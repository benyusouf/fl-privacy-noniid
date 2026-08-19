/*
 * Typed access to the generated results bundle.
 *
 * Everything here is a selection or a grouping of recorded values. No function
 * in this file adjusts, rescales or corrects a number that came out of the
 * experiment. Where the study's methodology and the recorded data disagree
 * (see communication cost), this layer reports the recorded value and the site
 * shows the disagreement.
 */

import bundleJson from '@/data/generated/results.json'

import type { Dataset, Partition, ResultsBundle, Run, SeedGroup, Strategy } from '@/types/results'

export const bundle = bundleJson as unknown as ResultsBundle

export const allRuns = bundle.runs

export const federatedRuns = allRuns.filter(r => r.mode === 'federated')
export const centralizedRuns = allRuns.filter(r => r.mode === 'centralized')

/*
 * Protected vs unprotected is the distinction that matters for selecting runs,
 * and run.dp carries it directly. Filtering on the phase letter would work today
 * but ties the meaning to a naming convention rather than to the mechanism.
 */
export const unprotectedRuns = allRuns.filter(r => r.dp === null)

/**
 * The Phase A baseline: no privacy mechanism and no experimental arm. Filtering
 * on dp alone is not enough — a Phase C "plain" control also carries dp: null,
 * and would otherwise be plotted as if it were the original baseline.
 */
export const baselineRuns = allRuns.filter(r => r.dp === null && r.arm === null)
export const protectedRuns = allRuns.filter(r => r.dp !== null)

export const phaseRuns = (phase: string) => allRuns.filter(r => r.phase === phase)

/**
 * Runs that count toward the study's totals. Section 3.11 excludes calibration
 * and diagnostic activity, so a diagnostic is recorded, published and shown —
 * but not counted.
 */
export const countedRuns = allRuns.filter(r => r.counted)

export const EPSILONS = [8, 4, 1] as const

// ---------------------------------------------------------------------------
// Ordering. Presentational only.
// ---------------------------------------------------------------------------

export const PARTITION_ORDER: Partition[] = ['dir100', 'dir1.0', 'dir0.1', 'quantity', 'path1']
export const STRATEGY_ORDER: Strategy[] = ['fedavg', 'fedprox', 'scaffold', 'moon']

export const partitionRank = (p: Partition | null) => (p === null ? -1 : PARTITION_ORDER.indexOf(p))
export const strategyRank = (s: Strategy | null) => (s === null ? -1 : STRATEGY_ORDER.indexOf(s))

// ---------------------------------------------------------------------------
// Curve access
// ---------------------------------------------------------------------------

export type CurvePoint = Record<string, number | null>

/** Turns the compact column/row encoding back into objects for charting. */
export const curvePoints = (run: Run): CurvePoint[] =>
  run.curve.rows.map(row => {
    const o: CurvePoint = {}

    run.curve.cols.forEach((c, i) => {
      const v = row[i]

      o[c] = typeof v === 'number' ? v : null
    })

    return o
  })

export const hasColumn = (run: Run, col: string) => run.curve.cols.includes(col)

// ---------------------------------------------------------------------------
// Grouping across seeds
// ---------------------------------------------------------------------------

/*
 * The experimental arm is part of the identity of a configuration.
 *
 * Later phases reuse the Phase A grid deliberately — same dataset, strategy and
 * partition, one mechanism changed. Without the arm in the key those runs
 * collapse into one group with their baseline, and every "spread across seeds"
 * figure computed from it would silently be a spread across mechanisms instead.
 * Phase B adds eps1/eps4/eps8; Phase C adds plain/secagg.
 */
