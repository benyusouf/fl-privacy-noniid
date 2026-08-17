#!/bin/bash
# Re-run the SCAFFOLD pair with the control variate masked (D79).
#
# Before the fix, secure aggregation masked the model but transmitted c_i in the
# clear, and c_i inverts to the local model exactly - so masking bought SCAFFOLD
# nothing, and its measured cost did not track its payload.
#
# Both arms are re-run, not just the masked one: Section 3.10.3 wants the pair
# measured back to back so the processor-time ratio is not carrying a drift in
# machine state between them.
#
# The FedAvg pair is untouched. It has no control variate and its numbers stand.
set -eu
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)
for arm in plain secagg; do
  d="results/C_cifar10_scaffold_dir0.1_${arm}_s0"
  [ -d "$d" ] && mv "$d" "${d}.premask-c-${STAMP}"
  python run.py "experiments/phase_c/C_cifar10_scaffold_dir0.1_${arm}_s0.yaml"
done
python experiments/verify_phase_c.py
echo "old outputs kept as *.premask-c-${STAMP}"
