"""Run ON YOUR MACHINE after installing requirements, to verify the parts of
the privacy stack that need torch/opacus:

    python tests/verify_privacy_stack.py

Checks:
  1. Opacus DP-SGD attaches and trains (sample-level DP)
  2. The RDP accountant returns a finite epsilon, and epsilon grows with steps
  3. calibrate_noise_for_epsilon() hits the requested eps in {1, 4, 8}
  4. The gradient-inversion attack runs and reports PSNR for three conditions

Step 4 is slow (a few minutes on CPU) — pass --quick to shorten it.
"""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flcore.models import build_model
from flcore.privacy import (accountant_epsilon, calibrate_noise_for_epsilon,
                            make_private_trainer)


def main(quick: bool = False):
    try:
        import torch, opacus  # noqa: F401
    except ModuleNotFoundError as e:
        print(f"missing dependency: {e.name} — run pip install -r requirements.txt")
        sys.exit(1)

    size, ch, k = 32, 3, 4
    rng = np.random.default_rng(0)
    y = rng.integers(0, k, 256).astype(np.int64)
    base = rng.normal(0, 1, (k, ch * size * size))
    X = (base[y] + rng.normal(0, 0.5, (256, ch * size * size))).astype(np.float32)

    cfg = {"backend": "torch_cnn", "in_channels": ch, "img_size": size,
           "num_classes": k, "width": 16, "batch_size": 32, "seed": 0,
           "in_dim": ch * size * size}

    # 1. DP-SGD trains
    model = build_model(cfg)
    train_dp, _ = make_private_trainer(model, sample_rate=32 / 256,
                                       noise_multiplier=1.0, max_grad_norm=1.0)
    l1 = train_dp(X, y, lr=0.05, seed=0)
    l2 = train_dp(X, y, lr=0.05, seed=1)
    print(f"1. DP-SGD trains: loss {l1:.4f} -> {l2:.4f}  "
          f"{'OK' if np.isfinite(l1) and np.isfinite(l2) else 'FAIL'}")

    # 2. accountant monotone in steps
    e_short = accountant_epsilon(1.0, 32 / 256, 100)
    e_long = accountant_epsilon(1.0, 32 / 256, 400)
    print(f"2. RDP accountant: eps(100 steps)={e_short:.3f} < "
          f"eps(400 steps)={e_long:.3f}  {'OK' if e_long > e_short else 'FAIL'}")

    # 3. calibration hits the target budgets
    print("3. noise calibration:")
    for target in (1.0, 4.0, 8.0):
        sigma = calibrate_noise_for_epsilon(target, 32 / 256, 400)
        got = accountant_epsilon(sigma, 32 / 256, 400)
        ok = abs(got - target) < 0.1
        print(f"   eps target {target:>4} -> sigma {sigma:.3f} "
              f"(realised eps {got:.3f}) {'OK' if ok else 'FAIL'}")

    # 4. attack probe
    from attacks.gradient_inversion import run_attack_experiment
    import torch
    iters = 300 if quick else 2000
    model = build_model(cfg)
    x_true = torch.tensor(X[:1], dtype=torch.float32).view(1, ch, size, size)
    y_true = torch.tensor(y[:1], dtype=torch.long)
    print(f"4. gradient inversion ({iters} iters):")
    for noise, label in [(0.0, "no DP"), (0.01, "light DP"), (0.1, "strong DP")]:
        r = run_attack_experiment(model, x_true, y_true, dp_noise=noise,
                                  iterations=iters, seed=0)
        print(f"   {label:10s} PSNR {r['psnr_db']:6.2f} dB   MSE {r['mse']:.5f}")
    print("\nExpected pattern: PSNR highest with no DP and falling as noise rises.")
    print("If PSNR does not fall with DP, tell Display — the attack or the noise "
          "scaling needs adjusting before this goes in Chapter 4.")


if __name__ == "__main__":
    main(quick="--quick" in sys.argv)
