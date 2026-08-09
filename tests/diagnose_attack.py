"""Diagnostic for the gradient-inversion probe.

The verification run produced a contradiction: on LeNet the attack reached a
cosine loss of 0.000 while the reconstruction scored 9.5 dB, i.e. noise. A
perfect match to a meaningless target usually means the observed gradient is
degenerate (near zero), so any input matches it. This script tests that and the
other candidate causes in one pass.

    python tests/diagnose_attack.py

Checks, in order:
  1. Gradient norms for both architectures, at initialisation and after
     pretraining. A tiny norm explains a trivially-matched objective.
  2. Sigmoid saturation in LeNet: the fraction of activations stuck near 0 or 1.
  3. Attack at INITIALISATION vs after pretraining. Zhu et al. (2019)
     demonstrated DLG on an untrained network; trained networks are harder
     (Geiping et al., 2020), so this isolates difficulty from bugs.
  4. Sanity check on the metric: PSNR of the true image against itself, and of
     a lightly blurred copy, so we know what the scale means for this image.

Prints a short verdict pointing at the likely cause.
"""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from attacks.gradient_inversion import (observed_gradient, run_attack_experiment,
                                        psnr)


def load_cifar(n=64):
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


def main():
    import torch

    X, y = load_cifar(64)
    x_np = X[:1]
    x_true = torch.tensor(x_np, dtype=torch.float32)
    y_true = torch.tensor([int(y[0])], dtype=torch.long)
    Xflat = X.reshape(len(X), -1)

    print("=" * 66)
    print("1. GRADIENT NORMS  (tiny norm => degenerate attack objective)")
    print("=" * 66)
    for name in ("lenet", "smallcnn"):
        for pre in (0, 2):
            m = build(name)
            for _ in range(pre):
                m.train_epoch(Xflat, y, lr=0.01, seed=0)
            g = observed_gradient(m, x_true, y_true)
            norm = float(torch.sqrt(sum((t ** 2).sum() for t in g)))
            per = [float(t.norm()) for t in g]
            print(f"  {name:9s} pretrain={pre}  ||grad||={norm:.3e}  "
                  f"min_layer={min(per):.2e} max_layer={max(per):.2e}")

    print()
    print("=" * 66)
    print("2. SIGMOID SATURATION IN LENET  (fraction of activations <0.05 or >0.95)")
    print("=" * 66)
    m = build("lenet")
    acts = {}
    h = []
    for i, layer in enumerate(m.net.body):
        if layer.__class__.__name__ == "Sigmoid":
            h.append(layer.register_forward_hook(
                lambda mod, inp, out, i=i: acts.__setitem__(i, out.detach())))
    m.net(x_true)
    for hh in h:
        hh.remove()
    for i, a in sorted(acts.items()):
        sat = float(((a < 0.05) | (a > 0.95)).float().mean())
        print(f"  sigmoid layer {i}: saturated fraction = {sat:.1%}  "
              f"mean={float(a.mean()):.3f} std={float(a.std()):.3f}")

    print()
    print("=" * 66)
    print("3. METRIC SANITY  (what PSNR means for this image)")
    print("=" * 66)
    rng = np.random.default_rng(0)
    print(f"  identical copy      : {psnr(x_np, x_np):.1f} dB (inf expected)")
    noisy = np.clip(x_np + rng.normal(0, 0.05, x_np.shape), 0, 1).astype(np.float32)
    print(f"  + small noise (0.05): {psnr(noisy, x_np):.1f} dB")
    noisy2 = np.clip(x_np + rng.normal(0, 0.2, x_np.shape), 0, 1).astype(np.float32)
    print(f"  + heavy noise (0.20): {psnr(noisy2, x_np):.1f} dB")
    print(f"  pure random image   : "
          f"{psnr(rng.random(x_np.shape).astype(np.float32), x_np):.1f} dB")
    print(f"  mean-grey image     : "
          f"{psnr(np.full_like(x_np, x_np.mean()), x_np):.1f} dB")

    print()
    print("=" * 66)
    print("4. ATTACK AT INITIALISATION vs AFTER TRAINING (no DP, 2000 iters)")
    print("=" * 66)
    results = {}
    for name in ("lenet", "smallcnn"):
        for pre in (0, 2):
            m = build(name)
            for _ in range(pre):
                m.train_epoch(Xflat, y, lr=0.01, seed=0)
            r = run_attack_experiment(m, x_true, y_true, dp_noise=0.0,
                                      iterations=2000, seed=0)
            results[(name, pre)] = (r["psnr_db"], r["final_attack_loss"])
            print(f"  {name:9s} pretrain={pre}  PSNR {r['psnr_db']:6.2f} dB  "
                  f"loss {r['final_attack_loss']:.5f}")

    print()
    print("=" * 66)
    print("VERDICT")
    print("=" * 66)
    best = max(results.items(), key=lambda kv: kv[1][0])
    print(f"  best configuration: {best[0][0]} with pretrain={best[0][1]} "
          f"-> {best[1][0]:.2f} dB")
    if best[1][0] < 15:
        print("  No configuration reconstructs. The probe needs redesign, not "
              "tuning. Report this whole output to Display.")
    elif best[1][0] < 20:
        print("  Partial reconstruction only. Usable as a qualitative figure "
              "but should not be described as a full reconstruction.")
    else:
        print("  Reconstruction succeeds. Use this configuration for RQ4 and "
              "record it in analysis.docx.")


if __name__ == "__main__":
    main()
