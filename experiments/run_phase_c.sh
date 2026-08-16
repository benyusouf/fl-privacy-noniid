#!/bin/bash
# Phase C. Each pair runs BACK TO BACK so the overhead ratio is
# robust to machine state drifting between them (Section 3.10.3).
# Do not reorder.
#
# Roughly 4 runs x 60 rounds. FedAvg cost about 65 s/round in Phase B;
# the masked arms add 105 mask expansions per round on top.
set -u
python run.py experiments/phase_c/C_cifar10_fedavg_dir0.1_plain_s0.yaml
python run.py experiments/phase_c/C_cifar10_fedavg_dir0.1_secagg_s0.yaml
python run.py experiments/phase_c/C_cifar10_scaffold_dir0.1_plain_s0.yaml
python run.py experiments/phase_c/C_cifar10_scaffold_dir0.1_secagg_s0.yaml

python experiments/verify_phase_c.py
