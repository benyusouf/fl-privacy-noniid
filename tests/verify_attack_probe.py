"""Proper check of the gradient-inversion probe (RQ4).

The earlier quick check was inconclusive because it used synthetic noise
"images" (no structure to recover) and only 300 iterations. A gradient
inversion attack needs (a) a real image, and (b) enough optimisation steps.

    python tests/verify_attack_probe.py              # CIFAR-10, 4000 iters
    python tests/verify_attack_probe.py --iters 1500 # faster, still meaningful

It reports, for each condition, PSNR against the true image AND against a
random-image baseline. The baseline is the crucial control: PSNR only means
"reconstruction succeeded" if it is clearly above what random noise scores.

Expected, if the probe is working:
    no DP        PSNR well above baseline (visibly recognisable, usually >18 dB)
    light DP     PSNR reduced
    strong DP    PSNR at or near baseline (attack defeated)

Saves reconstructions to results/attack_probe/ for the Chapter 4 figure.
"""
import argparse
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flcore.models import build_model
from attacks.gradient_inversion import run_attack_experiment, psnr


def load_one_cifar_image():
    """A single real CIFAR-10 image, normalised to [0,1]."""
    from torchvision import datasets
    ds = datasets.CIFAR10(root="./data", train=True, download=True)
    img = ds.data[7].astype(np.float32) / 255.0        # HWC
    label = int(ds.targets[7])
    return img.transpose(2, 0, 1)[None, ...], label     # NCHW


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=4000)
    ap.add_argument("--pretrain", type=int, default=30,
                    help="steps of pretraining; attacks on trained nets are "
                         "harder and more realistic (Geiping et al., 2020)")
    args = ap.parse_args()

    try:
        import torch
    except ModuleNotFoundError:
        print("torch not installed"); sys.exit(1)

    x_np, label = load_one_cifar_image()
    cfg = {"backend": "torch_cnn", "in_channels": 3, "img_size": 32,
           "num_classes": 10, "width": 16, "batch_size": 8, "seed": 0,
           "in_dim": 3 * 32 * 32}
    model = build_model(cfg)

    if args.pretrain:
        rng = np.random.default_rng(0)
        Xw = rng.normal(0.5, 0.25, (128, 3 * 32 * 32)).astype(np.float32)
        yw = rng.integers(0, 10, 128).astype(np.int64)
        for _ in range(args.pretrain // 10):
            model.train_epoch(Xw, yw, lr=0.01, seed=0)

    x_true = torch.tensor(x_np, dtype=torch.float32)
    y_true = torch.tensor([label], dtype=torch.long)

    # control: what PSNR does an unrelated random image score?
    rng = np.random.default_rng(123)
    rand_img = rng.random(x_np.shape).astype(np.float32)
    baseline = psnr(rand_img, x_np)
    print(f"baseline PSNR (random image vs truth): {baseline:.2f} dB")
    print(f"attack iterations: {args.iters}\n")

    outdir = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "results", "attack_probe")
    os.makedirs(outdir, exist_ok=True)

    rows = []
    for noise, label_txt in [(0.0, "no DP"), (0.005, "light DP"),
                             (0.05, "strong DP")]:
        r = run_attack_experiment(model, x_true, y_true, dp_noise=noise,
                                  iterations=args.iters, seed=0)
        gain = r["psnr_db"] - baseline
        verdict = ("RECONSTRUCTED" if gain > 4 else
                   "partial" if gain > 1.5 else "defeated")
        print(f"{label_txt:10s} PSNR {r['psnr_db']:6.2f} dB "
              f"({gain:+.2f} vs baseline)  -> {verdict}")
        np.save(os.path.join(outdir, f"recon_{label_txt.replace(' ', '_')}.npy"),
                r["reconstruction"])
        rows.append((label_txt, r["psnr_db"], gain, verdict))
    np.save(os.path.join(outdir, "ground_truth.npy"), x_np)

    print(f"\nreconstructions saved to results/attack_probe/")
    if rows[0][2] <= 4:
        print("\nNOTE: the undefended attack did not clearly beat the baseline.")
        print("Try --iters 8000, or tell Claude — the attack needs tuning "
              "before it can support RQ4.")
    elif rows[-1][2] >= rows[0][2] - 2:
        print("\nNOTE: strong DP did not reduce reconstruction much. "
              "Report this to Claude before using it in Chapter 4.")
    else:
        print("\nPattern is as expected: attack succeeds undefended, "
              "degrades under DP.")


if __name__ == "__main__":
    main()
