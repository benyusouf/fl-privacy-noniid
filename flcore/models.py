"""Model backends behind one common interface, so the FL core stays
framework-agnostic (analysis.docx D11).

Interface every model implements:
    get_params()            -> dict[str, np.ndarray]      (a "state dict")
    set_params(params)      -> None
    train_epoch(X, y, lr)   -> float (mean loss)          one local pass
    evaluate(X, y)          -> (accuracy, loss)
    num_params()            -> int

Two backends:
  * NumpyMLP  - pure NumPy, zero dependencies. Used for fast smoke tests and
                for verifying the FL orchestration without a GPU/torch install.
  * TorchCNN  - the production model for the real experiments (CIFAR-10,
                PathMNIST); supports Opacus DP-SGD. Imported lazily so the
                NumPy path never requires torch.

The FL server only ever sees get_params/set_params dicts, so FedAvg, SecAgg,
and the attack probe are identical regardless of backend.
"""
from __future__ import annotations

import numpy as np


# ------------------------------------------------------------ NumPy MLP ----

class NumpyMLP:
    """One-hidden-layer MLP with softmax output, trained by plain SGD.

    Small and dependency-free - its purpose is to exercise the federated
    machinery (local training, averaging, per-client eval, non-IID effects),
    not to be state of the art.
    """

    def __init__(self, in_dim: int, hidden: int, num_classes: int, seed: int = 0):
        rng = np.random.default_rng(seed)
        # He-ish init
        self.W1 = rng.normal(0, np.sqrt(2 / in_dim), (in_dim, hidden))
        self.b1 = np.zeros(hidden)
        self.W2 = rng.normal(0, np.sqrt(2 / hidden), (hidden, num_classes))
        self.b2 = np.zeros(num_classes)
        self.num_classes = num_classes

    def get_params(self) -> dict[str, np.ndarray]:
        return {k: getattr(self, k).copy() for k in ("W1", "b1", "W2", "b2")}

    def set_params(self, params: dict[str, np.ndarray]) -> None:
        for k, v in params.items():
            setattr(self, k, np.asarray(v).copy())

    def num_params(self) -> int:
        return sum(v.size for v in self.get_params().values())

    @staticmethod
    def _forward(W1, b1, W2, b2, X):
        z1 = X @ W1 + b1
        a1 = np.maximum(0, z1)              # ReLU
        logits = a1 @ W2 + b2
        logits -= logits.max(axis=1, keepdims=True)
        exp = np.exp(logits)
        probs = exp / exp.sum(axis=1, keepdims=True)
        return z1, a1, probs

    def train_epoch(self, X, y, lr: float, batch_size: int = 32, seed: int = 0) -> float:
        rng = np.random.default_rng(seed)
        order = rng.permutation(len(X))
        X, y = X[order], y[order]
        losses = []
        for i in range(0, len(X), batch_size):
            xb, yb = X[i:i + batch_size], y[i:i + batch_size]
            n = len(xb)
            z1, a1, probs = self._forward(self.W1, self.b1, self.W2, self.b2, xb)
            loss = -np.log(probs[np.arange(n), yb] + 1e-9).mean()
            losses.append(loss)
            # backprop
            d_logits = probs
            d_logits[np.arange(n), yb] -= 1
            d_logits /= n
            dW2 = a1.T @ d_logits
            db2 = d_logits.sum(0)
            da1 = d_logits @ self.W2.T
            dz1 = da1 * (z1 > 0)
            dW1 = xb.T @ dz1
            db1 = dz1.sum(0)
            self.W2 -= lr * dW2; self.b2 -= lr * db2
            self.W1 -= lr * dW1; self.b1 -= lr * db1
        return float(np.mean(losses))

    def evaluate(self, X, y) -> tuple[float, float]:
        _, _, probs = self._forward(self.W1, self.b1, self.W2, self.b2, X)
        preds = probs.argmax(1)
        acc = float((preds == y).mean())
        loss = float(-np.log(probs[np.arange(len(y)), y] + 1e-9).mean())
        return acc, loss


def build_model(cfg: dict):
    """Config dispatch: {backend: numpy_mlp|torch_cnn, ...}."""
    backend = cfg.get("backend", "numpy_mlp")
    if backend == "numpy_mlp":
        return NumpyMLP(cfg["in_dim"], cfg.get("hidden", 128),
                        cfg["num_classes"], cfg.get("seed", 0))
    if backend == "torch_cnn":
        from flcore.models_torch import TorchCNN  # lazy: only needs torch here
        return TorchCNN(cfg)
    raise ValueError(f"unknown model backend: {backend}")
