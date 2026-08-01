"""Gradient-inversion probe check (RQ4), comparing BOTH architectures.

    python tests/verify_attack_probe.py                 # both models, 3000 iters
    python tests/verify_attack_probe.py --iters 1000    # faster
    python tests/verify_attack_probe.py --model lenet   # attack model only

Two architectures are evaluated because they answer different questions:

  lenet     LeNet with sigmoid activations, the architecture used by Zhu et al.
            (2019). Gradient inversion differentiates through the gradient, so
            it needs twice-differentiable activations; this is the standard
            attack setting and should reconstruct successfully.

  smallcnn  The ReLU + GroupNorm + pooling model used for the main federated
            experiments. Expected to resist inversion far better. That contrast
            is a reportable finding, not a failure.

For each model the script runs three conditions (no DP, light DP, strong DP) and
reports PSNR against the true image plus a random-image baseline. It also
reports the final attack loss, which is the optimiser's own objective: values
near 0 mean the reconstructed gradient matches the observed one.

Guide to PSNR: below ~10 dB is noise, 15 dB is vague structure, 20 dB and above
is a clearly recognisable image.
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
    y = np.array(ds.targets[:n], dtype=np.int64)
    return X, y


def build(model_name, seed=0):
    cfg = {"in_channels": 3, "img_size": 32, "num_classes": 10,
           "batch_size": 8, "seed": seed, "in_dim": 3 * 32 * 32}
    if model_name == "lenet":
        from attacks.lenet_dlg import LeNetAdapter
        return LeNetAdapter({**cfg, "width": 12})
    from flcore.models import build_model
    return build_model({**cfg, "backend": "torch_cnn", "width": 16})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=3000)
    ap.add_argument("--model", choices=["lenet", "smallcnn", "both"],
                    default="both")
    ap.add_argument("--pretrain-epochs", type=int, default=2,
                    help="brief training on REAL data before the attack; "
                         "attacking a trained net is the realistic case")
    args = ap.parse_args()

    try:
        import torch
    except ModuleNotFoundError:
        print("torch not installed"); sys.exit(1)

    X, y = load_cifar(64)
    x_np, label = X[:1], int(y[0])
    x_true = torch.tensor(x_np, dtype=torch.float32)
    y_true = torch.tensor([label], dtype=torch.long)

    rng = np.random.default_rng(123)
    baseline = psnr(rng.random(x_np.shape).astype(np.float32), x_np)
    print(f"baseline PSNR (random image vs truth): {baseline:.2f} dB")
    print(f"iterations: {args.iters}\n")

    outdir = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "results", "attack_probe")
    os.makedirs(outdir, exist_ok=True)
    np.save(os.path.join(outdir, "ground_truth.npy"), x_np)

    models = ["lenet", "smallcnn"] if args.model == "both" else [args.model]
    summary = {}

    for mname in models:
        model = build(mname)
        # brief pretraining on REAL images (not noise)
        Xflat = X.reshape(len(X), -1)
        for _ in range(args.pretrain_epochs):
            model.train_epoch(Xflat, y, lr=0.01, seed=0)
        print(f"--- {mname} ({model.num_params():,} params) ---")
        rows = []
        for noise, tag in [(0.0, "no DP"), (0.005, "light DP"), (0.05, "strong DP")]:
            r = run_attack_experiment(model, x_true, y_true, dp_noise=noise,
                                      iterations=args.iters, seed=0)
            gain = r["psnr_db"] - baseline
            print(f"  {tag:10s} PSNR {r['psnr_db']:6.2f} dB ({gain:+.2f}) "
                  f"attack_loss {r['final_attack_loss']:.4f}")
            np.save(os.path.join(outdir,
                    f"{mname}_{tag.replace(' ', '_')}.npy"), r["reconstruction"])
            rows.append((tag, r["psnr_db"], r["final_attack_loss"]))
        summary[mname] = rows
        print()

    print("=" * 62)
    for mname, rows in summary.items():
        nodp_psnr, nodp_loss = rows[0][1], rows[0][2]
        strong_psnr = rows[-1][1]
        recon = nodp_psnr > 18
        mitigated = (nodp_psnr - strong_psnr) > 3
        print(f"{mname:9s} undefended {'RECONSTRUCTS' if recon else 'resists'} "
              f"({nodp_psnr:.1f} dB, loss {nodp_loss:.3f}); "
              f"DP mitigation {'clear' if mitigated else 'weak'} "
              f"({nodp_psnr - strong_psnr:+.1f} dB)")
    print("\nReport these two lines to Claude. Expected: lenet reconstructs and "
          "DP mitigates; smallcnn resists inversion even undefended.")


if __name__ == "__main__":
    main()
