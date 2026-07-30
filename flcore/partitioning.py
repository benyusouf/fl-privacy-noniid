"""Non-IID data partitioning for cross-silo FL simulation.

Implements the three partition families agreed in the research plan (analysis.docx D1):
  - Dirichlet label skew  (Hsu et al., 2019)        -> dirichlet_partition
  - Pathological k-class  (Zhao et al., 2018)       -> pathological_partition
  - Quantity skew                                    -> quantity_skew_partition

plus Hellinger distance (Jimenez-Gutierrez et al., 2025) to quantify how
non-IID a given partition actually is.

All functions are pure NumPy (no torch dependency) and deterministic given `seed`.
Each returns: list of index arrays, one per client.
"""
from __future__ import annotations

import numpy as np


def _check(labels: np.ndarray, num_clients: int) -> None:
    if labels.ndim != 1:
        raise ValueError("labels must be a 1-D array of integer class labels")
    if num_clients < 2:
        raise ValueError("need at least 2 clients")


def iid_partition(labels: np.ndarray, num_clients: int, seed: int = 0) -> list[np.ndarray]:
    """Uniform random split - the IID reference point."""
    _check(labels, num_clients)
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(labels))
    return [np.sort(part) for part in np.array_split(idx, num_clients)]


def dirichlet_partition(
    labels: np.ndarray,
    num_clients: int,
    alpha: float,
    seed: int = 0,
    min_samples: int = 10,
) -> list[np.ndarray]:
    """Label-skew partition via Dirichlet(alpha) (Hsu et al., 2019).

    For each class c, sample p ~ Dir(alpha) over clients and allocate the
    class's samples proportionally. Small alpha (e.g. 0.1) -> severe skew;
    large alpha (e.g. 100) -> near-IID. Re-samples (new sub-seed) until every
    client has at least `min_samples`, so no silo is empty.
    """
    _check(labels, num_clients)
    classes = np.unique(labels)
    for attempt in range(100):
        rng = np.random.default_rng(seed + attempt * 1_000_003)
        client_idx: list[list[int]] = [[] for _ in range(num_clients)]
        for c in classes:
            c_idx = np.where(labels == c)[0]
            rng.shuffle(c_idx)
            p = rng.dirichlet(np.full(num_clients, alpha))
            cuts = (np.cumsum(p)[:-1] * len(c_idx)).astype(int)
            for client, part in enumerate(np.split(c_idx, cuts)):
                client_idx[client].extend(part.tolist())
        if min(len(ci) for ci in client_idx) >= min_samples:
            return [np.sort(np.array(ci)) for ci in client_idx]
    raise RuntimeError(
        f"could not satisfy min_samples={min_samples} after 100 attempts "
        f"(alpha={alpha}, num_clients={num_clients})"
    )


