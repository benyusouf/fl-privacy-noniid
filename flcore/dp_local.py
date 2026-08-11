"""Sample-level DP-SGD local training for all four aggregation strategies.

Chapter 3, Section 3.8.2. Each client runs DP-SGD locally: per-example
gradients, clipped to C, summed, Gaussian noise at sigma * C added, step taken
on the noised average. Opacus supplies the per-example gradients
(GradSampleModule) and the clipping and noising (DPOptimizer).

WHERE THE STRATEGY TERMS GO, AND WHY IT MATTERS
-----------------------------------------------
Three of the four strategies add something to the plain FedAvg local step, and
the three are not alike under DP.

  FedProx   mu/2 * ||w - w_global||^2. The gradient of this term is
            mu * (w - w_global): a function of the current parameters and the
            broadcast global model, both of which the server already has. It
            depends on no training example. It is therefore added AFTER the
            noised gradient has been formed, as a data-independent shift.

  SCAFFOLD  the correction (c - c_i). Both control variates were fixed at the
            start of the round, so within the round the term is a constant.
            Added after noising, exactly as FedProx's is.

  MOON      the model-contrastive term. This one IS per-example - it compares
            each example's local representation against that example's global
            and previous representations - so it belongs INSIDE the loss that
            is backpropagated, where Opacus can form a per-example gradient for
            it and clip it along with the rest. Putting it outside would leave
            it unclipped and unaccounted.

Adding a term after DPOptimizer has noised is not a hole in the guarantee. It
is post-processing of a differentially private quantity by a function of public
data, and DP is closed under post-processing.

The same argument covers the control variate that SCAFFOLD transmits. c_i^+ is
computed as c_i - c + (w_global - w_local) / (K * lr). Every input is either
public (w_global), already released in an earlier round (c_i, c), or the DP
output of this round (w_local). Releasing it alongside the update therefore
costs no additional budget, and the accountant is not charged twice. See
analysis.docx D57.

Opacus is imported lazily so the NumPy smoke path never needs it.
"""
from __future__ import annotations

import numpy as np


def _make_private(model, sigma: float, max_grad_norm: float, lr: float,
                  batch_size: int):
    """Wrap model.net for per-example gradients and return (gsm, dp_optimizer).

    The wrapper shares parameter tensors with model.net, so model.get_params()
    reads the trained weights back without any copying. Hooks are removed by
    the caller once the round's local epochs are done.
    """
    import torch
    from opacus import GradSampleModule
    from opacus.optimizers import DPOptimizer
    from flcore.models_torch import LOCAL_MOMENTUM

    if not hasattr(model, "net"):
        raise TypeError("sample-level DP requires the torch backend (TorchCNN)")

    gsm = GradSampleModule(model.net)
    base = torch.optim.SGD(gsm.parameters(), lr=lr, momentum=LOCAL_MOMENTUM)
    opt = DPOptimizer(
        optimizer=base,
        noise_multiplier=sigma,
        max_grad_norm=max_grad_norm,
        expected_batch_size=batch_size,
    )
    return gsm, opt


def _release(gsm):
    """Detach Opacus' hooks and per-sample buffers from the underlying net."""
    for fn in ("remove_hooks", "_close"):
        if hasattr(gsm, fn):
            try:
                getattr(gsm, fn)()
                return
            except Exception:
                pass


def _step(opt, correction=None, named=None):
    """One optimizer step. `correction` is a dict name -> tensor added to the
    noised gradient before the parameters move: data-independent terms only."""
    import torch
    taken = opt.pre_step()
    if taken is False:          # Opacus skipped (virtual batch); nothing to do
        return False
    if correction:
        with torch.no_grad():
            for name, p in named.items():
                if p.grad is not None and name in correction:
                    p.grad.add_(correction[name])
    opt.original_optimizer.step()
    return True


def _named_params(gsm):
    """Parameter names as the *unwrapped* net knows them.

    GradSampleModule prefixes every name with '_module.'; strategy state is
    keyed on the bare names, so the prefix is stripped here rather than at
    every call site.
    """
    out = {}
    for name, p in gsm.named_parameters():
        out[name[len("_module."):] if name.startswith("_module.") else name] = p
    return out


# --------------------------------------------------------------- FedAvg ----

def dp_fedavg_local(model, X, y, global_params, cfg, state=None):
    import torch
    model.set_params(global_params)
    bs = model.batch_size
    gsm, opt = _make_private(model, cfg["dp_sigma"], cfg["dp_max_grad_norm"],
                             cfg["lr"], bs)
    try:
        for e in range(cfg["local_epochs"]):
            gsm.train()
            g = torch.Generator().manual_seed(cfg.get("seed", 0) + e)
            order = torch.randperm(len(X), generator=g).numpy()
            for i in range(0, len(order), bs):
                idx = order[i:i + bs]
                xb, yb = model._to_tensor(X[idx], y[idx])
                opt.zero_grad()
                out = gsm(xb)
                if isinstance(out, tuple):
                    out = out[0]
                model.criterion(out, yb).backward()
                _step(opt)
    finally:
        _release(gsm)
    return model.get_params(), state


# -------------------------------------------------------------- FedProx ----

