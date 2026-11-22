"""Phase E - gradient-inversion attack and its mitigation (RQ3).

Implements Chapter 3, Section 3.10.5 and Table 3.6 exactly: FOURTEEN attack
conditions, one seed.

    LeNet-sigmoid (Section 3.6.2), six defences x two attack objects  = 12
        none | DP eps=8 | DP eps=4 | DP eps=1 | SecAgg | SecAgg + DP eps=8
    SmallCNN width 32 (Section 3.6.1), undefended x two objects       =  2
        (architectural control)

Attack objects (D32):
    grad   one batch gradient over the victim's local data - the object the
           classical literature assumes (Zhu et al., 2019; Geiping et al., 2020)
    delta  the multi-epoch parameter delta this study's pipeline transmits,
           returned in gradient form (w_before - w_after) / (steps * lr)

Decisions taken for this driver (D184, 22 Nov 2026, Abdullahi):
    * Victim client holds 8 CIFAR-10 images, one per class (8 distinct
      classes), so the reconstruction-to-truth assignment is fixed by label.
      grad  = one step over all 8.
      delta = 2 local epochs at local batch 2, lr 0.01  -> 8 SGD steps.
    * The SecAgg+DP condition uses eps = 8, the LIGHTEST budget.
    * Labels are known to the attacker (the generous, standard assumption).

Fixed by Chapter 3:
    * layer-wise cosine gradient matching (D17), TV prior 1e-2, Adam lr 0.1
    * DP noise multiplier from the Phase B accountant: q = 0.0480, T = 2,520,
      delta = 1e-5 (D45). The whole transmitted object is clipped to unit L2
      norm and N(0, sigma^2) added per coordinate. This SIMULATES the effect
      of DP-SGD on the transmitted object and carries no eps guarantee of its
      own - Section 3.10.5 declares this, and the result rows record it.
    * SecAgg: 15 clients, the victim is client 0, the other 14 hold their own
      8 images. Each client forms the SAME kind of object from the SAME global
      model; under SecAgg+DP each clips and noises its own object before
      masking. Masking uses flcore/secagg.py and the cancellation error is
      recorded per condition. The attacker inverts the aggregate.
    * PSNR per image after min-max normalisation of both images (the probe's
      convention); the flat-grey floor is computed per image as in
      tests/compare_attack_objectives.py.

Every condition writes results/E_attack/<id>/result.json + .npy arrays.
A condition whose result.json exists is SKIPPED, never re-run silently;
delete the directory (or pass --force-id) to re-run it.

    .venv/bin/python experiments/run_phase_e.py                  # full phase
    .venv/bin/python experiments/run_phase_e.py --iters 50 --out /tmp/e_smoke
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import subprocess
import sys
import time

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from flcore.privacy import calibrate_noise_for_epsilon, accountant_epsilon  # noqa: E402
from flcore.secagg import secure_aggregate  # noqa: E402
from attacks.gradient_inversion import (observed_gradient,  # noqa: E402
                                        observed_fedavg_update,
                                        invert_gradient, psnr)

SEED = 0
NUM_CLIENTS = 15
IMAGES_PER_CLIENT = 8
LOCAL_EPOCHS = 2
LOCAL_BATCH = 2
LOCAL_LR = 0.01
PRETRAIN_N = 256
PRETRAIN_EPOCHS = 2
SA_DP_EPS = 8

# Phase B's per-client regime (D45) - identical to experiments/run_rq4_attack.py
PHASE_B = dict(clients=15, train_n=20000, batch_size=64, rounds=60,
               local_epochs=2, delta=1e-5)

DEFENCES = [  # order = run order: controls first
    ("none", None, False),
    ("dp8", 8, False), ("dp4", 4, False), ("dp1", 1, False),
    ("sa", None, True), (f"sadp{SA_DP_EPS}", SA_DP_EPS, True),
]
OBJECTS = ["grad", "delta"]


def conditions():
    out = [dict(id=f"E_lenet_none_{o}", arch="lenet", defence="none",
                eps=None, secagg=False, obj=o) for o in OBJECTS]
    out += [dict(id=f"E_smallcnn_none_{o}", arch="smallcnn", defence="none",
                 eps=None, secagg=False, obj=o) for o in OBJECTS]
    for tag, eps, sa in DEFENCES[1:]:
        out += [dict(id=f"E_lenet_{tag}_{o}", arch="lenet", defence=tag,
                     eps=eps, secagg=sa, obj=o) for o in OBJECTS]
    assert len(out) == 14 and len({c["id"] for c in out}) == 14
    return out


def phase_b_regime():
    per_client = PHASE_B["train_n"] / PHASE_B["clients"]
    q = PHASE_B["batch_size"] / per_client
    steps = int(PHASE_B["rounds"] * PHASE_B["local_epochs"]
                * np.ceil(per_client / PHASE_B["batch_size"]))
    return q, steps, PHASE_B["delta"]


def load_cifar():
    from torchvision import datasets
    ds = datasets.CIFAR10(root=os.path.join(ROOT, "data"), train=True,
                          download=False)
    X = (ds.data.astype(np.float32) / 255.0).transpose(0, 3, 1, 2)
    return X, np.array(ds.targets, dtype=np.int64)


def select_data(y):
    """15 clients x 8 images, each client 8 distinct classes; 256 disjoint
    pre-training images. Deterministic in SEED."""
    rng = np.random.default_rng(SEED)
    by_class = {c: list(rng.permutation(np.where(y == c)[0])) for c in range(10)}
    clients = []
    for _ in range(NUM_CLIENTS):
        classes = sorted(rng.choice(10, IMAGES_PER_CLIENT, replace=False))
        clients.append([int(by_class[c].pop()) for c in classes])
    used = {i for c in clients for i in c}
    pool = [i for i in rng.permutation(len(y)) if i not in used]
    pretrain = [int(i) for i in pool[:PRETRAIN_N]]
    return clients, pretrain


def build(arch):
    cfg = {"in_channels": 3, "img_size": 32, "num_classes": 10,
           "batch_size": 8, "seed": SEED, "in_dim": 3 * 32 * 32}
    if arch == "lenet":
        from attacks.lenet_dlg import LeNetAdapter
        return LeNetAdapter({**cfg, "width": 12})
    from flcore.models import build_model
    return build_model({**cfg, "backend": "torch_cnn", "width": 32})


def make_object(model, X, y, obj, seed):
    import torch
    if obj == "grad":
        xb = torch.tensor(X, dtype=torch.float32)
        yb = torch.tensor(y, dtype=torch.long)
        return observed_gradient(model, xb, yb), 1
    return observed_fedavg_update(model, X, y, local_epochs=LOCAL_EPOCHS,
                                  lr=LOCAL_LR, batch_size=LOCAL_BATCH, seed=seed)


def clip_and_noise(target, sigma, gen):
    import torch
    norm = float(torch.sqrt(sum((g ** 2).sum() for g in target)))
    scale = min(1.0, 1.0 / norm)
    noised = [g * scale + torch.randn(g.shape, generator=gen) * sigma
              for g in target]
    n_coord = sum(g.numel() for g in target)
    return noised, dict(pre_clip_norm=norm, clip_scale=scale,
                        noise_norm_expected=sigma * float(np.sqrt(n_coord)),
                        signal_norm_after_clip=norm * scale)


def per_image_psnr(rec, true):
    nrm = lambda z: (z - z.min()) / (z.max() - z.min() + 1e-12)
    out, grey = [], []
    for a, b in zip(rec, true):
        out.append(round(psnr(nrm(a), nrm(b)), 2))
        grey.append(round(psnr(np.full_like(b, b.mean()), b), 2))
    return out, grey


def git_commit():
    try:
        head = subprocess.check_output(["git", "-C", ROOT, "rev-parse", "HEAD"],
                                       text=True).strip()
        dirty = subprocess.check_output(["git", "-C", ROOT, "status", "--porcelain",
                                         "--untracked-files=no"], text=True).strip()
        return head + ("+uncommitted" if dirty else "")
    except Exception:
        return "unknown"


def run_condition(c, X, y, clients, pretrain, sigma_tab, q, steps, delta,
                  iters, restarts, out_root):
    import torch
    d = os.path.join(out_root, c["id"])
    os.makedirs(d, exist_ok=True)
    t0p, t0w = time.process_time(), time.perf_counter()

    model = build(c["arch"])
    Xp, yp = X[pretrain], y[pretrain]
    for e in range(PRETRAIN_EPOCHS):
        model.train_epoch(Xp.reshape(len(Xp), -1), yp, lr=0.01, seed=SEED + e)

    sigma = sigma_tab[c["eps"]] if c["eps"] else 0.0
    gen = torch.Generator().manual_seed(SEED)
    victim = clients[0]
    xv, yv = X[victim], y[victim]
    rec = {"condition": c, "seed": SEED}

    if not c["secagg"]:
        target, nsteps = make_object(model, xv, yv, c["obj"], SEED)
        if sigma > 0:
            target, dpinfo = clip_and_noise(target, sigma, gen)
            rec["dp"] = dpinfo
    else:
        objs, nsteps_all, dpinfos = [], [], []
        for k, idx in enumerate(clients):
            t, ns = make_object(model, X[idx], y[idx], c["obj"], SEED + k)
            if sigma > 0:
                t, info = clip_and_noise(t, sigma, gen)
                dpinfos.append(info)
            objs.append(t); nsteps_all.append(ns)
        nsteps = nsteps_all[0]
        names = [f"p{i}" for i in range(len(objs[0]))]
        as_np = [{n: g.detach().numpy().astype(np.float64)
                  for n, g in zip(names, t)} for t in objs]
        agg, timing = secure_aggregate(as_np, base_seed=SEED,
                                       weights=[IMAGES_PER_CLIENT] * NUM_CLIENTS)
        plain = {n: np.mean([u[n] for u in as_np], axis=0) for n in names}
        err = max(float(np.abs(agg[n] - plain[n]).max()) for n in names)
        target = [torch.tensor(agg[n], dtype=torch.float32) for n in names]
        rec["secagg"] = dict(num_clients=NUM_CLIENTS, mask_cancellation_max_abs_error=err,
                             key_agreement_messages=timing["key_agreement_messages"])
        if dpinfos:
            rec["dp_per_client"] = dpinfos

    if sigma > 0:
        rec["dp_calibration"] = dict(
            target_epsilon=c["eps"], sigma=sigma, sample_rate=q, steps=steps,
            delta=delta, realised_epsilon=accountant_epsilon(sigma, q, steps, delta),
            note="noise scale from the Phase B accountant; applied to the clipped "
                 "transmitted object, so the object carries no eps guarantee "
                 "of its own (Section 3.10.5)")

    x_true = torch.tensor(xv, dtype=torch.float32)
    y_true = torch.tensor(yv, dtype=torch.long)
    x_hat, hist = invert_gradient(model, target, tuple(x_true.shape),
                                  model.num_classes, y_known=y_true,
                                  iterations=iters, seed=SEED,
                                  loss_type="cosine_layerwise",
                                  restarts=restarts, verbose=False)
    r = x_hat.cpu().numpy()
    ps, grey = per_image_psnr(r, xv)

    rec.update({
        "victim_indices": victim, "victim_labels": [int(v) for v in yv],
        "object_local_steps": nsteps,
        "psnr_db_per_image": ps, "grey_floor_db_per_image": grey,
        "psnr_db_mean": round(float(np.mean(ps)), 2),
        "psnr_db_max": round(float(np.max(ps)), 2),
        "grey_floor_db_mean": round(float(np.mean(grey)), 2),
        "images_above_grey_floor": int(sum(p > g for p, g in zip(ps, grey))),
        "final_attack_loss": round(hist[-1], 6),
        "attack": dict(objective="cosine_layerwise", tv_weight=1e-2, adam_lr=0.1,
                       iterations=iters, restarts=restarts, labels_known=True),
        "model": dict(arch=c["arch"], params=model.num_params(),
                      pretrain_images=PRETRAIN_N, pretrain_epochs=PRETRAIN_EPOCHS),
        "local_training": dict(epochs=LOCAL_EPOCHS, batch=LOCAL_BATCH, lr=LOCAL_LR,
                               images=IMAGES_PER_CLIENT),
        "processor_seconds": round(time.process_time() - t0p, 2),
        "elapsed_seconds": round(time.perf_counter() - t0w, 2),
        "provenance": dict(git_commit=git_commit(),
                           driver_sha256=__import__("hashlib").sha256(
                               open(os.path.abspath(__file__), "rb").read()).hexdigest(), python=platform.python_version(),
                           torch=torch.__version__, platform=platform.platform()),
    })
    np.save(os.path.join(d, "reconstruction.npy"), r)
    np.save(os.path.join(d, "ground_truth.npy"), xv)
    np.save(os.path.join(d, "attack_loss_history.npy"), np.array(hist))
    tmp = os.path.join(d, "result.json.tmp")
    with open(tmp, "w") as f:
        json.dump(rec, f, indent=2)
    os.replace(tmp, os.path.join(d, "result.json"))
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=3000)
    ap.add_argument("--restarts", type=int, default=2)
    ap.add_argument("--out", default=os.path.join(ROOT, "results", "E_attack"))
    ap.add_argument("--only", nargs="*", help="run only these condition ids")
    args = ap.parse_args()

    import torch
    torch.set_num_threads(max(1, os.cpu_count() or 1))
    os.makedirs(args.out, exist_ok=True)
    X, y = load_cifar()
    clients, pretrain = select_data(y)
    q, steps, delta = phase_b_regime()
    sigma_tab = {e: calibrate_noise_for_epsilon(e, q, steps, delta) for e in (8, 4, 1)}
    print(f"q={q:.4f} T={steps} delta={delta}  sigma: "
          + ", ".join(f"eps={e}->{s:.4f}" for e, s in sigma_tab.items()), flush=True)
    with open(os.path.join(args.out, "phase_e_design.json"), "w") as f:
        json.dump(dict(conditions=conditions(), clients=clients, pretrain=pretrain,
                       sigma=sigma_tab, sample_rate=q, steps=steps, delta=delta,
                       iters=args.iters, restarts=args.restarts), f, indent=2)

    for c in conditions():
        if args.only and c["id"] not in args.only:
            continue
        if os.path.exists(os.path.join(args.out, c["id"], "result.json")):
            print(f"SKIP {c['id']} (result.json exists)", flush=True)
            continue
        print(f"RUN  {c['id']} ...", flush=True)
        r = run_condition(c, X, y, clients, pretrain, sigma_tab, q, steps, delta,
                          args.iters, args.restarts, args.out)
        print(f"DONE {c['id']}: mean {r['psnr_db_mean']:.2f} dB, max "
              f"{r['psnr_db_max']:.2f} dB, grey {r['grey_floor_db_mean']:.2f} dB, "
              f"{r['images_above_grey_floor']}/8 above floor, "
              f"{r['processor_seconds']:.0f} cpu-s", flush=True)
    print("PHASE E DRIVER FINISHED", flush=True)


if __name__ == "__main__":
    main()
