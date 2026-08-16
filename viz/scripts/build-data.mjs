/*
 * build-data.mjs — converts fl-privacy-noniid/results/ into a single static JSON
 * bundle consumed by the site.
 *
 * Deliberately dependency-free: plain Node, no npm packages. It can therefore be
 * run and verified independently of the frontend toolchain.
 *
 *   node scripts/build-data.mjs
 *
 * Reads : ../results/<run>/{metrics.csv,partition_report.json,config_used.json,timing.txt}
 * Writes: src/data/generated/results.json
 *
 * Design notes
 * ------------
 * - Nothing is read at runtime. The bundle is imported statically, so there is no
 *   fetch, no basePath URL construction and no server dependency of any kind.
 * - Curves are stored column-name + row-array rather than an array of objects,
 *   which roughly halves the JSON size for identical information.
 * - Superseded runs (.pre-D49, .d50-twostage) are excluded, per FRONTEND_HANDOFF §4.
 * - Non-Phase-A directories (attack_probe, smoke_synthetic_dir01) are excluded:
 *   attack_probe has no config_used.json and unresolved provenance, and the smoke
 *   test is a synthetic fixture, not a result.
 * - No value is recomputed, rescaled or corrected. Whatever is in the CSV is what
 *   is emitted. Derived fields (finalAcc, bestAcc, hellingerMean) are selections
 *   from recorded values, never adjustments to them.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VIZ_ROOT = resolve(__dirname, '..')
const RESULTS_DIR = resolve(VIZ_ROOT, '..', 'results')
const OUT_DIR = join(VIZ_ROOT, 'src', 'data', 'generated')
const OUT_FILE = join(OUT_DIR, 'results.json')

/*
 * A superseded copy keeps the original name and gains a suffix AFTER the seed:
 *   ..._s0.pre-D49          the centralized runs before D49
 *   ..._s0.d50-twostage     the withdrawn two-stage scheme
 *   ..._s0.sigma30-<stamp>  the eps=1 runs whose noise search hit its ceiling (D69)
 *
 * Matching on the seed rather than on a bare dot matters: partition names carry
 * dots of their own (dir0.1, dir1.0), and a naive test drops two thirds of the
 * phase without saying so.
 */
const SUPERSEDED_RE = /_s\d+\..+$/

// ---------------------------------------------------------------------------
// Labels. Phase names are locked by Chapter One — do not rename (HANDOFF §1).
// ---------------------------------------------------------------------------

const STRATEGY_LABELS = {
  fedavg: 'FedAvg',
  fedprox: 'FedProx',
  scaffold: 'SCAFFOLD',
  moon: 'MOON'
}

const PARTITION_LABELS = {
  dir100: 'Dirichlet α = 100',
  'dir1.0': 'Dirichlet α = 1.0',
  'dir0.1': 'Dirichlet α = 0.1',
  path1: 'Pathological, 1 class/client',
  quantity: 'Quantity skew, β = 0.5'
}

const DATASET_LABELS = {
  cifar10: 'CIFAR-10',
  pathmnist: 'PathMNIST'
}

// Display order: increasing heterogeneity for the Dirichlet ladder, then the
// two non-Dirichlet protocols. Ordering here is presentational only.
const PARTITION_ORDER = ['dir100', 'dir1.0', 'dir0.1', 'quantity', 'path1']
const STRATEGY_ORDER = ['fedavg', 'fedprox', 'scaffold', 'moon']

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const parseCsv = text => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)

  if (lines.length === 0) return { cols: [], rows: [] }

  const cols = lines[0].split(',').map(s => s.trim())

  const rows = lines.slice(1).map(line =>
    line.split(',').map(cell => {
      const v = cell.trim()

      if (v === '') return null

      const n = Number(v)

      return Number.isFinite(n) ? n : v
    })
  )

  return { cols, rows }
}

const parseTiming = text => {
  const out = {}

  for (const line of text.trim().split(/\r?\n/)) {
    const i = line.indexOf('=')

    if (i === -1) continue
    const key = line.slice(0, i).trim()
    const n = Number(line.slice(i + 1).trim())

    out[key] = Number.isFinite(n) ? n : line.slice(i + 1).trim()
  }

  return out
}

