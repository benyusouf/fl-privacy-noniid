#!/usr/bin/env python3
"""
Check Phase C and report the overhead ratio.

    python3 experiments/verify_phase_c.py

TWO THINGS ARE CHECKED, AND THE FIRST MATTERS MORE
--------------------------------------------------
1. Masking cannot change accuracy. The masks cancel exactly, so a masked run and
   its plain pair must agree at EVERY round, not merely at the end. A difference
   is not a finding about secure aggregation; it is a fault in the
   implementation, and the numbers should not be reported until it is found.

2. The overhead. Section 3.10.3 defines it as additional processor time and
   additional bytes per round, each relative to the unmasked run of the same
   arm, reported as a ratio between the paired runs. Elapsed time is shown for
   context only - Section 3.11 records why it cannot carry the claim.

The plain arms should also reproduce their Phase A equivalents to the digit,
being identically configured. That is checked too, and a mismatch there points
at drift between the phase generators rather than at anything in this phase.
"""
from __future__ import annotations

import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(HERE, "results")
STRATEGIES = ["fedavg", "scaffold"]


def rows(name):
    p = os.path.join(RESULTS, name, "metrics.csv")
    return list(csv.DictReader(open(p))) if os.path.exists(p) else None


def col(rs, key, cast=float):
    return [cast(r[key]) for r in rs if r.get(key) not in (None, "")]


def main():
    ok = True
    print("PHASE C - SECURE AGGREGATION OVERHEAD\n")

    summary = []
    for s in STRATEGIES:
        plain_name = f"C_cifar10_{s}_dir0.1_plain_s0"
        sec_name = f"C_cifar10_{s}_dir0.1_secagg_s0"
        plain, sec = rows(plain_name), rows(sec_name)

        if plain is None or sec is None:
            print(f"{s}: not run yet "
                  f"({'plain missing' if plain is None else ''}"
                  f"{' and ' if plain is None and sec is None else ''}"
                  f"{'masked missing' if sec is None else ''})")
            ok = False
            continue

        # ---- 1. accuracy must be identical, round by round
        pa, sa = col(plain, "test_acc"), col(sec, "test_acc")
        n = min(len(pa), len(sa))
        worst = max((abs(pa[i] - sa[i]) for i in range(n)), default=None)
        same = worst is not None and worst < 1e-9

        print(f"{s}")
        print(f"  accuracy, masked vs plain over {n} rounds: "
              f"max difference {worst:.2e}  {'IDENTICAL' if same else 'DIVERGED'}")
        if not same:
            ok = False
            print("     Masks are supposed to cancel exactly. This is an "
                  "implementation fault,\n     not a cost of secure aggregation. "
                  "Do not report these runs.")

        # ---- 2. overhead in processor time
        mask = col(sec, "secagg_mask_s")
        agg = col(sec, "secagg_agg_s")
        msgs = col(sec, "secagg_msgs", int)
        per_round_mask = sum(mask) / max(1, len(mask))
        per_round_agg = sum(agg) / max(1, len(agg))

        # the plain arm records zeros for these, which is what makes the pair
        # comparable from the CSVs alone
        plain_mask = sum(col(plain, "secagg_mask_s")) if "secagg_mask_s" in plain[0] else 0.0

        print(f"  masking, processor seconds per round: "
              f"{per_round_mask:.4f} mask + {per_round_agg:.4f} aggregate")
        print(f"  plain arm records {plain_mask:.4f} (must be zero)")
        print(f"  key-agreement messages per round: {msgs[0] if msgs else 'n/a'}")

        # ---- 3. bytes
        pb = col(plain, "bytes_up")[0] if "bytes_up" in plain[0] else None
        sb = col(sec, "bytes_up")[0] if "bytes_up" in sec[0] else None
        if pb and sb:
            print(f"  bytes per round: plain {pb:,}  masked {sb:,}  "
                  f"ratio {sb / pb:.4f}"
                  + ("   (unchanged, as Section 3.8.5 predicts)"
                     if abs(sb / pb - 1) < 1e-9 else "   <-- EXPECTED TO BE UNCHANGED"))

        # ---- 4. the plain arm should equal its Phase A twin
        twin = rows(f"A_cifar10_{s}_dir0.1_s0")
        if twin:
            ta = col(twin, "test_acc")
            m = min(len(ta), len(pa))
            d = max((abs(ta[i] - pa[i]) for i in range(m)), default=0.0)
            print(f"  plain arm vs Phase A twin: max difference {d:.2e}"
                  + ("" if d < 1e-9 else "   <-- CONFIGURATIONS HAVE DRIFTED"))
            if d >= 1e-9:
                ok = False

        summary.append({
            "strategy": s,
            "rounds": n,
            "accuracy_identical": same,
            "max_accuracy_difference": worst,
            "mask_processor_seconds_per_round": round(per_round_mask, 5),
            "aggregate_processor_seconds_per_round": round(per_round_agg, 5),
            "key_agreement_messages_per_round": msgs[0] if msgs else None,
            "bytes_per_round_plain": pb,
            "bytes_per_round_masked": sb,
        })
        print()

    if summary:
        dest = os.path.join(RESULTS, "C_summary")
        os.makedirs(dest, exist_ok=True)
        with open(os.path.join(dest, "overhead.json"), "w") as f:
            json.dump({"arms": summary,
                       "note": ("Overhead is processor time. Elapsed time is not "
                                "usable on this machine; see Section 3.11.")},
                      f, indent=2)
        print(f"written -> results/C_summary/overhead.json")

    print("\nPASS" if ok else "\nFAIL - see above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
