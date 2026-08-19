#!/usr/bin/env python3
"""
Phase D gate: measure the update norm, then decide the clipping bound.

    python3 experiments/phase_d_preflight.py           # 3 rounds
    python3 experiments/phase_d_preflight.py --rounds 5

WHY THIS RUNS FIRST
-------------------
Table 3.6 specifies client-level DP as "C on the update; noise std sigma*C/N
with N = 15". It does not say what C is, and C decides the whole phase.

  C far ABOVE the true update norm - clipping never bites, so the signal keeps
      its natural size while the noise, which scales with C, grows without
      limit. The result measures the choice of C, not the mechanism.

  C far BELOW it - every update is scaled down hard, the signal shrinks toward
      C, and again the outcome is dominated by an arbitrary constant.

The honest choice is the median update norm, which is what McMahan et al. (2018)
use and what makes clipping bind on about half the clients. That cannot be
guessed; it has to be measured on this model, this partition and this learning
rate. So this script runs a few real rounds, records the per-client update norm,
and reports what C should be.

IT ALSO PRICES THE PHASE BEFORE IT RUNS. Under full participation every client
appears in every round, so client-level accounting gets NO subsampling
amplification at all - the sampling rate is 1.0. Over sixty rounds that forces
sigma up hard, and since the noise added to the mean is sigma*C/N, the script
can state the noise-to-signal ratio for each budget in advance. Section 3.8.3
declines to anticipate the outcome, and rightly; this is not an anticipation,
it is the arithmetic of the mechanism, and it is better known before eight runs
are committed than after.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from flcore.data import load_dataset
from flcore.partitioning import build_partition, partition_report
from flcore.models import build_model
from flcore.federated import fedavg_aggregate, local_train

SUBSAMPLE, SUBSAMPLE_TEST = 20000, 5000
NUM_CLIENTS, LOCAL_EPOCHS, LR, BATCH = 15, 2, 0.01, 64
ROUNDS_FULL, DELTA = 60, 1e-5
BUDGETS = (8, 4, 1)


def flat(d):
    return np.concatenate([v.ravel() for v in d.values() if v.dtype.kind == "f"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=3)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()

    print(f"Phase D pre-flight: {a.rounds} rounds, CIFAR-10, alpha=0.1, FedAvg\n")

    Xtr, ytr, Xte, yte = load_dataset("cifar10", seed=a.seed, subsample=SUBSAMPLE,
                                      subsample_test=SUBSAMPLE_TEST)
    parts = build_partition(ytr, {"kind": "dirichlet", "alpha": 0.1,
                                  "num_clients": NUM_CLIENTS, "seed": a.seed})
    rep = partition_report(ytr, parts)
    clients = [(Xtr[i], ytr[i]) for i in parts]
    print(f"partition: HD mean {rep['hellinger_mean']:.3f}, "
          f"sizes {min(rep['client_sizes'])}-{max(rep['client_sizes'])}\n")

    mcfg = {"backend": "torch_cnn", "width": 32, "batch_size": BATCH,
            "in_channels": 3, "img_size": 32, "seed": a.seed,
            "in_dim": Xtr.shape[1], "num_classes": int(ytr.max()) + 1}
    model = build_model(dict(mcfg))
    gp = model.get_params()

    all_norms = []
    print(f"{'round':>5s} {'min':>9s} {'median':>9s} {'mean':>9s} {'max':>9s} "
          f"{'aggregate':>10s}")
    for r in range(a.rounds):
        params, weights, norms = [], [], []
        for cid, (Xc, yc) in enumerate(clients):
            p = local_train(model, Xc, yc, gp, LOCAL_EPOCHS, LR,
                            seed=a.seed + 1000 * r + cid)
            delta = {k: p[k] - gp[k] for k in p if p[k].dtype.kind == "f"}
            norms.append(float(np.linalg.norm(flat(delta))))
            params.append(p)
            weights.append(len(yc))
        agg = fedavg_aggregate(params, weights)
        agg_delta = {k: agg[k] - gp[k] for k in agg if agg[k].dtype.kind == "f"}
        agg_norm = float(np.linalg.norm(flat(agg_delta)))
        gp = agg
        all_norms.extend(norms)
        print(f"{r+1:5d} {min(norms):9.4f} {np.median(norms):9.4f} "
              f"{np.mean(norms):9.4f} {max(norms):9.4f} {agg_norm:10.4f}")

    med = float(np.median(all_norms))
    print(f"\nmedian client update norm over {len(all_norms)} client-rounds: {med:.4f}")

    # --- what the accountant demands under full participation ------------
    from flcore.privacy import calibrate_noise_for_epsilon, accountant_epsilon

    print(f"\nclient-level accounting: sampling rate 1.0 (full participation), "
          f"{ROUNDS_FULL} rounds, delta={DELTA}")
    # COMPARE LIKE WITH LIKE. The noise is drawn independently for EACH of the
    # model's parameters at standard deviation sigma*C/N, so the noise VECTOR
    # has norm (sigma*C/N) * sqrt(P). Setting the per-coordinate deviation
    # beside a vector norm understates it by sqrt(P) - a factor of 435 on this
    # model - and an earlier version of this script did exactly that, reporting
    # 0.69x where the true figure is 300x (D82).
    n_params = int(sum(v.size for v in gp.values() if v.dtype.kind == "f"))
    root_p = math.sqrt(n_params)
    print(f"model has {n_params:,} parameters, so a noise vector's norm is its "
          f"per-coordinate std x {root_p:.1f}\n")
    print(f"{'eps':>4s} {'sigma':>9s} {'per-coord std':>14s} {'noise norm':>12s} "
          f"{'signal norm':>12s} {'ratio':>9s}")
    rows = []
    for e in BUDGETS:
        sig = calibrate_noise_for_epsilon(float(e), 1.0, ROUNDS_FULL, DELTA)
        got = accountant_epsilon(sig, 1.0, ROUNDS_FULL, DELTA)
        per_coord = sig * med / NUM_CLIENTS
        noise_norm = per_coord * root_p
        ratio = noise_norm / max(1e-12, agg_norm)
        rows.append({"epsilon": e, "sigma": round(sig, 4),
                     "realised_epsilon": round(got, 4),
                     "noise_std_per_coordinate": round(per_coord, 6),
                     "noise_vector_norm": round(noise_norm, 3),
                     "signal_norm": round(agg_norm, 5),
                     "noise_to_signal": round(ratio, 1)})
        print(f"{e:4d} {sig:9.3f} {per_coord:14.5f} {noise_norm:12.1f} "
              f"{agg_norm:12.4f} {ratio:8.0f}x")

    print(f"\nC is set to the median update norm, {med:.4f}, so clipping binds on")
    print("about half the clients - the choice McMahan et al. (2018) make.")
    print("\nThe last column is the ratio the phase turns on: the length of the")
    print("noise vector against the length of the aggregate it is added to.")
    print("This is the arithmetic of the mechanism at fifteen clients under full")
    print("participation, not a prediction of the result. Section 3.8.3 is right")
    print("not to anticipate the outcome, and the runs still have to be made.")

    out = {"median_update_norm": med, "recommended_C": med,
           "aggregate_update_norm": agg_norm, "rounds_sampled": a.rounds,
           "client_rounds": len(all_norms), "budgets": rows,
           "note": ("Measured on CIFAR-10 alpha=0.1 FedAvg at the Phase A regime. "
                    "C is the median client update norm. Noise on the mean is "
                    "sigma*C/N with N=15, and the accounting takes no subsampling "
                    "amplification because participation is full.")}
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dest = os.path.join(root, "results", "D_preflight")
    os.makedirs(dest, exist_ok=True)
    with open(os.path.join(dest, "update_norms.json"), "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nwritten -> results/D_preflight/update_norms.json")


if __name__ == "__main__":
    main()
