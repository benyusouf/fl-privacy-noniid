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
  /**
   * Sampling ratio, batch / n. Subsampling amplification weakens as this rises,
   * and is 1.0 under client-level accounting — every client participates every
   * round, so there is no amplification at all.
   */
  q: number
  /** Noised steps across all rounds. */
  steps?: number

  /**
   * NULL on a time-adaptive run, and that is not a defect: noise moves every
   * round, so no single value exists. Anything rendering a sigma must branch on
   * `schedule` and fall back to the sigmaMin–sigmaMax range.
   */
  sigma: number | null
  sigmaMin?: number
  sigmaMax?: number

  realisedEpsilon?: number
  /** Phase B spelling, kept so earlier runs still type. */
  realised_epsilon?: number

  /** True when this client's noise follows a per-round schedule. */
  schedule?: boolean

  saturated?: boolean
  sigma_needed_for_target?: number | null
}

/** Secure aggregation, on Phase C runs and null before them. */
export type Secagg = {
  /**
   * false marks the PLAIN member of a pair, not an unavailable mechanism. Its
   * costs are zero by construction, which is what makes the paired ratio
   * computable without joining anything.
   */
  enabled: boolean

  /** Processor seconds, not elapsed. The distinction is load-bearing here. */
  maskProcessorSecondsPerRound: number
  aggregateProcessorSecondsPerRound: number

  /**
   * What the simulation recorded: one key agreement per masked object, so 420
   * for SCAFFOLD against FedAvg's 210.
   */
  keyAgreementMessagesPerRound: number

  /**
   * What a deployment carries: n(n−1) = 210 regardless of strategy, both mask
   * sets derived from one pairwise secret through a key-derivation function.
   * The computation genuinely doubles for SCAFFOLD; the traffic need not.
   */
  keyAgreementMessagesProtocol: number

  /** Masked run → its plain pair. */
  pair: string | null

  /** Plain run → the Phase A run it reproduces exactly. */
  equals: string | null
}

/**
 * What the guarantee protects.
 *
 * Sample-level protects one record; client-level protects one institution. They
 * are not comparable strengths at the same nominal epsilon, which is the whole
 * point of Phase D.
 */
export type DpGranularity = 'sample-level' | 'client-level' | 'sample-level, time-adaptive'

export type Dp = {
  granularity: DpGranularity

  /** One sentence describing the mechanism. Safe to render verbatim. */
  mechanism?: string
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
  /**
   * sigmaMax / sigmaMin.
   *
   * Its meaning changes with granularity. Under sample-level it is a RESULT:
   * calibration is per client, so the smallest silo carries the most noise and
   * the ratio grows with skew. Under client-level it is exactly 1.0 BY
   * CONSTRUCTION — one sigma covers the whole federation — and that 1.0 must
   * never be presented as a finding about heterogeneity.
   */
  sigmaRatio: number
  clients: DpClient[]

  // --- client-level only ---
  /** σ·C/N — the figure the entire result turns on. */
  noiseStdOnMean?: number
  numClients?: number
  /** 1.0 under full participation, which is why there is no amplification. */
  samplingRate?: number
  uniformAveraging?: true
  whyNoAmplification?: string

  // --- time-adaptive only ---
  scheduleFile?: string
  /** Sixty multipliers, before per-client scaling. */
  scheduleShape?: number[]
  scheduleShapeMin?: number
  scheduleShapeMax?: number
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

  /** Present on Phase C runs and every federated run after them. */
  secagg: Secagg | null

  /**
   * True when the server averages client updates uniformly rather than by
   * sample count. Client-level DP requires it, because its sensitivity bound of
   * C/N is the sensitivity of a uniform mean to one client.
   */
  uniformAveraging: boolean

  /** A run made to interpret another run, rather than to produce a result. */
  diagnostic: boolean

  /** Section 3.11 excludes diagnostics from the study's run totals. */
  counted: boolean

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

  /**
   * Cells the source CSV recorded as nan or inf, emitted as null in the curve.
   * Non-zero means the run broke down numerically somewhere, which is a finding
   * rather than a parsing artefact.
   */
  nonFiniteCells: number

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
