/*
 * build-downloads.mjs — publishes the recorded files behind every figure.
 *
 *   node scripts/build-downloads.mjs
 *
 * Reads : ../results/<run>/{metrics.csv,partition_report.json,config_used.json,
 *                           timing.txt,dp_calibration.json,provenance.txt,run.log}
 * Writes: public/data/runs/<run>/*          one copy per file, served as-is
 *         public/data/fl-privacy-noniid-results.zip   the whole set
 *         src/data/generated/downloads.json           manifest for the UI
 *
 * Why publish the raw files at all
 * --------------------------------
 * The site claims numbers. A reader who wants to check one should not have to
 * clone the repository and re-run anything: the file that produced the figure
 * should be a click away. The whole payload is under three megabytes, so there
 * is no reason to make anyone ask.
 *
 * Deliberately dependency-free, like build-data.mjs. Archiving shells out to
 * zip, and falls back to tar where zip is absent, so nothing has to be
 * installed to build the site.
 *
 * Checkpoints are never published. They are 74 MB of model weights, they are
 * gitignored, and nothing on the site reads them.
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VIZ_ROOT = resolve(__dirname, '..')
const RESULTS_DIR = resolve(VIZ_ROOT, '..', 'results')
const PUBLIC_DIR = join(VIZ_ROOT, 'public', 'data')
const RUNS_DIR = join(PUBLIC_DIR, 'runs')
const OUT_DIR = join(VIZ_ROOT, 'src', 'data', 'generated')
const ARCHIVE_BASE = 'fl-privacy-noniid-results'

// Same rule as build-data.mjs: a supersession suffix attaches after the seed.
const SUPERSEDED_RE = /_s\d+\..+$/

// Everything a run records, in the order a reader would want it.
const PUBLISHABLE = [
  ['metrics.csv', 'Accuracy, loss and payload per round'],
  ['partition_report.json', 'Client sizes and Hellinger distances as drawn'],
  ['config_used.json', 'Every parameter the run executed with'],
  ['dp_calibration.json', 'Per-client noise multiplier and realised epsilon'],
  ['timing.txt', 'Elapsed time — unreliable, see Section 3.11'],
  ['run.log', 'Captured transcript of the run'],
  ['provenance.txt', 'Reconstructed record — not a transcript']
]

const human = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)

function collect() {
  const manifest = {}
  let files = 0
  let bytes = 0

  for (const name of readdirSync(RESULTS_DIR).sort()) {
    const dir = join(RESULTS_DIR, name)

    if (!statSync(dir).isDirectory()) continue
    if (SUPERSEDED_RE.test(name)) continue
    if (!/^[A-E]_/.test(name)) continue
    if (name === 'B_pilot_dp_overhead') continue
    if (!existsSync(join(dir, 'config_used.json'))) continue

    const present = []

    for (const [file, description] of PUBLISHABLE) {
      const src = join(dir, file)

      if (!existsSync(src)) continue
      const size = statSync(src).size

      mkdirSync(join(RUNS_DIR, name), { recursive: true })
      copyFileSync(src, join(RUNS_DIR, name, file))
      present.push({ file, description, size, sizeLabel: human(size) })
      files += 1
      bytes += size
    }

    if (present.length) manifest[name] = present
  }

  return { manifest, files, bytes }
}

/*
 * Build the whole-study archive.
 *
 * zip is tried first because it is what a general reader expects, with tar.gz
 * as the fallback. Both are checked by SIZE afterwards rather than trusted on
 * exit status: an interrupted zip leaves a zero-byte target and a temp file
 * beside it and does not always report failure, which would otherwise ship an
 * empty download. Whichever format wins, the other is removed so the export
 * never carries two archives that claim to be the same thing.
 */
function archive() {
  const candidates = [`${ARCHIVE_BASE}.zip`, `${ARCHIVE_BASE}.tar.gz`]

  const tidy = () => {
    for (const f of readdirSync(PUBLIC_DIR)) {
      const isArchive = candidates.includes(f)
      const isTemp = !isArchive && f !== 'runs' && !f.startsWith('.')

      if (!isArchive && !isTemp) continue

      try {
        rmSync(join(PUBLIC_DIR, f), { recursive: true, force: true })
      } catch {
        /* best effort, as above */
      }
    }
  }

  const attempts = [
    { name: candidates[0], cmd: 'zip', args: ['-qr', candidates[0], 'runs'] },
    { name: candidates[1], cmd: 'tar', args: ['-czf', candidates[1], 'runs'] }
  ]

  for (const { name, cmd, args } of attempts) {
    tidy()

    try {
      execFileSync(cmd, args, { cwd: PUBLIC_DIR, stdio: 'ignore' })
    } catch {
      continue
    }

    const path = join(PUBLIC_DIR, name)

    // A usable archive of ~800 KB of text will not come out under 20 KB.
    if (existsSync(path) && statSync(path).size > 20_000) {
      for (const other of candidates) {
        if (other === name || !existsSync(join(PUBLIC_DIR, other))) continue

        try {
          rmSync(join(PUBLIC_DIR, other))
        } catch {
          console.warn(`build-downloads: could not remove the stale ${other}; delete it by hand`)
        }
      }

      return { path: name, size: statSync(path).size }
    }

    console.warn(`build-downloads: ${cmd} produced nothing usable, trying the next format`)
  }

  tidy()
  throw new Error('could not build an archive with either zip or tar')
}

/*
 * Start clean so a deleted or superseded run cannot linger in the export.
 * Removal is best-effort: a file held open elsewhere, or a mount that forbids
 * unlinking, should not stop the build. Copies overwrite in place, so the only
 * cost of a failed clean is that a run deleted upstream may survive here - and
 * that is worth a warning rather than a crash.
 */
try {
  if (existsSync(RUNS_DIR)) rmSync(RUNS_DIR, { recursive: true })
} catch {
  console.warn('build-downloads: could not clear public/data/runs; files will be overwritten in place')
}

mkdirSync(RUNS_DIR, { recursive: true })

const { manifest, files, bytes } = collect()
const bundle = archive()

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(
  join(OUT_DIR, 'downloads.json'),
  `${JSON.stringify(
    {
      runs: manifest,
      archive: { ...bundle, sizeLabel: human(bundle.size) },
      totalFiles: files,
      totalBytes: bytes,
      totalLabel: human(bytes),
      note: 'Model checkpoints are not published: 74 MB of weights that nothing on the site reads.'
    },
    null,
    2
  )}\n`
)

console.log(`build-downloads: ${Object.keys(manifest).length} runs, ${files} files, ${human(bytes)}`)
console.log(`build-downloads: archive ${bundle.path} (${human(bundle.size)})`)