def dp_fedprox_local(model, X, y, global_params, cfg, state=None):
    import torch
    mu = float(cfg.get("mu", 0.01))
    model.set_params(global_params)
    bs = model.batch_size
    gsm, opt = _make_private(model, cfg["dp_sigma"], cfg["dp_max_grad_norm"],
                             cfg["lr"], bs)
    named = _named_params(gsm)
    gtensors = {k: torch.tensor(v, device=model.device)
                for k, v in global_params.items()}
    try:
        for e in range(cfg["local_epochs"]):
            gsm.train()
            g = torch.Generator().manual_seed(cfg.get("seed", 0) + e)
            order = torch.randperm(len(X), generator=g).numpy()
            for i in range(0, len(order), bs):
                idx = order[i:i + bs]
                xb, yb = model._to_tensor(X[idx], y[idx])
                opt.zero_grad()
                out = gsm(xb)
                if isinstance(out, tuple):
                    out = out[0]
                model.criterion(out, yb).backward()
                # d/dw of mu/2 ||w - w_global||^2, evaluated at the current w
                with torch.no_grad():
                    corr = {n: mu * (p.detach() - gtensors[n])
                            for n, p in named.items() if n in gtensors}
                _step(opt, corr, named)
    finally:
        _release(gsm)
    return model.get_params(), state


# ------------------------------------------------------------- SCAFFOLD ----

def dp_scaffold_local(model, X, y, global_params, cfg, state=None):
    import torch
    lr = cfg["lr"]
    model.set_params(global_params)
    state = state or {}
    keys = list(global_params.keys())
    c_i = state.get("c_i") or {k: np.zeros_like(global_params[k]) for k in keys}
    c = state.get("c") or {k: np.zeros_like(global_params[k]) for k in keys}

    bs = model.batch_size
    gsm, opt = _make_private(model, cfg["dp_sigma"], cfg["dp_max_grad_norm"],
                             lr, bs)
    named = _named_params(gsm)
    corr = {k: torch.tensor(c[k] - c_i[k], device=model.device)
            for k in keys if k in named}
    steps = 0
    try:
        for e in range(cfg["local_epochs"]):
            gsm.train()
            g = torch.Generator().manual_seed(cfg.get("seed", 0) + e)
            order = torch.randperm(len(X), generator=g).numpy()
            for i in range(0, len(order), bs):
                idx = order[i:i + bs]
                xb, yb = model._to_tensor(X[idx], y[idx])
                opt.zero_grad()
                out = gsm(xb)
                if isinstance(out, tuple):
                    out = out[0]
                model.criterion(out, yb).backward()
                if _step(opt, corr, named):
                    steps += 1
    finally:
        _release(gsm)

    new_params = model.get_params()
    c_i_new = {}
    for k in keys:
        if new_params[k].dtype.kind == "f":
            c_i_new[k] = (c_i[k] - c[k]
                          + (global_params[k] - new_params[k]) / max(1, steps * lr))
        else:
            c_i_new[k] = c_i[k]
    return new_params, {"c_i": c_i_new, "c": c}


# ----------------------------------------------------------------- MOON ----

def dp_moon_local(model, X, y, global_params, cfg, state=None):
    import copy
    import torch
    import torch.nn.functional as F

    mu, tau = float(cfg.get("moon_mu", 1.0)), float(cfg.get("moon_tau", 0.5))
    state = state or {}
    model.set_params(global_params)

    global_net = copy.deepcopy(model.net).eval()
    for p in global_net.parameters():
        p.requires_grad_(False)

    prev_params = state.get("prev_params")
    prev_net = None
    if prev_params is not None:
        prev_net = copy.deepcopy(model.net)
        prev_net.load_state_dict(
            {k: torch.tensor(v, device=model.device) for k, v in prev_params.items()})
        prev_net.eval()
        for p in prev_net.parameters():
            p.requires_grad_(False)

    bs = model.batch_size
    gsm, opt = _make_private(model, cfg["dp_sigma"], cfg["dp_max_grad_norm"],
                             cfg["lr"], bs)
    try:
        for e in range(cfg["local_epochs"]):
            gsm.train()
            g = torch.Generator().manual_seed(cfg.get("seed", 0) + e)
            order = torch.randperm(len(X), generator=g).numpy()
            for i in range(0, len(order), bs):
                idx = order[i:i + bs]
                xb, yb = model._to_tensor(X[idx], y[idx])
                opt.zero_grad()
                out, feats = gsm(xb, return_features=True)
                loss = model.criterion(out, yb)
                if prev_net is not None:
                    with torch.no_grad():
                        _, z_glob = global_net(xb, return_features=True)
                        _, z_prev = prev_net(xb, return_features=True)
                    sim_glob = F.cosine_similarity(feats, z_glob, dim=1) / tau
                    sim_prev = F.cosine_similarity(feats, z_prev, dim=1) / tau
                    logits = torch.stack([sim_glob, sim_prev], dim=1)
                    labels = torch.zeros(len(logits), dtype=torch.long,
                                         device=logits.device)
                    loss = loss + mu * F.cross_entropy(logits, labels)
                loss.backward()
                _step(opt)
    finally:
        _release(gsm)

    new_params = model.get_params()
    return new_params, {"prev_params": new_params}


_DP = {
    "fedavg": dp_fedavg_local,
    "fedprox": dp_fedprox_local,
    "scaffold": dp_scaffold_local,
    "moon": dp_moon_local,
}


def get_dp_strategy(name: str):
    key = str(name).lower()
    if key not in _DP:
        raise ValueError(f"no DP local step for strategy {name!r}; "
                         f"have {sorted(_DP)}")
    return _DP[key]
