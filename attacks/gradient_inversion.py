"""Gradient-inversion attack probe (RQ4, analysis.docx D10).

Implements the optimisation attack of Zhu & Han (2019) with the cosine-
similarity objective and total-variation prior of Geiping et al. (2020):

    x*  =  argmin_x  [ 1 - cos( grad(f(x), y),  grad_observed ) ] + a * TV(x)

The attacker holds the model architecture, the current weights, and a client's
shared gradient. It optimises a dummy image until the gradient it produces
matches the observed one. If the recovered image resembles the client's real
training image, the "raw data never leaves the device" claim has failed.

The experiment this supports (three conditions):
    1. plain FedAvg update        -> expect recognisable reconstruction
    2. update with sample-level DP -> expect reconstruction to degrade
    3. DP + secure aggregation     -> attacker sees only the SUM of 15 updates,
                                      so there is no individual gradient to invert

Reported per condition: MSE and PSNR between reconstruction and ground truth,
plus the saved images for the figure in Chapter 4.

Requires torch. Run on your machine, not in the sandbox.
"""
from __future__ import annotations

import numpy as np


def total_variation(x):
    """Image smoothness prior; suppresses high-frequency noise in the
    reconstruction (Geiping et al., 2020)."""
    import torch
    dx = (x[:, :, :, :-1] - x[:, :, :, 1:]).abs().mean()
    dy = (x[:, :, :-1, :] - x[:, :, 1:, :]).abs().mean()
    return dx + dy


def observed_gradient(model, x_true, y_true):
    """The gradient a victim client would share for one batch."""
    import torch
    model.net.zero_grad()
    out = model.net(x_true)
    loss = model.criterion(out, y_true)
    grads = torch.autograd.grad(loss, list(model.net.parameters()))
    return [g.detach().clone() for g in grads]


def observed_fedavg_update(model, X, y, local_epochs: int, lr: float,
                           batch_size: int = 8, seed: int = 0):
    """The update a client actually sends under practical FedAvg.

    Phases A-D do not transmit a single batch gradient. Each client runs
    `local_epochs` passes of local SGD and sends the resulting parameter DELTA.
    Guo et al. (2025) report that this multi-iteration setting resists
    optimisation-based gradient inversion in a way the single-gradient case does
    not, and list "practical FedAvg" as one of the factors influencing attack
    success.

    Returned in gradient form, (w_before - w_after) / (steps * lr), so the same
    inversion machinery applies. Attacking this rather than a single gradient is
    the honest test of whether the channel THIS study opens is invertible.
    """
    import copy
    import torch

    before = {k: v.clone() for k, v in model.net.state_dict().items()}
    steps = 0
    opt = torch.optim.SGD(model.net.parameters(), lr=lr)
    g = torch.Generator().manual_seed(seed)
    model.net.train()
    for e in range(local_epochs):
        order = torch.randperm(len(X), generator=g).numpy()
        for i in range(0, len(order), batch_size):
            idx = order[i:i + batch_size]
            xb, yb = model._to_tensor(X[idx], y[idx])
            opt.zero_grad()
            model.criterion(model.net(xb), yb).backward()
            opt.step()
            steps += 1
    after = model.net.state_dict()
    pseudo = []
    for (k, p_) in model.net.named_parameters():
        delta = (before[k] - after[k]) / max(1, steps * lr)
        pseudo.append(delta.detach().clone())
    model.net.load_state_dict(before)          # restore
    return pseudo, steps


def gradient_distance(grads, target_grads, loss_type: str = "cosine_layerwise"):
    """Distance between the reconstructed and observed gradients.

    IMPORTANT (found by tests/diagnose_attack.py): layer gradient norms in these
    networks span up to four orders of magnitude, so a single GLOBAL cosine over
    all layers concatenated is dominated by one layer. That layer is largely
    determined by the label, which the attacker already knows, so the objective
    can reach ~0 while carrying no information about the image.

    loss_type:
      cosine_layerwise  mean of per-layer cosine distances - every layer
                        contributes equally (default; fixes the domination bug)
      cosine_global     single cosine over concatenated layers (the buggy
                        behaviour, kept so the effect can be reported)
      l2                normalised Euclidean distance, as used by Zhu et al.
                        (2019) in the original DLG formulation
    """
    import torch

    if loss_type == "cosine_global":
        num = sum((g * t).sum() for g, t in zip(grads, target_grads))
        den = (sum((g ** 2).sum() for g in grads).sqrt()
               * sum((t ** 2).sum() for t in target_grads).sqrt())
        return 1 - num / (den + 1e-12)

    if loss_type == "l2":
        num = sum(((g - t) ** 2).sum() for g, t in zip(grads, target_grads))
        den = sum((t ** 2).sum() for t in target_grads)
        return num / (den + 1e-12)

    if loss_type == "cosine_layerwise":
        total = 0.0
        for g, t in zip(grads, target_grads):
            num = (g * t).sum()
            den = g.norm() * t.norm() + 1e-12
            total = total + (1 - num / den)
        return total / max(1, len(grads))

    raise ValueError(f"unknown loss_type: {loss_type}")


