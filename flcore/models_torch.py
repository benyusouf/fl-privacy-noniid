"""PyTorch model backend — the production path for CIFAR-10 and PathMNIST.

Implements the same interface as NumpyMLP (get_params/set_params/train_epoch/
evaluate/num_params), so flcore.federated drives it unchanged.

Kept deliberately small (~200k parameters) so the full experiment matrix is
feasible on a CPU-only laptop, per the research plan. Opacus attaches to this
module directly for sample-level DP-SGD (Phase B).

Requires: torch, torchvision. Not imported unless backend == "torch_cnn".
"""
from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


# Local optimiser momentum, shared by ALL aggregation strategies.
# Plain SGD (0.0) is the setting used in the FedAvg / FedProx / SCAFFOLD / MOON
# papers, and is required for SCAFFOLD's correction to be theoretically valid.
# Change it here (not per strategy) if you want momentum, so the four arms stay
# comparable.
LOCAL_MOMENTUM = 0.0


class SmallCNN(nn.Module):
    """Compact CNN for 28x28 or 32x32 inputs.

    GroupNorm rather than BatchNorm: BatchNorm's running statistics are both
    (a) incompatible with Opacus DP-SGD, and (b) a known confound in non-IID FL
    (the effect FedBN exploits). GroupNorm keeps the comparison clean.
    """

    def __init__(self, in_channels: int, num_classes: int, img_size: int = 32,
                 width: int = 32):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, width, 3, padding=1)
        self.gn1 = nn.GroupNorm(4, width)
        self.conv2 = nn.Conv2d(width, width * 2, 3, padding=1)
        self.gn2 = nn.GroupNorm(4, width * 2)
        self.conv3 = nn.Conv2d(width * 2, width * 2, 3, padding=1)
        self.gn3 = nn.GroupNorm(4, width * 2)
        reduced = img_size // 8
        self.fc1 = nn.Linear(width * 2 * reduced * reduced, 128)
        self.fc2 = nn.Linear(128, num_classes)

    def forward(self, x, return_features: bool = False):
        x = F.max_pool2d(F.relu(self.gn1(self.conv1(x))), 2)
        x = F.max_pool2d(F.relu(self.gn2(self.conv2(x))), 2)
        x = F.max_pool2d(F.relu(self.gn3(self.conv3(x))), 2)
        x = torch.flatten(x, 1)
        feats = F.relu(self.fc1(x))          # penultimate representation (MOON)
        out = self.fc2(feats)
        if return_features:
            return out, feats
        return out


class TorchCNN:
    """Adapter exposing SmallCNN through the framework-agnostic interface."""

    def __init__(self, cfg: dict):
        torch.manual_seed(cfg.get("seed", 0))
        self.img_size = int(cfg.get("img_size", 32))
        self.in_channels = int(cfg.get("in_channels", 3))
        self.num_classes = int(cfg["num_classes"])
        self.device = torch.device(cfg.get("device", "cpu"))
        self.batch_size = int(cfg.get("batch_size", 64))
        self.net = SmallCNN(self.in_channels, self.num_classes,
                            self.img_size, int(cfg.get("width", 32))).to(self.device)
        self.criterion = nn.CrossEntropyLoss()

    # ---- interface -------------------------------------------------------
    def get_params(self) -> dict[str, np.ndarray]:
        return {k: v.detach().cpu().numpy().copy()
                for k, v in self.net.state_dict().items()}

    def set_params(self, params: dict[str, np.ndarray]) -> None:
        sd = {k: torch.tensor(v, device=self.device)
              for k, v in params.items()}
        self.net.load_state_dict(sd, strict=True)

    def num_params(self) -> int:
        return sum(p.numel() for p in self.net.parameters())

    def _to_tensor(self, X: np.ndarray, y: np.ndarray | None = None):
        """Flat float array -> NCHW tensor."""
        n = len(X)
        xt = torch.tensor(X, dtype=torch.float32, device=self.device).view(
            n, self.in_channels, self.img_size, self.img_size)
        if y is None:
            return xt
        return xt, torch.tensor(y, dtype=torch.long, device=self.device)

    def train_epoch(self, X, y, lr: float, batch_size: int | None = None,
                    seed: int = 0, momentum: float | None = None, **kwargs) -> float:
        """One local pass of local SGD (FedAvg local objective).

        Momentum defaults to LOCAL_MOMENTUM (0.0). This must be identical for
        every strategy: SCAFFOLD's control-variate correction is derived for
        plain SGD, so mixing momentum across arms would confound the comparison
        with an optimiser difference rather than a strategy difference.
        """
        bs = batch_size or self.batch_size
        m = LOCAL_MOMENTUM if momentum is None else momentum
        opt = torch.optim.SGD(self.net.parameters(), lr=lr, momentum=m)
        return self._epoch(X, y, opt, bs, seed)

    def _epoch(self, X, y, opt, bs, seed, extra_loss=None) -> float:
        """Shared loop. `extra_loss(out, feats, xb)` adds a strategy term."""
        self.net.train()
        g = torch.Generator().manual_seed(seed)
        order = torch.randperm(len(X), generator=g).numpy()
        losses = []
        for i in range(0, len(order), bs):
            idx = order[i:i + bs]
            xb, yb = self._to_tensor(X[idx], y[idx])
            opt.zero_grad()
            out, feats = self.net(xb, return_features=True)
            loss = self.criterion(out, yb)
            if extra_loss is not None:
                loss = loss + extra_loss(out, feats, xb)
            loss.backward()
            opt.step()
            losses.append(loss.item())
        return float(np.mean(losses)) if losses else 0.0

    @torch.no_grad()
    def evaluate(self, X, y, batch_size: int = 256) -> tuple[float, float]:
        self.net.eval()
        correct, total, loss_sum = 0, 0, 0.0
        for i in range(0, len(X), batch_size):
            xb, yb = self._to_tensor(X[i:i + batch_size], y[i:i + batch_size])
            out = self.net(xb)
            loss_sum += self.criterion(out, yb).item() * len(yb)
            correct += (out.argmax(1) == yb).sum().item()
            total += len(yb)
        return correct / max(1, total), loss_sum / max(1, total)
