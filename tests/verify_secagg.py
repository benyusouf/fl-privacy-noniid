#!/usr/bin/env python3
"""
Verify the secure-aggregation implementation, and report the figures that
Section 3.8.5 quotes.

    python3 tests/verify_secagg.py

WHY THIS FILE EXISTS
--------------------
Section 3.8.5 states two measured properties: that across twenty seeds the
masked sum reproduces the plaintext sum to within 1e-14, and that the mean
absolute correlation between a masked update and its plaintext is 0.019.
Section 3.11 says those checks live in tests/. They did not - nothing in tests/
touched secagg.py. A chapter that claims a verification the repository does not
contain is a reproducibility gap, and this closes it.

FOUR CHECKS
  1. exactness, weighted    the aggregate equals the weighted mean FedAvg computes
  2. exactness, unweighted  the plain mean case, for completeness
  3. leakage                correlation between a masked update and its plaintext
  4. weighting is required  demonstrates the error if weights were ignored

Check 4 is not a property of the protocol. It is a regression guard: an earlier
version of secure_aggregate returned an unweighted mean, and wiring that into a
FedAvg round would have altered every result while appearing to work.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from flcore.secagg import auto_scale, mask_update, secure_aggregate

SEEDS = 20
CLIENTS = 15
SHAPE = (64, 32)


def make(seed):
    r = np.random.default_rng(seed)
    updates = [{"w": r.normal(0, 0.1, SHAPE).astype(np.float32),
                "b": r.normal(0, 0.1, (SHAPE[0],)).astype(np.float32)}
               for _ in range(CLIENTS)]
    weights = [int(x) for x in r.integers(88, 3591, CLIENTS)]
    return updates, weights


def reference(updates, weights=None):
    """The aggregate computed in the clear, in float64 so the comparison
    measures the masking and not float32 rounding in the reference itself."""
    n = len(updates)
    w = weights or [1] * n
    tw = float(sum(w))
    keys = [k for k in updates[0] if updates[0][k].dtype.kind == "f"]
    return {k: sum((wi / tw) * u[k].astype(np.float64)
                   for u, wi in zip(updates, w)) for k in keys}


def main():
    print(f"secure aggregation: {SEEDS} seeds, {CLIENTS} clients\n")

    weighted, unweighted, corrs = [], [], []

    for seed in range(SEEDS):
        updates, weights = make(seed)

        agg, _ = secure_aggregate(updates, base_seed=seed, weights=weights)
        ref = reference(updates, weights)
        weighted.append(max(float(np.abs(ref[k] - agg[k]).max()) for k in ref))

        agg_u, _ = secure_aggregate(updates, base_seed=seed)
        ref_u = reference(updates)
        unweighted.append(max(float(np.abs(ref_u[k] - agg_u[k]).max()) for k in ref_u))

        # Leakage: how much of a single client's plaintext survives in its
        # masked update. Real SecAgg masks live in a modular field and leak
        # nothing; Gaussian masks in floating point leave a faint residue.
        scale = auto_scale(updates)
        for cid in range(CLIENTS):
            m = mask_update(updates[cid], cid, CLIENTS, seed, scale)
            a = np.concatenate([updates[cid][k].astype(np.float64).ravel()
                                for k in m])
            b = np.concatenate([m[k].ravel() for k in m])
            corrs.append(abs(float(np.corrcoef(a, b)[0, 1])))

    print("1. exactness, weighted (the case FedAvg actually uses)")
    print(f"     max {max(weighted):.3e}   mean {np.mean(weighted):.3e}")
    print("2. exactness, unweighted")
    print(f"     max {max(unweighted):.3e}   mean {np.mean(unweighted):.3e}")
    print("3. leakage: |correlation| between a masked update and its plaintext")
    print(f"     mean {np.mean(corrs):.4f}   max {max(corrs):.4f}   "
          f"n={len(corrs)} client-rounds")

    updates, weights = make(0)
    ref = reference(updates, weights)
    agg_u, _ = secure_aggregate(updates, base_seed=0)          # weights ignored
    wrong = max(float(np.abs(ref[k] - agg_u[k]).max()) for k in ref)
    print("4. weighting is required, not optional")
    print(f"     ignoring weights misses the FedAvg aggregate by {wrong:.3e}")
    print(f"     which is {wrong / max(max(weighted), 1e-18):.0f}x the masking error")

    print("\n" + "=" * 68)
    print("FIGURES FOR SECTION 3.8.5, AS MEASURED NOW")
    print(f"  exactness   within {max(weighted):.1e}")
    print(f"  correlation mean {np.mean(corrs):.3f}")
    print("=" * 68)

    ok = max(weighted) < 1e-12 and np.mean(corrs) < 0.02
    print("\nPASS" if ok else "\nFAIL")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
