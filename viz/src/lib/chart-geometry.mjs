/*
 * chart-geometry.mjs — pure geometry for the SVG charts.
 *
 * Written as plain JavaScript rather than TypeScript on purpose: this module can
 * be executed and unit-tested with bare Node, with no toolchain and no installed
 * packages. The chart components are then thin — they map these numbers onto SVG
 * elements and add no arithmetic of their own — so the part of the charting that
 * can actually be wrong is the part that is tested.
 *
 * tsconfig has allowJs, so TypeScript consumes this directly. JSDoc annotations
 * give the call sites real types.
 *
 * Tests: node scripts/test-chart-geometry.mjs
 */

/**
 * @typedef {{ top: number, right: number, bottom: number, left: number }} Margin
 * @typedef {{ x: number, y: number }} Point
 */

/** @type {Margin} */
export const DEFAULT_MARGIN = { top: 16, right: 24, bottom: 44, left: 56 }

/**
 * Linear scale from a data domain to a pixel range.
 * Zero-width domains are widened rather than producing a divide-by-zero, so a
 * single-point series still renders in the middle of the plot instead of at NaN.
 *
 * @param {[number, number]} domain
 * @param {[number, number]} range
 * @returns {(v: number) => number}
 */
export const scaleLinear = (domain, range) => {
  let [d0, d1] = domain
  const [r0, r1] = range

  if (!Number.isFinite(d0) || !Number.isFinite(d1)) {
    d0 = 0
    d1 = 1
  }

  if (d0 === d1) {
    const pad = Math.abs(d0) > 0 ? Math.abs(d0) * 0.5 : 0.5

    d0 -= pad
    d1 += pad
  }

  const m = (r1 - r0) / (d1 - d0)

  return v => r0 + (v - d0) * m
}

/**
 * "Nice" round tick values covering a domain — steps of 1, 2, 2.5 or 5 times a
 * power of ten. Returns ticks at or inside the domain.
 *
 * @param {number} lo
 * @param {number} hi
 * @param {number} count target number of ticks
 * @returns {number[]}
 */
export const niceTicks = (lo, hi, count = 5) => {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || count < 1) return []
  if (lo === hi) return [lo]
  if (lo > hi) [lo, hi] = [hi, lo]

  const raw = (hi - lo) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag

  let step
  if (norm <= 1) step = 1
  else if (norm <= 2) step = 2
  else if (norm <= 2.5) step = 2.5
  else if (norm <= 5) step = 5
  else step = 10
  step *= mag

  const out = []
  const start = Math.ceil(lo / step) * step

  // Guard against floating-point drift accumulating across many steps.
  for (let i = 0; start + i * step <= hi + step * 1e-9; i++) {
    const v = start + i * step

    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)))
    if (out.length > 1000) break
  }

  return out
}

/**
 * Extent of an array of numbers, ignoring null/undefined/NaN.
 * @param {(number|null|undefined)[]} values
 * @returns {[number, number] | null}
 */
export const extent = values => {
  let lo = Infinity
  let hi = -Infinity

  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }

  return lo === Infinity ? null : [lo, hi]
}

/**
 * Plot area inside the margins.
 * @param {number} width
 * @param {number} height
 * @param {Margin} margin
 */
export const plotArea = (width, height, margin = DEFAULT_MARGIN) => ({
  x0: margin.left,
  y0: margin.top,
  x1: width - margin.right,
  y1: height - margin.bottom,
  width: Math.max(0, width - margin.left - margin.right),
  height: Math.max(0, height - margin.top - margin.bottom)
})

/**
 * SVG path for a polyline, breaking the line at null values rather than
 * interpolating across a gap. A run that stops early therefore looks like it
 * stopped early, instead of being drawn straight to the next recorded point.
 *
 * @param {{x: number, y: number|null}[]} points already in pixel space
 * @returns {string}
 */
export const linePath = points => {
  let d = ''
  let pen = false

  for (const p of points) {
    if (p.y === null || !Number.isFinite(p.y) || !Number.isFinite(p.x)) {
      pen = false
      continue
    }

    d += `${pen ? 'L' : 'M'}${round(p.x)} ${round(p.y)}`
    d += ' '
    pen = true
  }

  return d.trim()
}

/** Round to 2dp — keeps generated SVG small without visible loss. */
export const round = n => Math.round(n * 100) / 100

/**
 * Evenly spaced band positions for categorical bars.
 *
 * @param {number} n number of categories
 * @param {number} x0
 * @param {number} x1
 * @param {number} padding fraction of each band left empty, 0..1
 */
export const bandScale = (n, x0, x1, padding = 0.2) => {
  const span = x1 - x0
  const band = n > 0 ? span / n : 0
  const barWidth = Math.max(0, band * (1 - padding))

  return {
    band,
    barWidth,
    /** @param {number} i */
    center: i => x0 + band * i + band / 2,
    /** @param {number} i */
    start: i => x0 + band * i + (band - barWidth) / 2
  }
}

/**
 * Splits a band into k side-by-side sub-bars (grouped bar chart).
 * @param {number} barWidth
 * @param {number} k
 */
export const subBands = (barWidth, k) => {
  const w = k > 0 ? barWidth / k : 0

  return { width: w, offset: i => i * w }
}

/**
 * Formats a tick value with the fewest decimals that both keeps neighbouring
 * ticks distinct and represents every tick faithfully.
 *
 * Distinctness alone is not enough: ticks [0, 0.25, 0.5] are all distinct at one
 * decimal place, but that prints 0.25 as "0.3" — an axis label that names a
 * value the tick is not at. Faithfulness is checked by parsing the formatted
 * string back and requiring it to match.
 *
 * @param {number} v
 * @param {number[]} allTicks
 * @param {(n: number, dp: number) => string} [fmt]
 */
export const formatTick = (v, allTicks, fmt = (n, dp) => n.toFixed(dp)) => {
  for (let dp = 0; dp <= 6; dp++) {
    const rendered = allTicks.map(t => fmt(t, dp))
    const distinct = new Set(rendered).size === allTicks.length
    const faithful = allTicks.every((t, i) => Math.abs(Number(rendered[i]) - t) < Math.pow(10, -(dp + 6)))

    if (distinct && faithful) return fmt(v, dp)
  }

  return fmt(v, 6)
}

/**
 * Positions a set of labels along one axis so that they do not overlap, by
 * dropping labels rather than moving them — a moved label points at the wrong
 * place, a dropped one merely says less.
 *
 * @param {number[]} positions pixel positions, ascending
 * @param {number} minGap
 * @returns {boolean[]} keep flags, aligned with positions
 */
export const thinLabels = (positions, minGap) => {
  const keep = positions.map(() => false)
  let last = -Infinity

  positions.forEach((p, i) => {
    if (p - last >= minGap) {
      keep[i] = true
      last = p
    }
  })

  return keep
}
