"""Framework-agnostic federated learning core.

Operates purely on parameter dicts (get_params/set_params), so the same code
runs the NumPy smoke model and the production torch CNN. Implements:

  * local_train        - one client's local rounds
  * fedavg_aggregate   - sample-weighted parameter averaging (McMahan 2017)
  * fedprox term       - optional proximal regularization (Li 2020) [torch path]
  * run_federated      - the round loop with per-client eval, metrics, and
                         checkpoint/resume

Aggregation strategies FedProx / SCAFFOLD / MOON differ mainly in the LOCAL
objective; the server-side averaging here is shared. The strategy-specific
local steps live in strategies.py (torch) and are dispatched by config.
"""
from __future__ import annotations

import copy
import math
import numpy as np


def fedavg_aggregate(param_list: list[dict], weights: list[int]) -> dict:
    """Weighted average of client parameter dicts (weights = local sample counts)."""
    total = float(sum(weights))
    agg = {k: np.zeros_like(v) for k, v in param_list[0].items()}
    for params, w in zip(param_list, weights):
        for k, v in params.items():
            agg[k] += (w / total) * v
    return agg


def params_nbytes(params: dict) -> int:
    """Bytes to transmit one model update (for the communication-cost metric)."""
    return int(sum(v.astype(np.float32).nbytes for v in params.values()))


def local_train(model, X, y, global_params, epochs: int, lr: float, seed: int) -> dict:
    """Run `epochs` local passes starting from global_params; return new params."""
    model.set_params(global_params)
    for e in range(epochs):
        model.train_epoch(X, y, lr, seed=seed + e)
    return model.get_params()


def evaluate_global(model, params, client_data) -> tuple[float, list[float]]:
    """Set global params, return (mean per-client accuracy, per-client accuracies)."""
    model.set_params(params)
    accs = []
    for (Xc, yc) in client_data:
        acc, _ = model.evaluate(Xc, yc)
        accs.append(acc)
    return float(np.mean(accs)), accs


