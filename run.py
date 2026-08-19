"""Entry point: python run.py experiments/<config>.yaml

Reads a YAML config, builds the dataset + partition + model, runs either a
federated or centralized experiment, and writes results (metrics.csv,
partition_report.json, config_used.yaml) with checkpoint/resume support.
"""
from __future__ import annotations

import csv
import json
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flcore.partitioning import build_partition, partition_report
from flcore.models import build_model
from flcore.federated import run_federated, train_centralized
from flcore.data import load_dataset


def _load_yaml(path):
    try:
        import yaml
        with open(path) as f:
            return yaml.safe_load(f)
    except ModuleNotFoundError:
        # minimal fallback parser so the smoke test runs without PyYAML
        return _tiny_yaml(path)


def _tiny_yaml(path):
    """Very small YAML subset parser (flat + one level of nesting via indent)."""
    root, stack = {}, [(-1, {})]
    with open(path) as f:
        lines = [ln.rstrip() for ln in f if ln.strip() and not ln.strip().startswith("#")]
    root = {}
    ctx = [(-1, root)]
    for ln in lines:
        indent = len(ln) - len(ln.lstrip())
        key, _, val = ln.strip().partition(":")
        val = val.strip()
        while ctx and indent <= ctx[-1][0]:
            ctx.pop()
        parent = ctx[-1][1]
        if val == "":
            d = {}
            parent[key] = d
            ctx.append((indent, d))
        else:
            parent[key] = _coerce(val)
    return root


def _coerce(v):
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        return v.strip('"\'')


def _checkpoint_path(outdir):
    return os.path.join(outdir, "checkpoint.npz")


class _Tee:
    """Mirror stdout into the run's own directory.

    Phase A and the first Phase B were run without capturing their terminal
    output, and it is gone: the round-by-round numbers survive in metrics.csv,
    but the warnings, the calibration table and the start time do not. Runs from
    here on write their own transcript beside their results, so a run is
    self-describing without anyone having to remember to redirect it.
    """

    def __init__(self, path, stream):
        self.file = open(path, "a", buffering=1, encoding="utf-8")
        self.stream = stream

    def write(self, s):
        self.stream.write(s)
        self.file.write(s)
        return len(s)

    def flush(self):
        self.stream.flush()
        self.file.flush()

    def close(self):
        try:
            self.file.close()
        except Exception:
            pass


