#!/usr/bin/env python3
"""
Write the per-client DP calibration into every Phase B result directory.

    python3 experiments/backfill_dp_calibration.py            # all B runs
    python3 experiments/backfill_dp_calibration.py --check    # verify, write nothing

WHY THIS EXISTS
---------------
run_federated prints each client's calibrated sigma and realised epsilon at the
start of a DP run, and printing was all it did. Nothing in the result directory
records them. That leaves a run labelled "eps=4" with no evidence that each of
its fifteen clients actually spent epsilon = 4, which is the one claim a Phase B
run exists to make. D58 also makes the per-client sigma table a result in its
own right, because sigma varies with client size and the smallest silos carry
the most noise.

Nothing needs re-running. The calibration is a deterministic function of
quantities the directory already holds:

    q_c     = batch_size / n_c                    n_c from partition_report.json
    steps_c = ceil(n_c / batch_size) * local_epochs * rounds
    sigma_c = the sigma that spends target_epsilon at (q_c, steps_c, delta)

so this script reconstructs exactly what the run used, and --check re-derives
epsilon from the reconstructed sigma to prove the inversion held.

Writes dp_calibration.json into each run directory:

    {"target_epsilon": 4.0, "delta": 1e-05, "max_grad_norm": 1.0,
     "batch_size": 64, "local_epochs": 2, "rounds": 60,
     "clients": [{"client": 0, "n": 1837, "q": 0.0348, "steps": 1740,
                  "sigma": 0.8123, "realised_epsilon": 3.998}, ...],
     "sigma_min": ..., "sigma_max": ..., "epsilon_max": ...}
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RESULTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "results")


def calibrate(run_dir, check_only=False):
    cfg = json.load(open(os.path.join(run_dir, "config_used.json")))
    dp = cfg.get("dp")
    if not dp or not dp.get("enabled", True):
        return None
    rep = json.load(open(os.path.join(run_dir, "partition_report.json")))

    from flcore.privacy import calibrate_noise_for_epsilon, accountant_epsilon

    target = float(dp["target_epsilon"])
    delta = float(dp.get("delta", 1e-5))
    bs = int(cfg["model"]["batch_size"])
    le = int(cfg["local_epochs"])
    rounds = int(cfg["rounds"])

    clients, worst = [], 0.0
    for cid, n_c in enumerate(rep["client_sizes"]):
        q = min(1.0, bs / max(1, n_c))
        steps = int(math.ceil(n_c / bs)) * le * rounds
        # Every live run now used the expanding ceiling: 32 were never affected
        # by the old cap of 30, and the four dir0.1 eps=1 cells that were have
        # been re-run (D69). The capped versions are archived alongside as
        # *.sigma30-<timestamp> and are not read here.
        sigma_as_run = calibrate_noise_for_epsilon(target, q, steps, delta)
        eps = accountant_epsilon(sigma_as_run, q, steps, delta)
        # would the retired ceiling have been able to deliver this budget?
        saturated = False
        sigma_needed = None
        if sigma_as_run > 30.0:
            saturated = True          # historical note only, not a defect now
            sigma_needed = round(sigma_as_run, 6)
        worst = max(worst, abs(eps - target))
        clients.append({"client": cid, "n": int(n_c), "q": round(q, 6),
                        "steps": steps, "sigma": round(sigma_as_run, 6),
                        "realised_epsilon": round(eps, 4),
                        "saturated": saturated,
                        "sigma_needed_for_target": sigma_needed})

    sigmas = [c["sigma"] for c in clients]
    sat = [c for c in clients if c["saturated"]]
    # "saturated" now means only that the retired ceiling of 30 would not have
    # sufficed, which is a fact about the old code, not a defect in this run.
    run_eps = max(c["realised_epsilon"] for c in clients)
    out = {
        "target_epsilon": target, "delta": delta,
        "max_grad_norm": float(dp.get("max_grad_norm", 1.0)),
        "batch_size": bs, "local_epochs": le, "rounds": rounds,
        "granularity": "sample-level",
        "clients": clients,
        "sigma_min": min(sigmas), "sigma_max": max(sigmas),
        "sigma_ratio": max(sigmas) / min(sigmas),
        "epsilon_max_abs_error": round(worst, 5),
        # The guarantee a run can claim is the WORST client's, not the label on
        # the directory. Where no client saturated the two coincide.
        "epsilon_run_level": run_eps,
        "label_honoured": worst <= 0.05,
        "exceeds_retired_ceiling": [c["client"] for c in sat],
        "note": ("Reconstructed from config_used.json and partition_report.json, "
                 "not logged at run time. The calibration is deterministic in "
                 "(client size, batch size, local epochs, rounds, target epsilon, "
                 "delta), so these are the values the run used. The ceiling on "
                 "the noise search now expands until it brackets the target, so "
                 "no client is silently capped. See D58, D63, D69."),
    }
    if not check_only:
        with open(os.path.join(run_dir, "dp_calibration.json"), "w") as f:
            json.dump(out, f, indent=2)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="verify the inversion, write nothing")
    a = ap.parse_args()

    # Live runs only. Superseded copies carry a suffix AFTER the seed -
    # .sigma30-<stamp> from the D69 re-run, .pre-D49 and .d50-twostage from
    # earlier decisions - and must not be recalibrated or counted.
    #
    # The test is anchored on the seed, not on a bare dot: partition names
    # contain dots too (dir0.1, dir1.0), and a naive "no dot" filter silently
    # drops two thirds of the phase.
    import re as _re
    runs = sorted(d for d in os.listdir(RESULTS)
                  if d.startswith("B_cifar10_")
                  and not _re.search(r"_s\d+\.", d)
                  and os.path.isdir(os.path.join(RESULTS, d)))
    if not runs:
        sys.exit("no Phase B runs found")

    print(f"{len(runs)} Phase B runs\n")
    print(f"{'run':44s} {'eps':>4s} {'sigma min':>10s} {'sigma max':>10s} "
          f"{'ratio':>6s} {'max |eps err|':>13s}")
    bad = []
    for r in runs:
        out = calibrate(os.path.join(RESULTS, r), check_only=a.check)
        if out is None:
            print(f"{r:44s}  no dp block - skipped")
            continue
        flag = ""
        if not out["label_honoured"]:
            flag = f"  <-- run delivers eps={out['epsilon_run_level']:.2f}"
            bad.append((r, out))
        elif out["exceeds_retired_ceiling"]:
            flag = (f"  (clients {out['exceeds_retired_ceiling']} need sigma>30, "
                    f"unreachable before D69)")
        print(f"{r:44s} {out['target_epsilon']:4.0f} {out['sigma_min']:10.4f} "
              f"{out['sigma_max']:10.4f} {out['sigma_ratio']:6.2f} "
              f"{out['epsilon_max_abs_error']:13.5f}{flag}")

    print("\n" + ("checked only, nothing written" if a.check
                  else "wrote dp_calibration.json into each run directory"))
    if bad:
        print(f"\n{len(bad)} runs do not honour their directory label.")
        print("This is NOT a reason to discard them. The accuracy they report is "
              "\nexactly what that noise produced; only the epsilon on the label is "
              "\nwrong, and the honest figure is the worst client's:\n")
        for r, out in bad:
            worst = max(out["clients"], key=lambda c: c["realised_epsilon"])
            need = worst["sigma_needed_for_target"]
            print(f"  {r}")
            print(f"     label eps={out['target_epsilon']:.0f}, delivered "
                  f"eps={out['epsilon_run_level']:.2f} at the smallest silo "
                  f"(n={worst['n']}, q={worst['q']:.3f})")
            print(f"     sigma was capped at 30; reaching the label needs "
                  f"sigma={need}")
        print("\nEither report these four at their delivered epsilon, or re-run "
              "\nthem now that the ceiling expands. See D69.")
        sys.exit(1)
    print("\nEvery client in every run spends its target epsilon to within 0.05, "
          "\nso every directory label is honoured.")


if __name__ == "__main__":
    main()
