/*
 * Unit tests for chart-geometry.mjs. Plain Node, no test framework:
 *
 *   node scripts/test-chart-geometry.mjs
 *
 * These exist because the chart components cannot be executed in every
 * environment this project is worked on in, but the arithmetic they depend on
 * can be. Anything that can be wrong numerically lives in the module under test.
 */

import assert from 'node:assert/strict'

import {
  bandScale,
  extent,
  formatTick,
  linePath,
  niceTicks,
  plotArea,
  round,
  scaleLinear,
  subBands,
  thinLabels
} from '../src/lib/chart-geometry.mjs'

let passed = 0
let failed = 0

const test = (name, fn) => {
  try {
    fn()
    passed++
  } catch (e) {
    failed++
    console.error(`  FAIL  ${name}\n        ${e.message}`)
  }
}

// --- scaleLinear ------------------------------------------------------------

test('scaleLinear maps domain endpoints to range endpoints', () => {
  const s = scaleLinear([0, 100], [0, 500])

  assert.equal(s(0), 0)
  assert.equal(s(100), 500)
  assert.equal(s(50), 250)
})

test('scaleLinear handles inverted pixel range (SVG y axis)', () => {
  const s = scaleLinear([0, 1], [400, 0])

  assert.equal(s(0), 400)
  assert.equal(s(1), 0)
  assert.equal(s(0.5), 200)
})

test('scaleLinear widens a zero-width domain instead of dividing by zero', () => {
  const s = scaleLinear([5, 5], [0, 100])

  assert.ok(Number.isFinite(s(5)), 's(5) should be finite')
  assert.equal(s(5), 50, 'a constant series should sit mid-plot')
})

test('scaleLinear widens a zero domain at the origin', () => {
  const s = scaleLinear([0, 0], [0, 100])

  assert.ok(Number.isFinite(s(0)))
  assert.equal(s(0), 50)
})

test('scaleLinear survives non-finite domains', () => {
  const s = scaleLinear([NaN, Infinity], [0, 10])

  assert.ok(Number.isFinite(s(0.5)))
})

// --- niceTicks --------------------------------------------------------------

test('niceTicks produces round values inside the domain', () => {
  const t = niceTicks(0, 100, 5)

  assert.deepEqual(t, [0, 20, 40, 60, 80, 100])
})

test('niceTicks handles fractional domains', () => {
  const t = niceTicks(0, 0.9, 5)

  assert.ok(t.length >= 4 && t.length <= 7, `got ${t.length} ticks: ${t}`)
  assert.equal(t[0], 0)
  assert.ok(t.every(v => v >= 0 && v <= 0.9))
})

test('niceTicks never emits floating-point noise', () => {
  for (const [lo, hi] of [
    [0, 1],
    [0, 0.9],
    [0, 0.3],
    [8.24, 37.89],
    [0, 76.14]
  ]) {
    for (const v of niceTicks(lo, hi, 5)) {
      assert.equal(String(v).length <= 14, true, `tick ${v} for domain ${lo}..${hi} is not clean`)
    }
  }
})

test('niceTicks returns a single tick for a zero-width domain', () => {
  assert.deepEqual(niceTicks(3, 3, 5), [3])
})

test('niceTicks tolerates a reversed domain', () => {
  assert.deepEqual(niceTicks(100, 0, 5), [0, 20, 40, 60, 80, 100])
})

test('niceTicks handles negative domains', () => {
  const t = niceTicks(-10, 10, 4)

  assert.ok(t.includes(0), `expected a zero tick, got ${t}`)
  assert.ok(t.every(v => v >= -10 && v <= 10))
})

test('niceTicks does not run away on tiny domains', () => {
  const t = niceTicks(0, 1e-9, 5)

  assert.ok(t.length <= 1001)
})

// --- extent -----------------------------------------------------------------

test('extent ignores nulls and NaN', () => {
  assert.deepEqual(extent([3, null, 1, undefined, NaN, 9]), [1, 9])
})

test('extent returns null for an all-empty series', () => {
  assert.equal(extent([null, undefined, NaN]), null)
  assert.equal(extent([]), null)
})

test('extent handles a single value', () => {
  assert.deepEqual(extent([42]), [42, 42])
})

// --- plotArea ---------------------------------------------------------------

test('plotArea subtracts margins', () => {
  const a = plotArea(600, 400, { top: 10, right: 20, bottom: 30, left: 40 })

  assert.equal(a.x0, 40)
  assert.equal(a.y0, 10)
  assert.equal(a.x1, 580)
  assert.equal(a.y1, 370)
  assert.equal(a.width, 540)
  assert.equal(a.height, 360)
})

