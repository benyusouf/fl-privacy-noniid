#!/bin/bash
# Re-run the three time-adaptive arms with the schedule SCALE calibrated
# against the accountant rather than derived from the sum(1/sigma^2) proxy.
#
# Measured overspend under the proxy: realised 1.0100, 4.0366 and 8.1959
# against targets of 1, 4 and 8 (D87). An arm that overspends has more budget
# than the constant arm it is compared with, so any advantage it shows is
# partly bought rather than earned.
#
# Only the adaptive arms change. Client-level and the controls use a constant
# schedule and are untouched.
set -eu
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)

for e in 1 4 8; do
  d="results/D_cifar10_fedavg_dir0.1_adaptive_eps${e}_s0"
  [ -d "$d" ] && mv "$d" "${d}.proxyscale-${STAMP}"
  python run.py "experiments/phase_d/D_cifar10_fedavg_dir0.1_adaptive_eps${e}_s0.yaml"
done

python experiments/verify_phase_d.py
echo
echo "old outputs kept as *.proxyscale-${STAMP}"
