#!/usr/bin/env python3
"""
Write a provenance record for every run that has no captured log.

    python3 experiments/make_provenance.py            # write
    python3 experiments/make_provenance.py --check    # report, write nothing

WHAT THIS IS, AND WHAT IT IS NOT
--------------------------------
Phase A and the first Phase B were run without their terminal output being
redirected to a file, so those transcripts are gone. run.py now writes
results/<run>/run.log for every run, but that cannot apply retroactively.

This produces provenance.txt instead: everything about the run that survives in
its recorded artefacts, laid out so it can be read at a glance. It is a
RECONSTRUCTION assembled after the fact from config_used.json,
partition_report.json, timing.txt, dp_calibration.json and metrics.csv. It is
NOT a transcript, and the header of every file says so in those words. Any run
that already carries a real run.log is left alone.

The distinction matters for the same reason the wall-clock caveat matters: a
reader is entitled to know which numbers were observed and which were derived.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(HERE, "results")
SUPERSEDED = re.compile(r"_s\d+\.|\.(pre-D49|d50-twostage)$")

BANNER = """\
PROVENANCE RECORD - RECONSTRUCTED, NOT A TRANSCRIPT
===================================================================
This run was executed before run.py captured its own output, so no
log of it exists. Everything below was assembled afterwards from the
files the run wrote. It records what the run was and what it
produced. It does not record what appeared on the terminal, and no
warning, timestamp or message from the session survives.

Runs from Phase C onward carry a real transcript in run.log.
===================================================================
"""


def read_json(d, name):
    p = os.path.join(d, name)
    return json.load(open(p)) if os.path.exists(p) else None


def read_timing(d):
    p = os.path.join(d, "timing.txt")
    if not os.path.exists(p):
        return {}
    return dict(l.strip().split("=") for l in open(p) if "=" in l)


def curve(d):
    p = os.path.join(d, "metrics.csv")
    if not os.path.exists(p):
        return []
    return list(csv.DictReader(open(p)))


def block(title, lines):
    out = [f"\n{title}", "-" * len(title)]
    out += [f"  {l}" for l in lines]
    return out


def build(d):
    name = os.path.basename(d)
    cfg = read_json(d, "config_used.json") or {}
    rep = read_json(d, "partition_report.json")
    cal = read_json(d, "dp_calibration.json")
    tim = read_timing(d)
    rows = curve(d)

    L = [BANNER, f"run: {name}"]

    L += block("CONFIGURATION AS EXECUTED", [
        f"phase          {name.split('_')[0]}",
        f"dataset        {cfg.get('dataset')}",
        f"mode           {cfg.get('mode')}",
        f"strategy       {cfg.get('strategy', 'n/a (centralized)')}",
        f"seed           {cfg.get('seed')}",
        f"rounds/epochs  {cfg.get('rounds', cfg.get('epochs'))}",
        f"local epochs   {cfg.get('local_epochs', 'n/a')}",
        f"learning rate  {cfg.get('lr')}",
        f"clients        {cfg.get('num_clients', 'n/a')}",
        f"train subsample {cfg.get('subsample')}  test {cfg.get('subsample_test')}",
        f"model          {cfg.get('model')}",
    ] + ([f"comparator     {cfg['comparator']}"] if cfg.get("comparator") else []))

    if rep:
        cs = rep.get("client_sizes", [])
        L += block("PARTITION AS DRAWN", [
            f"kind           {cfg.get('partition', {}).get('kind')}"
            + (f", alpha={cfg['partition'].get('alpha')}"
               if cfg.get("partition", {}).get("alpha") is not None else ""),
            f"clients        {len(cs)}",
            f"sizes          min {min(cs)}  max {max(cs)}  "
            f"ratio {max(cs)/max(1,min(cs)):.2f}",
            f"Hellinger      mean {rep.get('hellinger_mean')}  "
            f"max {rep.get('hellinger_max')}",
        ])

    if cal:
        cl = cal["clients"]
        L += block("DIFFERENTIAL PRIVACY AS CALIBRATED", [
            f"granularity    {cal.get('granularity')}",
            f"target epsilon {cal['target_epsilon']}   delta {cal['delta']}",
            f"clipping norm  {cal['max_grad_norm']}",
            f"sigma          min {cal['sigma_min']:.4f}  max {cal['sigma_max']:.4f}  "
            f"ratio {cal['sigma_ratio']:.2f}",
            f"delivered eps  worst client {cal['epsilon_run_level']:.4f}  "
            f"(label honoured: {cal['label_honoured']})",
            "",
            "per client:",
        ] + [f"  client {c['client']:2d}  n={c['n']:5d}  q={c['q']:.4f}  "
             f"steps={c['steps']:6d}  sigma={c['sigma']:8.4f}  "
             f"eps={c['realised_epsilon']:.4f}" for c in cl])

    if rows:
        step = "round" if "round" in rows[0] else "epoch"
        accs = [float(r["test_acc"]) for r in rows]
        peak = max(accs)
        L += block("OUTCOME AS RECORDED", [
            f"{step}s recorded {len(rows)}",
            f"final test_acc  {accs[-1]:.4f}",
            f"best test_acc   {peak:.4f} at {step} {accs.index(peak)+1}",
        ] + (["", "NOTE: the peak is more than 3 points above the final value, so "
                  "this run", "declined after peaking. Report the trajectory, not "
                  "the final score."]
             if peak - accs[-1] > 0.03 else []))

    if tim:
        spr = float(tim.get("seconds_per_round", 0))
        L += block("TIMING AS MEASURED (UNRELIABLE - SEE SECTION 3.11)", [
            f"seconds total     {tim.get('seconds_total')}",
            f"rounds run        {tim.get('rounds_run')}",
            f"seconds per round {tim.get('seconds_per_round')}",
            "",
            "Elapsed wall clock continues to accumulate while the machine",
            "sleeps. Across 68 Phase A runs the rate ranged 41.0 to 869.0",
            "seconds for identical work. This figure is recorded, not trusted."
            + ("\n  THIS RUN SPANNED A SLEEP: the rate above is not usable."
               if spr > 150 else ""),
        ])

    # Checkpoints are excluded because they are never published; this record is
    # excluded because a file listing itself among a run's outputs is noise.
    have = sorted(f for f in os.listdir(d)
                  if not f.endswith(".npz") and f != "provenance.txt")
    L += block("FILES THIS RUN WROTE", have)
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    dirs = sorted(d for d in os.listdir(RESULTS)
                  if os.path.isdir(os.path.join(RESULTS, d))
                  and not SUPERSEDED.search(d))
    written = skipped = 0
    for name in dirs:
        d = os.path.join(RESULTS, name)
        if not os.path.exists(os.path.join(d, "config_used.json")):
            continue
        if os.path.exists(os.path.join(d, "run.log")):
            skipped += 1
            continue
        if not a.check:
            # Build first, then write. Opening for writing creates the file, and
            # if that happened first the record would list itself among the
            # run's outputs.
            text = build(d)
            with open(os.path.join(d, "provenance.txt"), "w") as f:
                f.write(text)
        written += 1

    print(f"{written} provenance records {'to write' if a.check else 'written'}")
    print(f"{skipped} runs skipped - they carry a real run.log")
    if not a.check and written:
        sample = next(n for n in dirs
                      if os.path.exists(os.path.join(RESULTS, n, "provenance.txt")))
        print(f"\nsample ({sample}):\n")
        print(open(os.path.join(RESULTS, sample, "provenance.txt")).read()[:1200])


if __name__ == "__main__":
    main()
