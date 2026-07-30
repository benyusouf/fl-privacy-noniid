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
):
    """Core FedAvg loop. Returns (final_params, history list of dict rows).

    Deterministic given seed. `start_round`/`init_params` allow resuming from a
    checkpoint. Every client participates each round (cross-silo, full
    participation - analysis.docx D2).
    """
    X_test, y_test = test_data
    global_params = init_params if init_params is not None else model.get_params()
    history = []
    for r in range(start_round, rounds):
        client_params, weights = [], []
        for cid, (Xc, yc) in enumerate(client_train):
            p = local_train(model, Xc, yc, global_params, local_epochs, lr,
                            seed=seed + 1000 * r + cid)
            client_params.append(p)
            weights.append(len(yc))
        global_params = fedavg_aggregate(client_params, weights)

        # metrics
        model.set_params(global_params)
        test_acc, test_loss = model.evaluate(X_test, y_test)
        train_acc, per_client = evaluate_global(
            model, global_params, client_train)
        bytes_up = sum(params_nbytes(p) for p in client_params)
        row = {
            "round": r + 1,
            "test_acc": round(test_acc, 4),
            "test_loss": round(test_loss, 4),
            "mean_client_acc": round(train_acc, 4),
            "client_acc_var": round(float(np.var(per_client)), 6),
            "bytes_up": bytes_up,
        }
        history.append(row)
        if on_round:
            on_round(r + 1, global_params, row)
    return global_params, history


def train_centralized(model, X, y, test_data, epochs: int, lr: float, seed: int = 0):
    """Centralized baseline on the pooled data (RQ1 reference)."""
    X_test, y_test = test_data
    history = []
    for e in range(epochs):
        model.train_epoch(X, y, lr, seed=seed + e)
        acc, loss = model.evaluate(X_test, y_test)
        history.append({"epoch": e + 1, "test_acc": round(acc, 4),
                        "test_loss": round(loss, 4)})
    return model.get_params(), history
