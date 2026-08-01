"""LeNet variant used for the gradient-inversion demonstration (RQ4).

WHY A SEPARATE ARCHITECTURE FOR THE ATTACK

Gradient inversion optimises through the gradient itself, so it needs the
network to be twice differentiable with respect to its weights. ReLU has a
second derivative of zero almost everywhere, which removes most of the signal
the attack relies on. Zhu et al. (2019) therefore built the original Deep
Leakage from Gradients demonstration on a LeNet with SIGMOID activations, and
subsequent work (Geiping et al., 2020; and the 2025 vulnerability analyses)
confirms that reconstruction difficulty depends strongly on architecture:
activation choice, normalisation layers, pooling and network width.

This module reproduces that standard attack architecture so RQ4 is evaluated on
the same footing as the literature it is testing. The main federated
experiments (RQ1 to RQ3) continue to use SmallCNN in flcore/models_torch.py.

This split must be stated plainly in Chapter 3, and the reason given: it is a
methodological choice for comparability with prior attack evaluations, not a
convenience. The contrast is itself a finding worth reporting, namely that the
ReLU/GroupNorm architecture used for the main experiments is markedly harder to
invert than the classical attack architecture.
"""
from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn


class LeNetSigmoid(nn.Module):
    """The DLG attack architecture: strided convolutions, sigmoid activations,
    no pooling and no normalisation layers (Zhu et al., 2019)."""

    def __init__(self, in_channels: int = 3, num_classes: int = 10,
                 img_size: int = 32, width: int = 12):
        super().__init__()
        act = nn.Sigmoid
        self.body = nn.Sequential(
            nn.Conv2d(in_channels, width, 5, padding=5 // 2, stride=2), act(),
            nn.Conv2d(width, width, 5, padding=5 // 2, stride=2), act(),
            nn.Conv2d(width, width, 5, padding=5 // 2, stride=1), act(),
        )
        reduced = img_size // 4
        self.fc = nn.Linear(width * reduced * reduced, num_classes)

    def forward(self, x, return_features: bool = False):
        feats = self.body(x)
        flat = feats.view(feats.size(0), -1)
        out = self.fc(flat)
        if return_features:
            return out, flat
        return out


class LeNetAdapter:
    """Minimal adapter so the attack code can treat this like TorchCNN."""

    def __init__(self, cfg: dict):
        torch.manual_seed(cfg.get("seed", 0))
        self.img_size = int(cfg.get("img_size", 32))
        self.in_channels = int(cfg.get("in_channels", 3))
        self.num_classes = int(cfg.get("num_classes", 10))
        self.device = torch.device(cfg.get("device", "cpu"))
        self.batch_size = int(cfg.get("batch_size", 8))
        self.net = LeNetSigmoid(self.in_channels, self.num_classes,
                                self.img_size, int(cfg.get("width", 12))).to(self.device)
        self.criterion = nn.CrossEntropyLoss()

    def get_params(self):
        return {k: v.detach().cpu().numpy().copy()
                for k, v in self.net.state_dict().items()}

    def set_params(self, params):
        self.net.load_state_dict(
            {k: torch.tensor(v, device=self.device) for k, v in params.items()})

    def num_params(self):
        return sum(p.numel() for p in self.net.parameters())

    def _to_tensor(self, X, y=None):
        n = len(X)
        xt = torch.tensor(X, dtype=torch.float32, device=self.device).view(
            n, self.in_channels, self.img_size, self.img_size)
        if y is None:
            return xt
        return xt, torch.tensor(y, dtype=torch.long, device=self.device)

    def train_epoch(self, X, y, lr, batch_size=None, seed=0, **kwargs):
        bs = batch_size or self.batch_size
        opt = torch.optim.SGD(self.net.parameters(), lr=lr)
        self.net.train()
        g = torch.Generator().manual_seed(seed)
        order = torch.randperm(len(X), generator=g).numpy()
        losses = []
        for i in range(0, len(order), bs):
            idx = order[i:i + bs]
            xb, yb = self._to_tensor(X[idx], y[idx])
            opt.zero_grad()
            loss = self.criterion(self.net(xb), yb)
            loss.backward()
            opt.step()
            losses.append(loss.item())
        return float(np.mean(losses)) if losses else 0.0

    @torch.no_grad()
    def evaluate(self, X, y, batch_size: int = 256):
        self.net.eval()
        correct, total, loss_sum = 0, 0, 0.0
        for i in range(0, len(X), batch_size):
            xb, yb = self._to_tensor(X[i:i + batch_size], y[i:i + batch_size])
            out = self.net(xb)
            loss_sum += self.criterion(out, yb).item() * len(yb)
            correct += (out.argmax(1) == yb).sum().item()
            total += len(yb)
        return correct / max(1, total), loss_sum / max(1, total)