def run_federated(
    model,
    client_train: list[tuple],      # [(X, y), ...] per client
    test_data: tuple,               # (X_test, y_test) global test set
    rounds: int,
    local_epochs: int,
    lr: float,
    seed: int = 0,
    on_round=None,                  # callback(round, global_acc, test_acc, bytes)
    start_round: int = 0,
    init_params: dict | None = None,
    strategy: str = "fedavg",
    strategy_cfg: dict | None = None,
    server_momentum: float = 0.0,   # beta in Hsu et al. (2019); >0 enables FedAvgM
    server_lr: float = 0.5,         # NOT in Hsu et al.; see server_momentum_step
    dp_cfg: dict | None = None,     # sample-level DP-SGD; None = unprotected
    secagg_cfg: dict | None = None, # pairwise masking; None = plaintext aggregation
):
    """Core FL round loop. Returns (final_params, history list of dict rows).

    Deterministic given seed. `start_round`/`init_params` allow resuming from a
    checkpoint. Every client participates each round (cross-silo, full
    participation - analysis.docx D2).

    `strategy` selects the LOCAL objective (fedavg/fedprox/scaffold/moon);
    server-side averaging is identical for all four. Strategy state (SCAFFOLD
    control variates, MOON previous model) is kept per client across rounds.

    `dp_cfg` switches every client to local DP-SGD (Chapter 3, Section 3.8.2):
        {"target_epsilon": 4.0, "delta": 1e-5, "max_grad_norm": 1.0}
    The noise multiplier is not supplied. It is calibrated PER CLIENT, because
    a Dirichlet partition leaves clients holding very different amounts of data
    and both quantities the accountant needs - the sampling ratio q = B / N_c
    and the number of noised steps - are functions of N_c. Calibrating one
    sigma from the mean client size would hand the smallest silo a weaker
    guarantee than the one the run is labelled with. Every client therefore
    spends the same epsilon and the smallest silos carry the most noise, which
    is the interaction with heterogeneity that RQ2 asks about. See D58.
    """
    X_test, y_test = test_data
    global_params = init_params if init_params is not None else model.get_params()
    history = []
    scfg = dict(strategy_cfg or {})
    scfg.setdefault("local_epochs", local_epochs)
    scfg.setdefault("lr", lr)

    secagg_on = bool(secagg_cfg) and bool(secagg_cfg.get("enabled", True))
    if secagg_on:
        print(f"    secure aggregation ON: pairwise masking over "
              f"{len(client_train)} clients, "
              f"{len(client_train) * (len(client_train) - 1) // 2} pairs per round")

    dp_on = bool(dp_cfg)
    dp_sigmas: list[float] = []
    if dp_on:
        from flcore.privacy import calibrate_noise_for_epsilon, accountant_epsilon
        target = float(dp_cfg["target_epsilon"])
        delta = float(dp_cfg.get("delta", 1e-5))
        bs = model.batch_size
        for cid, (Xc, _) in enumerate(client_train):
            n_c = len(Xc)
            q = min(1.0, bs / max(1, n_c))
            steps_pr = int(np.ceil(n_c / bs)) * local_epochs
            total = steps_pr * rounds
            sig = calibrate_noise_for_epsilon(target, q, total, delta)
            got = accountant_epsilon(sig, q, total, delta)
            dp_sigmas.append(sig)
            print(f"    DP client {cid:2d}: n={n_c:5d} q={q:.4f} steps={total:6d} "
                  f"sigma={sig:.4f} -> eps={got:.3f}")
        scfg["dp_max_grad_norm"] = float(dp_cfg.get("max_grad_norm", 1.0))

    use_strategy = dp_on or strategy != "fedavg"
    local_fn = None
    if dp_on:
        from flcore.dp_local import get_dp_strategy
        local_fn = get_dp_strategy(strategy)
    elif use_strategy:
        from flcore.strategies import get_strategy
        local_fn = get_strategy(strategy)
    client_state: list[dict | None] = [None] * len(client_train)
    velocity: dict = {}
    global_c: dict | None = None

    for r in range(start_round, rounds):
        client_params, weights, new_states = [], [], []
        for cid, (Xc, yc) in enumerate(client_train):
            if use_strategy:
                cfg_c = dict(scfg); cfg_c["seed"] = seed + 1000 * r + cid
                if dp_on:
                    cfg_c["dp_sigma"] = dp_sigmas[cid]
                st = client_state[cid]
                if strategy == "scaffold" and global_c is not None:
                    st = dict(st or {}); st["c"] = global_c
                p, st_new = local_fn(model, Xc, yc, global_params, cfg_c, st)
                new_states.append(st_new)
                client_state[cid] = st_new
            else:
                p = local_train(model, Xc, yc, global_params, local_epochs, lr,
                                seed=seed + 1000 * r + cid)
            client_params.append(p)
            weights.append(len(yc))

        # Pairwise masking (Section 3.8.5).
        #
        # Each client scales its own contribution by its share of the total
        # sample count BEFORE masking, so the sum the server recovers is the
        # weighted mean FedAvg would have computed in the clear. Masking an
        # unweighted mean would silently change every result, which is the one
        # thing Phase C exists to rule out.
        #
        # Non-float entries are not masked - there is nothing to hide in an
        # integer buffer and adding Gaussian noise to one would corrupt it - so
        # they are taken from the plaintext aggregate.
        if secagg_on:
            from flcore.secagg import secure_aggregate
            plain = fedavg_aggregate(client_params, weights)
            masked, sec_t = secure_aggregate(
                client_params, base_seed=seed + 1000 * r, weights=weights)
            aggregated = {k: (masked[k].astype(v.dtype) if k in masked else v)
                          for k, v in plain.items()}
            sec_mask_s = sec_t["mask_processor_seconds"]
            sec_agg_s = sec_t["aggregate_processor_seconds"]
            sec_msgs = sec_t["key_agreement_messages"]
        else:
            aggregated = fedavg_aggregate(client_params, weights)
            sec_mask_s = sec_agg_s = 0.0
            sec_msgs = 0

        if strategy == "scaffold" and new_states:
            from flcore.strategies import scaffold_server_update
            if global_c is None:
                global_c = {k: np.zeros_like(v) for k, v in global_params.items()}
            global_c = scaffold_server_update(new_states, global_c, len(client_train))

        if server_momentum > 0:
            from flcore.strategies import server_momentum_step
            global_params, velocity = server_momentum_step(
                global_params, aggregated, velocity,
                beta=server_momentum, server_lr=server_lr)
        else:
            global_params = aggregated

        # metrics
        model.set_params(global_params)
        test_acc, test_loss = model.evaluate(X_test, y_test)
        train_acc, per_client = evaluate_global(
            model, global_params, client_train)
        # Client-to-server payload for one round. Nothing is actually
        # transmitted here -- this is a single-process simulation -- so the
        # figure is a deterministic model of what the PROTOCOL would send, not a
        # measurement. See analysis.docx D52 and Ch.3 Section 3.9.
        #   model update            every strategy
        # + control variate         SCAFFOLD only: the protocol transmits c_i
        #                           alongside the update, which is what makes a
        #                           SCAFFOLD round cost ~2x a FedAvg round
        #                           (Karimireddy et al. 2020; Acar et al. 2021).
        # MOON's prev_params is NOT counted: it is retained on the client and
        # never sent. Secure aggregation adds nothing here either, since a
        # masked update is the same size as a plaintext one; its key-agreement
        # traffic is reported separately in Phase C.
        bytes_model = sum(params_nbytes(p) for p in client_params)
        bytes_state = sum(params_nbytes(st["c_i"])
                          for st in new_states if st and "c_i" in st)
        row = {
            "round": r + 1,
            "test_acc": round(test_acc, 4),
            "test_loss": round(test_loss, 4),
            "mean_client_acc": round(train_acc, 4),
            "client_acc_var": round(float(np.var(per_client)), 6),
            "bytes_up": bytes_model + bytes_state,
            "bytes_model": bytes_model,
            "bytes_state": bytes_state,
            # Phase C. Zero on an unmasked run, which is what makes the paired
            # ratio in Section 3.10.3 computable from the CSVs alone. Processor
            # time, not elapsed - see secure_aggregate and Section 3.11.
            "secagg_mask_s": round(sec_mask_s, 5),
            "secagg_agg_s": round(sec_agg_s, 5),
            "secagg_msgs": sec_msgs,
        }
        history.append(row)
        if on_round:
            on_round(r + 1, global_params, row)
    return global_params, history