const groupKey = (r: Run) =>
  [
    r.dataset,
    r.mode,
    r.isFedAvgM ? 'fedavgm' : (r.strategy ?? 'centralized'),
    r.partition ?? 'none',
    r.arm ?? 'baseline'
  ].join('|')

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export const seedGroups = (runs: Run[] = allRuns): SeedGroup[] => {
  const map = new Map<string, Run[]>()

  for (const r of runs) {
    const k = groupKey(r)

    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }

  const groups: SeedGroup[] = []

  for (const [key, rs] of map) {
    const sorted = [...rs].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
    const accs = sorted.map(r => r.finalAcc).filter((x): x is number => x !== null)
    const hs = sorted.map(r => r.hellingerMean).filter((x): x is number => x !== null)
    const head = sorted[0]

    if (accs.length === 0) continue

    groups.push({
      key,
      dataset: head.dataset,
      strategy: head.strategy,
      strategyLabel: head.strategyLabel,
      isFedAvgM: head.isFedAvgM,
      partition: head.partition,
      partitionLabel: head.partitionLabel,
      arm: head.arm,
      mode: head.mode,
      runs: sorted,
      n: sorted.length,
      singleSeed: sorted.length === 1,
      meanFinalAcc: mean(accs),
      minFinalAcc: Math.min(...accs),
      maxFinalAcc: Math.max(...accs),
      spread: Math.max(...accs) - Math.min(...accs),
      meanHellinger: hs.length ? mean(hs) : null
    })
  }

  return groups.sort(
    (a, b) =>
      a.dataset.localeCompare(b.dataset) ||
      partitionRank(a.partition) - partitionRank(b.partition) ||
      strategyRank(a.strategy) - strategyRank(b.strategy)
  )
}

/**
 * RQ1 view: one point per (strategy, partition) block, positioned on measured
 * mean Hellinger distance rather than the protocol parameter. This positioning
 * is a central methodological commitment of the study — do not substitute alpha.
 */
export const rq1Points = (dataset: Dataset) =>
  // Baseline arm only. RQ1 asks how federated training compares with centralized
  // as heterogeneity rises, with no mechanism in play; a Phase B noised run or a
  // Phase C control would otherwise be plotted as if it were that baseline.
  seedGroups(federatedRuns.filter(r => r.dataset === dataset && !r.isFedAvgM && r.dp === null && r.arm === null))
    .map(g => ({
      ...g,
      x: g.meanHellinger ?? 0,
      y: g.meanFinalAcc * 100,
      yMin: g.minFinalAcc * 100,
      yMax: g.maxFinalAcc * 100,
      // Recharts ErrorBar takes [below, above] offsets from the value.
      err: [g.meanFinalAcc * 100 - g.minFinalAcc * 100, g.maxFinalAcc * 100 - g.meanFinalAcc * 100] as [number, number]
    }))
    .sort((a, b) => a.x - b.x)

export const centralizedBaseline = (dataset: Dataset) => {
  const rs = centralizedRuns.filter(r => r.dataset === dataset)
  const accs = rs.map(r => r.finalAcc).filter((x): x is number => x !== null)

  if (!accs.length) return null

  return {
    runs: rs,
    n: rs.length,
    mean: mean(accs) * 100,
    min: Math.min(...accs) * 100,
    max: Math.max(...accs) * 100,
    singleSeed: rs.length === 1,
    // Centralized runs are measured in epochs, federated in rounds. These must
    // never share an x-axis.
    steps: rs[0]?.steps ?? null,
    stepUnit: rs[0]?.stepUnit ?? 'epoch'
  }
}

// ---------------------------------------------------------------------------
// Phase B — the cost of differential privacy
//
// Phase B was run at seed 0 throughout, so every comparison here fixes seed 0 on
// both sides. Comparing a three-seed Phase A mean against a single Phase B run
// would put a smoothed number next to an unsmoothed one and read as a smaller
// difference than it is.
// ---------------------------------------------------------------------------

export const DP_SEED = 0

export type DpCondition = {
  key: string
  label: string
  /** null means no privacy mechanism. */
  epsilon: number | null
}

export const DP_CONDITIONS: DpCondition[] = [
  { key: 'unprotected', label: 'No privacy mechanism', epsilon: null },
  { key: 'eps8', label: 'ε = 8', epsilon: 8 },
  { key: 'eps4', label: 'ε = 4', epsilon: 4 },
  { key: 'eps1', label: 'ε = 1', epsilon: 1 }
]

/** Partitions that Phase B covers — the Dirichlet ladder only. */
export const dpPartitions = (dataset: Dataset): Partition[] =>
  PARTITION_ORDER.filter(p => protectedRuns.some(r => r.dataset === dataset && r.partition === p))

