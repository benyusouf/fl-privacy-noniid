#!/usr/bin/env python3
"""
Fast checks on the DP path. Run this before the pilot and before Phase B.

    python3 experiments/dp_selftest.py

None of the DP code could be executed where it was written - that environment
has neither torch nor opacus - so this script exists to make the first real
execution cheap rather than a 36-run launch. It takes well under a minute and
exercises every seam that could be silently wrong:

  1  opacus imports, and the model passes its validator without surgery
  2  the compressed accountant history gives the same epsilon as the step loop
  3  calibration inverts the accountant: the sigma it returns spends the eps asked for
  4  GradSampleModule wraps SmallCNN and produces per-example gradients
  5  the DPOptimizer seam works: pre_step() then a data-independent correction
     then original_optimizer.step(), which is how FedProx and SCAFFOLD apply
     their terms under DP
  6  each of the four DP local steps runs one round on synthetic data and
     returns parameters of the right shape
  7  noise is actually being added: two runs at the same seed but different
     sigma must not produce identical parameters

Exit code 0 means every check passed.
"""
from __future__ import annotations

import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

PASS, FAIL = [], []


def check(name):
    def deco(fn):
        try:
            msg = fn()
            PASS.append((name, msg or ""))
            print(f"  ok    {name}" + (f"  [{msg}]" if msg else ""))
        except Exception as e:
            FAIL.append((name, e))
            print(f"  FAIL  {name}\n        {type(e).__name__}: {e}")
        return fn
    return deco


def synthetic(n=192, classes=4):
    rng = np.random.default_rng(0)
    X = rng.normal(0, 1, (n, 3 * 16 * 16)).astype(np.float32)
    y = rng.integers(0, classes, n).astype(np.int64)
    return X, y


MCFG = {"backend": "torch_cnn", "width": 8, "batch_size": 32,
        "in_channels": 3, "img_size": 16, "seed": 0,
        "in_dim": 3 * 16 * 16, "num_classes": 4}


def build():
    from flcore.models import build_model
    return build_model(dict(MCFG))


print("DP self-test\n")

# ---------------------------------------------------------------- 1
@check("opacus present and the model needs no surgery")
def _1():
    import torch, opacus
    from opacus.validators import ModuleValidator
    m = build()
    errs = ModuleValidator.validate(m.net, strict=False)
    if errs:
        raise AssertionError(f"ModuleValidator objects to the architecture: {errs}. "
                             "Replacing layers would break comparability with Phase A.")
    return f"torch {torch.__version__}, opacus {opacus.__version__}"


# ---------------------------------------------------------------- 2
@check("compressed accountant history == step loop")
def _2():
    from opacus.accountants import RDPAccountant
    from flcore.privacy import accountant_epsilon
    sigma, q, steps, delta = 1.1, 0.05, 400, 1e-5
    fast = accountant_epsilon(sigma, q, steps, delta)
    acct = RDPAccountant()
    for _ in range(steps):
        acct.step(noise_multiplier=sigma, sample_rate=q)
    slow = float(acct.get_epsilon(delta=delta))
    if abs(fast - slow) > 1e-6:
        raise AssertionError(f"fast {fast:.6f} vs loop {slow:.6f} - the compressed "
                             "history is not equivalent; remove the fast path")
    return f"eps={fast:.4f}"


# ---------------------------------------------------------------- 3
@check("calibration inverts the accountant")
def _3():
    from flcore.privacy import calibrate_noise_for_epsilon, accountant_epsilon
    q, steps, delta = 64 / 1333, 2520, 1e-5
    out = []
    for target in (1.0, 4.0, 8.0):
        sig = calibrate_noise_for_epsilon(target, q, steps, delta)
        got = accountant_epsilon(sig, q, steps, delta)
        if abs(got - target) > 0.05:
            raise AssertionError(f"target eps={target} -> sigma={sig:.4f} -> "
                                 f"realised eps={got:.4f}")
        out.append(f"eps{target:g}:sigma={sig:.3f}")
    return " ".join(out)


