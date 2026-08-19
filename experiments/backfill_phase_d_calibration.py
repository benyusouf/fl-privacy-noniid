#!/usr/bin/env python3
"""
Write dp_calibration.json into every Phase D run that configured DP.

    python3 experiments/backfill_phase_d_calibration.py            # write
    python3 experiments/backfill_phase_d_calibration.py --check    # verify only

WHY THIS EXISTS
---------------
backfill_dp_calibration.py covers Phase B, and Phase B has one mechanism:
sample-level DP-SGD, calibrated per client. Phase D has three, and the
visualisation layer reads dp_calibration.json for all of them. Without this,
six of the nine Phase D runs reach the site with `dp: null` - the client-level
arms, which are the point of the phase, arriving with no privacy metadata at
all beside an accuracy of ten per cent and no explanation for it.

THE THREE MECHANISMS, AND WHY THEIR CALIBRATION DIFFERS
-------------------------------------------------------
SAMPLE-LEVEL (sampledp_eps1). Identical to Phase B. Each client's sigma is
calibrated from its own sampling ratio q = B/n_c and its own step count, so
sigma varies across clients by an order of magnitude and the smallest silo
carries the most noise (D58).

CLIENT-LEVEL (clientdp_eps1/4/8). One sigma for the whole federation, because
the protected unit is an institution rather than a record. The accountant sees
one release per ROUND at sampling rate 1.0 - full participation buys no
amplification whatever - so sixty releases at q = 1 is what drives sigma so
high. The noise actually added is sigma*C/N on the UNIFORM mean, and that
quantity, not sigma, is what the ten per cent result turns on. It is recorded
here explicitly.

TIME-ADAPTIVE (adaptive_eps1/4/8). Sample-level, but sigma moves per round. The
sequence is not reconstructed here: it is read from dp_schedule.json, which
backfill_adaptive_schedule.py writes only after agreeing with the run.log
transcript. A run without that file is a failure, not a skip - deriving the
schedule here would repeat exactly the mistake D88 records, where a second
piece of code rebuilt a schedule by a normalisation the training code had
already abandoned and priced something nobody ran.

WHAT `sigma` MEANS IN THE OUTPUT, WHICH DIFFERS BY MECHANISM
------------------------------------------------------------
For sample-level and client-level, `sigma` is a number and holds for all sixty
rounds. For time-adaptive there is no single sigma, so `sigma` is null,
`sigma_min` and `sigma_max` bound the client's schedule, and `schedule` is true.
Anything rendering this must branch on `schedule` rather than assume a scalar.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
RESULTS = os.path.join(HERE, "results")
BUDGETS = (1, 4, 8)

NOTE = ("Reconstructed after the runs, not logged at run time. Sample-level and "
        "client-level calibration is deterministic in the quantities the "
        "directory already holds. The time-adaptive schedules are READ from "
        "dp_schedule.json rather than rebuilt, because rebuilding a schedule in "
        "a second place is what produced D88. See D58, D63, D87, D88.")


def sample_level(cfg, rep, dp):
    from flcore.privacy import calibrate_noise_for_epsilon, accountant_epsilon
    target = float(dp["target_epsilon"])
    delta = float(dp.get("delta", 1e-5))
    bs, le = int(cfg["model"]["batch_size"]), int(cfg["local_epochs"])
    rounds = int(cfg["rounds"])

    clients = []
    for cid, n_c in enumerate(rep["client_sizes"]):
        q = min(1.0, bs / max(1, n_c))
        steps = int(math.ceil(n_c / bs)) * le * rounds
        sig = calibrate_noise_for_epsilon(target, q, steps, delta)
        eps = accountant_epsilon(sig, q, steps, delta)
        clients.append({"client": cid, "n": int(n_c), "q": round(q, 6),
                        "steps": steps, "rounds": rounds,
                        "sigma": round(sig, 6),
                        "sigma_min": round(sig, 6), "sigma_max": round(sig, 6),
                        "realised_epsilon": round(eps, 6), "schedule": False})
    return clients, {"granularity": "sample-level",
                     "mechanism": "DP-SGD, constant noise, calibrated per client"}


def client_level(cfg, rep, dp):
    """One sigma for the federation; the noise on the mean is sigma*C/N."""
    from flcore.privacy import calibrate_noise_for_epsilon, accountant_epsilon
    target = float(dp["target_epsilon"])
    delta = float(dp.get("delta", 1e-5))
    clip_c = float(dp["max_grad_norm"])
    rounds = int(cfg["rounds"])
    n_cl = len(rep["client_sizes"])

    sig = calibrate_noise_for_epsilon(target, 1.0, rounds, delta)
    eps = accountant_epsilon(sig, 1.0, rounds, delta)
    clients = [{"client": cid, "n": int(n_c), "q": 1.0,
                "steps": rounds, "rounds": rounds,
                "sigma": round(sig, 6),
                "sigma_min": round(sig, 6), "sigma_max": round(sig, 6),
                "realised_epsilon": round(eps, 6), "schedule": False}
               for cid, n_c in enumerate(rep["client_sizes"])]
    extra = {
        "granularity": "client-level",
        "mechanism": "clip the update to C, average UNIFORMLY, noise the mean",
        "sampling_rate": 1.0,
        "releases": rounds,
        # THE FIGURE THE PHASE TURNS ON. sigma alone says nothing: what reaches
        # the model is this, against an aggregate update whose norm the
        # pre-flight measured. Fifteen clients is the denominator, and it is
        # small.
        "noise_std_on_mean": round(sig * clip_c / n_cl, 8),
        "num_clients": n_cl,
        "uniform_averaging": True,
        "why_no_amplification": (
            "Every client participates in every round, so the sampling rate is "
            "1.0 and subsampling amplification does not apply. Sixty releases "
            "at q=1 is what forces sigma this high."),
    }
    return clients, extra


def adaptive(run_dir, cfg, rep, dp):
    path = os.path.join(run_dir, "dp_schedule.json")
    if not os.path.exists(path):
        raise SystemExit(
            f"{os.path.basename(run_dir)}: dp_schedule.json is missing.\n"
            "The schedule is READ, never rebuilt here - rebuilding it in a "
            "second place is D88.\nRun: python3 experiments/"
            "backfill_adaptive_schedule.py")
    sched = json.load(open(path))
    if not sched.get("verified_against_run_log"):
        raise SystemExit(
            f"{os.path.basename(run_dir)}: dp_schedule.json was never checked "
            "against run.log; refusing to publish it.")

    clients = []
    for c in sched["clients"]:
        clients.append({"client": c["client"], "n": c["n"], "q": c["q"],
                        "steps": c["steps_per_round"] * int(cfg["rounds"]),
                        "rounds": int(cfg["rounds"]),
                        # No single sigma exists. Anything rendering this must
                        # branch on `schedule`, not assume a scalar.
                        "sigma": None,
                        "sigma_min": c["sigma_min"], "sigma_max": c["sigma_max"],
                        "realised_epsilon": c["realised_epsilon"],
                        "schedule": True})
    return clients, {
        "granularity": "sample-level, time-adaptive",
        "mechanism": (f"DP-SGD, '{sched['mode']}' schedule at strength "
                      f"{sched['strength']}; SHAPE from the schedule, SCALE "
                      f"calibrated per client against the accountant"),
        "schedule_file": "dp_schedule.json",
        "schedule_shape": sched["shape"],
        "schedule_shape_min": min(sched["shape"]),
        "schedule_shape_max": max(sched["shape"]),
    }


def build(run_dir):
    cfg = json.load(open(os.path.join(run_dir, "config_used.json")))
    dp = cfg.get("dp")
    if not dp or not dp.get("enabled", True):
        return None
    rep = json.load(open(os.path.join(run_dir, "partition_report.json")))

    gran = str(dp.get("granularity", "sample"))
    if gran == "client":
        clients, extra = client_level(cfg, rep, dp)
    elif dp.get("schedule"):
        clients, extra = adaptive(run_dir, cfg, rep, dp)
    else:
        clients, extra = sample_level(cfg, rep, dp)

    target = float(dp["target_epsilon"])
    lo = min(c["sigma_min"] for c in clients)
    hi = max(c["sigma_max"] for c in clients)
    worst = max(abs(c["realised_epsilon"] - target) for c in clients)
    run_eps = max(c["realised_epsilon"] for c in clients)

    out = {"target_epsilon": target,
           "delta": float(dp.get("delta", 1e-5)),
           "max_grad_norm": float(dp.get("max_grad_norm", 1.0)),
           "batch_size": int(cfg["model"]["batch_size"]),
           "local_epochs": int(cfg["local_epochs"]),
           "rounds": int(cfg["rounds"]),
           "clients": clients,
           "sigma_min": lo, "sigma_max": hi,
           "sigma_ratio": round(hi / lo, 6) if lo else None,
           "epsilon_max_abs_error": round(worst, 6),
           # The guarantee the federation can claim is the WORST client's, not
           # the label on the directory.
           "epsilon_run_level": run_eps,
           "label_honoured": worst <= 0.05,
           "exceeds_retired_ceiling": [],
           "note": NOTE}
    out.update(extra)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="write nothing")
    a = ap.parse_args()

    names = ([f"D_cifar10_fedavg_dir0.1_clientdp_eps{e}_s0" for e in BUDGETS]
             + [f"D_cifar10_fedavg_dir0.1_adaptive_eps{e}_s0" for e in BUDGETS]
             + ["D_cifar10_fedavg_dir0.1_sampledp_eps1_s0"])

    print(f"{'run':46s} {'granularity':30s} {'eps':>4s} {'sigma':>17s} "
          f"{'|eps err|':>10s}")
    ok = True
    for n in names:
        d = os.path.join(RESULTS, n)
        if not os.path.isdir(d):
            print(f"{n:46s}  MISSING")
            ok = False
            continue
        out = build(d)
        if out is None:
            print(f"{n:46s}  no dp block - skipped")
            continue
        if not a.check:
            with open(os.path.join(d, "dp_calibration.json"), "w") as f:
                json.dump(out, f, indent=2)
        if not out["label_honoured"]:
            ok = False
        short = n.replace("D_cifar10_fedavg_dir0.1_", "")
        rng = f"{out['sigma_min']:.3f}-{out['sigma_max']:.3f}"
        flag = "" if out["label_honoured"] else "   <-- LABEL NOT HONOURED"
        print(f"{short:46s} {out['granularity']:30s} "
              f"{out['target_epsilon']:4.0f} {rng:>17s} "
              f"{out['epsilon_max_abs_error']:10.5f}{flag}")

    print("\n" + ("checked only, nothing written" if a.check
                  else "wrote dp_calibration.json into each Phase D DP run"))
    print("\nNote the sigma ranges. Sample-level spreads across clients because "
          "\ncalibration is per client; client-level shows a single value "
          "because\none sigma covers the federation, and the number that matters "
          "there is\nnoise_std_on_mean = sigma*C/N, not sigma.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