def pathological_partition(
    labels: np.ndarray,
    num_clients: int,
    classes_per_client: int,
    seed: int = 0,
) -> list[np.ndarray]:
    """Extreme label skew: each client sees only k classes (Zhao et al., 2018;
    McMahan et al., 2017 use k=2). k=1 reproduces Zhao's worst case.

    Data of each class is split into shards; each client receives
    `classes_per_client` shards of distinct classes (round-robin assignment
    so every class is covered as evenly as possible).
    """
    _check(labels, num_clients)
    classes = np.unique(labels)
    k = classes_per_client
    if k < 1 or k > len(classes):
        raise ValueError(f"classes_per_client must be in [1, {len(classes)}]")
    rng = np.random.default_rng(seed)

    total_shards = num_clients * k
    shards_per_class = np.full(len(classes), total_shards // len(classes))
    shards_per_class[: total_shards % len(classes)] += 1  # distribute remainder

    # build shard pool: (class, index-array) pieces
    pool: list[tuple[int, np.ndarray]] = []
    for ci, c in enumerate(classes):
        c_idx = np.where(labels == c)[0]
        rng.shuffle(c_idx)
        for part in np.array_split(c_idx, max(1, shards_per_class[ci])):
            pool.append((int(c), part))
    rng.shuffle(pool)

    client_idx: list[list[int]] = [[] for _ in range(num_clients)]
    client_classes: list[set[int]] = [set() for _ in range(num_clients)]
    # greedy: give each shard to the least-loaded client that lacks the class
    # (or has it already but still needs shards), respecting k distinct classes
    for c, part in sorted(pool, key=lambda s: -len(s[1])):
        order = sorted(
            range(num_clients),
            key=lambda cl: (len(client_idx[cl]), c not in client_classes[cl]),
        )
        placed = False
        for cl in order:
            if c in client_classes[cl] or len(client_classes[cl]) < k:
                client_idx[cl].extend(part.tolist())
                client_classes[cl].add(c)
                placed = True
                break
        if not placed:  # everyone full with other classes: give to smallest
            cl = min(range(num_clients), key=lambda cl: len(client_idx[cl]))
            client_idx[cl].extend(part.tolist())
            client_classes[cl].add(c)
    return [np.sort(np.array(ci)) for ci in client_idx]


def quantity_skew_partition(
    labels: np.ndarray,
    num_clients: int,
    beta: float,
    seed: int = 0,
    min_samples: int = 10,
) -> list[np.ndarray]:
    """Quantity skew: class distribution stays IID but client dataset SIZES
    follow Dir(beta). Small beta -> a few data-rich silos, many data-poor ones.

    Every client is guaranteed `min_samples` by construction: the floor is
    allocated first, and only the remainder is distributed by Dir(beta).
    """
    _check(labels, num_clients)
    if min_samples * num_clients > len(labels):
        raise ValueError("min_samples * num_clients exceeds dataset size")
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(labels))
    remainder = len(idx) - min_samples * num_clients
    p = rng.dirichlet(np.full(num_clients, beta))
    sizes = min_samples + np.floor(p * remainder).astype(int)
    # hand out the few samples lost to flooring, largest shares first
    for i in np.argsort(-p)[: len(idx) - sizes.sum()]:
        sizes[i] += 1
    cuts = np.cumsum(sizes)[:-1]
    return [np.sort(part) for part in np.split(idx, cuts)]


# ---------------------------------------------------------------- metrics ----

def label_distribution(labels: np.ndarray, client_idx: list[np.ndarray],
                       num_classes: int | None = None) -> np.ndarray:
    """(num_clients, num_classes) matrix of per-client class proportions."""
    if num_classes is None:
        num_classes = int(labels.max()) + 1
    dist = np.zeros((len(client_idx), num_classes))
    for i, ci in enumerate(client_idx):
        counts = np.bincount(labels[ci], minlength=num_classes)
        dist[i] = counts / max(1, counts.sum())
    return dist


def hellinger_distance(client_dist: np.ndarray, global_dist: np.ndarray) -> np.ndarray:
    """Hellinger distance of each client's label distribution from the global one.

    HD(p, q) = (1/sqrt(2)) * ||sqrt(p) - sqrt(q)||_2   in [0, 1].
    Used by Jimenez-Gutierrez et al. (2025), who report performance thresholds
    at HD > 0.5 and HD > 0.75.
    """
    diff = np.sqrt(client_dist) - np.sqrt(global_dist)[None, :]
    return np.linalg.norm(diff, axis=1) / np.sqrt(2.0)


def partition_report(labels: np.ndarray, client_idx: list[np.ndarray]) -> dict:
    """Summary dict: sizes, per-client HD, mean/max HD - saved with every run."""
    num_classes = int(labels.max()) + 1
    dist = label_distribution(labels, client_idx, num_classes)
    global_dist = np.bincount(labels, minlength=num_classes) / len(labels)
    hd = hellinger_distance(dist, global_dist)
    return {
        "client_sizes": [int(len(ci)) for ci in client_idx],
        "hellinger_per_client": [round(float(h), 4) for h in hd],
        "hellinger_mean": round(float(hd.mean()), 4),
        "hellinger_max": round(float(hd.max()), 4),
        "classes_per_client": [int((dist[i] > 0).sum()) for i in range(len(client_idx))],
    }


def build_partition(labels: np.ndarray, cfg: dict) -> list[np.ndarray]:
    """Config-driven dispatch, e.g. {kind: dirichlet, alpha: 0.1, num_clients: 15, seed: 0}."""
    kind = cfg["kind"]
    n, seed = cfg["num_clients"], cfg.get("seed", 0)
    if kind == "iid":
        return iid_partition(labels, n, seed)
    if kind == "dirichlet":
        return dirichlet_partition(labels, n, cfg["alpha"], seed)
    if kind == "pathological":
        return pathological_partition(labels, n, cfg["classes_per_client"], seed)
    if kind == "quantity":
        return quantity_skew_partition(labels, n, cfg["beta"], seed)
    raise ValueError(f"unknown partition kind: {kind}")
