#!/usr/bin/env python3
"""
Check Phase C and report the overhead ratio.

    python3 experiments/verify_phase_c.py

TWO THINGS ARE CHECKED, AND THE FIRST MATTERS MORE
--------------------------------------------------
1. Masking cannot change the aggregate. Masks cancel to about 1e-14, so the
   first aggregate a masked run produces is identical to its plain pair's and
   ROUND 1 ACCURACY MATCHES EXACTLY. That is the direct test.

   Later rounds are a different question. A residue at 1e-14 changes where the
   next round starts from, and two runs of a non-convex optimisation then follow
   slightly different paths - they wander rather than diverge. Observed on
   FedAvg: identical at round 1, at most 0.70 points apart thereafter, 0.20
   points apart at round 60, against a seed-to-seed spread of about 6 points at
   the same cell. Demanding bit-identity at round 60 would fail a correct
   implementation, so later rounds are judged against that spread instead.

   A difference at round 1 IS a fault, and those runs should not be reported.

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

# The seed-to-seed spread Phase A shows at CIFAR-10, alpha = 0.1. Any wander
# between a masked run and its plain pair that is smaller than this carries no
# information; anything larger is not rounding and needs explaining.
SEED_SPREAD_PTS = 6.0


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

        # ---- 1. the aggregate must be identical; the TRAJECTORY need not be
        #
        # Masks cancel to about 1e-14, so the first aggregate a masked run
        # produces is identical to the plain one and round 1 accuracy matches
        # exactly. After that the float-level residue perturbs where the next
        # round starts from, and two runs of a non-convex optimisation follow
        # slightly different paths. That is amplification of rounding, not a
        # cost of masking, and demanding bit-identity at round 60 would fail a
        # correct implementation.
        #
        # So round 1 is the direct test of the aggregation, and later rounds are
        # judged against the seed-to-seed spread the same cell shows in Phase A:
        # a wander smaller than that carries no information.
        pa, sa = col(plain, "test_acc"), col(sec, "test_acc")
        n = min(len(pa), len(sa))
        r1 = abs(pa[0] - sa[0])
        worst = max((abs(pa[i] - sa[i]) for i in range(n)), default=0.0)

        print(f"{s}  ({n} rounds)")
        print(f"  round 1, masked vs plain: {r1:.2e}  "
              f"{'IDENTICAL - the aggregate is exact' if r1 < 1e-9 else 'DIFFERS'}")
        if r1 >= 1e-9:
            ok = False
            print("     The first aggregate should be identical. Masks are not "
                  "cancelling;\n     this is an implementation fault. Do not report "
                  "these runs.")

        print(f"  later rounds: max wander {worst * 100:.2f} points, "
              f"final {abs(pa[-1] - sa[-1]) * 100:.2f} points")
        if worst > SEED_SPREAD_PTS / 100:
            ok = False
            print(f"     That exceeds the {SEED_SPREAD_PTS:.1f}-point seed spread "
                  f"Phase A shows at this cell,\n     so it is too large to be "
                  f"rounding. Investigate before reporting.")

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
            "round1_identical": r1 < 1e-9,
            "round1_difference": r1,
            "max_wander_points": round(worst * 100, 4),
            "final_difference_points": round(abs(pa[-1] - sa[-1]) * 100, 4),
            "mask_processor_seconds_per_round": round(per_round_mask, 5),
            "aggregate_processor_seconds_per_round": round(per_round_agg, 5),
            "key_agreement_messages_per_round": msgs[0] if msgs else None,
            "bytes_per_round_plain": pb,
            "bytes_per_round_masked": sb,
        })
        print()

    # ---- 5. the question the phase exists to answer
    #
    # Section 3.10.3 includes SCAFFOLD because masking cost should scale with the
    # size of the object masked, and SCAFFOLD transmits about twice what FedAvg
    # does. Before D79 only the model was masked and the control variate went in
    # the clear, so the cost came out at 0.98x against a payload ratio of 2.00x -
    # and worse, the variate inverted to the local model exactly. With both
    # masked, the cost should now track the payload.
    if len(summary) == 2:
        fa, sc = summary[0], summary[1]
        cost_ratio = (sc["mask_processor_seconds_per_round"]
                      / max(1e-9, fa["mask_processor_seconds_per_round"]))
        byte_ratio = (sc["bytes_per_round_masked"]
                      / max(1e-9, fa["bytes_per_round_masked"]))
        print("does masking cost track update size?")
        print(f"  SCAFFOLD / FedAvg payload      {byte_ratio:.2f}x")
        print(f"  SCAFFOLD / FedAvg masking cost {cost_ratio:.2f}x")
        if abs(cost_ratio - byte_ratio) < 0.25:
            print("  -> yes, cost tracks payload, as Section 3.10.3 expected")
        else:
            print("  -> NO. If the control variate is being masked, these should")
            print("     agree. Check that the D79 fix is active.")
            ok = False
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
