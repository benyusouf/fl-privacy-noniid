#!/bin/bash
# Runs every Phase B config in order. Safe to interrupt: FedAvg and
# FedProx resume from checkpoint; SCAFFOLD and MOON restart the run
# they were interrupted in, because client state is not checkpointed
# (D48).
#
# DO NOT RUN THIS UNTIL dp_overhead_pilot.py HAS REPORTED (3.10.2).
set -u
if [ ! -f results/B_pilot_dp_overhead/overhead.json ]; then
  echo "Pilot has not run. See Section 3.10.2."; exit 1
fi
python run.py experiments/phase_b/B_cifar10_fedavg_dir100_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir100_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir100_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir1.0_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir1.0_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir1.0_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir0.1_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir0.1_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedavg_dir0.1_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir100_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir100_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir100_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir1.0_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir1.0_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir1.0_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir0.1_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir0.1_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_fedprox_dir0.1_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir100_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir100_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir100_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir1.0_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir1.0_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir1.0_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir0.1_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir0.1_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_scaffold_dir0.1_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir100_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir100_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir100_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir1.0_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir1.0_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir1.0_eps8_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir0.1_eps1_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir0.1_eps4_s0.yaml
python run.py experiments/phase_b/B_cifar10_moon_dir0.1_eps8_s0.yaml
