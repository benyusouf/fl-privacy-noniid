"""Generate every Phase B config: the cost of sample-level differential privacy.

    python experiments/generate_phase_b.py          # writes experiments/phase_b/*.yaml
    python experiments/generate_phase_b.py --list   # just print what would be made

Chapter 3, Section 3.10.2. Thirty-six runs: CIFAR-10 only, the three Dirichlet
settings, the four strategies, at eps in {1, 4, 8}, delta = 1e-5.

  4 strategies x 3 Dirichlet settings x 3 budgets = 36

PathMNIST is excluded from this phase. Every other quantity - rounds, local
epochs, batch size, learning rate, client count, architecture, subsample size
and seed - is held at its Phase A value, because the comparator for each run is
the corresponding Phase A run and not a fresh unprotected baseline. Only the
noise multiplier moves, and it is not set here: it is calibrated at run time,
per client, from that client's sampling ratio and step count (D58).

Seed 0 only. Phase A gives three seeds on this block, so the seed-0 comparison
is like for like, and the spread already measured there bounds what a
single-seed Phase B difference can be claimed to mean. Any Phase B difference
smaller than the Phase A seed spread at the same cell is not a finding.

DO NOT LAUNCH THIS PHASE UNTIL THE PILOT HAS RUN:
    python experiments/dp_overhead_pilot.py
Section 3.10.2 makes the measured overhead factor a precondition, because an
overhead of four instead of three would make Phase B larger than every other
phase combined.
"""
import argparse
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "phase_b")

STRATEGIES = ["fedavg", "fedprox", "scaffold", "moon"]
EPSILONS = [1, 4, 8]
DIRICHLET = {"dir100": 100.0, "dir1.0": 1.0, "dir0.1": 0.1}
SEED = 0

# Identical to generate_phase_a.BASE. Any drift between the two makes the
# Phase A comparator invalid, so these are duplicated deliberately rather than
# imported, and the equality is asserted in check() below.
BASE = {
    "num_clients": 15,
    "rounds": 60,
    "local_epochs": 2,
    "lr": 0.01,
    "checkpoint_every": 5,
    "subsample": 20000,
    "subsample_test": 5000,
}
MODEL = {"backend": "torch_cnn", "width": 32, "batch_size": 64,
         "in_channels": 3, "img_size": 32}
STRAT_PARAMS = {"mu": 0.01, "moon_mu": 1.0, "moon_tau": 0.5}

# Section 3.8.2: clipping norm C = 1.0, only sigma varies.
MAX_GRAD_NORM = 1.0
# Written in plain decimal, not 1e-5. YAML 1.1 requires a decimal point and a
# signed exponent to recognise a float, so PyYAML reads "1e-05" as a STRING.
# run.py casts with float() and would survive it, but a value that is a string
# in one parser and a number in the other is not worth keeping in the file.
DELTA = "0.00001"


def yaml_dump(d, indent=0):
    lines = []
    for k, v in d.items():
        pad = "  " * indent
        if isinstance(v, dict):
            lines.append(f"{pad}{k}:")
            lines.append(yaml_dump(v, indent + 1))
        else:
            lines.append(f"{pad}{k}: {v}")
    return "\n".join(l for l in lines if l)


def make(strategy, pkey, eps):
    name = f"B_cifar10_{strategy}_{pkey}_eps{eps}_s{SEED}"
    cfg = {"name": name, "seed": SEED, "dataset": "cifar10", "mode": "federated"}
    cfg.update(BASE)
    cfg["strategy"] = strategy
    cfg["model"] = dict(MODEL)
    cfg["strategy_params"] = dict(STRAT_PARAMS)
    cfg["partition"] = {"kind": "dirichlet", "alpha": DIRICHLET[pkey],
                        "num_clients": BASE["num_clients"], "seed": SEED}
    cfg["dp"] = {"enabled": "true", "target_epsilon": eps,
                 "delta": DELTA, "max_grad_norm": MAX_GRAD_NORM}
    cfg["comparator"] = f"A_cifar10_{strategy}_{pkey}_s{SEED}"
    return cfg


def build_all():
    return [make(s, p, e) for s in STRATEGIES for p in DIRICHLET for e in EPSILONS]


def check(configs):
    """Guard the one thing that would silently invalidate the whole phase: a
    Phase B run whose training regime has drifted from its Phase A comparator."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "gpa", os.path.join(HERE, "generate_phase_a.py"))
    gpa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gpa)
    problems = []
    for k, v in BASE.items():
        if gpa.BASE.get(k) != v:
            problems.append(f"BASE[{k}]: phase A {gpa.BASE.get(k)!r} vs phase B {v!r}")
    for k, v in MODEL.items():
        if gpa.MODEL.get(k) != v:
            problems.append(f"MODEL[{k}]: phase A {gpa.MODEL.get(k)!r} vs phase B {v!r}")
    for k, v in STRAT_PARAMS.items():
        if gpa.STRAT_PARAMS.get(k) != v:
            problems.append(f"STRAT_PARAMS[{k}]: phase A {gpa.STRAT_PARAMS.get(k)!r} "
                            f"vs phase B {v!r}")
    root = os.path.dirname(HERE)
    missing = [c["comparator"] for c in configs
               if not os.path.isdir(os.path.join(root, "results", c["comparator"]))]
    return problems, sorted(set(missing))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    configs = build_all()
    problems, missing = check(configs)
    if problems:
        print("REGIME DRIFT against Phase A - fix before generating:")
        for p in problems:
            print("   ", p)
        raise SystemExit(1)
    print("regime matches Phase A on every held-constant parameter")
    if missing:
        print(f"WARNING: {len(missing)} Phase A comparator runs are missing:")
        for m in missing:
            print("   ", m)

    if args.list:
        for c in configs:
            print(c["name"])
        print(f"\ntotal: {len(configs)} runs")
        return

    os.makedirs(OUT, exist_ok=True)
    for c in configs:
        with open(os.path.join(OUT, c["name"] + ".yaml"), "w") as f:
            f.write("# Auto-generated by generate_phase_b.py (Ch.3 Section 3.10.2)\n")
            f.write("# Comparator: the Phase A run named in `comparator`. Identical in\n"
                    "# every respect but the mechanism.\n")
            f.write(yaml_dump(c) + "\n")

    sh = os.path.join(HERE, "run_phase_b.sh")
    with open(sh, "w") as f:
        f.write("#!/bin/bash\n"
                "# Runs every Phase B config in order. Safe to interrupt: FedAvg and\n"
                "# FedProx resume from checkpoint; SCAFFOLD and MOON restart the run\n"
                "# they were interrupted in, because client state is not checkpointed\n"
                "# (D48).\n"
                "#\n"
                "# DO NOT RUN THIS UNTIL dp_overhead_pilot.py HAS REPORTED (3.10.2).\n"
                "set -u\n"
                'if [ ! -f results/B_pilot_dp_overhead/overhead.json ]; then\n'
                '  echo "Pilot has not run. See Section 3.10.2."; exit 1\n'
                'fi\n')
        for c in configs:
            f.write(f'python run.py experiments/phase_b/{c["name"]}.yaml\n')
    os.chmod(sh, 0o755)
    print(f"wrote {len(configs)} configs to {OUT}")
    print(f"wrote runner: {sh}")


if __name__ == "__main__":
    main()