test('plotArea clamps to zero rather than going negative', () => {
  const a = plotArea(10, 10, { top: 20, right: 20, bottom: 20, left: 20 })

  assert.equal(a.width, 0)
  assert.equal(a.height, 0)
})

// --- linePath ---------------------------------------------------------------

test('linePath emits a single move then lines', () => {
  const d = linePath([
    { x: 0, y: 10 },
    { x: 1, y: 20 },
    { x: 2, y: 30 }
  ])

  assert.equal(d, 'M0 10 L1 20 L2 30')
})

test('linePath breaks at nulls instead of interpolating across the gap', () => {
  const d = linePath([
    { x: 0, y: 10 },
    { x: 1, y: null },
    { x: 2, y: 30 }
  ])

  assert.equal(d, 'M0 10 M2 30', 'a gap must start a new subpath, not join across it')
})

test('linePath returns empty string for no drawable points', () => {
  assert.equal(linePath([]), '')
  assert.equal(linePath([{ x: 0, y: null }]), '')
})

test('linePath skips non-finite coordinates', () => {
  const d = linePath([
    { x: 0, y: 1 },
    { x: NaN, y: 2 },
    { x: 2, y: 3 }
  ])

  assert.equal(d, 'M0 1 M2 3')
})

// --- round ------------------------------------------------------------------

test('round trims to 2dp', () => {
  assert.equal(round(1.23456), 1.23)
  assert.equal(round(10), 10)
  assert.equal(round(-1.005), -1)
})

// --- bandScale / subBands ---------------------------------------------------

test('bandScale centres bars evenly across the plot', () => {
  const b = bandScale(4, 0, 400, 0)

  assert.equal(b.band, 100)
  assert.equal(b.center(0), 50)
  assert.equal(b.center(3), 350)
  assert.equal(b.barWidth, 100)
})

test('bandScale applies padding', () => {
  const b = bandScale(2, 0, 200, 0.2)

  assert.equal(b.barWidth, 80)
  assert.equal(b.start(0), 10)
})

test('bandScale handles zero categories', () => {
  const b = bandScale(0, 0, 100, 0.2)

  assert.equal(b.band, 0)
  assert.equal(b.barWidth, 0)
})

test('subBands splits a bar into k equal parts', () => {
  const s = subBands(60, 3)

  assert.equal(s.width, 20)
  assert.equal(s.offset(0), 0)
  assert.equal(s.offset(2), 40)
})

test('subBands handles k = 0', () => {
  assert.equal(subBands(60, 0).width, 0)
})

// --- formatTick -------------------------------------------------------------

test('formatTick uses the fewest decimals that keeps ticks distinct', () => {
  assert.equal(formatTick(0.25, [0, 0.25, 0.5]), '0.25')
  assert.equal(formatTick(20, [0, 20, 40]), '20')
})

test('formatTick disambiguates close ticks', () => {
  const ticks = [0.6, 0.65, 0.7]

  assert.equal(formatTick(0.65, ticks), '0.65')
})

test('formatTick never renders a tick at a value it is not at', () => {
  // Distinctness alone would allow 0.25 -> "0.3" here.
  for (const ticks of [
    [0, 0.25, 0.5],
    [0, 0.15, 0.3],
    [0, 0.05, 0.1],
    [0, 1 / 3, 2 / 3]
  ]) {
    for (const t of ticks) {
      const s = formatTick(t, ticks)

      assert.ok(Math.abs(Number(s) - t) < 5e-4, `tick ${t} rendered as "${s}"`)
    }
  }
})

test('formatTick falls back gracefully on unrepresentable ticks', () => {
  const s = formatTick(1 / 3, [0, 1 / 3, 2 / 3])

  assert.ok(s.startsWith('0.33'), `got "${s}"`)
})

// --- thinLabels -------------------------------------------------------------

test('thinLabels keeps the first and drops those too close', () => {
  const keep = thinLabels([0, 5, 40, 45, 80], 20)

  assert.deepEqual(keep, [true, false, true, false, true])
})

test('thinLabels keeps everything when there is room', () => {
  assert.deepEqual(thinLabels([0, 50, 100], 20), [true, true, true])
})

test('thinLabels handles an empty list', () => {
  assert.deepEqual(thinLabels([], 10), [])
})

// ---------------------------------------------------------------------------

console.log(`chart-geometry: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