def invert_gradient(model, target_grads, shape, num_classes, y_known=None,
                    iterations: int = 3000, lr: float = 0.1,
                    tv_weight: float = 1e-2, seed: int = 0, verbose: bool = True,
                    loss_type: str = "cosine_layerwise", restarts: int = 1):
    """Reconstruct an input image from an observed gradient.

    shape      (batch, channels, H, W) of the image being recovered
    y_known    the true label, if the attacker knows it (labels are often
               recoverable analytically from the final-layer gradient sign)
    Returns    (reconstructed_tensor, history of loss values)
    """
    import torch

    device = model.device
    params = list(model.net.parameters())
    y_hat = (y_known if y_known is not None
             else torch.randint(0, num_classes, (shape[0],), device=device))

    best_x, best_loss, history = None, float("inf"), []

    for attempt in range(max(1, restarts)):
        torch.manual_seed(seed + attempt * 977)
        # init in [0,1] like natural images, rather than standard normal
        x_hat = torch.rand(shape, device=device, requires_grad=True)
        opt = torch.optim.Adam([x_hat], lr=lr)
        sched = torch.optim.lr_scheduler.MultiStepLR(
            opt, milestones=[iterations // 2, int(iterations * 0.75)], gamma=0.1)
        run_hist = []

        for it in range(iterations):
            opt.zero_grad()
            model.net.zero_grad()
            loss = model.criterion(model.net(x_hat), y_hat)
            grads = torch.autograd.grad(loss, params, create_graph=True)

            rec_loss = gradient_distance(grads, target_grads, loss_type)
            rec_loss = rec_loss + tv_weight * total_variation(x_hat)

            rec_loss.backward()
            opt.step()
            sched.step()
            with torch.no_grad():          # images live in [0,1]
                x_hat.clamp_(0, 1)
            run_hist.append(float(rec_loss.item()))
            if verbose and it % 500 == 0:
                print(f"  [restart {attempt}] iter {it:5d}  "
                      f"attack loss {rec_loss.item():.5f}")

        if run_hist[-1] < best_loss:
            best_loss, best_x, history = run_hist[-1], x_hat.detach().clone(), run_hist

    return best_x, history


def psnr(a: np.ndarray, b: np.ndarray, data_range: float = 1.0) -> float:
    """Peak signal-to-noise ratio: the reconstruction-quality metric reported
    in Chapter 4. Higher = better reconstruction = worse privacy.
    Roughly: >20 dB is a clearly recognisable image; <10 dB is noise."""
    mse = float(np.mean((a - b) ** 2))
    if mse <= 1e-12:
        return float("inf")
    return float(10 * np.log10((data_range ** 2) / mse))


def run_attack_experiment(model, x_true, y_true, dp_noise: float = 0.0,
                          iterations: int = 3000, seed: int = 0,
                          loss_type: str = "cosine_layerwise", restarts: int = 1,
                          verbose: bool = True):
    """One condition of the RQ4 experiment.

    dp_noise > 0 simulates the client having applied DP-SGD: Gaussian noise of
    that standard deviation is added to the shared gradient after clipping.
    Returns dict with psnr, mse, and the reconstruction as a numpy array.
    """
    import torch

    target = observed_gradient(model, x_true, y_true)
    if dp_noise > 0:
        # clip then noise: the DP-SGD transformation the client would apply
        flat_norm = torch.sqrt(sum((g ** 2).sum() for g in target))
        scale = min(1.0, 1.0 / float(flat_norm))
        target = [g * scale + torch.randn_like(g) * dp_noise for g in target]

    x_hat, hist = invert_gradient(
        model, target, tuple(x_true.shape), model.num_classes,
        y_known=y_true, iterations=iterations, seed=seed,
        loss_type=loss_type, restarts=restarts, verbose=verbose)

    a = x_hat.cpu().numpy()
    b = x_true.cpu().numpy()
    # normalise both to [0,1] before comparing, so PSNR is meaningful
    def norm(z):
        lo, hi = z.min(), z.max()
        return (z - lo) / (hi - lo + 1e-12)
    a_n, b_n = norm(a), norm(b)
    return {
        "dp_noise": dp_noise,
        "loss_type": loss_type,
        "psnr_db": round(psnr(a_n, b_n), 2),
        "mse": round(float(np.mean((a_n - b_n) ** 2)), 5),
        "final_attack_loss": round(hist[-1], 5),
        "reconstruction": a,
        "ground_truth": b,
    }
