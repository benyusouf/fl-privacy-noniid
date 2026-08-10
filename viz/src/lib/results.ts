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

const groupKey = (r: Run) =>
  [r.dataset, r.mode, r.isFedAvgM ? 'fedavgm' : (r.strategy ?? 'centralized'), r.partition ?? 'none'].join('|')

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
  seedGroups(federatedRuns.filter(r => r.dataset === dataset && !r.isFedAvgM))
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
// Filtering for the run explorer
// ---------------------------------------------------------------------------

export type RunFilter = {
  dataset?: Dataset | 'all'
  strategy?: Strategy | 'all'
  partition?: Partition | 'all'
  seed?: number | 'all'
  mode?: 'all' | 'federated' | 'centralized'
  includeFedAvgM?: boolean
}

export const filterRuns = (f: RunFilter): Run[] =>
  allRuns
    .filter(r => (f.dataset && f.dataset !== 'all' ? r.dataset === f.dataset : true))
    .filter(r => (f.mode && f.mode !== 'all' ? r.mode === f.mode : true))
    .filter(r => (f.strategy && f.strategy !== 'all' ? r.strategy === f.strategy : true))
    .filter(r => (f.partition && f.partition !== 'all' ? r.partition === f.partition : true))
    .filter(r => (f.seed !== undefined && f.seed !== 'all' ? r.seed === f.seed : true))
    .filter(r => (f.includeFedAvgM === false ? !r.isFedAvgM : true))
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