def train_centralized(model, X, y, test_data, epochs: int, lr: float, seed: int = 0,
                      lr_schedule: str = "cosine"):
    """Centralized baseline on the pooled data (RQ1 reference).

    Trains on the FULL pooled training set for `epochs` epochs and reports the
    final epoch. No early stopping, no validation split, no selection of any
    kind - the reported number is simply where training ended.

    LEARNING-RATE DECAY IS THE POINT (analysis.docx D53, superseding D49/D50).
    At a constant lr = 0.01 this baseline does not converge, it OSCILLATES:
    consecutive epochs differ by 3.8-4.3 accuracy points, against 0.4-0.5 for
    the federated arms on the same data and the same nominal rate. The rate was
    chosen for the federated setting, where averaging fifteen clients each round
    damps the noise - parameter averaging acts as variance reduction. Remove the
    averaging and the same rate is too large to settle.

    An earlier reading of that oscillation as OVERFITTING was wrong, and the fix
    it motivated - selecting an epoch count on a validation split - made matters
    worse, because the argmax of a noisy curve is a lucky epoch rather than a
    better model. It widened the seed spread from 2.7 to 7.7 points.

    Cosine decay to zero over `epochs` keeps the NOMINAL rate identical to the
    federated arms, so the comparison is not confounded by a different learning
    rate; only the schedule differs, and it differs for a stated reason. The
    federated arms need no schedule because averaging already provides the
    damping. Declare this asymmetry in Ch.3 Section 3.12.1.
    """
    X_test, y_test = test_data
    history = []
    for e in range(epochs):
        if lr_schedule == "cosine":
            lr_e = lr * 0.5 * (1.0 + math.cos(math.pi * e / max(1, epochs)))
        else:
            lr_e = lr
        model.train_epoch(X, y, lr_e, seed=seed + e)
        acc, loss = model.evaluate(X_test, y_test)
        history.append({"epoch": e + 1, "lr": round(lr_e, 6),
                        "test_acc": round(acc, 4), "test_loss": round(loss, 4)})
    return model.get_params(), history
