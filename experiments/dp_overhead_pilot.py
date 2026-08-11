#!/usr/bin/env python3
"""
Phase B gate: measure the DP-SGD overhead factor before committing 35 more runs.

Chapter 3, Section 3.10.2 puts an assumed threefold overhead behind the Phase B
compute estimate and requires that the factor be measured on a pilot first,
because "an overhead of four times instead of three would make this phase alone
larger than every other phase combined".

WHAT IS MEASURED, AND WHY IT IS NOT WALL CLOCK
----------------------------------------------
Table 3.8 defines the overhead ratio in PROCESSOR time, and this script uses
time.process_time(), which counts CPU time consumed by this process and does
not advance while the machine sleeps. That is what makes the number reportable:
across 68 timed Phase A runs, wall clock varied by up to 17.9x between identical
configurations purely because system sleep was being counted as compute (D44).
Processor time is immune to that. Wall clock is printed too, but only so the
gap between the two is visible; do not report it.

Both arms run in one process, on the same partition and the same seed, so the
only difference between them is the mechanism.

    python3 experiments/dp_overhead_pilot.py            # 3 rounds each
    python3 experiments/dp_overhead_pilot.py --rounds 5
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from flcore.data import load_dataset
from flcore.partitioning import build_partition, partition_report
from flcore.models import build_model
from flcore.federated import run_federated

# Held identical to Phase A so the ratio means what it claims to mean.
SUBSAMPLE, SUBSAMPLE_TEST = 20000, 5000
NUM_CLIENTS, LOCAL_EPOCHS, LR, BATCH = 15, 2, 0.01, 64
FULL_ROUNDS = 60          # rounds in a real Phase A / Phase B run
PHASE_B_RUNS = 36


def timed(label, fn):
    p0, w0 = time.process_time(), time.monotonic()
    out = fn()
    p1, w1 = time.process_time(), time.monotonic()
    print(f"  {label:22s} processor {p1-p0:8.1f}s   wall {w1-w0:8.1f}s")
    return out, p1 - p0, w1 - w0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=3)
    ap.add_argument("--epsilon", type=float, default=4.0)
    ap.add_argument("--alpha", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--strategy", default="fedavg")
    a = ap.parse_args()

    print(f"DP overhead pilot: {a.strategy}, dirichlet alpha={a.alpha}, "
          f"seed={a.seed}, {a.rounds} rounds per arm, target eps={a.epsilon}\n")

    Xtr, ytr, Xte, yte = load_dataset("cifar10", seed=a.seed,
                                      subsample=SUBSAMPLE,
                                      subsample_test=SUBSAMPLE_TEST)
    parts = build_partition(ytr, {"kind": "dirichlet", "alpha": a.alpha,
                                  "num_clients": NUM_CLIENTS, "seed": a.seed})
    rep = partition_report(ytr, parts)
    print(f"partition: HD mean={rep['hellinger_mean']:.3f} "
          f"sizes [{min(rep['client_sizes'])}, {max(rep['client_sizes'])}]\n")
    clients = [(Xtr[i], ytr[i]) for i in parts]

    mcfg = {"backend": "torch_cnn", "width": 32, "batch_size": BATCH,
            "in_channels": 3, "img_size": 32, "seed": a.seed,
            "in_dim": Xtr.shape[1], "num_classes": int(ytr.max()) + 1}

    def arm(dp):
        model = build_model(dict(mcfg))
        return run_federated(
            model, clients, (Xte, yte), rounds=a.rounds,
            local_epochs=LOCAL_EPOCHS, lr=LR, seed=a.seed,
            strategy=a.strategy, dp_cfg=dp)

    print("PLAIN arm")
    (_, h_plain), p_plain, w_plain = timed("plain", lambda: arm(None))
    print("\nDP arm")
    dp = {"target_epsilon": a.epsilon, "delta": 1e-5, "max_grad_norm": 1.0}
    (_, h_dp), p_dp, w_dp = timed("dp-sgd", lambda: arm(dp))

    ratio = p_dp / max(1e-9, p_plain)
    per_round_plain = p_plain / a.rounds
    per_round_dp = p_dp / a.rounds
    projected_h = PHASE_B_RUNS * FULL_ROUNDS * per_round_dp / 3600.0

    print("\n" + "=" * 62)
    print(f"OVERHEAD RATIO (processor time)      {ratio:.2f}x")
    print(f"  assumed in Section 3.10.2          3.00x")
    print(f"  per round, plain                   {per_round_plain:.1f}s")
    print(f"  per round, DP                      {per_round_dp:.1f}s")
    print(f"  projected Phase B, 36 x 60 rounds  {projected_h:.1f} processor-hours")
    print("=" * 62)
    if ratio > 3.5:
        print("\nABOVE THE ASSUMPTION. Section 3.10.2 says a factor of four would make "
              "\nthis phase larger than every other phase combined. Do not launch the "
              "\nremaining 35 runs until the matrix has been revisited.")
    elif ratio > 3.0:
        print("\nSlightly above the assumption. Phase B is affordable but the estimate "
              "\nin Section 3.10.2 needs correcting to the measured figure.")
    else:
        print("\nAt or below the assumption. Phase B can be launched as specified.")

    print("\naccuracy after the pilot rounds (not a result, only a sanity check):")
    print(f"  plain  {h_plain[-1]['test_acc']:.4f}")
    print(f"  dp     {h_dp[-1]['test_acc']:.4f}")
    if h_dp[-1]["test_acc"] < 0.11:
        print("  WARNING: DP accuracy is at or below the ten-class chance line. "
              "Check the calibrated sigma before trusting the timing.")

    out = {
        "measured_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "strategy": a.strategy, "alpha": a.alpha, "seed": a.seed,
        "rounds_per_arm": a.rounds, "target_epsilon": a.epsilon,
        "processor_seconds": {"plain": p_plain, "dp": p_dp},
        "wall_seconds": {"plain": w_plain, "dp": w_dp},
        "per_round_processor_seconds": {"plain": per_round_plain, "dp": per_round_dp},
        "overhead_ratio": ratio,
        "assumed_ratio": 3.0,
        "projected_phase_b_processor_hours": projected_h,
        "final_test_acc": {"plain": h_plain[-1]["test_acc"], "dp": h_dp[-1]["test_acc"]},
    }
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dest = os.path.join(root, "results", "B_pilot_dp_overhead")
    os.makedirs(dest, exist_ok=True)
    with open(os.path.join(dest, "overhead.json"), "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nwritten -> results/B_pilot_dp_overhead/overhead.json")


if __name__ == "__main__":
    main()
