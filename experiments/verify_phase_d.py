#!/usr/bin/env python3
"""
Check Phase D, and check first that each run measured what its name claims.

    python3 experiments/verify_phase_d.py

THE FIRST CHECK IS THE ONE THAT MATTERS
---------------------------------------
Phase D failed twice before producing a number, and both failures were silent.

  1. run.py rebuilt the dp block from three named keys and dropped `granularity`
     and `schedule`, so six runs executed as plain sample-level DP under
     directories claiming client-level and time-adaptive.

  2. The corrected configs were re-launched and every run RESUMED from its
     completed checkpoint, did zero rounds, and reported success - leaving the
     wrong numbers in place beside a config that recorded the right mechanism.

Neither showed up in any accuracy figure. So before anything is compared, this
asserts that the mechanism recorded in each run agrees with its directory name,
and that the number of recorded rounds equals the number configured. Either
check alone would have caught both failures in seconds.
"""
from __future__ import annotations

import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Without this the flcore import below raises ImportError, the except-clause
# swallows it, and the realised-epsilon check that Section 3.8.4 REQUIRES is
# skipped while the report still says PASS. It did exactly that on the first
# run of this script.
sys.path.insert(0, HERE)
RESULTS = os.path.join(HERE, "results")
BUDGETS = (1, 4, 8)


def load(name):
    d = os.path.join(RESULTS, name)
    m = os.path.join(d, "metrics.csv")
    c = os.path.join(d, "config_used.json")
    if not (os.path.exists(m) and os.path.exists(c)):
        return None
    return {"name": name, "dir": d,
            "rows": list(csv.DictReader(open(m))),
            "cfg": json.load(open(c))}


def acc(run):
    return [float(r["test_acc"]) for r in run["rows"]]


def expected(name):
    """What the directory name promises."""
    dp = None
    if "clientdp" in name:
        dp = ("client", None)
    elif "adaptive" in name:
        dp = ("sample", "decreasing")
    elif "sampledp" in name:
        dp = ("sample", None)
    return {"dp": dp, "uniform": "diag" in name or "clientdp" in name}