const readJson = p => JSON.parse(readFileSync(p, 'utf8'))

// ---------------------------------------------------------------------------
// Run-name decoding
//
// Naming: <phase>_<dataset>_<strategy>_<partition>_s<seed>
// Centralized runs omit the partition: <phase>_<dataset>_centralized_s<seed>
//
// FedAvgM is a *configuration of FedAvg*, not a fifth strategy (HANDOFF §1).
// Its config_used.json records strategy "fedavg" and is distinguished only by
// the presence of server_momentum / server_lr. We detect it from the config
// rather than from the directory name, which is the more robust signal.
// ---------------------------------------------------------------------------

const decodeName = (name, config) => {
  const parts = name.split('_')
  const phase = parts[0]
  const dataset = parts[1]
  const seedMatch = name.match(/_s(\d+)$/)
  const seed = seedMatch ? Number(seedMatch[1]) : null

  const isCentralized = name.includes('_centralized_') || config?.mode === 'centralized'

  let strategy = null
  let partition = null

  if (!isCentralized) {
    strategy = config?.strategy ?? parts[2]
    partition = parts.slice(3, parts.length - 1).join('_') || null

    /*
     * Phase B directories carry the privacy budget in the name:
     *   B_<dataset>_<strategy>_<partition>_eps<N>_s<seed>
     *
     * Left in place, the partition reads "dir0.1_eps1", which matches no entry
     * in PARTITION_LABELS, appears in no facet list, and never groups with the
     * Phase A run it is measured against — so a Phase B run would be
     * unreachable from the partition filter and mislabelled everywhere it
     * appeared. The budget is already carried, more precisely, on run.dp.
     *
     * Anchored on the _eps<digits> segment specifically, not on a loose split:
     * partition names legitimately contain dots and digits (dir0.1, dir1.0).
     */
    if (partition) partition = partition.replace(/_eps\d+$/, '')
  }

  const isFedAvgM = !isCentralized && config?.server_momentum !== undefined

  return {
    phase,
    dataset,
    seed,
    strategy,
    partition,
    isFedAvgM,
    mode: isCentralized ? 'centralized' : 'federated'
  }
}

