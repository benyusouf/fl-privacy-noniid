"""Verify Phase E from what the runs RECORDED (lesson of D82/D88: never
recompute the thing being checked from config; read the data).

Checks, per condition:
  1  all 14 condition directories exist with result.json, ids match the design
  2  every row is labelled with its attack object (D32), architecture, defence
  3  PSNR re-derived from the saved reconstruction.npy / ground_truth.npy
     equals the recorded figure (data, not metadata)
  4  victim indices identical across all 14 conditions; shapes (8,3,32,32)
  5  DP rows: sigma equals the design table and realised eps is within 0.01
     of the target
  6  SecAgg rows: 15 clients, mask cancellation error < 1e-9
  7  one git commit across the phase

Writes results/E_attack/metrics.csv and figure_grid.png from the saved arrays,
and one 32x32 PNG per image for the results explorer:
    results/E_attack/ground_truth_<k>.png
    results/E_attack/<id>/reconstruction_<k>.png
Reconstructions are min-max normalised per image, the same convention the PSNR
uses, so what the site shows is exactly what was scored.
    .venv/bin/python experiments/verify_phase_e.py [--out DIR]
"""
import argparse, csv, json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from attacks.gradient_inversion import psnr  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "results", "E_attack"))
    a = ap.parse_args()
    design = json.load(open(os.path.join(a.out, "phase_e_design.json")))
    fails, rows, commits, victims = [], [], set(), set()
    nrm = lambda z: (z - z.min()) / (z.max() - z.min() + 1e-12)
    for c in design["conditions"]:
        d = os.path.join(a.out, c["id"]); p = os.path.join(d, "result.json")
        if not os.path.exists(p):
            fails.append(f"[1] {c['id']}: missing result.json"); continue
        r = json.load(open(p))
        if r["condition"] != c:
            fails.append(f"[2] {c['id']}: recorded condition differs from design")
        rec = np.load(os.path.join(d, "reconstruction.npy"))
        gt = np.load(os.path.join(d, "ground_truth.npy"))
        if rec.shape != (8, 3, 32, 32) or gt.shape != rec.shape:
            fails.append(f"[4] {c['id']}: shape {rec.shape}")
        ps = [round(psnr(nrm(x), nrm(t)), 2) for x, t in zip(rec, gt)]
        if ps != r["psnr_db_per_image"]:
            fails.append(f"[3] {c['id']}: PSNR from arrays {ps} != recorded")
        victims.add(tuple(r["victim_indices"])); commits.add(r["provenance"]["git_commit"])
        if c["eps"]:
            cal = r.get("dp_calibration", {})
            if abs(cal.get("sigma", -1) - design["sigma"][str(c["eps"])]) > 1e-12:
                fails.append(f"[5] {c['id']}: sigma {cal.get('sigma')} != design")
            if abs(cal.get("realised_epsilon", 99) - c["eps"]) > 0.01:
                fails.append(f"[5] {c['id']}: realised eps {cal.get('realised_epsilon')}")
        if c["secagg"]:
            s = r.get("secagg", {})
            if s.get("num_clients") != 15 or s.get("mask_cancellation_max_abs_error", 1) > 1e-9:
                fails.append(f"[6] {c['id']}: secagg {s}")
        rows.append(dict(id=c["id"], architecture=c["arch"], defence=c["defence"],
                         epsilon=c["eps"] or "", secagg=c["secagg"], attack_object=c["obj"],
                         psnr_db_mean=r["psnr_db_mean"], psnr_db_max=r["psnr_db_max"],
                         grey_floor_db_mean=r["grey_floor_db_mean"],
                         images_above_grey_floor=r["images_above_grey_floor"],
                         final_attack_loss=r["final_attack_loss"],
                         processor_seconds=r["processor_seconds"]))
    try:
        import matplotlib.image as mpimg
        for c in design["conditions"]:
            d = os.path.join(a.out, c["id"])
            if not os.path.exists(os.path.join(d, "reconstruction.npy")):
                continue
            rec = np.load(os.path.join(d, "reconstruction.npy"))
            gt = np.load(os.path.join(d, "ground_truth.npy"))
            for k in range(len(rec)):
                mpimg.imsave(os.path.join(d, f"reconstruction_{k}.png"),
                             np.clip(nrm(rec[k]).transpose(1, 2, 0), 0, 1))
                mpimg.imsave(os.path.join(a.out, f"ground_truth_{k}.png"),
                             np.clip(gt[k].transpose(1, 2, 0), 0, 1))
    except ModuleNotFoundError:
        fails.append("matplotlib missing; per-image PNGs not written")
    if len(victims) > 1: fails.append(f"[4] victim indices differ across conditions")
    if len(commits) > 1: fails.append(f"[7] {len(commits)} git commits across the phase")
    if rows:
        with open(os.path.join(a.out, "metrics.csv"), "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
        try:
            import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
            gt = np.load(os.path.join(a.out, rows[0]["id"], "ground_truth.npy"))
            ids = [r["id"] for r in rows]
            fig, ax = plt.subplots(len(ids) + 1, 8, figsize=(12, 1.6 * (len(ids) + 1)))
            for j in range(8):
                ax[0, j].imshow(gt[j].transpose(1, 2, 0)); ax[0, j].axis("off")
            ax[0, 0].set_title("ground truth", fontsize=7, loc="left")
            for i, r in enumerate(rows, 1):
                rec = np.load(os.path.join(a.out, r["id"], "reconstruction.npy"))
                for j in range(8):
                    ax[i, j].imshow(nrm(rec[j]).transpose(1, 2, 0)); ax[i, j].axis("off")
                ax[i, 0].set_title(f"{r['id']}  mean {r['psnr_db_mean']} dB", fontsize=7, loc="left")
            plt.tight_layout(); plt.savefig(os.path.join(a.out, "figure_grid.png"), dpi=130)
        except ModuleNotFoundError:
            print("matplotlib missing; no figure")
    for r in rows:
        print(f"{r['id']:24s} {r['psnr_db_mean']:6.2f} dB mean  {r['psnr_db_max']:6.2f} max  "
              f"grey {r['grey_floor_db_mean']:.2f}  {r['images_above_grey_floor']}/8")
    print(f"\n{len(rows)}/{len(design['conditions'])} conditions present")
    print("FAIL\n  " + "\n  ".join(fails) if fails else "ALL CHECKS PASS")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
