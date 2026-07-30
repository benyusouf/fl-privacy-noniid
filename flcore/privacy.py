"""Differential privacy for the federated pipeline (analysis.docx D5, D6, D7).

Two granularities, deliberately contrasted in this study:

  * SAMPLE-LEVEL DP (primary).  Each silo runs DP-SGD locally (Abadi et al.,
    2016) via Opacus: per-sample gradient clipping plus Gaussian noise. This
    protects the individual records a hospital or bank holds, which is the
    guarantee such an institution actually owes its patients or customers.

  * CLIENT-LEVEL DP (negative result).  Noise is calibrated to hide an entire
    client's contribution (Geyer et al., 2017; McMahan et al., 2018). Those
    recipes assume very large client populations; at cross-silo scale (n=15)
    the required noise destroys utility. We run it to show precisely that.

Also implements the time-adaptive noise schedule (Phase D): spend less privacy
budget in early rounds, where coarse features tolerate a low signal-to-noise
ratio, and more in later rounds where fine features need signal.

Opacus is imported lazily, so the NumPy smoke path never requires it.
"""
from __future__ import annotations

import numpy as np


# ------------------------------------------------------- sample-level DP ----

def make_private_trainer(model, sample_rate: float, noise_multiplier: float,
                         max_grad_norm: float = 1.0):
    """Attach Opacus DP-SGD to a TorchCNN. Returns a callable train_epoch.

    sample_rate       batch_size / len(local_dataset) — the sampling ratio the
                      accountant needs
    noise_multiplier  sigma: std of Gaussian noise relative to the clipping norm
    max_grad_norm     C: per-sample gradient clipping threshold
    """
    import torch
    from opacus import GradSampleModule
    from opacus.optimizers import DPOptimizer

    if not hasattr(model, "net"):
        raise TypeError("sample-level DP requires the torch backend (TorchCNN)")

    private_net = GradSampleModule(model.net)

    def train_epoch(X, y, lr, batch_size=None, seed=0, **kwargs):
        bs = batch_size or model.batch_size
        base_opt = torch.optim.SGD(private_net.parameters(), lr=lr)
        opt = DPOptimizer(
            optimizer=base_opt,
            noise_multiplier=noise_multiplier,
            max_grad_norm=max_grad_norm,
            expected_batch_size=bs,
        )
        private_net.train()
        g = torch.Generator().manual_seed(seed)
        order = torch.randperm(len(X), generator=g).numpy()
        losses = []
        for i in range(0, len(order), bs):
            idx = order[i:i + bs]
            xb, yb = model._to_tensor(X[idx], y[idx])
            opt.zero_grad()
            loss = model.criterion(private_net(xb), yb)
            loss.backward()
            opt.step()
            losses.append(loss.item())
        return float(np.mean(losses)) if losses else 0.0

    return train_epoch, private_net


def accountant_epsilon(noise_multiplier: float, sample_rate: float,
                       steps: int, delta: float = 1e-5) -> float:
    """Privacy budget spent, via Opacus' RDP accountant (Mironov, 2017).

    `steps` is the total number of noised gradient steps taken by one client
    across all rounds (local_steps_per_round * rounds).
    """
    from opacus.accountants import RDPAccountant

    acct = RDPAccountant()
    for _ in range(steps):
        acct.step(noise_multiplier=noise_multiplier, sample_rate=sample_rate)
    return float(acct.get_epsilon(delta=delta))


def calibrate_noise_for_epsilon(target_epsilon: float, sample_rate: float,
                                steps: int, delta: float = 1e-5,
                                lo: float = 0.3, hi: float = 30.0,
                                tol: float = 0.01) -> float:
    """Binary-search the noise multiplier that spends exactly `target_epsilon`.

    Used to run the experiment grid at eps in {1, 4, 8} rather than at arbitrary
    sigma values, so results are reported in the units the literature uses.
    """
    for _ in range(60):
        mid = (lo + hi) / 2
        eps = accountant_epsilon(mid, sample_rate, steps, delta)
        if abs(eps - target_epsilon) < tol:
            return mid
        if eps > target_epsilon:      # too much privacy loss -> more noise
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ------------------------------------------------------- client-level DP ----

def clip_update(update: dict, max_norm: float) -> tuple[dict, float]:
    """Clip a whole client update to L2 norm `max_norm` (the unit of protection
    in client-level DP). Returns (clipped_update, original_norm)."""
    flat = np.concatenate([v.ravel() for v in update.values()
                           if v.dtype.kind == "f"])
    norm = float(np.linalg.norm(flat))
    scale = min(1.0, max_norm / (norm + 1e-12))
    return ({k: (v * scale if v.dtype.kind == "f" else v)
             for k, v in update.items()}, norm)


def add_gaussian_noise(params: dict, sigma: float, max_norm: float,
                       num_clients: int, seed: int = 0) -> dict:
    """Server-side Gaussian mechanism for client-level DP (DP-FedAvg).

    Noise std is sigma * max_norm / num_clients, because the aggregate is a
    mean: the sensitivity of the mean to one client is max_norm / num_clients.
    With num_clients=15 this term is large relative to the signal, which is
    exactly the effect this study reports.
    """
    rng = np.random.default_rng(seed)
    std = sigma * max_norm / max(1, num_clients)
    return {k: (v + rng.normal(0, std, v.shape).astype(v.dtype)
                if v.dtype.kind == "f" else v)
            for k, v in params.items()}


# ------------------------------------------------ time-adaptive schedule ----

def adaptive_noise_schedule(total_rounds: int, base_sigma: float,
                            mode: str = "decreasing",
                            strength: float = 0.5) -> list[float]:
    """Per-round noise multipliers whose privacy cost matches a constant
    schedule at `base_sigma`, but distributed non-uniformly over rounds.

    mode="decreasing": more noise early (cheap, coarse features), less later
    (when fine features need signal) — the intuition of the 2025 time-adaptive
    DP work. mode="constant" reproduces the fixed baseline.

    The schedule is normalised so that sum(1/sigma_t^2) — the quantity that
    drives RDP composition — matches the constant schedule, keeping total
    privacy spend comparable. Always verify the realised epsilon with
    accountant_epsilon() before reporting.
    """
    if mode == "constant":
        return [base_sigma] * total_rounds

    t = np.arange(total_rounds)
    if mode == "decreasing":
        raw = 1.0 + strength * (1 - t / max(1, total_rounds - 1))
    elif mode == "increasing":
        raw = 1.0 + strength * (t / max(1, total_rounds - 1))
    else:
        raise ValueError(f"unknown schedule mode: {mode}")

    sigmas = base_sigma * raw
    # renormalise so total RDP-relevant spend matches the constant schedule
    target = total_rounds / (base_sigma ** 2)
    scale = np.sqrt(np.sum(1.0 / sigmas ** 2) / target)
    return (sigmas * scale).tolist()
