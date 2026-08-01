"""Compare gradient-matching objectives for the inversion probe.

The diagnostic showed per-layer gradient norms spanning up to 10^4, which means
a single global cosine over concatenated layers is decided by one dominant
layer. This script tests whether matching layer by layer fixes it.

    python tests/compare_attack_objectives.py                  # 2000 iters
    python tests/compare_attack_objectives.py --iters 4000 --restarts 2

Reference points for PSNR on this image, measured by diagnose_attack.py:
    random image      8.7 dB      <- attack learned nothing
    flat grey        13.8 dB      <- attack learned nothing useful
    heavy noise      14.6 dB
    light noise      26.1 dB      <- a genuinely good reconstruction

Anything at or below ~14 dB is a failure regardless of what the attack loss says.
"""
import argparse
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from attacks.gradient_inversion import run_attack_experiment, psnr


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
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=2000)
    ap.add_argument("--restarts", type=int, default=1)
    args = ap.parse_args()

    import torch

    X, y = load_cifar(64)
    x_np = X[:1]
    x_true = torch.tensor(x_np, dtype=torch.float32)
    y_true = torch.tensor([int(y[0])], dtype=torch.long)
    grey = psnr(np.full_like(x_np, x_np.mean()), x_np)
    print(f"flat-grey reference: {grey:.2f} dB  (beat this to mean anything)\n")

    outdir = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "results", "attack_probe")
    os.makedirs(outdir, exist_ok=True)
    np.save(os.path.join(outdir, "ground_truth.npy"), x_np)

    best = (None, -1)
    for mname in ("lenet", "smallcnn"):
        for lt in ("cosine_global", "cosine_layerwise", "l2"):
            model = build(mname)
            r = run_attack_experiment(model, x_true, y_true, dp_noise=0.0,
                                      iterations=args.iters, seed=0,
                                      loss_type=lt, restarts=args.restarts,
                                      verbose=False)
            gain = r["psnr_db"] - grey
            flag = ("STRONG" if r["psnr_db"] > 20 else
                    "partial" if gain > 3 else "failed")
            print(f"  {mname:9s} {lt:17s} PSNR {r['psnr_db']:6.2f} dB "
                  f"({gain:+5.2f} vs grey)  loss {r['final_attack_loss']:.5f}  {flag}")
            np.save(os.path.join(outdir, f"{mname}_{lt}.npy"), r["reconstruction"])
            if r["psnr_db"] > best[1]:
                best = (f"{mname} + {lt}", r["psnr_db"])
        print()

    print("=" * 64)
    print(f"BEST: {best[0]} at {best[1]:.2f} dB")
    if best[1] > 20:
        print("Attack works. Use this configuration for RQ4; we then rerun the "
              "three DP conditions on it.")
    elif best[1] - grey > 3:
        print("Partial only. Report to Claude; we decide between one more fix "
              "and reporting the negative result.")
    else:
        print("Still failing. This is the negative-result path: report that "
              "inversion did not recover data under this setup.")


if __name__ == "__main__":
    main()
