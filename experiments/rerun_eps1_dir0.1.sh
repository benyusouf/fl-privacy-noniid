#!/bin/bash
# Re-run the four Phase B cells whose smallest silo could not reach eps=1 under
# the old sigma ceiling of 30 (D69). The ceiling now expands, so the calibration
# will find the sigma the budget actually needs.
#
# The old outputs are moved aside first, not overwritten, and the runs restart
# from round 0 rather than resuming - a resumed run would keep the old noise.
set -eu
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)
for s in fedavg fedprox scaffold moon; do
  d="results/B_cifar10_${s}_dir0.1_eps1_s0"
  [ -d "$d" ] && mv "$d" "${d}.sigma30-${STAMP}"
  python run.py "experiments/phase_b/B_cifar10_${s}_dir0.1_eps1_s0.yaml"
done
echo "done. Old outputs kept as *.sigma30-${STAMP}"
