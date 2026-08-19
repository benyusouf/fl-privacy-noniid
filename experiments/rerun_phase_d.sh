#!/bin/bash
# Re-run Phase D from scratch after the config-passthrough fix.
#
# The first attempt ran six of eight arms as plain sample-level DP, because
# run.py rebuilt the dp block from three named keys and dropped `granularity`
# and `schedule`. The second attempt corrected the configs but every run
# RESUMED from its completed checkpoint and did zero rounds, leaving the wrong
# numbers in place while config_used.json recorded the right mechanism.
#
# run.py now refuses to resume across a mechanism change, but that guard cannot
# help here: the zero-round pass already rewrote config_used.json, so the
# recorded mechanism matches and only the data is stale. This script therefore
# archives every Phase D output explicitly before re-running.
set -eu
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)

shopt -s nullglob
for d in results/D_cifar10_* results/D_diag_*; do
  [ -d "$d" ] || continue
  mv "$d" "${d}.stale-${STAMP}"
  echo "archived $(basename "$d")"
done

for f in experiments/phase_d/*.yaml; do
  python run.py "$f"
done

python experiments/verify_phase_d.py
echo
echo "old outputs kept as *.stale-${STAMP}"
