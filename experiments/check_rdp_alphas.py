#!/usr/bin/env python3
"""
Is the Renyi order range wide enough for the epsilons this study reports?

    python3 experiments/check_rdp_alphas.py

WHY
---
Opacus computes epsilon by minimising over a fixed grid of Renyi orders. Its
default grid runs 1.1 to 11.9 in steps of 0.1, then the integers 12 to 63. When
the minimum falls on either end of that grid it warns, because the true optimum
may lie outside it and the bound returned is then looser than it needs to be.

That warning fired during the Phase B eps=1 re-runs. It is not a privacy
failure. A loose bound OVERSTATES epsilon, so calibrating against it adds more
noise than the budget strictly requires: the guarantee is honoured with room to
spare and the cost is paid in accuracy, not in privacy. But if the gap is
material then some of Phase B was noisier than it needed to be, and the
accuracy figures carry an avoidable penalty that should be known about rather
than discovered by a examiner.

This script recomputes epsilon at each run's calibrated sigma under the default
grid and under a much wider one, and reports the difference. Nothing is
rewritten; it only measures.
"""
from __future__ import annotations

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RESULTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "results")

# Opacus' default, then a grid extended in both directions.
WIDE = ([1 + x / 100.0 for x in range(1, 100)]          # 1.01 .. 1.99, finer
        + [1 + x / 10.0 for x in range(1, 100)]         # 1.1 .. 10.9
        + list(range(11, 256))                          # integers to 255
        + [300, 400, 512, 768, 1024, 2048])


def eps_at(sigma, q, steps, delta, alphas=None):
    from opacus.accountants import RDPAccountant
    acct = RDPAccountant()
    acct.history = [(float(sigma), float(q), int(steps))]
    if alphas is None:
        return float(acct.get_epsilon(delta=delta))
    return float(acct.get_epsilon(delta=delta, alphas=alphas))


def main():
    import warnings
    warnings.filterwarnings("ignore")

    # Live runs only; a supersession suffix attaches after the seed. Anchoring
    # on the seed matters because partition names contain dots (dir0.1, dir1.0).
    import re as _re
    runs = sorted(d for d in os.listdir(RESULTS)
                  if d.startswith("B_cifar10_")
                  and not _re.search(r"_s\d+\.", d)
                  and os.path.isfile(os.path.join(RESULTS, d, "dp_calibration.json")))
    if not runs:
        sys.exit("no dp_calibration.json found - run backfill_dp_calibration.py first")

    print("Only distinct (sigma, q, steps) triples are evaluated. The four\n"
          "strategies share a partition and a seed, so their calibrations are\n"
          "identical and one row covers all four.\n")
    print(f"{'run':42s} {'client':>6s} {'sigma':>9s} {'eps default':>12s} "
          f"{'eps wide':>10s} {'gap':>8s}")
    worst = (-1.0, None)
    seen = set()
    for r in runs:
        cal = json.load(open(os.path.join(RESULTS, r, "dp_calibration.json")))
        delta = cal["delta"]
        # the largest and smallest sigma in the run are where the grid ends bite
        cs = sorted(cal["clients"], key=lambda c: c["sigma"])
        for c in (cs[0], cs[-1]):
            key = (round(c["sigma"], 4), c["q"], c["steps"])
            if key in seen:
                continue
            seen.add(key)
            d_eps = eps_at(c["sigma"], c["q"], c["steps"], delta)
            w_eps = eps_at(c["sigma"], c["q"], c["steps"], delta, WIDE)
            gap = d_eps - w_eps
            if gap > worst[0]:
                worst = (gap, (r, c, d_eps, w_eps))
            flag = "  <-- default grid is loose" if gap > 0.02 else ""
            print(f"{r:42s} {c['client']:6d} {c['sigma']:9.4f} {d_eps:12.4f} "
                  f"{w_eps:10.4f} {gap:8.4f}{flag}")

    print("\n" + "=" * 78)
    g, info = worst
    if info is None:
        print("no calibrations found to compare")
        return
    r, c, d_eps, w_eps = info
    print(f"{len(seen)} distinct calibrations checked")
    print(f"largest gap {g:.4f}  ({r}, client {c['client']}, n={c['n']}, "
          f"sigma={c['sigma']:.4f})")
    if g < 0.02:
        print("\nThe default grid is tight enough. The warning fired at intermediate\n"
              "sigma values during the bisection, not at the values the runs used.\n"
              "No action needed and nothing to declare.")
    elif g < 0.15:
        print("\nThe default grid is slightly loose. Every run still honours its label,\n"
              "since a loose bound overstates epsilon, but the noise was marginally\n"
              "higher than the budget required. Worth one sentence in Section 3.8.2.")
    else:
        print("\nThe default grid is materially loose. The runs are over-noised: they\n"
              "deliver a better guarantee than they claim, at an avoidable cost in\n"
              "accuracy. Decide whether to re-calibrate with the wider grid and re-run,\n"
              "or to report the tighter epsilon these sigmas actually deliver.")


if __name__ == "__main__":
    main()
