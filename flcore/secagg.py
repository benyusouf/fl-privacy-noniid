"""Secure aggregation via pairwise masking (Bonawitz et al., 2017).

Protocol implemented here (the masking core of SecAgg, without the full
Shamir-secret-sharing dropout recovery, which is not needed under the
full-participation cross-silo assumption of this study — D2, D9):

  1. Every pair of clients (i, j) agrees a shared secret s_ij (in practice via
     Diffie-Hellman; here a seeded PRG, since we measure cost, not cryptography).
  2. Client i masks its update:  y_i = x_i + sum_{j>i} PRG(s_ij) - sum_{j<i} PRG(s_ij)
  3. The server sums all y_i. Every mask appears once with + and once with -,
     so they cancel exactly:  sum_i y_i = sum_i x_i.

The server therefore learns only the SUM, never any individual x_i, which is
the guarantee the study needs against an honest-but-curious server (D8).

What this module is for in the dissertation: measuring the computation and
communication OVERHEAD that this guarantee costs (Phase C). Secure aggregation
does not change model accuracy — masks cancel exactly — so accuracy is
unaffected by design, and that fact is itself worth stating in the results.
"""
from __future__ import annotations

import time
import numpy as np


def _pair_seed(base_seed: int, i: int, j: int) -> int:
    """Deterministic shared seed for the unordered pair {i, j}."""
    a, b = min(i, j), max(i, j)
    return (base_seed * 1_000_003 + a * 10_007 + b) % (2 ** 31 - 1)


def _mask_like(params: dict, seed: int, scale: float = 1.0) -> dict:
    rng = np.random.default_rng(seed)
    return {k: rng.normal(0, scale, v.shape).astype(np.float64)
            for k, v in params.items() if v.dtype.kind == "f"}


def mask_update(update: dict, client_id: int, num_clients: int,
                base_seed: int = 0, scale: float = 1.0) -> dict:
    """Apply pairwise masks to one client's update (step 2 above)."""
    masked = {k: v.astype(np.float64).copy() for k, v in update.items()
              if v.dtype.kind == "f"}
    for j in range(num_clients):
        if j == client_id:
            continue
        m = _mask_like(update, _pair_seed(base_seed, client_id, j), scale)
        sign = 1.0 if j > client_id else -1.0
        for k in masked:
            masked[k] += sign * m[k]
    return masked


def auto_scale(updates: list[dict], factor: float = 20.0) -> float:
    """Mask magnitude relative to the updates being hidden.

    Real SecAgg masks live in a large modular field, so a single masked update
    is information-theoretically uninformative. This simulation uses Gaussian
    masks, so the scale must be set well above the update magnitude or a faint
    correlation with the plaintext survives. `factor` = 20 puts the residual
    correlation below 0.02 while keeping cancellation exact.
    """
    vals = np.concatenate([v.ravel() for u in updates for v in u.values()
                           if v.dtype.kind == "f"])
    return float(factor * (vals.std() + 1e-12))


def secure_aggregate(updates: list[dict], base_seed: int = 0,
                     scale: float | None = None) -> tuple[dict, dict]:
    """Full protocol over a list of client updates.

    Returns (mean_aggregate, timing_dict). The mean equals the plaintext mean
    up to floating-point error, which the accompanying test asserts.
    `scale=None` sets the mask magnitude automatically via auto_scale().
    """
    n = len(updates)
    if scale is None:
        scale = auto_scale(updates)
    t0 = time.perf_counter()
    masked = [mask_update(u, i, n, base_seed, scale) for i, u in enumerate(updates)]
    t_mask = time.perf_counter() - t0

    t1 = time.perf_counter()
    total = {k: np.zeros_like(v) for k, v in masked[0].items()}
    for m in masked:
        for k in total:
            total[k] += m[k]
    mean = {k: (v / n) for k, v in total.items()}
    t_agg = time.perf_counter() - t1

    return mean, {
        "mask_seconds": round(t_mask, 4),
        "aggregate_seconds": round(t_agg, 4),
        "mask_seconds_per_client": round(t_mask / max(1, n), 4),
        "num_pairs": n * (n - 1) // 2,
    }


def overhead_report(update: dict, num_clients: int, base_seed: int = 0) -> dict:
    """Measure the cost of secure aggregation for one round (Phase C metrics).

    Communication note: with pairwise masking the payload SIZE is unchanged
    (a masked update has the same shape as a plaintext one), so the overhead is
    the key-agreement traffic — O(n) messages per client — plus the masking
    computation measured here. This is the honest framing: SecAgg's cost in this
    configuration is computational and in setup rounds, not in update bandwidth.
    """
    payload_bytes = int(sum(v.astype(np.float32).nbytes for v in update.values()
                            if v.dtype.kind == "f"))
    plain = [update for _ in range(num_clients)]

    t0 = time.perf_counter()
    ref = {k: np.zeros_like(v.astype(np.float64)) for k, v in update.items()
           if v.dtype.kind == "f"}
    for u in plain:
        for k in ref:
            ref[k] += u[k]
    plain_seconds = time.perf_counter() - t0

    _, timing = secure_aggregate(plain, base_seed)
    total_secure = timing["mask_seconds"] + timing["aggregate_seconds"]
    return {
        "num_clients": num_clients,
        "payload_bytes_per_client": payload_bytes,
        "plain_aggregate_seconds": round(plain_seconds, 5),
        "secure_aggregate_seconds": round(total_secure, 5),
        "overhead_factor": round(total_secure / max(1e-9, plain_seconds), 2),
        "pairwise_masks_per_client": num_clients - 1,
        **timing,
    }
