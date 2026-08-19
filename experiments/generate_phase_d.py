"""Generate the Phase D configs: the granularity of differential privacy.

    python experiments/generate_phase_d.py          # writes experiments/phase_d/*.yaml
    python experiments/generate_phase_d.py --list   # just print what would be made

Chapter 3, Section 3.10.4. Eight matrix runs, all CIFAR-10 at alpha = 0.1 with
FedAvg at seed 0:

    3   client-level DP at eps = 1, 4, 8
    3   time-adaptive spending at eps = 1, 4, 8
    2   within-phase controls: sample-level DP at eps = 1, and no DP

PLUS ONE UNCOUNTED DIAGNOSTIC, which is not part of Table 3.8's 120.

Client-level DP requires UNIFORM averaging for its sensitivity bound of C/N to
hold, while every other arm averages by sample count. Without a control the
client-level runs would differ from their comparators in two ways at once and a
reader could not separate the noise from the re-weighting. The diagnostic run is
unprotected with uniform averaging, identical in all else, and isolates the
re-weighting on its own. Section 3.11 already excludes calibration activities
from the run counts, so the study total stays at 120 (D83).

C IS NOT HARDCODED. It is read from results/D_preflight/update_norms.json,
which is why the pre-flight has to run first. Table 3.6 gives no value for the
clipping bound, and a guessed one would make the phase measure the guess: too
high and clipping never bites while the noise, which scales with C, grows
regardless; too low and every update is crushed toward it. The measured median
client update norm makes clipping bind on about half the clients, which is the
choice McMahan et al. (2018) make.

TWO FREE INTEGRITY CHECKS. The no-DP control is configured identically to
A_cifar10_fedavg_dir0.1_s0 and the sample-level control to
B_cifar10_fedavg_dir0.1_eps1_s0, so both should reproduce their twins to the
digit. Section 3.10.4 wants them re-run anyway, because a comparison across
granularities is only interpretable if all of them are observed in one pipeline.
"""
import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "phase_d")
PREFLIGHT = os.path.join(os.path.dirname(HERE), "results", "D_preflight",
                         "update_norms.json")

BUDGETS = [1, 4, 8]
SEED = 0
DELTA = "0.00001"          # plain decimal; see generate_phase_b.py
SAMPLE_C = 1.0             # Section 3.8.2 fixes this for sample-level DP

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


def shell(name):
    cfg = {"name": name, "seed": SEED, "dataset": "cifar10", "mode": "federated"}
    cfg.update(BASE)
    cfg["strategy"] = "fedavg"
    cfg["model"] = dict(MODEL)
    cfg["strategy_params"] = dict(STRAT_PARAMS)
    cfg["partition"] = {"kind": "dirichlet", "alpha": 0.1,
                        "num_clients": BASE["num_clients"], "seed": SEED}
    return cfg


def build_all(clip_c):
    out = []

    for e in BUDGETS:
        c = shell(f"D_cifar10_fedavg_dir0.1_clientdp_eps{e}_s0")
        c["dp"] = {"enabled": "true", "granularity": "client",
                   "target_epsilon": e, "delta": DELTA,
                   "max_grad_norm": round(clip_c, 6)}
        c["note"] = "uniform averaging; sensitivity C/N requires it"
        out.append(c)

    for e in BUDGETS:
        c = shell(f"D_cifar10_fedavg_dir0.1_adaptive_eps{e}_s0")
        c["dp"] = {"enabled": "true", "granularity": "sample",
                   "target_epsilon": e, "delta": DELTA,
                   "max_grad_norm": SAMPLE_C,
                   "schedule": "decreasing", "schedule_strength": 0.5}
        c["note"] = "exploratory arm; realised epsilon recomputed per schedule"
        out.append(c)

    c = shell("D_cifar10_fedavg_dir0.1_sampledp_eps1_s0")
    c["dp"] = {"enabled": "true", "granularity": "sample", "target_epsilon": 1,
               "delta": DELTA, "max_grad_norm": SAMPLE_C}
    c["equals"] = "B_cifar10_fedavg_dir0.1_eps1_s0"
    out.append(c)

    c = shell("D_cifar10_fedavg_dir0.1_none_s0")
    c["equals"] = "A_cifar10_fedavg_dir0.1_s0"
    out.append(c)

    return out


