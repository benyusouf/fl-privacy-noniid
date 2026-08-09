"""RQ4 experiment: gradient inversion and its mitigation (Phase E).

Configuration settled by tests/compare_attack_objectives.py on 1 Aug 2026:
    architecture   LeNet with sigmoid activations (Zhu et al., 2019)
    objective      layer-wise cosine matching
    reference      19.52 dB undefended, against a 13.82 dB flat-grey floor

    python experiments/run_rq4_attack.py                 # full run
    python experiments/run_rq4_attack.py --iters 1000    # quick

Conditions:
  1. no defence          single client's raw gradient
  2. DP eps=8 (light)    clipped and noised
  3. DP eps=4            clipped and noised
  4. DP eps=1 (strong)   clipped and noised
  5. secure aggregation  attacker sees only the SUM of 15 client updates,
                         which is the practical point: there is no individual
                         gradient left to invert
  6. DP + secure agg     both defences together

Also runs the SmallCNN architecture undefended, to report the architectural
contrast: the model used for RQ1-RQ3 resists inversion where the classical
attack architecture does not.

Outputs to results/rq4_attack/:
    metrics.csv          one row per condition
    figure_grid.png      ground truth + all reconstructions (Chapter 4 figure)
    *.npy                raw arrays
"""
import argparse
import csv
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flcore.privacy import calibrate_noise_for_epsilon
from attacks.gradient_inversion import (run_attack_experiment, observed_gradient,
                                        invert_gradient, psnr)

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "results", "rq4_attack")


def load_cifar(n=256):
    from torchvision import datasets
    ds = datasets.CIFAR10(root="./data", train=True, download=True)
    X = (ds.data[:n].astype(np.float32) / 255.0).transpose(0, 3, 1, 2)
    return X, np.array(ds.targets[:n], dtype=np.int64)


def build(name, seed=0):
    cfg = {"in_channels": 3, "img_size": 32, "num_classes": 10,
           "batch_size": 8, "seed": seed, "in_dim": 3 * 32 * 32}
    if name == "lenet":
        from attacks.lenet_dlg import LeNetAdapter
        return LeNetAdapter({**cfg, "width": 12})
    from flcore.models import build_model
    return build_model({**cfg, "backend": "torch_cnn", "width": 16})


def secure_aggregation_condition(model, X, y, victim_idx, num_clients,
                                 iterations, seed, dp_noise=0.0):
    """Attacker observes the AVERAGE gradient of `num_clients` clients.

    This is what secure aggregation leaves visible: the sum, never an individual
    update. The attack still runs, but its target no longer corresponds to any
    single image.
    """
    import torch

    grads_sum = None
    for c in range(num_clients):
        lo = c * 4
        xb = torch.tensor(X[lo:lo + 4], dtype=torch.float32)
        yb = torch.tensor(y[lo:lo + 4], dtype=torch.long)
        g = observed_gradient(model, xb, yb)
        if dp_noise > 0:
            g = [t + torch.randn_like(t) * dp_noise for t in g]
        grads_sum = g if grads_sum is None else [a + b for a, b in zip(grads_sum, g)]
    target = [t / num_clients for t in grads_sum]

    x_true = torch.tensor(X[victim_idx:victim_idx + 1], dtype=torch.float32)
    y_true = torch.tensor(y[victim_idx:victim_idx + 1], dtype=torch.long)
    x_hat, hist = invert_gradient(model, target, tuple(x_true.shape),
                                  model.num_classes, y_known=y_true,
                                  iterations=iterations, seed=seed, verbose=False)
    a, b = x_hat.cpu().numpy(), x_true.cpu().numpy()
    nrm = lambda z: (z - z.min()) / (z.max() - z.min() + 1e-12)
    return {"psnr_db": round(psnr(nrm(a), nrm(b)), 2),
            "final_attack_loss": round(hist[-1], 5),
            "reconstruction": a}