def main():
    names = ([f"D_cifar10_fedavg_dir0.1_clientdp_eps{e}_s0" for e in BUDGETS]
             + [f"D_cifar10_fedavg_dir0.1_adaptive_eps{e}_s0" for e in BUDGETS]
             + ["D_cifar10_fedavg_dir0.1_sampledp_eps1_s0",
                "D_cifar10_fedavg_dir0.1_none_s0",
                "D_diag_cifar10_fedavg_dir0.1_uniform_s0"])

    runs, missing = {}, []
    for n in names:
        r = load(n)
        if r is None:
            missing.append(n)
        else:
            runs[n] = r

    ok = True
    print("PHASE D - GRANULARITY OF DIFFERENTIAL PRIVACY\n")

    if missing:
        ok = False
        print(f"{len(missing)} runs missing:")
        for m in missing:
            print("   ", m)
        print()

    # ---- 1. did each run measure what it claims, and for how long?
    print("mechanism and completeness")
    for n, r in runs.items():
        cfg, want = r["cfg"], expected(n)
        dp = cfg.get("dp") or {}
        got_dp = ((str(dp.get("granularity", "sample")),
                   str(dp["schedule"]) if dp.get("schedule") else None)
                  if dp and dp.get("enabled", True) else None)
        got_uniform = bool(cfg.get("uniform_averaging", False)) or (
            got_dp is not None and got_dp[0] == "client")

        problems = []
        if got_dp != want["dp"]:
            problems.append(f"mechanism {got_dp} but the name promises {want['dp']}")
        if got_uniform != want["uniform"]:
            problems.append(f"uniform averaging {got_uniform}, expected {want['uniform']}")
        want_rounds = int(cfg.get("rounds", 0))
        if len(r["rows"]) != want_rounds:
            problems.append(f"{len(r['rows'])} rounds recorded, {want_rounds} configured")

        short = n.replace("D_cifar10_fedavg_dir0.1_", "").replace("D_diag_cifar10_fedavg_dir0.1_", "diag ")
        if problems:
            ok = False
            print(f"  FAIL {short}")
            for p in problems:
                print(f"        {p}")
        else:
            print(f"  ok   {short:22s} {len(r['rows'])} rounds, "
                  f"final {acc(r)[-1]*100:.2f}%")
    print()

    # ---- 2. the controls must reproduce their twins
    print("controls against their twins")
    for n, twin in (("D_cifar10_fedavg_dir0.1_none_s0", "A_cifar10_fedavg_dir0.1_s0"),
                    ("D_cifar10_fedavg_dir0.1_sampledp_eps1_s0",
                     "B_cifar10_fedavg_dir0.1_eps1_s0")):
        r, t = runs.get(n), load(twin)
        if not (r and t):
            continue
        a, b = acc(r), acc(t)
        d = max(abs(x - y) for x, y in zip(a, b[:len(a)]))
        print(f"  {'ok  ' if d < 1e-9 else 'FAIL'} {n.split('dir0.1_')[1]:22s} "
              f"vs {twin}: max diff {d:.2e}")
        if d >= 1e-9:
            ok = False
    print()

    # ---- 2b. ARMS THAT DIFFER IN MECHANISM MUST DIFFER IN RESULT.
    #
    # This is the check that survives a rewritten config. After the second
    # failure the directories recorded the correct mechanism while holding data
    # produced by the wrong one, so every metadata check passed. Data cannot
    # lie the same way: a time-adaptive run and a constant-schedule run at the
    # same budget cannot produce identical curves, and if they do the schedule
    # never took effect.
    print("arms that should differ, do")
    pairs = [("adaptive_eps1_s0", "sampledp_eps1_s0",
              "time-adaptive vs constant schedule at eps=1")]
    for a_key, b_key, what in pairs:
        a = runs.get(f"D_cifar10_fedavg_dir0.1_{a_key}")
        b = runs.get(f"D_cifar10_fedavg_dir0.1_{b_key}")
        if not (a and b):
            continue
        d = max(abs(x - y) for x, y in zip(acc(a), acc(b)))
        if d < 1e-9:
            ok = False
            print(f"  FAIL {what}: curves are IDENTICAL")
            print("        the schedule had no effect; these are stale or the "
                  "config was dropped")
        else:
            print(f"  ok   {what}: max difference {d*100:.2f} points")
    print()

    # ---- 3. realised epsilon for the adaptive arms (Section 3.8.4)
    #
    # PRICE THE SCHEDULE THE RUN USED, NOT ONE REBUILT HERE.
    #
    # The first version of this check reconstructed a schedule from the config
    # and priced that. It kept the reconstruction it was written against - the
    # sum(1/sigma^2) proxy normalisation - after run_federated had moved to
    # calibrating the scale against the accountant, so it went on reporting the
    # epsilon of a schedule nobody had run. Its verdict did not move when the
    # runs were corrected: identical figures, 1.0100 / 4.0366 / 8.1959, before
    # and after three and a half hours of re-running. A check whose output is
    # unchanged by the thing it checks is measuring itself (D88).
    #
    # So the sequence is read from dp_schedule.json, which
    # backfill_adaptive_schedule.py writes only after agreeing with the sigma
    # ranges run.log recorded while the run was happening. This script then
    # applies the accountant to it. Reconstruction is checked against the
    # transcript in one place; pricing happens in another.
    print("time-adaptive: realised epsilon of the schedule each run used")
    try:
        from flcore.privacy import epsilon_of_schedule
        for e in BUDGETS:
            n = f"D_cifar10_fedavg_dir0.1_adaptive_eps{e}_s0"
            r = runs.get(n)
            if not r:
                continue
            path = os.path.join(r["dir"], "dp_schedule.json")
            if not os.path.exists(path):
                ok = False
                print(f"  eps={e}: NO dp_schedule.json - the schedule this run "
                      f"used is not recorded.\n"
                      f"        Run: python3 experiments/backfill_adaptive_schedule.py")
                continue
            sched = json.load(open(path))
            if not sched.get("verified_against_run_log"):
                ok = False
                print(f"  eps={e}: dp_schedule.json was never checked against "
                      f"run.log; refusing to price it")
                continue

            worst, worst_real, worst_cid = 0.0, None, None
            for c in sched["clients"]:
                real = epsilon_of_schedule(c["sigma"], c["q"],
                                           c["steps_per_round"],
                                           float(sched["delta"]))
                if abs(real - e) > worst:
                    worst, worst_real, worst_cid = abs(real - e), real, c["client"]
            flag = "" if worst < 0.15 else "   <-- schedule does not land on its budget"
            if worst >= 0.15:
                ok = False
            # THE SIGN MATTERS. Overshooting means the adaptive arm spent MORE
            # budget than the constant arm it is compared against, so any
            # advantage it shows is partly bought rather than earned;
            # undershooting means the opposite.
            direction = ("overspends" if worst_real and worst_real > e
                         else "underspends")
            print(f"  eps={e}: realised {worst_real:.4f} at client {worst_cid}, "
                  f"the worst of {len(sched['clients'])}, {direction} by "
                  f"{worst:.4f}{flag}")
    except ImportError as exc:
        # Never silently pass. Section 3.8.4 makes this recomputation a
        # precondition for reporting the adaptive arms at all.
        ok = False
        print(f"  COULD NOT CHECK: {exc}")
        print("  Section 3.8.4 requires the realised epsilon to be recomputed "
              "before\n  any adaptive figure is reported. This is a FAILURE, not "
              "a skip.")
    print()

    # ---- 4. what the phase found, stated without prejudging it
    print("results")
    base = runs.get("D_cifar10_fedavg_dir0.1_none_s0")
    diag = runs.get("D_diag_cifar10_fedavg_dir0.1_uniform_s0")
    if base and diag:
        print(f"  unprotected, weighted averaging   {acc(base)[-1]*100:6.2f}%")
        print(f"  unprotected, uniform averaging    {acc(diag)[-1]*100:6.2f}%"
              f"   <- the re-weighting alone costs "
              f"{(acc(base)[-1]-acc(diag)[-1])*100:+.2f} points")
    for label, key in (("sample-level", "sampledp"), ("client-level", "clientdp"),
                       ("time-adaptive", "adaptive")):
        for e in BUDGETS:
            n = f"D_cifar10_fedavg_dir0.1_{key}_eps{e}_s0"
            if n in runs:
                a = acc(runs[n])
                print(f"  {label:14s} eps={e}: {a[-1]*100:6.2f}%  "
                      f"(best {max(a)*100:.2f}% at round {a.index(max(a))+1})")

    print("\nPASS" if ok else "\nFAIL - see above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