const strategyLabelFor = (strategy, isFedAvgM) => {
  if (isFedAvgM) return 'FedAvg + server momentum (FedAvgM)'

  return STRATEGY_LABELS[strategy] ?? strategy
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const isSuperseded = name => SUPERSEDED_RE.test(name)

const collect = () => {
  if (!existsSync(RESULTS_DIR)) {
    throw new Error(
      `results/ not found at ${RESULTS_DIR}. This script must run from viz/ inside the fl-privacy-noniid repository.`
    )
  }

  const entries = readdirSync(RESULTS_DIR).filter(n => statSync(join(RESULTS_DIR, n)).isDirectory())

  const runs = []
  const excluded = []

  for (const name of entries.sort()) {
    const dir = join(RESULTS_DIR, name)
    const metricsPath = join(dir, 'metrics.csv')
    const configPath = join(dir, 'config_used.json')

    if (isSuperseded(name)) {
      excluded.push({ name, reason: 'superseded' })
      continue
    }

    /*
     * Phases A to E are all real results. Anything else in results/ is a probe
     * or a fixture: attack_probe has no config_used.json and unresolved
     * provenance, smoke_synthetic_dir01 is a synthetic test, and
     * B_pilot_dp_overhead holds one timing measurement rather than a run.
     */
    if (!/^[A-E]_/.test(name)) {
      excluded.push({ name, reason: 'not a phase result directory' })
      continue
    }

    if (name === 'B_pilot_dp_overhead') {
      excluded.push({ name, reason: 'overhead pilot, not a training run' })
      continue
    }

    if (!existsSync(metricsPath) || !existsSync(configPath)) {
      excluded.push({ name, reason: 'missing metrics.csv or config_used.json' })
      continue
    }

    const config = readJson(configPath)
    const dpCalPath = join(dir, 'dp_calibration.json')
    const dpCal = existsSync(dpCalPath) ? readJson(dpCalPath) : null
    const curve = parseCsv(readFileSync(metricsPath, 'utf8'))
    const meta = decodeName(name, config)

    // Accuracy summary — selections from recorded values, never adjustments.
    const accIdx = curve.cols.indexOf('test_acc')
    const stepCol = curve.cols.includes('round') ? 'round' : 'epoch'
    const stepIdx = curve.cols.indexOf(stepCol)

    let finalAcc = null
    let bestAcc = null
    let bestStep = null

    if (accIdx !== -1 && curve.rows.length > 0) {
      finalAcc = curve.rows[curve.rows.length - 1][accIdx]

      for (const row of curve.rows) {
        const a = row[accIdx]

        if (typeof a === 'number' && (bestAcc === null || a > bestAcc)) {
          bestAcc = a
          bestStep = stepIdx === -1 ? null : row[stepIdx]
        }
      }
    }

    /*
     * Volatility.
     *
     * On some configurations the accuracy series oscillates so violently between
     * consecutive rounds that the final value is close to arbitrary — it records
     * which phase of the oscillation round 60 happened to land on, not where the
     * run converged. PathMNIST with the pathological split is the clear case:
     * mean round-to-round movement there is 4.5–11.9 points, against roughly 1.2
     * points at Dirichlet 0.1.
     *
     * These fields let the site flag such runs and report a tail mean beside the
     * final value, instead of presenting a single noisy endpoint as the result.
     */
    let meanAbsDelta = null
    let tailMean = null
    let tailMin = null
    let tailMax = null

    if (accIdx !== -1 && curve.rows.length > 1) {
      const accs = curve.rows.map(r => r[accIdx]).filter(v => typeof v === 'number')
      const deltas = accs.slice(1).map((v, i) => Math.abs(v - accs[i]))

      meanAbsDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length

      const tail = accs.slice(-10)

      tailMean = tail.reduce((a, b) => a + b, 0) / tail.length
      tailMin = Math.min(...tail)
      tailMax = Math.max(...tail)
    }

    // Partition report — absent for centralized runs by design.
    let partitionReport = null
    const prPath = join(dir, 'partition_report.json')

    if (existsSync(prPath)) partitionReport = readJson(prPath)

    // Timing — recorded but unreliable (HANDOFF §6). Carried through so the
    // site can say so explicitly; never plotted as a measurement.
    let timing = null
    const tPath = join(dir, 'timing.txt')

    if (existsSync(tPath)) timing = parseTiming(readFileSync(tPath, 'utf8'))

    // Communication cost, exactly as recorded. Note that bytes_up is identical
    // across all strategies in the recorded data — the SCAFFOLD control-variate
    // multiplier described in the methodology is not reflected in these files.
    // The site surfaces that gap rather than silently correcting for it.
    const bytesIdx = curve.cols.indexOf('bytes_up')
    const bytesUpPerRound = bytesIdx === -1 || curve.rows.length === 0 ? null : curve.rows[0][bytesIdx]

    runs.push({
      name,
      ...meta,
      datasetLabel: DATASET_LABELS[meta.dataset] ?? meta.dataset,
      strategyLabel: meta.mode === 'centralized' ? 'Centralized baseline' : strategyLabelFor(meta.strategy, meta.isFedAvgM),
      partitionLabel: meta.partition ? (PARTITION_LABELS[meta.partition] ?? meta.partition) : null,
      steps: curve.rows.length,
      stepUnit: stepCol,
      configuredSteps: config.rounds ?? config.epochs ?? null,
      finalAcc,
      bestAcc,
      bestStep,
      meanAbsDelta,
      tailMean,
      tailMin,
      tailMax,
      hellingerMean: partitionReport?.hellinger_mean ?? null,
      hellingerMax: partitionReport?.hellinger_max ?? null,
      clientSizes: partitionReport?.client_sizes ?? null,
      hellingerPerClient: partitionReport?.hellinger_per_client ?? null,
      classesPerClient: partitionReport?.classes_per_client ?? null,
      bytesUpPerRound,
      secondsPerRound: timing?.seconds_per_round ?? null,
      secondsTotal: timing?.seconds_total ?? null,

      /*
       * Differential privacy, present only where the run configured it.
       *
       * targetEpsilon is the label on the directory. deliveredEpsilon is the
       * WORST client's realised budget, which is the guarantee the federation
       * can actually claim, and the two coincide only when no client was
       * short-changed. sigmaRatio is a result in its own right: noise is
       * calibrated per client, so the smallest silo carries the most of it, and
       * the ratio grows with skew (D58, D69).
       */
      dp: dpCal
        ? {
            granularity: dpCal.granularity,
            targetEpsilon: dpCal.target_epsilon,
            deliveredEpsilon: dpCal.epsilon_run_level,
            labelHonoured: dpCal.label_honoured,
            delta: dpCal.delta,
            maxGradNorm: dpCal.max_grad_norm,
            sigmaMin: dpCal.sigma_min,
            sigmaMax: dpCal.sigma_max,
            sigmaRatio: dpCal.sigma_ratio,
            clients: dpCal.clients
          }
        : null,

      /** The Phase A run this one is measured against, where the config names it. */
      comparator: config.comparator ?? null,

      /*
       * Which record of the run survives. Phase A and the first Phase B predate
       * run.py capturing its own output, so they carry a reconstruction rather
       * than a transcript, and the site must not present the two as equivalent.
       */
      hasLog: existsSync(join(dir, 'run.log')),
      hasProvenance: existsSync(join(dir, 'provenance.txt')),

      config,
      curve
    })
  }

  return { runs, excluded }
}

const { runs, excluded } = collect()

// Integrity checks. These are assertions about the emitted bundle, not about the
// experiment — they catch a broken conversion, not a broken result.
const problems = []

for (const r of runs) {
  if (r.finalAcc === null) problems.push(`${r.name}: no test_acc column`)
  if (r.mode === 'federated' && r.hellingerMean === null) problems.push(`${r.name}: federated run with no partition_report.json`)
  if (r.configuredSteps !== null && r.steps !== r.configuredSteps) {
    problems.push(`${r.name}: ${r.steps} rows recorded but config specifies ${r.configuredSteps}`)
  }
}

/*
 * Content hash rather than a build timestamp.
 *
 * The bundle must be byte-identical for identical inputs. A generatedAt
 * timestamp would change on every run, which means the committed copy could
 * never match a freshly built one — and the CI step that checks the committed
 * bundle is in step with results/ would fail on every push, forever.
 *
 * The hash is also the more useful field: it identifies the dataset, not the
 * moment someone happened to run the script.
 */
const dataHash = createHash('sha256').update(JSON.stringify(runs)).digest('hex').slice(0, 12)

const bundle = {
  dataHash,
  runCount: runs.length,
  excluded,
  integrityWarnings: problems,
  facets: {
    datasets: [...new Set(runs.map(r => r.dataset))],
    strategies: STRATEGY_ORDER.filter(s => runs.some(r => r.strategy === s)),
    partitions: PARTITION_ORDER.filter(p => runs.some(r => r.partition === p)),
    seeds: [...new Set(runs.map(r => r.seed))].sort((a, b) => a - b)
  },
  labels: {
    strategies: STRATEGY_LABELS,
    partitions: PARTITION_LABELS,
    datasets: DATASET_LABELS
  },
  runs
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(bundle))

const kb = (statSync(OUT_FILE).size / 1024).toFixed(0)

console.log(`build-data: ${runs.length} runs -> ${OUT_FILE} (${kb} KB, data ${dataHash})`)
console.log(`build-data: ${excluded.length} directories excluded`)

for (const e of excluded) console.log(`  - ${e.name}: ${e.reason}`)

if (problems.length) {
  console.log(`build-data: ${problems.length} integrity warning(s)`)
  for (const p of problems) console.log(`  ! ${p}`)
}
