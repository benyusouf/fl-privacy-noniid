"""Sanity demonstration: federated convergence slows as non-IID severity
(Hellinger distance) rises - the weight-divergence effect of Zhao et al. (2018).

Uses the dependency-free NumPy backend so it runs anywhere in seconds:
    python tests/test_convergence_vs_heterogeneity.py

This is a PLUMBING + PHENOMENON check, not a headline result. On separable
synthetic data all settings eventually reach high accuracy; the signal is the
early-round accuracy gap, which widens with HD. The real accuracy gaps come
from the non-separable image datasets (CIFAR-10, PathMNIST) on the main runs.
"""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flcore.models import NumpyMLP
from flcore.partitioning import (
    iid_partition, dirichlet_partition, pathological_partition, partition_report)
from flcore.federated import run_federated


def _data(seed=1, K=10, dim=64, n_tr=6000, n_te=1000):
    rng = np.random.default_rng(seed)
    centers = rng.normal(0, 1.2, (K, dim))

    def make(n):
        y = rng.integers(0, K, n)
        X = centers[y] + rng.normal(0, 1.0, (n, dim))
        return X.astype(np.float32), y.astype(np.int64)

    Xtr, ytr = make(n_tr)
    Xte, yte = make(n_te)
    mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-6
    return (Xtr - mu) / sd, ytr, (Xte - mu) / sd, yte


def _run(Xtr, ytr, Xte, yte, parts, K, dim):
    model = NumpyMLP(dim, 64, K, seed=0)
    ct = [(Xtr[i], ytr[i]) for i in parts]
    _, hist = run_federated(model, ct, (Xte, yte), rounds=20,
                            local_epochs=3, lr=0.05, seed=0)
    hd = partition_report(ytr, parts)["hellinger_mean"]
    return hd, hist[4]["test_acc"], hist[-1]["test_acc"]


def main():
    Xtr, ytr, Xte, yte = _data()
    K, dim = 10, 64
    settings = [
        ("IID", iid_partition(ytr, 15, 0)),
        ("Dirichlet a=1.0", dirichlet_partition(ytr, 15, 1.0, 0)),
        ("Dirichlet a=0.1", dirichlet_partition(ytr, 15, 0.1, 0)),
        ("Pathological-1class", pathological_partition(ytr, 15, 1, 0)),
    ]
    results = []
    print(f"{'setting':22s} {'HD':>5s} {'acc@5':>7s} {'acc@20':>7s}")
    for name, parts in settings:
        hd, a5, a20 = _run(Xtr, ytr, Xte, yte, parts, K, dim)
        results.append((hd, a5))
        print(f"{name:22s} {hd:5.3f} {a5:7.3f} {a20:7.3f}")

    # assertion: early-round accuracy is monotonically non-increasing in HD
    hds = [r[0] for r in results]
    a5s = [r[1] for r in results]
    assert hds == sorted(hds), "HD not ordered as expected"
    assert a5s[0] >= a5s[-1] - 1e-9, "expected IID to converge no slower than extreme skew"
    assert a5s[-1] < a5s[0], "expected extreme skew to be slower at round 5"
    print("\nPASS: convergence slows monotonically with heterogeneity.")


if __name__ == "__main__":
    main()
