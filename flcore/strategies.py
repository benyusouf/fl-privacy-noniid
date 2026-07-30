"""Aggregation strategies: the four comparison arms (analysis.docx D3).

All four share the same server-side weighted averaging (flcore.federated.
fedavg_aggregate); they differ in the LOCAL objective each client optimises:

  FedAvg    plain local SGD                          (McMahan et al., 2017)
  FedProx   + (mu/2)||w - w_global||^2               (Li et al., 2020)
  SCAFFOLD  gradient correction via control variates (Karimireddy et al., 2020)
  MOON      + model-contrastive loss on features     (Li et al., 2021)

Each strategy exposes:
    local_update(model, X, y, global_params, cfg, state) -> (params, new_state)

`state` carries whatever the strategy must remember between rounds (SCAFFOLD's
control variates, MOON's previous local model). Cross-silo full participation
(D2) means stateful strategies are legitimate here.

FedAvgM (server momentum, Hsu et al. 2019) is a SERVER-side option and lives in
`server_momentum_step` rather than in a local objective.
"""
from __future__ import annotations

import numpy as np


# ------------------------------------------------------------- FedAvg ------

def fedavg_local(model, X, y, global_params, cfg, state=None):
    model.set_params(global_params)
    for e in range(cfg["local_epochs"]):
        model.train_epoch(X, y, cfg["lr"], seed=cfg.get("seed", 0) + e)
    return model.get_params(), state


# ------------------------------------------------------------- FedProx -----

def fedprox_local(model, X, y, global_params, cfg, state=None):
    """Proximal term mu/2 * ||w - w_global||^2 added to the local loss.

    Implemented as a gradient-level correction (equivalent, and backend-neutral):
    after each epoch, pull weights toward the global point by mu * lr.
    For the torch backend the exact penalty is applied inside the loop.
    """
    import torch  # local import: FedProx exact form needs autograd

    mu = float(cfg.get("mu", 0.01))
    model.set_params(global_params)
    gparams = {k: torch.tensor(v, device=model.device)
               for k, v in global_params.items()}

    def prox(out, feats, xb):
        term = 0.0
        for name, p in model.net.named_parameters():
            term = term + ((p - gparams[name]) ** 2).sum()
        return (mu / 2.0) * term

    opt = torch.optim.SGD(model.net.parameters(), lr=cfg["lr"], momentum=0.9)
    for e in range(cfg["local_epochs"]):
        model._epoch(X, y, opt, model.batch_size,
                     cfg.get("seed", 0) + e, extra_loss=prox)
    return model.get_params(), state


# ------------------------------------------------------------ SCAFFOLD -----

def scaffold_local(model, X, y, global_params, cfg, state=None):
    """SCAFFOLD with control variates (Option II update of the paper).

    state = {"c_i": client control variate, "c": server control variate}
    Local step: w <- w - lr * (g - c_i + c)
    After training: c_i^+ = c_i - c + (w_global - w_local) / (K * lr)
    """
    import torch

    lr, K = cfg["lr"], cfg["local_epochs"]
    model.set_params(global_params)
    state = state or {}
    keys = list(global_params.keys())
    c_i = state.get("c_i") or {k: np.zeros_like(global_params[k]) for k in keys}
    c = state.get("c") or {k: np.zeros_like(global_params[k]) for k in keys}

    corr = {k: torch.tensor(c[k] - c_i[k], device=model.device) for k in keys}
    opt = torch.optim.SGD(model.net.parameters(), lr=lr)
    named = dict(model.net.named_parameters())

    steps = 0
    for e in range(K):
        model.net.train()
        g = torch.Generator().manual_seed(cfg.get("seed", 0) + e)
        order = torch.randperm(len(X), generator=g).numpy()
        for i in range(0, len(order), model.batch_size):
            idx = order[i:i + model.batch_size]
            xb, yb = model._to_tensor(X[idx], y[idx])
            opt.zero_grad()
            loss = model.criterion(model.net(xb), yb)
            loss.backward()
            with torch.no_grad():           # apply the control-variate correction
                for name, p in named.items():
                    if p.grad is not None and name in corr:
                        p.grad.add_(corr[name])
            opt.step()
            steps += 1

    new_params = model.get_params()
    c_i_new = {}
    for k in keys:
        if new_params[k].dtype.kind == "f":
            c_i_new[k] = (c_i[k] - c[k]
                          + (global_params[k] - new_params[k]) / max(1, steps * lr))
        else:
            c_i_new[k] = c_i[k]
    return new_params, {"c_i": c_i_new, "c": c}


def scaffold_server_update(states: list[dict], global_c: dict, num_clients: int):
    """Server control variate: c <- c + (1/N) * sum_i (c_i^+ - c_i)."""
    if not states:
        return global_c
    new_c = {k: v.copy() for k, v in global_c.items()}
    for st in states:
        for k in new_c:
            if k in st["c_i"]:
                new_c[k] = new_c[k] + (st["c_i"][k] - global_c[k]) / num_clients
    return new_c


# ---------------------------------------------------------------- MOON -----

def moon_local(model, X, y, global_params, cfg, state=None):
    """Model-contrastive loss (Li et al., 2021).

    Pulls the local representation toward the GLOBAL model's representation and
    pushes it away from the PREVIOUS local model's representation:

        l_con = -log[ exp(sim(z, z_glob)/tau) /
                     (exp(sim(z, z_glob)/tau) + exp(sim(z, z_prev)/tau)) ]
        loss  = CE + mu * l_con
    """
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

    def contrastive(out, feats, xb):
        with torch.no_grad():
            _, z_glob = global_net(xb, return_features=True)
        sim_glob = F.cosine_similarity(feats, z_glob, dim=1) / tau
        if prev_net is None:
            return torch.zeros((), device=feats.device)
        with torch.no_grad():
            _, z_prev = prev_net(xb, return_features=True)
        sim_prev = F.cosine_similarity(feats, z_prev, dim=1) / tau
        logits = torch.stack([sim_glob, sim_prev], dim=1)
        labels = torch.zeros(len(logits), dtype=torch.long, device=logits.device)
        return mu * F.cross_entropy(logits, labels)

    opt = torch.optim.SGD(model.net.parameters(), lr=cfg["lr"], momentum=0.9)
    for e in range(cfg["local_epochs"]):
        model._epoch(X, y, opt, model.batch_size,
                     cfg.get("seed", 0) + e, extra_loss=contrastive)

    new_params = model.get_params()
    return new_params, {"prev_params": new_params}


# ------------------------------------------------- server momentum (FedAvgM)

def server_momentum_step(global_params, aggregated, velocity, beta: float = 0.9,
                         server_lr: float = 1.0):
    """FedAvgM (Hsu et al., 2019): treat (global - aggregated) as a pseudo-gradient.

    v <- beta*v + delta ;  w <- w - server_lr * v
    """
    new_v, new_w = {}, {}
    for k in global_params:
        delta = global_params[k] - aggregated[k]
        if global_params[k].dtype.kind != "f":
            new_v[k] = velocity.get(k, np.zeros_like(delta))
            new_w[k] = aggregated[k]
            continue
        v = beta * velocity.get(k, np.zeros_like(delta)) + delta
        new_v[k] = v
        new_w[k] = global_params[k] - server_lr * v
    return new_w, new_v


STRATEGIES = {
    "fedavg": fedavg_local,
    "fedprox": fedprox_local,
    "scaffold": scaffold_local,
    "moon": moon_local,
}


def get_strategy(name: str):
    if name not in STRATEGIES:
        raise ValueError(f"unknown strategy '{name}'; choose from {list(STRATEGIES)}")
    return STRATEGIES[name]