# ---------------------------------------------------------------- 4
@check("GradSampleModule yields per-example gradients")
def _4():
    import torch
    from opacus import GradSampleModule
    m = build()
    gsm = GradSampleModule(m.net)
    X, y = synthetic(64)
    xb, yb = m._to_tensor(X[:32], y[:32])
    out = gsm(xb)
    if isinstance(out, tuple):
        out = out[0]
    m.criterion(out, yb).backward()
    have = [(n, p.grad_sample.shape) for n, p in gsm.named_parameters()
            if getattr(p, "grad_sample", None) is not None]
    if not have:
        raise AssertionError("no parameter carries grad_sample")
    n0, s0 = have[0]
    if s0[0] != 32:
        raise AssertionError(f"per-example dimension is {s0[0]}, expected the batch 32")
    return f"{len(have)} tensors, first {n0} {tuple(s0)}"


# ---------------------------------------------------------------- 5
@check("DPOptimizer seam: pre_step -> correction -> step")
def _5():
    import torch
    from flcore.dp_local import _make_private, _named_params, _step, _release
    m = build()
    gsm, opt = _make_private(m, sigma=1.0, max_grad_norm=1.0, lr=0.1, batch_size=32)
    named = _named_params(gsm)
    if any(n.startswith("_module.") for n in named):
        raise AssertionError("parameter names still carry the GradSampleModule prefix")
    X, y = synthetic(64)
    xb, yb = m._to_tensor(X[:32], y[:32])
    opt.zero_grad()
    out = gsm(xb)
    if isinstance(out, tuple):
        out = out[0]
    m.criterion(out, yb).backward()
    before = {n: p.detach().clone() for n, p in named.items()}
    corr = {n: torch.full_like(p, 0.05) for n, p in named.items()}
    took = _step(opt, corr, named)
    if not took:
        raise AssertionError("pre_step() reported no step taken")
    moved = sum(1 for n, p in named.items() if not torch.equal(p.detach(), before[n]))
    if moved == 0:
        raise AssertionError("no parameter moved")
    _release(gsm)
    return f"{moved}/{len(named)} tensors moved"


# ---------------------------------------------------------------- 6
@check("all four DP local steps run and return correct shapes")
def _6():
    from flcore.dp_local import get_dp_strategy
    X, y = synthetic(192)
    names = []
    for strat in ("fedavg", "fedprox", "scaffold", "moon"):
        m = build()
        gp = m.get_params()
        cfg = {"lr": 0.05, "local_epochs": 1, "seed": 0, "dp_sigma": 1.0,
               "dp_max_grad_norm": 1.0, "mu": 0.01, "moon_mu": 1.0, "moon_tau": 0.5}
        fn = get_dp_strategy(strat)
        p, st = fn(m, X, y, gp, cfg, None)
        if set(p) != set(gp):
            raise AssertionError(f"{strat}: parameter keys changed")
        for k in gp:
            if p[k].shape != gp[k].shape:
                raise AssertionError(f"{strat}: {k} shape {p[k].shape} != {gp[k].shape}")
            if not np.all(np.isfinite(p[k])):
                raise AssertionError(f"{strat}: {k} contains non-finite values")
        if strat == "scaffold" and (not st or "c_i" not in st):
            raise AssertionError("scaffold returned no control variate")
        if strat == "moon" and (not st or "prev_params" not in st):
            raise AssertionError("moon returned no prev_params")
        names.append(strat)
    return ", ".join(names)


# ---------------------------------------------------------------- 7
@check("noise is real: different sigma, same seed, different result")
def _7():
    from flcore.dp_local import get_dp_strategy
    X, y = synthetic(192)
    fn = get_dp_strategy("fedavg")
    outs = []
    for sigma in (0.5, 8.0):
        m = build()
        gp = m.get_params()
        cfg = {"lr": 0.05, "local_epochs": 1, "seed": 0, "dp_sigma": sigma,
               "dp_max_grad_norm": 1.0}
        outs.append(fn(m, X, y, gp, cfg, None)[0])
    k = next(k for k in outs[0] if outs[0][k].dtype.kind == "f")
    d = float(np.abs(outs[0][k] - outs[1][k]).max())
    if d == 0.0:
        raise AssertionError("identical parameters at sigma 0.5 and 8.0 - "
                             "the noise multiplier is not reaching the optimizer")
    return f"max |delta| on {k} = {d:.4g}"


print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nThe DP path is not ready. Do not launch the pilot.")
    for n, e in FAIL:
        print(f"\n--- {n} ---")
        traceback.print_exception(type(e), e, e.__traceback__)
    sys.exit(1)
print("\nDP path looks sound. Next: python3 experiments/dp_overhead_pilot.py")
