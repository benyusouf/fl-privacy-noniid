/*
 * preview-charts.mjs — renders the site's charts to standalone SVG files using
 * the same geometry module the React components use.
 *
 *   node scripts/preview-charts.mjs
 *
 * Why this exists: the React components cannot be executed without a full
 * toolchain, but the charts they draw are worth looking at before anyone builds
 * the site. This script mirrors each component's rendering with the same calls
 * to chart-geometry.mjs, so what comes out is what the site will draw. It is a
 * development aid, not part of the build.
 *
 * Output: scripts/preview/*.svg (gitignored territory — safe to delete)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { bandScale, extent, formatTick, linePath, niceTicks, plotArea, scaleLinear, subBands } from '../src/lib/chart-geometry.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VIZ = resolve(__dirname, '..')
const OUT = join(__dirname, 'preview')

const bundle = JSON.parse(readFileSync(join(VIZ, 'src/data/generated/results.json'), 'utf8'))

// Mirrors src/components/charts/palette.ts
const STRATEGY_COLOURS = { fedavg: '#666CFF', fedprox: '#26C6F9', scaffold: '#FDB528', moon: '#72E128' }
const CENTRALIZED_COLOUR = '#8592A3'
const CHANCE_COLOUR = '#FF4D49'

const TEXT = '#8592A3'
const AXIS = '#DBDADE'
const PAPER = '#FFFFFF'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// --- shared frame, mirroring ChartFrame.tsx --------------------------------

const frame = ({ vbWidth = 900, vbHeight = 380, margin, xDomain, yDomain, xLabel, yLabel, xTickCount = 6, yTickCount = 6, formatX, formatY, body }) => {
  const m = margin ?? { top: 16, right: 24, bottom: 44, left: 56 }
  const area = plotArea(vbWidth, vbHeight, m)
  const x = scaleLinear(xDomain, [area.x0, area.x1])
  const y = scaleLinear(yDomain, [area.y1, area.y0])
  const xTicks = niceTicks(xDomain[0], xDomain[1], xTickCount)
  const yTicks = niceTicks(yDomain[0], yDomain[1], yTickCount)
  const fx = v => (formatX ? formatX(v, xTicks) : formatTick(v, xTicks))
  const fy = v => (formatY ? formatY(v, yTicks) : formatTick(v, yTicks))

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbWidth} ${vbHeight}" width="100%" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`
  s += `<rect width="${vbWidth}" height="${vbHeight}" fill="${PAPER}"/>`

  for (const t of yTicks) s += `<line x1="${area.x0}" x2="${area.x1}" y1="${y(t)}" y2="${y(t)}" stroke="${AXIS}" stroke-dasharray="3 3"/>`
  for (const t of xTicks) s += `<line y1="${area.y0}" y2="${area.y1}" x1="${x(t)}" x2="${x(t)}" stroke="${AXIS}" stroke-dasharray="3 3"/>`

  s += body({ x, y, area })

  s += `<line x1="${area.x0}" x2="${area.x1}" y1="${area.y1}" y2="${area.y1}" stroke="${AXIS}"/>`
  s += `<line x1="${area.x0}" x2="${area.x0}" y1="${area.y0}" y2="${area.y1}" stroke="${AXIS}"/>`

  for (const t of yTicks) s += `<text x="${area.x0 - 8}" y="${y(t)}" text-anchor="end" dominant-baseline="middle" font-size="12" fill="${TEXT}">${esc(fy(t))}</text>`
  for (const t of xTicks) s += `<text x="${x(t)}" y="${area.y1 + 18}" text-anchor="middle" font-size="12" fill="${TEXT}">${esc(fx(t))}</text>`

  if (xLabel) s += `<text x="${(area.x0 + area.x1) / 2}" y="${vbHeight - 6}" text-anchor="middle" font-size="12" fill="${TEXT}">${esc(xLabel)}</text>`
  if (yLabel) s += `<text transform="translate(14 ${(area.y0 + area.y1) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="${TEXT}">${esc(yLabel)}</text>`

  return s + '</svg>'
}

// --- RQ1 scatter, mirroring HellingerScatterChart.tsx ----------------------

const STRATEGY_ORDER = ['fedavg', 'fedprox', 'scaffold', 'moon']
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length

const seedGroups = runs => {
  const map = new Map()

  for (const r of runs) {
    const k = [r.dataset, r.mode, r.isFedAvgM ? 'fedavgm' : r.strategy ?? 'centralized', r.partition ?? 'none'].join('|')

    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }

  return [...map.entries()].map(([key, rs]) => {
    const accs = rs.map(r => r.finalAcc).filter(v => v !== null)
    const hs = rs.map(r => r.hellingerMean).filter(v => v !== null)

    return {
      key,
      strategy: rs[0].strategy,
      partitionLabel: rs[0].partitionLabel,
      n: rs.length,
      singleSeed: rs.length === 1,
      x: hs.length ? mean(hs) : 0,
      y: mean(accs) * 100,
      yMin: Math.min(...accs) * 100,
      yMax: Math.max(...accs) * 100
    }
  })
}

const rq1Svg = dataset => {
  const fed = bundle.runs.filter(r => r.mode === 'federated' && r.dataset === dataset && !r.isFedAvgM)
  const pts = seedGroups(fed).sort((a, b) => a.x - b.x)
  const cen = bundle.runs.filter(r => r.mode === 'centralized' && r.dataset === dataset)
  const cAcc = cen.map(r => r.finalAcc * 100)
  const baseline = cAcc.length ? { mean: mean(cAcc), n: cAcc.length, singleSeed: cAcc.length === 1 } : null
  const chance = (dataset === 'cifar10' ? 1 / 10 : 1 / 9) * 100
  const yMax = Math.max(...pts.map(p => p.yMax), baseline?.mean ?? 0, chance)

  return frame({
    vbHeight: 420,
    xDomain: [0, 0.9],
    yDomain: [0, yMax * 1.1],
    xLabel: 'measured mean Hellinger distance',
    yLabel: 'final test accuracy (%)',
    formatY: v => `${v.toFixed(0)}%`,
    body: ({ x, y, area }) => {
      let s = ''

      s += `<line x1="${area.x0}" x2="${area.x1}" y1="${y(chance)}" y2="${y(chance)}" stroke="${CHANCE_COLOUR}" stroke-dasharray="6 4"/>`
      s += `<text x="${area.x1}" y="${y(chance) + 14}" text-anchor="end" font-size="11" fill="${CHANCE_COLOUR}">chance = ${chance.toFixed(2)}%</text>`

      if (baseline) {
        s += `<line x1="${area.x0}" x2="${area.x1}" y1="${y(baseline.mean)}" y2="${y(baseline.mean)}" stroke="${CENTRALIZED_COLOUR}" stroke-dasharray="4 4"/>`
        s += `<text x="${area.x1}" y="${y(baseline.mean) - 6}" text-anchor="end" font-size="11" fill="${CENTRALIZED_COLOUR}">centralized ${baseline.mean.toFixed(2)}% (n=${baseline.n})</text>`
      }

      for (const st of STRATEGY_ORDER) {
        const g = pts.filter(p => p.strategy === st)

        if (!g.length) continue
        const c = STRATEGY_COLOURS[st]

        s += `<path d="${linePath(g.map(p => ({ x: x(p.x), y: y(p.y) })))}" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.55"/>`

        for (const p of g) {
          if (!p.singleSeed) {
            s += `<g stroke="${c}" stroke-width="1.5">`
            s += `<line x1="${x(p.x)}" x2="${x(p.x)}" y1="${y(p.yMin)}" y2="${y(p.yMax)}"/>`
            s += `<line x1="${x(p.x) - 4}" x2="${x(p.x) + 4}" y1="${y(p.yMin)}" y2="${y(p.yMin)}"/>`
            s += `<line x1="${x(p.x) - 4}" x2="${x(p.x) + 4}" y1="${y(p.yMax)}" y2="${y(p.yMax)}"/>`
            s += `</g>`
          }
        }
        for (const p of g) {
          s += `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="5" fill="${p.singleSeed ? 'none' : c}" stroke="${c}" stroke-width="2"/>`
        }
      }

      // legend
      let lx = area.x0 + 8

      for (const st of STRATEGY_ORDER) {
        if (!pts.some(p => p.strategy === st)) continue
        s += `<rect x="${lx}" y="${area.y0 + 4}" width="10" height="10" fill="${STRATEGY_COLOURS[st]}"/>`
        s += `<text x="${lx + 15}" y="${area.y0 + 13}" font-size="11" fill="${TEXT}">${st === 'scaffold' ? 'SCAFFOLD' : st === 'fedavg' ? 'FedAvg' : st === 'fedprox' ? 'FedProx' : 'MOON'}</text>`
        lx += 90
      }

      return s
    }
  })
}

// --- accuracy curve, mirroring AccuracyCurveChart.tsx ----------------------

const curveSvg = (runNames, title) => {
  const runs = runNames.map(n => bundle.runs.find(r => r.name === n)).filter(Boolean)
  const series = runs.map(run => {
    const ci = run.curve.cols.indexOf('test_acc')
    const si = run.curve.cols.indexOf(run.stepUnit)

    return {
      run,
      colour: STRATEGY_COLOURS[run.strategy] ?? CENTRALIZED_COLOUR,
      points: run.curve.rows.map(r => ({ step: r[si], value: r[ci] === null ? null : r[ci] * 100 }))
    }
  })

  const xe = extent(series.flatMap(s => s.points.map(p => p.step)))
  const ye = extent(series.flatMap(s => s.points.map(p => p.value)))
  const chance = (runs[0].dataset === 'cifar10' ? 1 / 10 : 1 / 9) * 100

  return frame({
    xDomain: xe,
    yDomain: [0, Math.max(ye[1] * 1.08, 1)],
    xLabel: runs[0].stepUnit,
    yLabel: 'test accuracy (%)',
    formatY: v => `${v.toFixed(0)}%`,
    formatX: v => String(Math.round(v)),
    body: ({ x, y, area }) => {
      let s = ''

      s += `<line x1="${area.x0}" x2="${area.x1}" y1="${y(chance)}" y2="${y(chance)}" stroke="${CHANCE_COLOUR}" stroke-dasharray="6 4"/>`
      s += `<text x="${area.x1}" y="${y(chance) - 5}" text-anchor="end" font-size="11" fill="${CHANCE_COLOUR}">chance = ${chance.toFixed(2)}%</text>`

      for (const ser of series) {
        s += `<path d="${linePath(ser.points.map(p => ({ x: x(p.step), y: p.value === null ? null : y(p.value) })))}" fill="none" stroke="${ser.colour}" stroke-width="2" stroke-linejoin="round"/>`
      }

      s += `<text x="${area.x0 + 8}" y="${area.y0 + 14}" font-size="12" fill="${TEXT}">${esc(title)}</text>`

      let ly = area.y0 + 32

      for (const ser of series) {
        s += `<rect x="${area.x0 + 8}" y="${ly - 8}" width="10" height="10" fill="${ser.colour}"/>`
        s += `<text x="${area.x0 + 23}" y="${ly}" font-size="11" fill="${TEXT}">${esc(ser.run.name)}</text>`
        ly += 16
      }

      return s
    }
  })
}

// --- client distribution, mirroring ClientDistributionChart.tsx ------------

const clientSvg = runName => {
  const run = bundle.runs.find(r => r.name === runName)
  const data = run.clientSizes.map((size, i) => ({ i, size, hellinger: run.hellingerPerClient[i] }))
  const sizeMax = extent(data.map(d => d.size))[1]

  return frame({
    vbHeight: 320,
    margin: { top: 16, right: 56, bottom: 44, left: 64 },
    xDomain: [0, data.length],
    yDomain: [0, sizeMax * 1.1],
    xLabel: `client — ${runName}`,
    yLabel: 'training samples',
    xTickCount: Math.min(data.length, 8),
    formatX: v => String(Math.round(v)),
    formatY: v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))),
    body: ({ y, area }) => {
      const band = bandScale(data.length, area.x0, area.x1, 0.25)
      const sub = subBands(band.barWidth, 2)
      const hy = h => area.y1 - h * area.height
      let s = ''

      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        s += `<text x="${area.x1 + 8}" y="${hy(t)}" dominant-baseline="middle" font-size="11" fill="#FDB528">${t.toFixed(2)}</text>`
      }
      s += `<line x1="${area.x0}" x2="${area.x1}" y1="${hy(run.hellingerMean)}" y2="${hy(run.hellingerMean)}" stroke="#FDB528" stroke-dasharray="5 4"/>`
      s += `<text x="${area.x0 + 4}" y="${hy(run.hellingerMean) - 5}" font-size="11" fill="#FDB528">mean H = ${run.hellingerMean.toFixed(3)}</text>`

      for (const d of data) {
        s += `<rect x="${band.start(d.i) + sub.offset(0)}" y="${y(d.size)}" width="${sub.width}" height="${Math.max(area.y1 - y(d.size), 0)}" fill="#666CFF"/>`
        s += `<rect x="${band.start(d.i) + sub.offset(1)}" y="${hy(d.hellinger)}" width="${sub.width}" height="${Math.max(area.y1 - hy(d.hellinger), 0)}" fill="#FDB528"/>`
      }

      return s
    }
  })
}

// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })

const files = {
  'rq1-cifar10.svg': rq1Svg('cifar10'),
  'rq1-pathmnist.svg': rq1Svg('pathmnist'),
  'curve-scaffold-divergence.svg': curveSvg(
    ['A_pathmnist_scaffold_path1_s0', 'A_pathmnist_fedavg_path1_s0', 'A_pathmnist_moon_path1_s0'],
    'PathMNIST, pathological 1-class — SCAFFOLD diverges'
  ),
  'curve-cifar-dir01.svg': curveSvg(
    ['A_cifar10_fedavg_dir0.1_s0', 'A_cifar10_fedprox_dir0.1_s0', 'A_cifar10_scaffold_dir0.1_s0', 'A_cifar10_moon_dir0.1_s0'],
    'CIFAR-10, Dirichlet alpha = 0.1, seed 0'
  ),
  'clients-dir01.svg': clientSvg('A_cifar10_fedavg_dir0.1_s0'),
  'clients-dir100.svg': clientSvg('A_cifar10_fedavg_dir100_s0')
}

for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(OUT, name), svg)
  console.log(`preview: ${name} (${(svg.length / 1024).toFixed(1)} KB)`)
}

console.log(`preview: written to ${OUT}`)