def save_figure(images, titles, path):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ModuleNotFoundError:
        print("matplotlib not installed; skipping figure")
        return
    n = len(images)
    cols = min(4, n)
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(3 * cols, 3.2 * rows))
    axes = np.atleast_1d(axes).ravel()
    for ax, img, title in zip(axes, images, titles):
        im = img[0].transpose(1, 2, 0)
        im = (im - im.min()) / (im.max() - im.min() + 1e-12)
        ax.imshow(im); ax.set_title(title, fontsize=9); ax.axis("off")
    for ax in axes[len(images):]:
        ax.axis("off")
    plt.tight_layout()
    plt.savefig(path, dpi=160)
    print(f"figure written: {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=3000)
    ap.add_argument("--restarts", type=int, default=2)
    ap.add_argument("--pretrain-epochs", type=int, default=2)
    args = ap.parse_args()

    import torch
    os.makedirs(OUT, exist_ok=True)

    X, y = load_cifar(256)
    Xflat = X.reshape(len(X), -1)
    x_np = X[:1]
    x_true = torch.tensor(x_np, dtype=torch.float32)
    y_true = torch.tensor([int(y[0])], dtype=torch.long)
    grey = psnr(np.full_like(x_np, x_np.mean()), x_np)
    print(f"flat-grey floor: {grey:.2f} dB\n")

    model = build("lenet")
    for _ in range(args.pretrain_epochs):
        model.train_epoch(Xflat, y, lr=0.01, seed=0)

    rows, images, titles = [], [x_np], ["ground truth"]

    # --- DP noise multipliers CALIBRATED to the epsilon budgets, not hand-set.
    # Phase B's per-client training regime supplies sample_rate and steps, so an
    # "epsilon = 1" condition here means the same thing it means in Phase B
    # (D45). Hand-picked sigmas labelled with an epsilon would not be defensible.
    PHASE_B = dict(clients=15, train_n=20000, batch_size=64, rounds=60,
                   local_epochs=2, delta=1e-5)
    per_client = PHASE_B["train_n"] / PHASE_B["clients"]
    sample_rate = PHASE_B["batch_size"] / per_client
    steps = int(PHASE_B["rounds"] * PHASE_B["local_epochs"]
                * np.ceil(per_client / PHASE_B["batch_size"]))
    sigma = {e: calibrate_noise_for_epsilon(e, sample_rate, steps,
                                            PHASE_B["delta"]) for e in (8, 4, 1)}
    print(f"calibrated sigma (q={sample_rate:.4f}, T={steps}, "
          f"delta={PHASE_B['delta']}): "
          + ", ".join(f"eps={e} -> {s:.4f}" for e, s in sigma.items()) + "\n")

    conditions = [("no defence", 0.0), ("DP eps=8", sigma[8]),
                  ("DP eps=4", sigma[4]), ("DP eps=1", sigma[1])]
    for tag, noise in conditions:
        r = run_attack_experiment(model, x_true, y_true, dp_noise=noise,
                                  iterations=args.iters, seed=0,
                                  restarts=args.restarts, verbose=False)
        rows.append({"condition": tag, "architecture": "lenet",
                     "psnr_db": r["psnr_db"], "attack_loss": r["final_attack_loss"],
                     "vs_grey_db": round(r["psnr_db"] - grey, 2)})
        images.append(r["reconstruction"]); titles.append(f"{tag}\n{r['psnr_db']:.1f} dB")
        print(f"  {tag:14s} PSNR {r['psnr_db']:6.2f} dB  "
              f"({r['psnr_db'] - grey:+5.2f} vs grey)")
        np.save(os.path.join(OUT, f"lenet_{tag.replace(' ', '_').replace('=', '')}.npy"),
                r["reconstruction"])

    for tag, dpn in [("secure agg (15)", 0.0), ("secure agg + DP", 0.02)]:
        r = secure_aggregation_condition(model, X, y, 0, 15, args.iters, 0, dpn)
        rows.append({"condition": tag, "architecture": "lenet",
                     "psnr_db": r["psnr_db"], "attack_loss": r["final_attack_loss"],
                     "vs_grey_db": round(r["psnr_db"] - grey, 2)})
        images.append(r["reconstruction"]); titles.append(f"{tag}\n{r['psnr_db']:.1f} dB")
        print(f"  {tag:14s} PSNR {r['psnr_db']:6.2f} dB  "
              f"({r['psnr_db'] - grey:+5.2f} vs grey)")

    # architectural contrast
    m2 = build("smallcnn")
    for _ in range(args.pretrain_epochs):
        m2.train_epoch(Xflat, y, lr=0.01, seed=0)
    r = run_attack_experiment(m2, x_true, y_true, dp_noise=0.0,
                              iterations=args.iters, seed=0,
                              restarts=args.restarts, verbose=False)
    rows.append({"condition": "no defence", "architecture": "smallcnn",
                 "psnr_db": r["psnr_db"], "attack_loss": r["final_attack_loss"],
                 "vs_grey_db": round(r["psnr_db"] - grey, 2)})
    images.append(r["reconstruction"])
    titles.append(f"SmallCNN, no defence\n{r['psnr_db']:.1f} dB")
    print(f"  {'smallcnn':14s} PSNR {r['psnr_db']:6.2f} dB  "
          f"({r['psnr_db'] - grey:+5.2f} vs grey)")

    with open(os.path.join(OUT, "metrics.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    np.save(os.path.join(OUT, "ground_truth.npy"), x_np)
    save_figure(images, titles, os.path.join(OUT, "figure_grid.png"))
    print(f"\nmetrics written: {os.path.join(OUT, 'metrics.csv')}")
    print(f"grey floor for the caption: {grey:.2f} dB")


if __name__ == "__main__":
    main()
