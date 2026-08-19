#!/bin/bash
# Phase D. Controls first, so a failure shows up against a known
# reference before six hours of protected runs have been spent.
set -u
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_none_s0.yaml
python run.py experiments/phase_d/D_diag_cifar10_fedavg_dir0.1_uniform_s0.yaml
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_sampledp_eps1_s0.yaml
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_clientdp_eps1_s0.yaml
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_clientdp_eps4_s0.yaml
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_clientdp_eps8_s0.yaml
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_adaptive_eps1_s0.yaml
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_adaptive_eps4_s0.yaml
python run.py experiments/phase_d/D_cifar10_fedavg_dir0.1_adaptive_eps8_s0.yaml

python experiments/verify_phase_d.py