def main(cfg_path):
    cfg = _load_yaml(cfg_path)
    seed = int(cfg.get("seed", 0))
    np.random.seed(seed)
    name = cfg["name"]
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results", name)
    os.makedirs(outdir, exist_ok=True)

    # Append, never truncate: a resumed run should extend its transcript rather
    # than erase the part that recorded how it started.
    log = _Tee(os.path.join(outdir, "run.log"), sys.stdout)
    sys.stdout = log
    print(f"\n{'=' * 70}\n{name}  started {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
          f"config: {cfg_path}\n{'=' * 70}")
    import atexit
    atexit.register(lambda: (setattr(sys, "stdout", log.stream), log.close()))

    # data
    Xtr, ytr, Xte, yte = load_dataset(
        cfg["dataset"], seed=seed,
        subsample=cfg.get("subsample"), subsample_test=cfg.get("subsample_test"))
    model_cfg = dict(cfg["model"]); model_cfg.setdefault("seed", seed)
    model_cfg["in_dim"] = Xtr.shape[1]
    model_cfg["num_classes"] = int(ytr.max()) + 1
    model = build_model(model_cfg)
    print(f"[{name}] model params: {model.num_params():,} | "
          f"train {len(ytr)} test {len(yte)}")

    mode = cfg.get("mode", "federated")

    if mode == "centralized":
        # D53: full pool, fixed epochs, cosine learning-rate decay, final epoch
        # reported. No validation split and no epoch selection - see the
        # docstring of train_centralized for why the earlier two-stage scheme
        # was withdrawn.
        _, hist = train_centralized(
            model, Xtr, ytr, (Xte, yte), int(cfg["epochs"]), float(cfg["lr"]),
            seed, lr_schedule=str(cfg.get("lr_schedule", "cosine")))
        _write_csv(os.path.join(outdir, "metrics.csv"), hist)
        tail = [h["test_acc"] for h in hist[-5:]]
        print(f"[{name}] centralized: final test_acc = {hist[-1]['test_acc']} "
              f"(last 5 epochs {tail}, spread {max(tail)-min(tail):.4f})")
        _finish(outdir, cfg, None)
        return

    # federated: partition
    pcfg = dict(cfg["partition"]); pcfg.setdefault("num_clients", cfg.get("num_clients", 15))
    pcfg.setdefault("seed", seed)
    parts = build_partition(ytr, pcfg)
    rep = partition_report(ytr, parts)
    with open(os.path.join(outdir, "partition_report.json"), "w") as f:
        json.dump(rep, f, indent=2)
    print(f"[{name}] partition {pcfg['kind']} | HD mean={rep['hellinger_mean']} "
          f"max={rep['hellinger_max']} | sizes[{min(rep['client_sizes'])},"
          f"{max(rep['client_sizes'])}]")

    client_train = [(Xtr[idx], ytr[idx]) for idx in parts]

    # Strategies whose clients carry state between rounds. The checkpoint stores
    # ONLY the global parameters and the round number (see np.savez below), so a
    # resumed SCAFFOLD run would restart from a zero control variate and a
    # resumed MOON run without its previous local model. Neither failure
    # announces itself in the output. Until client state is checkpointed, these
    # arms are never resumed -- an interrupted run is restarted from round zero.
    # analysis.docx D48.
    STATEFUL = {"scaffold", "moon"}

    # resume?
    start_round, init_params, prior = 0, None, []
    ckpt = _checkpoint_path(outdir)
    def _mechanism(c):
        """The settings that decide WHAT is being measured, not how far it got."""
        dp = dict(c.get("dp") or {})
        return {
            "dp_enabled": bool(dp) and bool(dp.get("enabled", True)),
            "granularity": str(dp.get("granularity", "sample")) if dp else None,
            "schedule": str(dp.get("schedule")) if dp.get("schedule") else None,
            "target_epsilon": float(dp["target_epsilon"]) if dp.get("target_epsilon") is not None else None,
            "max_grad_norm": float(dp["max_grad_norm"]) if dp.get("max_grad_norm") is not None else None,
            "secagg": bool((c.get("secagg") or {}).get("enabled", False)),
            "uniform_averaging": bool(c.get("uniform_averaging", False)),
            "strategy": str(c.get("strategy", "fedavg")).lower(),
            "rounds": int(c.get("rounds", 0)),
        }

    if os.path.exists(ckpt) and not cfg.get("fresh", False):
        data = np.load(ckpt, allow_pickle=True)
        ckpt_round = int(data["round"])
        strat = str(cfg.get("strategy", "fedavg")).lower()

        # REFUSE TO RESUME A RUN THAT MEASURED SOMETHING ELSE.
        #
        # A checkpoint records how far a run got, not what it was doing. When
        # Phase D added `granularity` and `schedule`, six runs executed as plain
        # sample-level DP under directories that claimed client-level and
        # time-adaptive; the configs were then corrected and re-launched, and
        # every one of them resumed from its completed checkpoint and did ZERO
        # rounds, leaving the wrong numbers in place and reporting success.
        #
        # So the mechanism recorded in config_used.json is compared with the
        # mechanism now being asked for, and any difference archives the old
        # outputs and restarts from round 0 - the same treatment D48 gives a
        # stateful arm that cannot safely resume.
        prev_path = os.path.join(outdir, "config_used.json")
        drift = []
        if os.path.exists(prev_path):
            try:
                prev = _mechanism(json.load(open(prev_path)))
                now = _mechanism(cfg)
                drift = [f"{k}: {prev[k]!r} -> {now[k]!r}"
                         for k in now if prev.get(k) != now[k]]
            except Exception as exc:
                drift = [f"could not read the previous config ({exc})"]

        if drift:
            stamp = time.strftime("%Y%m%d-%H%M%S")
            for fname in ("checkpoint.npz", "metrics.csv", "run.log",
                          "config_used.json"):
                src = os.path.join(outdir, fname)
                if os.path.exists(src):
                    os.rename(src, os.path.join(outdir, f"{fname}.mechanism-{stamp}"))
            print(f"[{name}] MECHANISM CHANGED since the recorded run; restarting "
                  f"from round 0 rather than resuming:")
            for d in drift:
                print(f"    {d}")
            print(f"  Previous outputs renamed with suffix .mechanism-{stamp}.")
        elif strat in STATEFUL and ckpt_round > 0:
            stamp = time.strftime("%Y%m%d-%H%M%S")
            for fname in ("checkpoint.npz", "metrics.csv"):
                src = os.path.join(outdir, fname)
                if os.path.exists(src):
                    os.rename(src, os.path.join(outdir, f"{fname}.superseded-{stamp}"))
            print(f"[{name}] REFUSING TO RESUME a stateful arm ({strat}) from "
                  f"round {ckpt_round}: client state is not checkpointed, so the "
                  f"run would continue from a zero control variate / absent "
                  f"previous model. Restarting from round 0. Partial outputs "
                  f"renamed with suffix .superseded-{stamp}.")
        else:
            start_round = ckpt_round
            init_params = {k: data[f"p_{k}"] for k in data["keys"]}
            if os.path.exists(os.path.join(outdir, "metrics.csv")):
                prior = list(csv.DictReader(open(os.path.join(outdir, "metrics.csv"))))
            print(f"[{name}] resuming from round {start_round}")

    metrics_path = os.path.join(outdir, "metrics.csv")
    ckpt_every = int(cfg.get("checkpoint_every", 5))

    def on_round(r, gparams, row):
        rows = prior + [row] if start_round else None
        # append incrementally
        _append_csv(metrics_path, row, header=(r == 1 and start_round == 0))
        if r % ckpt_every == 0 or r == int(cfg["rounds"]):
            keys = list(gparams.keys())
            np.savez(ckpt, round=r, keys=np.array(keys, dtype=object),
                     **{f"p_{k}": gparams[k] for k in keys})
        print(f"  round {r:3d}  test_acc={row['test_acc']:.4f}  "
              f"client_acc_var={row['client_acc_var']:.5f}")

    strategy = str(cfg.get("strategy", "fedavg")).lower()
    scfg = dict(cfg.get("strategy_params", {}) or {})
    server_momentum = float(cfg.get("server_momentum", 0.0))
    server_lr = float(cfg.get("server_lr", 0.5))

    # Sample-level DP (Phase B). Absent or disabled -> unprotected run.
    dp_cfg = cfg.get("dp") or None
    if dp_cfg and not dp_cfg.get("enabled", True):
        dp_cfg = None
    if dp_cfg:
        # PASS THE WHOLE BLOCK THROUGH. An earlier version rebuilt this dict
        # from three named keys, which was right when three were all that
        # existed and silently wrong the moment Phase D added `granularity` and
        # `schedule`: six runs executed as plain sample-level DP while their
        # directories claimed client-level and time-adaptive, and nothing in the
        # output said so. Copy first, coerce the numeric fields, keep the rest.
        dp_cfg = dict(dp_cfg)
        dp_cfg["target_epsilon"] = float(dp_cfg["target_epsilon"])
        dp_cfg["delta"] = float(dp_cfg.get("delta", 1e-5))
        dp_cfg["max_grad_norm"] = float(dp_cfg.get("max_grad_norm", 1.0))
        dp_cfg.pop("enabled", None)

        gran = str(dp_cfg.get("granularity", "sample"))
        sched = dp_cfg.get("schedule")
        if gran not in ("sample", "client"):
            raise SystemExit(f"unknown dp granularity {gran!r}; "
                             "expected 'sample' or 'client'")
        if sched is not None and str(sched) not in ("constant", "decreasing",
                                                    "increasing"):
            raise SystemExit(f"unknown dp schedule {sched!r}")

        # Say out loud what is about to run, so a mismatch between the label on
        # the directory and the mechanism inside it is visible in the log.
        print(f"[{name}] DP ON | granularity={gran} | "
              f"schedule={sched or 'constant'} | "
              f"target eps={dp_cfg['target_epsilon']} "
              f"delta={dp_cfg['delta']} C={dp_cfg['max_grad_norm']}")

    # Secure aggregation (Phase C). Absent or disabled -> plaintext aggregation.
    secagg_cfg = cfg.get("secagg") or None
    if secagg_cfg and not secagg_cfg.get("enabled", True):
        secagg_cfg = None
    if secagg_cfg:
        print(f"[{name}] secure aggregation on: pairwise masking")

    print(f"[{name}] strategy={strategy}"
          + (f" (FedAvgM: beta={server_momentum}, server_lr={server_lr})"
             if server_momentum else ""))

    t_start = time.time()
    _, _ = run_federated(
        model, client_train, (Xte, yte),
        rounds=int(cfg["rounds"]), local_epochs=int(cfg["local_epochs"]),
        lr=float(cfg["lr"]), seed=seed, on_round=on_round,
        start_round=start_round, init_params=init_params,
        strategy=strategy, strategy_cfg=scfg, server_momentum=server_momentum,
        server_lr=server_lr, dp_cfg=dp_cfg, secagg_cfg=secagg_cfg,
        uniform_averaging=bool(cfg.get("uniform_averaging", False)),
        record_dir=outdir,
    )
    elapsed = time.time() - t_start
    print(f"[{name}] wall-clock: {elapsed/60:.1f} min "
          f"({elapsed/max(1,int(cfg['rounds'])-start_round):.1f} s/round)")
    with open(os.path.join(outdir, "timing.txt"), "w") as f:
        f.write(f"seconds_total={elapsed:.1f}\n"
                f"rounds_run={int(cfg['rounds'])-start_round}\n"
                f"seconds_per_round={elapsed/max(1,int(cfg['rounds'])-start_round):.2f}\n")
    _finish(outdir, cfg, rep)


def _append_csv(path, row, header):
    exists = os.path.exists(path)
    with open(path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(row.keys()))
        if not exists:
            w.writeheader()
        w.writerow(row)


def _write_csv(path, rows):
    if not rows:
        return
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def _finish(outdir, cfg, rep):
    with open(os.path.join(outdir, "config_used.json"), "w") as f:
        json.dump(cfg, f, indent=2)
    print(f"[{cfg['name']}] done -> {outdir}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python run.py experiments/<config>.yaml")
        sys.exit(1)
    main(sys.argv[1])
