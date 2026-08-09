"""Generate every Phase A config file, following the seed policy in D19.

    python experiments/generate_phase_a.py          # writes experiments/phase_a/*.yaml
    python experiments/generate_phase_a.py --list   # just print what would be made

Seed policy (analysis.docx D19):
  3 seeds  CIFAR-10 x {fedavg, fedprox, scaffold, moon} x Dirichlet {100, 1.0, 0.1}
           plus CIFAR-10 centralized baseline, plus FedAvgM at alpha=0.1
  1 seed   CIFAR-10 pathological and quantity; all PathMNIST; PathMNIST
           centralized; PathMNIST FedAvgM at alpha=0.1

Every config is one run. Run them with:
    python run.py experiments/phase_a/<name>.yaml
or all of them with experiments/run_phase_a.sh
"""
import argparse
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "phase_a")

STRATEGIES = ["fedavg", "fedprox", "scaffold", "moon"]
SEEDS_MULTI = [0, 1, 2]
SEEDS_SINGLE = [0]

# CPU-sized: small model, subsampled data, enough rounds to separate the curves.
BASE = {
    "num_clients": 15,
    "rounds": 60,
    "local_epochs": 2,
    "lr": 0.01,
    "checkpoint_every": 5,
    # CPU budget lever (see analysis.docx D22). Measured 153 s/round on the full
    # 50k CIFAR-10 training set, which made the full matrix ~400 hours. A
    # stratified 20k subsample preserves the label distribution and every
    # comparison, at a cost in absolute accuracy that the Limitations section
    # already declares.
    "subsample": 20000,
    "subsample_test": 5000,
}
MODEL = {
    "backend": "torch_cnn",
    "width": 32,
    "batch_size": 64,
    "in_channels": 3,
    "img_size": 32,
}
STRAT_PARAMS = {"mu": 0.01, "moon_mu": 1.0, "moon_tau": 0.5}

PARTITIONS = {
    "dir100": {"kind": "dirichlet", "alpha": 100.0},
    "dir1.0": {"kind": "dirichlet", "alpha": 1.0},
    "dir0.1": {"kind": "dirichlet", "alpha": 0.1},
    "path1": {"kind": "pathological", "classes_per_client": 1},
    "quantity": {"kind": "quantity", "beta": 0.5},
}
DIRICHLET_ONLY = ["dir100", "dir1.0", "dir0.1"]


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


# FedAvgM (Hsu et al., 2019). TWO parameters, and they are not the same thing.
#   FEDAVGM_BETA      momentum coefficient. Hsu et al. sweep {0, .7, .9, .97, .99,
#                     .997}; 0.9 is their representative value and is what the
#                     overshoot analysis in server_momentum_step assumes.
#   FEDAVGM_SERVER_LR server learning rate. Hsu et al. have NO such term - their
#                     update is w <- w - v, i.e. server_lr = 1.0. We use 0.5
#                     because 1.0 gave below-chance accuracy at 3 rounds.
# Both divergences from the paper must be declared in Ch.3 Section 3.7.5, along
# with the fact that our step is plain momentum where Hsu et al. use Nesterov.
FEDAVGM_BETA = 0.9
FEDAVGM_SERVER_LR = 0.5


def make(name, dataset, strategy, partition_key, seed, server_momentum=0.0,
         mode="federated"):
    cfg = {"name": name, "seed": seed, "dataset": dataset, "mode": mode}
    cfg.update(BASE)
    if mode == "centralized":
        cfg["epochs"] = 30
        for k in ("num_clients", "rounds", "local_epochs", "checkpoint_every"):
            cfg.pop(k, None)
    else:
        cfg["strategy"] = strategy
        if server_momentum:
            cfg["server_momentum"] = server_momentum   # beta
            cfg["server_lr"] = FEDAVGM_SERVER_LR       # set explicitly, never defaulted
    model = dict(MODEL)
    if dataset == "pathmnist":
        model["img_size"] = 28
    cfg["model"] = model
    if mode == "federated":
        cfg["strategy_params"] = dict(STRAT_PARAMS)
        p = dict(PARTITIONS[partition_key])
        p["num_clients"] = BASE["num_clients"]
        cfg["partition"] = p
    return cfg


def build_all():
    configs = []
    # --- CIFAR-10, 3 seeds, Dirichlet only ---
    for strat in STRATEGIES:
        for pk in DIRICHLET_ONLY:
            for s in SEEDS_MULTI:
                n = f"A_cifar10_{strat}_{pk}_s{s}"
                configs.append(make(n, "cifar10", strat, pk, s))
    # --- CIFAR-10, 1 seed, pathological + quantity ---
    for strat in STRATEGIES:
        for pk in ("path1", "quantity"):
            n = f"A_cifar10_{strat}_{pk}_s0"
            configs.append(make(n, "cifar10", strat, pk, 0))
    # --- CIFAR-10 FedAvgM, only at alpha=0.1, 3 seeds ---
    for s in SEEDS_MULTI:
        n = f"A_cifar10_fedavgm_dir0.1_s{s}"
        configs.append(make(n, "cifar10", "fedavg", "dir0.1", s, server_momentum=FEDAVGM_BETA))
    # --- CIFAR-10 centralized baseline, 3 seeds ---
    for s in SEEDS_MULTI:
        configs.append(make(f"A_cifar10_centralized_s{s}", "cifar10", None, None,
                            s, mode="centralized"))
    # --- PathMNIST, 1 seed, all five partitions ---
    for strat in STRATEGIES:
        for pk in PARTITIONS:
            n = f"A_pathmnist_{strat}_{pk}_s0"
            configs.append(make(n, "pathmnist", strat, pk, 0))
    # --- PathMNIST FedAvgM at alpha=0.1 + centralized, 1 seed ---
    configs.append(make("A_pathmnist_fedavgm_dir0.1_s0", "pathmnist", "fedavg",
                        "dir0.1", 0, server_momentum=FEDAVGM_BETA))
    configs.append(make("A_pathmnist_centralized_s0", "pathmnist", None, None,
                        0, mode="centralized"))
    return configs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    configs = build_all()
    if args.list:
        for c in configs:
            print(c["name"])
        print(f"\ntotal: {len(configs)} runs")
        return

    os.makedirs(OUT, exist_ok=True)
    for c in configs:
        with open(os.path.join(OUT, c["name"] + ".yaml"), "w") as f:
            f.write("# Auto-generated by generate_phase_a.py (D19 seed policy)\n")
            f.write(yaml_dump(c) + "\n")
    # runner script
    sh = os.path.join(HERE, "run_phase_a.sh")
    with open(sh, "w") as f:
        f.write("#!/bin/bash\n# Runs every Phase A config in order. Safe to "
                "interrupt: each run resumes from its checkpoint.\nset -u\n")
        for c in configs:
            f.write(f'python run.py experiments/phase_a/{c["name"]}.yaml\n')
    print(f"wrote {len(configs)} configs to {OUT}")
    print(f"wrote runner: {sh}")
    cif3 = sum(1 for c in configs if c["name"].startswith("A_cifar10")
               and c["name"].endswith(("s0", "s1", "s2")))
    print(f"\nbreakdown: {len(configs)} total runs")


if __name__ == "__main__":
    main()
