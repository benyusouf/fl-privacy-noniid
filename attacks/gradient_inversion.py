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


def invert_gradient(model, target_grads, shape, num_classes, y_known=None,
                    iterations: int = 3000, lr: float = 0.1,
                    tv_weight: float = 1e-2, seed: int = 0, verbose: bool = True):
    """Reconstruct an input image from an observed gradient.

    shape      (batch, channels, H, W) of the image being recovered
    y_known    the true label, if the attacker knows it (labels are often
               recoverable analytically from the final-layer gradient sign)
    Returns    (reconstructed_tensor, history of loss values)
    """
    import torch

    torch.manual_seed(seed)
    device = model.device
    x_hat = torch.randn(shape, device=device, requires_grad=True)
    if y_known is None:
        y_hat = torch.randint(0, num_classes, (shape[0],), device=device)
    else:
        y_hat = y_known

    opt = torch.optim.Adam([x_hat], lr=lr)
    sched = torch.optim.lr_scheduler.MultiStepLR(
        opt, milestones=[iterations // 2, int(iterations * 0.75)], gamma=0.1)
    params = list(model.net.parameters())
    history = []

    for it in range(iterations):
        opt.zero_grad()
        model.net.zero_grad()
        out = model.net(x_hat)
        loss = model.criterion(out, y_hat)
        grads = torch.autograd.grad(loss, params, create_graph=True)

        # cosine-similarity objective (scale-invariant, per Geiping et al.)
        num = sum((g * t).sum() for g, t in zip(grads, target_grads))
        den = (sum((g ** 2).sum() for g in grads).sqrt()
               * sum((t ** 2).sum() for t in target_grads).sqrt())
        rec_loss = 1 - num / (den + 1e-12)
        rec_loss = rec_loss + tv_weight * total_variation(x_hat)

        rec_loss.backward()
        opt.step()
        sched.step()
        history.append(float(rec_loss.item()))
        if verbose and it % 500 == 0:
            print(f"  iter {it:5d}  attack loss {rec_loss.item():.5f}")

    return x_hat.detach(), history


def psnr(a: np.ndarray, b: np.ndarray, data_range: float = 1.0) -> float:
    """Peak signal-to-noise ratio: the reconstruction-quality metric reported
    in Chapter 4. Higher = better reconstruction = worse privacy.
    Roughly: >20 dB is a clearly recognisable image; <10 dB is noise."""
    mse = float(np.mean((a - b) ** 2))
    if mse <= 1e-12:
        return float("inf")
    return float(10 * np.log10((data_range ** 2) / mse))


def run_attack_experiment(model, x_true, y_true, dp_noise: float = 0.0,
                          iterations: int = 3000, seed: int = 0):
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
        y_known=y_true, iterations=iterations, seed=seed)

    a = x_hat.cpu().numpy()
    b = x_true.cpu().numpy()
    # normalise both to [0,1] before comparing, so PSNR is meaningful
    def norm(z):
        lo, hi = z.min(), z.max()
        return (z - lo) / (hi - lo + 1e-12)
    a_n, b_n = norm(a), norm(b)
    return {
        "dp_noise": dp_noise,
        "psnr_db": round(psnr(a_n, b_n), 2),
        "mse": round(float(np.mean((a_n - b_n) ** 2)), 5),
        "final_attack_loss": round(hist[-1], 5),
        "reconstruction": a,
        "ground_truth": b,
    }
