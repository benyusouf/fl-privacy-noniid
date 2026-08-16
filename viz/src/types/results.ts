/*
 * Types for the generated results bundle (scripts/build-data.mjs).
 *
 * These mirror the emitted JSON exactly. If build-data.mjs changes shape,
 * change this file with it — nothing validates the two against each other
 * at build time beyond TypeScript's own structural check at the import site.
 */

export type Dataset = 'cifar10' | 'pathmnist'

/** Per-client differential privacy accounting. Noise is calibrated per client. */
export type DpClient = {
  client: number
  /** Samples held by this client. */
  n: number
  /** Sampling ratio, batch / n. Subsampling amplification weakens as this rises. */
  q: number
  /** Noised steps across all rounds. */
  steps: number
  sigma: number
  realised_epsilon: number
  saturated: boolean
  sigma_needed_for_target: number | null
}

export type Dp = {
  granularity: 'sample-level'
  /** The label on the directory — what was asked for. */
  targetEpsilon: 1 | 4 | 8
  /**
   * The worst client's realised budget — what was actually delivered. A
   * federation can only claim its weakest guarantee, so this is the number to
   * display. It agreed with targetEpsilon on every current run, but did not
   * before the D69 re-run.
   */
  deliveredEpsilon: number
  labelHonoured: boolean
  delta: number
  maxGradNorm: number
  sigmaMin: number
  sigmaMax: number
  /** sigmaMax / sigmaMin. A result about unequal burden, not a detail. */
  sigmaRatio: number
  clients: DpClient[]
}
export type Strategy = 'fedavg' | 'fedprox' | 'scaffold' | 'moon'
export type Partition = 'dir100' | 'dir1.0' | 'dir0.1' | 'quantity' | 'path1'
export type RunMode = 'federated' | 'centralized'

export type Curve = {
  cols: string[]
  rows: (number | string | null)[][]
}

export type Run = {
  name: string

  /** Locked by Chapter One — A, B, C, D or E. Never renamed. */
  phase: string

  dataset: Dataset
  datasetLabel: string
  mode: RunMode
  seed: number | null

  /**
   * Null for centralized runs. Note that FedAvgM runs carry strategy 'fedavg'
   * — it is a configuration of FedAvg, not a fifth strategy. Use isFedAvgM to
   * separate them.
   */
  strategy: Strategy | null
  strategyLabel: string
  isFedAvgM: boolean

  partition: Partition | null
  partitionLabel: string | null

  /**
   * The experimental arm within a partition — 'eps1', 'plain', 'secagg', … —
   * or null for the Phase A baseline. Two runs sharing a partition but not an
   * arm are different conditions and must never be pooled.
   */
  arm: string | null

  /** Number of recorded rows, and the unit of the step column ('round' | 'epoch'). */
  steps: number
  stepUnit: string
  configuredSteps: number | null

  finalAcc: number | null
  bestAcc: number | null
  bestStep: number | null

  /**
   * Mean absolute change in test accuracy between consecutive steps. Roughly
   * 0.01 on well-behaved runs; an order of magnitude higher where the series
   * oscillates and the final value is therefore close to arbitrary.
   */
  meanAbsDelta: number | null

  /** Mean, min and max over the last ten recorded steps. */
  tailMean: number | null
  tailMin: number | null
  tailMax: number | null

  /** Measured Hellinger distance. Null for centralized runs (no partition). */
  hellingerMean: number | null
  hellingerMax: number | null
  clientSizes: number[] | null
  hellingerPerClient: number[] | null
  classesPerClient: number[] | null

  /**
   * Analytic, not measured: params x 4 bytes x clients. Nothing is transmitted —
   * this is a single-process simulation. Identical across strategies in the
   * recorded data; see the caveat on the communication-cost views.
   */
  bytesUpPerRound: number | null

  /** Recorded but unreliable — see Limitations. Never plotted as a measurement. */
  secondsPerRound: number | null
  secondsTotal: number | null

  /** Present on Phase B runs, null elsewhere. Its presence means "protected". */
  dp: Dp | null

  /**
   * For a Phase B run, the name of the Phase A run it is measured against —
   * identical in every respect but the mechanism. Never reconstruct this by
   * string surgery on the run name.
   */
  comparator: string | null

  /** A captured transcript exists. */
  hasLog: boolean

  /**
   * A record was reconstructed after the fact from the run's artefacts. This is
   * NOT a transcript and must never be labelled as one — the provenance file
   * says so in its own header.
   */
  hasProvenance: boolean

  config: Record<string, unknown>
  curve: Curve
}

/** src/data/generated/downloads.json */
export type DownloadFile = {
  file: string
  description: string
  size: number
  sizeLabel: string
}

export type Downloads = {
  runs: Record<string, DownloadFile[]>
  archive: { path: string; size: number; sizeLabel: string }
  totalFiles: number
  totalBytes: number
  totalLabel: string
  note: string
}

export type ResultsBundle = {
  /**
   * First 12 hex characters of a SHA-256 over the runs payload. Deterministic
   * for identical inputs, so the committed bundle can be checked against a
   * freshly built one in CI. Deliberately not a build timestamp.
   */
  dataHash: string
  runCount: number
  excluded: { name: string; reason: string }[]
  integrityWarnings: string[]
  facets: {
    datasets: Dataset[]
    strategies: Strategy[]
    partitions: Partition[]
    seeds: number[]
  }
  labels: {
    strategies: Record<string, string>
    partitions: Record<string, string>
    datasets: Record<string, string>
  }
  runs: Run[]
}

/** A configuration aggregated across whatever seeds exist for it. */
export type SeedGroup = {
  key: string
  dataset: Dataset
  strategy: Strategy | null
  strategyLabel: string
  isFedAvgM: boolean
  partition: Partition | null
  partitionLabel: string | null

  /**
   * The experimental arm within a partition — 'eps1', 'plain', 'secagg', … —
   * or null for the Phase A baseline. Two runs sharing a partition but not an
   * arm are different conditions and must never be pooled.
   */
  arm: string | null
  mode: RunMode
  runs: Run[]
  n: number
  /** True when n === 1. Single-seed differences are never significant. */
  singleSeed: boolean
  meanFinalAcc: number
  minFinalAcc: number
  maxFinalAcc: number
  /** max - min, not a standard deviation. With n = 3 the range is the honest statistic. */
  spread: number
  meanHellinger: number | null
}
