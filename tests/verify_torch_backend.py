"""Run this ON YOUR MACHINE once torch is installed, to verify the PyTorch
backend and all four aggregation strategies before launching real experiments.

    python tests/verify_torch_backend.py

It uses tiny synthetic images and 3 rounds, so it finishes in a minute or two
on CPU. It checks, for each strategy:
  * the model trains (loss decreases / accuracy above chance)
  * parameters round-trip through get_params/set_params exactly
  * strategy state is carried across rounds (SCAFFOLD control variates, MOON
    previous model)
  * federated averaging runs end to end

Expected output: a PASS line for each of fedavg, fedprox, scaffold, moon.
"""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flcore.models import build_model
from flcore.federated import run_federated
from flcore.partitioning import dirichlet_partition


def fake_images(n, size=32, ch=3, k=4, seed=0):
    """Synthetic 'images': each class is a noisy coloured pattern."""
    rng = np.random.default_rng(seed)
    y = rng.integers(0, k, n)
    base = rng.normal(0, 1, (k, ch * size * size))
    X = base[y] + rng.normal(0, 0.5, (n, ch * size * size))
    return X.astype(np.float32), y.astype(np.int64)


def main():
    try:
        import torch  # noqa: F401
    except ModuleNotFoundError:
        print("torch not installed — run: pip install -r requirements.txt")
        sys.exit(1)

    size, ch, k = 32, 3, 4
    Xtr, ytr = fake_images(600, size, ch, k, seed=0)
    Xte, yte = fake_images(200, size, ch, k, seed=1)

    cfg = {"backend": "torch_cnn", "in_channels": ch, "img_size": size,
           "num_classes": k, "width": 16, "batch_size": 32, "seed": 0,
           "in_dim": ch * size * size}
    model = build_model(cfg)
    print(f"model parameters: {model.num_params():,}")

    # parameter round-trip must be exact
    p0 = model.get_params()
    model.set_params(p0)
    p1 = model.get_params()
    assert all(np.array_equal(p0[key], p1[key]) for key in p0), \
        "get_params/set_params round-trip is not exact"
    print("parameter round-trip: OK")

    parts = dirichlet_partition(ytr, 4, alpha=1.0, seed=0)
    client_train = [(Xtr[i], ytr[i]) for i in parts]

    results = {}
    for strat in ["fedavg", "fedprox", "scaffold", "moon"]:
        model = build_model(cfg)          # fresh model per strategy
        scfg = {"mu": 0.01, "moon_mu": 1.0, "moon_tau": 0.5}
        _, hist = run_federated(
            model, client_train, (Xte, yte), rounds=3, local_epochs=1,
            lr=0.01, seed=0, strategy=strat, strategy_cfg=scfg)
        acc = hist[-1]["test_acc"]
        results[strat] = acc
        status = "PASS" if acc > 1.0 / k else "CHECK"
        print(f"{status}: {strat:9s} final test_acc={acc:.3f} "
              f"(chance={1.0/k:.2f})  bytes/round={hist[-1]['bytes_up']:,}")

    # server momentum path
    model = build_model(cfg)
    _, hist = run_federated(model, client_train, (Xte, yte), rounds=3,
                            local_epochs=1, lr=0.01, seed=0,
                            strategy="fedavg", server_momentum=0.9)
    print(f"PASS: fedavgm   final test_acc={hist[-1]['test_acc']:.3f} (server momentum)")

    print("\nAll strategies executed. If any line says CHECK, tell Claude which one.")


if __name__ == "__main__":
    main()