export const dpStrategies = (dataset: Dataset): Strategy[] =>
  STRATEGY_ORDER.filter(s => protectedRuns.some(r => r.dataset === dataset && r.strategy === s))

/** One run: a (partition, strategy, condition) cell at the Phase B seed. */
export const dpCell = (dataset: Dataset, partition: Partition, strategy: Strategy, epsilon: number | null) =>
  allRuns.find(
    r =>
      r.dataset === dataset &&
      r.mode === 'federated' &&
      !r.isFedAvgM &&
      r.partition === partition &&
      r.strategy === strategy &&
      r.seed === DP_SEED &&
      (epsilon === null ? r.dp === null && r.arm === null : r.dp?.targetEpsilon === epsilon)
  ) ?? null

/**
 * The headline RQ2 view: accuracy against measured heterogeneity, one line per
 * privacy condition.
 *
 * Each point averages across strategies rather than showing them separately.
 * That is deliberate — Phase B is single-seed, and the Phase A seed spread at
 * the same cell exceeds every between-strategy difference at fixed epsilon, so
 * plotting strategies apart would invite a ranking the data cannot support.
 */
export const privacyCostSeries = (dataset: Dataset) => {
  const partitions = dpPartitions(dataset)
  const strategies = dpStrategies(dataset)

  return DP_CONDITIONS.map(condition => ({
    condition,
    points: partitions
      .map(partition => {
        const cells = strategies
          .map(s => dpCell(dataset, partition, s, condition.epsilon))
          .filter((r): r is Run => r !== null)

        const accs = cells.map(r => r.finalAcc).filter((x): x is number => x !== null)
        const hs = cells.map(r => r.hellingerMean).filter((x): x is number => x !== null)

        if (!accs.length) return null

        return {
          partition,
          partitionLabel: cells[0].partitionLabel,
          hellinger: hs.length ? mean(hs) : 0,
          acc: mean(accs) * 100,
          min: Math.min(...accs) * 100,
          max: Math.max(...accs) * 100,
          n: cells.length,
          runs: cells
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => a.hellinger - b.hellinger)
  })).filter(s => s.points.length > 0)
}

/**
 * Per condition: mean accuracy over all cells, cost against unprotected, and the
 * spread across partitions — the last being the actual finding, since it is what
 * collapses when noise is added.
 */
export const privacyCostSummary = (dataset: Dataset) => {
  const series = privacyCostSeries(dataset)
  const baseline = series.find(s => s.condition.epsilon === null)
  const baseMean = baseline ? mean(baseline.points.map(p => p.acc)) : null

  return series.map(s => {
    const partitionMeans = s.points.map(p => p.acc)
    const m = mean(partitionMeans)

    return {
      condition: s.condition,
      cells: s.points.reduce((a, p) => a + p.n, 0),
      acc: m,
      cost: baseMean === null || s.condition.epsilon === null ? null : baseMean - m,
      /** max − min across partitions: how much accuracy still tracks heterogeneity. */
      spread: Math.max(...partitionMeans) - Math.min(...partitionMeans),
      hellingerSpan: [Math.min(...s.points.map(p => p.hellinger)), Math.max(...s.points.map(p => p.hellinger))] as [
        number,
        number
      ]
    }
  })
}

/** The Phase A run a Phase B run is measured against. Never reconstructed by name. */
export const comparatorRun = (run: Run) => (run.comparator ? runByName(run.comparator) : null)

/**
 * Per-client noise burden, with the size and sigma ratios that make the
 * inequality legible. Sorted by client size so the spread reads left to right.
 */
export const clientNoise = (run: Run) => {
  if (!run.dp) return null

  const clients = [...run.dp.clients].sort((a, b) => a.n - b.n)
  const sizes = clients.map(c => c.n)

  // A scheduled client carries no scalar sigma; use the top of its range so the
  // ratio still means "most noise against least".
  const sigmas = clients.map(c => c.sigma ?? c.sigmaMax ?? 0).filter(v => v > 0)

  return {
    clients,
    scheduled: clients.some(c => c.schedule),
    sizeRatio: Math.max(...sizes) / Math.min(...sizes),
    sigmaRatio: sigmas.length ? Math.max(...sigmas) / Math.min(...sigmas) : null,
    maxQ: Math.max(...clients.map(c => c.q)),
    smallest: clients[0],
    largest: clients[clients.length - 1],
    anySaturated: clients.some(c => c.saturated)
  }
}

export const eps = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(4))

// ---------------------------------------------------------------------------
// Phase C — secure aggregation
//
// Each masked run is paired with a plain run at the same configuration, and the
// plain run in turn reproduces a Phase A run exactly. Everything here is
// computed from the recorded curves rather than restated, so the page cannot
// drift from the files.
// ---------------------------------------------------------------------------

export const secaggRuns = allRuns.filter(r => r.secagg !== null)
export const maskedRuns = allRuns.filter(r => r.secagg?.enabled)

export type SecaggPair = {
  strategy: Strategy | null
  strategyLabel: string
  masked: Run
  plain: Run
  /** The Phase A run the plain arm reproduces. */
  twin: Run | null

  /** Accuracy difference at round 1, in points. Zero means the aggregate is exact. */
  round1DiffPts: number | null
  /** Largest difference at any round after the first, in points. */
  maxWanderPts: number
  finalDiffPts: number | null

  /** Largest difference between the plain arm and its Phase A twin, in points. */
  twinMaxDiffPts: number | null

  bytesPlain: number | null
  bytesMasked: number | null
  /** Payload ratio. Masking does not change the shape of an update, so 1.0000. */
  bytesRatio: number | null

  maskSeconds: number
  aggregateSeconds: number
  /** Processor seconds per round attributable to masking. */
  totalSeconds: number

  keyAgreementRecorded: number
  keyAgreementProtocol: number

  /** Elapsed seconds per round, kept only to show that it cannot carry a claim. */
  elapsedMasked: number | null
  elapsedPlain: number | null
}

const accSeries = (run: Run) => {
  const i = run.curve.cols.indexOf('test_acc')

  return i === -1 ? [] : run.curve.rows.map(row => (typeof row[i] === 'number' ? (row[i] as number) : null))
}

const bytesPerRound = (run: Run) => {
  const i = run.curve.cols.indexOf('bytes_up')

  return i === -1 || !run.curve.rows.length ? null : (run.curve.rows[0][i] as number)
}

/** Aligned |difference| in accuracy points between two runs, round by round. */
const diffSeries = (a: Run, b: Run) => {
  const x = accSeries(a)
  const y = accSeries(b)
  const n = Math.min(x.length, y.length)
  const out: number[] = []

  for (let i = 0; i < n; i++) {
    if (x[i] === null || y[i] === null) continue
    out.push(Math.abs((x[i] as number) - (y[i] as number)) * 100)
  }

  return out
}

export const secaggPairs = (): SecaggPair[] =>
  maskedRuns
    .map(masked => {
      const plain = masked.secagg?.pair ? runByName(masked.secagg.pair) : null

      if (!plain) return null

      const twin = plain.secagg?.equals ? runByName(plain.secagg.equals) : null
      const diffs = diffSeries(masked, plain)
      const twinDiffs = twin ? diffSeries(plain, twin) : []

      const bp = bytesPerRound(plain)
      const bm = bytesPerRound(masked)

      return {
        strategy: masked.strategy,
        strategyLabel: masked.strategyLabel,
        masked,
        plain,
        twin,
        round1DiffPts: diffs.length ? diffs[0] : null,
        maxWanderPts: diffs.length > 1 ? Math.max(...diffs.slice(1)) : 0,
        finalDiffPts: diffs.length ? diffs[diffs.length - 1] : null,
        twinMaxDiffPts: twinDiffs.length ? Math.max(...twinDiffs) : null,
        bytesPlain: bp,
        bytesMasked: bm,
        bytesRatio: bp && bm ? bm / bp : null,
        maskSeconds: masked.secagg!.maskProcessorSecondsPerRound,
        aggregateSeconds: masked.secagg!.aggregateProcessorSecondsPerRound,
        totalSeconds: masked.secagg!.maskProcessorSecondsPerRound + masked.secagg!.aggregateProcessorSecondsPerRound,
        keyAgreementRecorded: masked.secagg!.keyAgreementMessagesPerRound,
        keyAgreementProtocol: masked.secagg!.keyAgreementMessagesProtocol,
        elapsedMasked: masked.secondsPerRound,
        elapsedPlain: plain.secondsPerRound
      }
    })
    .filter((p): p is SecaggPair => p !== null)
    .sort((a, b) => (a.bytesPlain ?? 0) - (b.bytesPlain ?? 0))

/**
 * Does the cost of masking track the size of what is masked?
 *
 * SCAFFOLD is in the phase to give the cost a second point on the payload
 * scale — it transmits a control variate alongside the update, so its payload
 * is twice FedAvg's.
 */
export const secaggScaling = () => {
  const pairs = secaggPairs()

  if (pairs.length < 2) return null

  const lo = pairs[0]
  const hi = pairs[pairs.length - 1]

  return {
    lo,
    hi,
    payloadRatio: lo.bytesPlain && hi.bytesPlain ? hi.bytesPlain / lo.bytesPlain : null,
    maskRatio: lo.maskSeconds ? hi.maskSeconds / lo.maskSeconds : null,
    aggregateRatio: lo.aggregateSeconds ? hi.aggregateSeconds / lo.aggregateSeconds : null
  }
}

// ---------------------------------------------------------------------------
// Phase D — what the guarantee protects
//
// Every arm shares one cell: CIFAR-10, FedAvg, Dirichlet 0.1, seed 0. Only the
// mechanism changes, so differences between them are attributable to the
// mechanism and nothing else.
// ---------------------------------------------------------------------------

export const phaseDRuns = allRuns.filter(r => r.phase === 'D')

export type GranularityArm = {
  key: string
  label: string
  /** Short description of what the guarantee protects, or that there is none. */
  protects: string
  run: Run | null
  epsilon: number | null
  finalAcc: number | null
  bestAcc: number | null
  bestStep: number | null
  secondsPerRound: number | null
  /** Delivered epsilon, once the calibration backfill has been run. */
  deliveredEpsilon: number | null
  granularity: string | null
}

const dArm = (arm: string) => phaseDRuns.find(r => r.arm === arm) ?? null

const armOf = (key: string, label: string, protects: string, arm: string, epsilon: number | null): GranularityArm => {
  const run = dArm(arm)

  return {
    key,
    label,
    protects,
    run,
    epsilon,
    finalAcc: run?.finalAcc ?? null,
    bestAcc: run?.bestAcc ?? null,
    bestStep: run?.bestStep ?? null,
    secondsPerRound: run?.secondsPerRound ?? null,
    deliveredEpsilon: run?.dp?.deliveredEpsilon ?? null,
    granularity: run?.dp?.granularity ?? null
  }
}

/** The client-level ladder — the arms that show the mechanism failing at every budget. */
export const clientLevelArms = () => [
  armOf('client1', 'Client-level, ε = 1', 'one institution', 'clientdp_eps1', 1),
  armOf('client4', 'Client-level, ε = 4', 'one institution', 'clientdp_eps4', 4),
  armOf('client8', 'Client-level, ε = 8', 'one institution', 'clientdp_eps8', 8)
]

export const adaptiveArms = () => [
  armOf('adapt1', 'Time-adaptive, ε = 1', 'one record', 'adaptive_eps1', 1),
  armOf('adapt4', 'Time-adaptive, ε = 4', 'one record', 'adaptive_eps4', 4),
  armOf('adapt8', 'Time-adaptive, ε = 8', 'one record', 'adaptive_eps8', 8)
]

export const sampleLevelArm = () => armOf('sample1', 'Sample-level, ε = 1', 'one record', 'sampledp_eps1', 1)
export const unprotectedArm = () => armOf('none', 'No privacy mechanism', 'nothing', 'none', null)
export const uniformDiagnosticArm = () =>
  armOf('uniform', 'Unprotected, uniform averaging', 'nothing', 'uniform', null)

/**
 * The granularity gap at equal budget: same ε, same everything else, differing
 * only in what the guarantee protects — one record against one institution.
 */
export const granularityGap = () => {
  const sample = sampleLevelArm()
  const client = clientLevelArms()[0]

  if (sample.finalAcc === null || client.finalAcc === null) return null

  return {
    sample,
    client,
    gapPts: (sample.finalAcc - client.finalAcc) * 100
  }
}

/**
 * Client-level DP requires a uniform mean, so its runs differ from their
 * comparators in two ways at once. The diagnostic isolates the re-weighting,
 * which is the only way the noise cost and the averaging cost can be separated.
 */
export const uniformAveragingCost = () => {
  const weighted = unprotectedArm()
  const uniform = uniformDiagnosticArm()
  const client = clientLevelArms()[0]

  if (weighted.finalAcc === null || uniform.finalAcc === null) return null

  const reweighting = (weighted.finalAcc - uniform.finalAcc) * 100
  const total = client.finalAcc === null ? null : (weighted.finalAcc - client.finalAcc) * 100

  return {
    weighted,
    uniform,
    client,
    reweightingPts: reweighting,
    totalPts: total,
    noisePts: total === null ? null : total - reweighting
  }
}

/**
 * Compute cost by mechanism, averaged across the budgets each mechanism was run
 * at — client-level and time-adaptive have three each, sample-level one.
 *
 * This is a ratio between runs made back to back on one machine, which is the
 * only circumstance in which elapsed time carries any information here. It is
 * never plotted, and it is labelled as a ratio wherever it appears.
 */
export const granularityCompute = () => {
  const base = unprotectedArm()

  if (base.secondsPerRound === null) return null

  const group = (label: string, protects: string, arms: GranularityArm[]) => {
    const secs = arms.map(a => a.secondsPerRound).filter((x): x is number => x !== null)

    if (!secs.length) return null

    const s = mean(secs)

    return { label, protects, secondsPerRound: s, ratio: s / base.secondsPerRound!, budgets: secs.length }
  }

  return [
    { label: base.label, protects: base.protects, secondsPerRound: base.secondsPerRound, ratio: 1, budgets: 1 },
    group('Client-level DP', 'one institution', clientLevelArms()),
    group('Sample-level DP', 'one record', [sampleLevelArm()]),
    group('Time-adaptive DP', 'one record', adaptiveArms())
  ].filter((x): x is NonNullable<typeof x> => x !== null)
}

/** True once the calibration backfill has populated dp on the Phase D runs. */
export const phaseDCalibrated = () => phaseDRuns.some(r => r.arm !== 'none' && r.arm !== 'uniform' && r.dp !== null)

// ---------------------------------------------------------------------------
// Filtering for the run explorer
// ---------------------------------------------------------------------------

export type RunFilter = {
  dataset?: Dataset | 'all'
  strategy?: Strategy | 'all'
  partition?: Partition | 'all'
  seed?: number | 'all'
  mode?: 'all' | 'federated' | 'centralized'
  includeFedAvgM?: boolean
  /** 'all' | 'none' for unprotected | a target epsilon. */
  privacy?: 'all' | 'none' | number
}

export const filterRuns = (f: RunFilter): Run[] =>
  allRuns
    .filter(r => (f.dataset && f.dataset !== 'all' ? r.dataset === f.dataset : true))
    .filter(r => (f.mode && f.mode !== 'all' ? r.mode === f.mode : true))
    .filter(r => (f.strategy && f.strategy !== 'all' ? r.strategy === f.strategy : true))
    .filter(r => (f.partition && f.partition !== 'all' ? r.partition === f.partition : true))
    .filter(r => (f.seed !== undefined && f.seed !== 'all' ? r.seed === f.seed : true))
    .filter(r => (f.includeFedAvgM === false ? !r.isFedAvgM : true))
    .filter(r => {
      if (f.privacy === undefined || f.privacy === 'all') return true
      if (f.privacy === 'none') return r.dp === null

      return r.dp?.targetEpsilon === f.privacy
    })
    .sort(
      (a, b) =>
        a.dataset.localeCompare(b.dataset) ||
        partitionRank(a.partition) - partitionRank(b.partition) ||
        strategyRank(a.strategy) - strategyRank(b.strategy) ||
        (a.seed ?? 0) - (b.seed ?? 0)
    )

export const runByName = (name: string) => allRuns.find(r => r.name === name) ?? null

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const pct = (x: number | null, dp = 2) => (x === null ? '—' : `${(x * 100).toFixed(dp)}%`)
export const num = (x: number | null, dp = 3) => (x === null ? '—' : x.toFixed(dp))

export const bytes = (b: number | null) => {
  if (b === null) return '—'
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} kB`

  return `${b} B`
}

/** Chance-level accuracy, for reading collapse against. */
export const chanceLevel = (dataset: Dataset) => (dataset === 'cifar10' ? 1 / 10 : 1 / 9)

export const numClasses = (dataset: Dataset) => (dataset === 'cifar10' ? 10 : 9)

/** True when a run ends below the chance line — i.e. it diverged, not underfit. */
export const endedBelowChance = (run: Run) =>
  run.finalAcc !== null && run.mode === 'federated' && run.finalAcc < chanceLevel(run.dataset)

/**
 * A run whose best accuracy is materially above its final accuracy has not
 * simply converged slowly — it has lost what it had.
 */
export const collapsed = (run: Run, marginPts = 5) =>
  run.bestAcc !== null && run.finalAcc !== null && (run.bestAcc - run.finalAcc) * 100 >= marginPts

/*
 * Volatility and whether the final value can be trusted as a summary.
 *
 * Round-to-round movement is a continuum across these runs, not two clean
 * regimes: CIFAR-10 spans 0.55–2.97 points and PathMNIST 2.17–11.89, with the
 * two datasets barely overlapping. Any single cut on that quantity would be
 * arbitrary, so it is reported as a number rather than used as the main flag.
 *
 * The question that actually matters is different, and does separate cleanly:
 * does the last recorded round misrepresent where the run was? Measured as the
 * gap between the final value and the mean of the last ten steps, the data
 * splits at 12.38, 9.72, then a 5.5-point gap down to 4.22. Two runs — both
 * PathMNIST with the pathological split — have a final value that is badly
 * unrepresentative; every other run is within 4.3 points and most within 1.
 */

/** Mean absolute round-to-round change in accuracy, in percentage points. */
export const volatilityPts = (run: Run) => (run.meanAbsDelta === null ? null : run.meanAbsDelta * 100)

/** Runs above this oscillate enough that no single round summarises them well. */
export const VOLATILITY_THRESHOLD_PTS = 4.5

export const isVolatile = (run: Run) => {
  const v = volatilityPts(run)

  return v !== null && v >= VOLATILITY_THRESHOLD_PTS
}

/** Gap between the final value and the mean of the last ten steps, in points. */
export const finalGapPts = (run: Run) =>
  run.finalAcc === null || run.tailMean === null ? null : Math.abs(run.finalAcc - run.tailMean) * 100

export const UNREPRESENTATIVE_THRESHOLD_PTS = 5

/**
 * True when quoting the final value would misstate the run by more than five
 * points. Where this holds the site shows the tail mean beside it rather than
 * presenting one noisy endpoint as the result.
 */
export const hasUnrepresentativeFinal = (run: Run) => {
  const g = finalGapPts(run)

  return g !== null && g >= UNREPRESENTATIVE_THRESHOLD_PTS
}

/** The value worth leading with: the tail mean when the final one misleads. */
export const headlineAcc = (run: Run) => (hasUnrepresentativeFinal(run) ? run.tailMean : run.finalAcc)

// ---------------------------------------------------------------------------
// Timing. Recorded, but not a measurement.
// ---------------------------------------------------------------------------

export const timingStats = () => {
  const xs = allRuns.map(r => r.secondsPerRound).filter((x): x is number => x !== null)

  if (!xs.length) return null
  const sorted = [...xs].sort((a, b) => a - b)

  return {
    n: xs.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    ratio: sorted[sorted.length - 1] / sorted[0]
  }
}