def diagnostic():
    c = shell("D_diag_cifar10_fedavg_dir0.1_uniform_s0")
    c["uniform_averaging"] = "true"
    c["note"] = ("uncounted diagnostic (D83): unprotected, uniform averaging, "
                 "isolating what the re-weighting costs on its own")
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(PREFLIGHT):
        raise SystemExit(
            "results/D_preflight/update_norms.json not found.\n"
            "Run 'python3 experiments/phase_d_preflight.py' first: the clipping\n"
            "bound is measured, not chosen, and Table 3.6 does not supply one.")

    pre = json.load(open(PREFLIGHT))

    # The first version of the pre-flight compared a per-coordinate standard
    # deviation against a vector norm and understated the noise by sqrt(P), a
    # factor of 435 on this model (D82). A file written by that version lacks
    # the corrected fields, and its ratios are wrong by that factor - so refuse
    # it rather than quote it.
    if not all("noise_vector_norm" in b for b in pre["budgets"]):
        raise SystemExit(
            "results/D_preflight/update_norms.json predates the D82 correction.\n"
            "Its noise-to-signal ratios understate the noise by sqrt(P) = 435.\n"
            "Re-run: python3 experiments/phase_d_preflight.py")

    clip_c = float(pre["recommended_C"])
    print(f"clipping bound C = {clip_c:.6f}, the median client update norm "
          f"over {pre['client_rounds']} client-rounds")
    worst = max(b["noise_to_signal"] for b in pre["budgets"])
    print("pre-flight, noise vector against aggregate signal:")
    for b in pre["budgets"]:
        print(f"   eps={b['epsilon']}: sigma {b['sigma']:.3f}, noise norm "
              f"{b['noise_vector_norm']:.1f} vs signal {b['signal_norm']:.4f} "
              f"-> {b['noise_to_signal']:.0f}x")
    if worst > 10:
        print("\nNOTE: the noise vector is far longer than the aggregate it is\n"
              "added to at every budget. That is the arithmetic of the mechanism\n"
              "at fifteen clients under full participation, and it is what the\n"
              "phase exists to measure. The runs still have to be made.\n")

    configs = build_all(clip_c)
    diag = diagnostic()

    if args.list:
        for c in configs:
            print(" ", c["name"])
        print("  " + diag["name"] + "   (uncounted diagnostic)")
        print(f"\n{len(configs)} matrix runs + 1 diagnostic")
        return

    os.makedirs(OUT, exist_ok=True)
    for c in configs + [diag]:
        with open(os.path.join(OUT, c["name"] + ".yaml"), "w") as f:
            f.write("# Auto-generated by generate_phase_d.py (Ch.3 Section 3.10.4)\n")
            if c is diag:
                f.write("# UNCOUNTED DIAGNOSTIC - not one of Table 3.8's 120 runs.\n")
            f.write(yaml_dump(c) + "\n")

    sh = os.path.join(HERE, "run_phase_d.sh")
    with open(sh, "w") as f:
        f.write("#!/bin/bash\n"
                "# Phase D. Controls first, so a failure shows up against a known\n"
                "# reference before six hours of protected runs have been spent.\n"
                "set -u\n")
        order = ([c for c in configs if "none" in c["name"]]
                 + [diag]
                 + [c for c in configs if "sampledp" in c["name"]]
                 + [c for c in configs if "clientdp" in c["name"]]
                 + [c for c in configs if "adaptive" in c["name"]])
        for c in order:
            f.write(f'python run.py experiments/phase_d/{c["name"]}.yaml\n')
        f.write('\npython experiments/verify_phase_d.py\n')
    os.chmod(sh, 0o755)

    print(f"wrote {len(configs)} matrix configs + 1 diagnostic to {OUT}")
    print(f"wrote runner: {sh}")
    print("\nrun order (controls first):")
    for c in order:
        print(f"   {c['name']}")


if __name__ == "__main__":
    main()
