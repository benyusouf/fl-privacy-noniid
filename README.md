# fl-privacy-noniid

Experimental codebase for the MSc dissertation:
**Federated Learning for Privacy-Preserving AI Models: A Study on Secure, Decentralized Model Training with Non-IID Data**
Yusuf Abdullahi — University of Abuja, 2026.

## What this repo does

Simulates cross-silo federated learning (15 clients) to answer four research questions:

- **RQ1** FL vs centralized training under increasing non-IID severity (FedAvg, FedProx, SCAFFOLD, MOON)
- **RQ2** Accuracy + communication cost of differential privacy and secure aggregation, vs heterogeneity
- **RQ3** DP granularity at cross-silo scale; time-adaptive privacy spending
- **RQ4** Gradient-inversion attack demonstration and its mitigation

## Structure

```
flcore/          partitioning (Dirichlet / pathological / quantity skew),
                 Hellinger distance, models, data loading, FL algorithms, DP
attacks/         gradient-inversion privacy probe (RQ4)
experiments/     one YAML config per run
results/         CSVs + plots (auto-generated; git-ignored except summaries)
run.py           entry point: python run.py experiments/<config>.yaml
```

## Setup (CPU-only is fine)

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Quick start

```bash
python run.py experiments/smoke_mnist.yaml    # ~minutes on CPU; verifies the whole pipeline
```

Every run writes `results/<run_name>/metrics.csv` (per round: global accuracy,
per-client accuracy, bytes transmitted, wall-clock) plus `config_used.yaml` and
a checkpoint every N rounds — interrupted runs resume automatically.

## Reproducibility

All runs are seeded (`seed:` in each config). Partition assignments are
deterministic given the seed and are saved alongside results.
