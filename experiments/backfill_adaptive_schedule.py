#!/usr/bin/env python3
"""
Write the per-client noise SCHEDULE into every time-adaptive result directory.

    python3 experiments/backfill_adaptive_schedule.py            # write
    python3 experiments/backfill_adaptive_schedule.py --check    # verify only

WHY THIS EXISTS
---------------
run_federated calibrates the schedule's scale per client against the accountant
and PRINTS the result. Printing was all it did, and only four of the fifteen
clients were printed at that. Nothing in the result directory recorded the
sequence of noise levels a run actually used.

That gap had a consequence. verify_phase_d.py could not read the schedule, so
it reconstructed one - and reconstructed it by the OLD proxy normalisation the
run no longer uses. It therefore reported the realised epsilon of a schedule
nobody ran, failed the corrected runs, and would have gone on failing them
however many times they were repeated. The numbers it printed after the D87
re-run were identical to the ones it printed before, which is the tell: a check
whose verdict does not move when the thing it checks moves is not reading it.

Section 3.8.4 makes the realised epsilon a precondition for reporting any
adaptive figure, so the sequence has to be on disk, not in a print statement.

NOTHING NEEDS RE-RUNNING. The schedule is a deterministic function of what the
directory already holds:

    shape_t   = adaptive_noise_schedule(rounds, 1.0, mode, strength)
    q_c       = batch_size / n_c            n_c from partition_report.json
    spr_c     = ceil(n_c / batch_size) * local_epochs
    sigma_c,t = shape_t * (the scale at which the accountant returns target eps)

THE RECONSTRUCTION IS TIED TO THE TRANSCRIPT, NOT TRUSTED ON ITS OWN. Rebuilding
a schedule with the same function the run used would prove only that the
function is deterministic. So every reconstruction is checked against run.log,
which recorded the sigma range and realised epsilon for clients 0, 1, 2 and 14
as the run happened. If the reconstruction disagrees with the transcript, this
script fails and writes nothing. The transcript is the evidence; this file is
the transcript made machine-readable and extended to the other eleven clients.

Writes dp_schedule.json into each adaptive run directory:

    {"target_epsilon": 8.0, "delta": 1e-05, "mode": "decreasing",
     "strength": 0.5, "rounds": 60, "batch_size": 64, "local_epochs": 2,
     "shape": [1.226, ..., 0.817],
     "clients": [{"client": 0, "n": 1837, "q": 0.0348, "steps_per_round": 58,
                  "sigma": [...60 values...], "sigma_min": 2.207,
                  "sigma_max": 3.310, "realised_epsilon": 7.9973}, ...],
     "epsilon_worst": 7.9973, "deviation_worst": 0.0027,
     "verified_against_run_log": [0, 1, 2, 14]}
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
RESULTS = os.path.join(HERE, "results")
BUDGETS = (1, 4, 8)

# "      client  0: sigma 2.207-3.310 -> realised eps=7.9973 against a target of 8.0"
LOGLINE = re.compile(
    r"client\s+(\d+):\s+sigma\s+([\d.]+)-([\d.]+)\s+->\s+realised eps=([\d.]+)")
# Tolerances are the print precision of the transcript, not a fudge factor:
# run.log rounds sigma to 3 decimals and epsilon to 4.
SIGMA_TOL, EPS_TOL = 5e-4, 5e-5


def transcript(run_dir):
    """What the run itself recorded, per client, as it happened."""
    path = os.path.join(run_dir, "run.log")
    if not os.path.exists(path):
        return {}
    out = {}
    for line in open(path, errors="replace"):
        m = LOGLINE.search(line)
        if m:
            out[int(m.group(1))] = (float(m.group(2)), float(m.group(3)),
                                    float(m.group(4)))
    return out


def rebuild(run_dir):
    from flcore.privacy import (adaptive_noise_schedule,
                                calibrate_schedule_for_epsilon,
                                epsilon_of_schedule)

    cfg = json.load(open(os.path.join(run_dir, "config_used.json")))
    rep = json.load(open(os.path.join(run_dir, "partition_report.json")))
    dp = cfg["dp"]
    target = float(dp["target_epsilon"])
    delta = float(dp.get("delta", 1e-5))
    mode = str(dp["schedule"])
    strength = float(dp.get("schedule_strength", 0.5))
    rounds = int(cfg["rounds"])
    bs = int(cfg["model"]["batch_size"])
    le = int(cfg["local_epochs"])

    shape = adaptive_noise_schedule(rounds, 1.0, mode=mode, strength=strength)

    clients, worst_eps, worst_dev = [], None, 0.0
    for cid, n_c in enumerate(rep["client_sizes"]):
        q = min(1.0, bs / max(1, n_c))
        spr = int(math.ceil(n_c / bs)) * le
        seq = calibrate_schedule_for_epsilon(target, shape, q, spr, delta)
        real = epsilon_of_schedule(seq, q, spr, delta)
        if abs(real - target) > worst_dev:
            worst_dev, worst_eps = abs(real - target), real
        clients.append({"client": cid, "n": int(n_c), "q": round(q, 6),
                        "steps_per_round": spr,
                        "sigma": [round(s, 6) for s in seq],
                        "sigma_min": round(min(seq), 6),
                        "sigma_max": round(max(seq), 6),
                        "realised_epsilon": round(real, 6)})

    return {"target_epsilon": target, "delta": delta, "mode": mode,
            "strength": strength, "rounds": rounds, "batch_size": bs,
            "local_epochs": le,
            "shape": [round(s, 6) for s in shape],
            "clients": clients,
            "epsilon_worst": round(worst_eps, 6),
            "deviation_worst": round(worst_dev, 6),
            "note": ("Reconstructed from config_used.json and "
                     "partition_report.json, then checked against the sigma "
                     "range and realised epsilon run.log recorded for the "
                     "clients it printed. Scale set by the accountant, not by "
                     "the sum(1/sigma^2) proxy (D87, D88).")}


def cross_check(data, log):
    """The reconstruction must agree with what the run printed at the time."""
    problems, checked = [], []
    by_id = {c["client"]: c for c in data["clients"]}
    for cid, (lo, hi, eps) in sorted(log.items()):
        c = by_id.get(cid)
        if c is None:
            problems.append(f"client {cid} is in run.log but not in the partition")
            continue
        for label, got, want, tol in (("sigma_min", c["sigma_min"], lo, SIGMA_TOL),
                                      ("sigma_max", c["sigma_max"], hi, SIGMA_TOL),
                                      ("realised_epsilon", c["realised_epsilon"],
                                       eps, EPS_TOL)):
            if abs(got - want) > tol:
                problems.append(f"client {cid} {label}: rebuilt {got:.6f}, "
                                f"run.log recorded {want:.6f}")
        checked.append(cid)
    if not checked:
        problems.append("run.log records no per-client schedule lines; there is "
                        "nothing to check the reconstruction against")
    return problems, checked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="verify against run.log, write nothing")
    a = ap.parse_args()

    names = [f"D_cifar10_fedavg_dir0.1_adaptive_eps{e}_s0" for e in BUDGETS]
    ok = True
    for n in names:
        d = os.path.join(RESULTS, n)
        if not os.path.isdir(d):
            print(f"MISSING  {n}")
            ok = False
            continue

        data = rebuild(d)
        log = transcript(d)
        problems, checked = cross_check(data, log)

        short = n.replace("D_cifar10_fedavg_dir0.1_", "")
        if problems:
            ok = False
            print(f"FAIL  {short}")
            for p in problems:
                print(f"        {p}")
            continue

        data["verified_against_run_log"] = checked
        if not a.check:
            with open(os.path.join(d, "dp_schedule.json"), "w") as f:
                json.dump(data, f, indent=2)
        sig = [c for c in data["clients"]]
        print(f"ok    {short:18s} eps worst {data['epsilon_worst']:.4f} "
              f"(deviation {data['deviation_worst']:.4f}), sigma "
              f"{min(c['sigma_min'] for c in sig):.3f}-"
              f"{max(c['sigma_max'] for c in sig):.3f} over "
              f"{len(sig)} clients, agrees with run.log on clients "
              f"{', '.join(str(c) for c in checked)}")

    print("\nPASS" if ok else "\nFAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
