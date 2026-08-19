"""Generate the four Phase C configs: the overhead of secure aggregation.

    python experiments/generate_phase_c.py          # writes experiments/phase_c/*.yaml
    python experiments/generate_phase_c.py --list   # just print what would be made

Chapter 3, Section 3.10.3. Four runs: CIFAR-10 at alpha = 0.1, with FedAvg and
with SCAFFOLD, each with masking enabled and disabled.

SCAFFOLD is in the phase because masking cost scales with the size of the object
being masked, and SCAFFOLD transmits roughly twice what FedAvg does by sending a
control variate alongside the model. One arm would give a single point on that
scale and no way to see whether the cost tracks update size.

WHY THE UNMASKED ARMS ARE RE-RUN RATHER THAN TAKEN FROM PHASE A
---------------------------------------------------------------
A_cifar10_fedavg_dir0.1_s0 is configured identically to C_..._fedavg_..._plain
and its accuracy will match to the digit. It is not used as the comparator
because Section 3.10.3 requires each masked and unmasked pair to be run BACK TO
BACK and reported as a ratio: a ratio between adjacent runs is robust to a drift
in machine state that a comparison against a run from weeks ago is not.

That the two agree anyway is a free check, and run_phase_c.sh points it out.

ORDERING MATTERS. run_phase_c.sh runs plain then masked within each strategy,
consecutively. Do not reorder it to group all the plain runs together.

ACCURACY CANNOT CHANGE. Masks cancel exactly, so a masked run and its unmasked
pair must produce the same accuracy at every round. verify_phase_c.py checks
that, and a difference means the implementation is wrong, not that masking has
a cost in accuracy.
"""
import argparse
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "phase_c")

STRATEGIES = ["fedavg", "scaffold"]
SEED = 0
PARTITION = ("dir0.1", 0.1)

# Identical to generate_phase_a.BASE; check() asserts it.
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


def yaml_dump(d, indent=0):
    lines = []
    for k, v in d.items():
        pad = "  " * indent
        if isinstance(v, dict):
            lines.append(f"{pad}{k}:")
            lines.append(yaml_dump(v, indent + 1))
        else:
            # Quote anything containing ": " - YAML reads it as a nested mapping
            # and fails with "mapping values are not allowed here". The Phase D
            # diagnostic carried "(D83): " in its note and crashed on it.
            text = str(v)
            if ": " in text or text.startswith(("[", "{", "*", "&", "!")):
                text = '"' + text.replace('"', "'") + '"'
            lines.append(f"{pad}{k}: {text}")
    return "\n".join(l for l in lines if l)


def make(strategy, masked):
    pkey, alpha = PARTITION
    arm = "secagg" if masked else "plain"
    name = f"C_cifar10_{strategy}_{pkey}_{arm}_s{SEED}"
    cfg = {"name": name, "seed": SEED, "dataset": "cifar10", "mode": "federated"}
    cfg.update(BASE)
    cfg["strategy"] = strategy
    cfg["model"] = dict(MODEL)
    cfg["strategy_params"] = dict(STRAT_PARAMS)
    cfg["partition"] = {"kind": "dirichlet", "alpha": alpha,
                        "num_clients": BASE["num_clients"], "seed": SEED}
    cfg["secagg"] = {"enabled": "true" if masked else "false"}
    if masked:
        cfg["pair"] = f"C_cifar10_{strategy}_{pkey}_plain_s{SEED}"
    else:
        cfg["equals"] = f"A_cifar10_{strategy}_{pkey}_s{SEED}"
    return cfg


def build_all():
    out = []
    for s in STRATEGIES:                 # plain first, then masked, per strategy
        out.append(make(s, False))
        out.append(make(s, True))
    return out


def check():
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "gpa", os.path.join(HERE, "generate_phase_a.py"))
    gpa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gpa)
    problems = []
    for label, mine, theirs in (("BASE", BASE, gpa.BASE), ("MODEL", MODEL, gpa.MODEL),
                                ("STRAT_PARAMS", STRAT_PARAMS, gpa.STRAT_PARAMS)):
        for k, v in mine.items():
            if theirs.get(k) != v:
                problems.append(f"{label}[{k}]: phase A {theirs.get(k)!r} vs phase C {v!r}")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    problems = check()
    if problems:
        print("REGIME DRIFT against Phase A - fix before generating:")
        for p in problems:
            print("   ", p)
        raise SystemExit(1)
    print("regime matches Phase A on every held-constant parameter")

    configs = build_all()
    if args.list:
        for c in configs:
            print(c["name"])
        print(f"\ntotal: {len(configs)} runs")
        return

    os.makedirs(OUT, exist_ok=True)
    for c in configs:
        with open(os.path.join(OUT, c["name"] + ".yaml"), "w") as f:
            f.write("# Auto-generated by generate_phase_c.py (Ch.3 Section 3.10.3)\n")
            f.write("# Masking cannot change accuracy. A masked run and its plain\n"
                    "# pair must agree at every round; if they do not, the fault is\n"
                    "# in the implementation.\n")
            f.write(yaml_dump(c) + "\n")

    sh = os.path.join(HERE, "run_phase_c.sh")
    with open(sh, "w") as f:
        f.write("#!/bin/bash\n"
                "# Phase C. Each pair runs BACK TO BACK so the overhead ratio is\n"
                "# robust to machine state drifting between them (Section 3.10.3).\n"
                "# Do not reorder.\n"
                "#\n"
                "# Roughly 4 runs x 60 rounds. FedAvg cost about 65 s/round in Phase B;\n"
                "# the masked arms add 105 mask expansions per round on top.\n"
                "set -u\n")
        for c in configs:
            f.write(f'python run.py experiments/phase_c/{c["name"]}.yaml\n')
        f.write('\npython experiments/verify_phase_c.py\n')
    os.chmod(sh, 0o755)

    print(f"wrote {len(configs)} configs to {OUT}")
    print(f"wrote runner: {sh}")
    print("\nrun order:")
    for c in configs:
        print(f"   {c['name']}")


if __name__ == "__main__":
    main()
