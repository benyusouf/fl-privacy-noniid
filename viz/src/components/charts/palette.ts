/*
 * Chart colours.
 *
 * Every colour is a CSS variable defined in app/site.css, with a light and a
 * dark step for each, so charts follow the theme without re-rendering. The
 * values were validated with the dataviz skill's palette checker against the
 * site's own surfaces (#FFFFFF light, #0F0F0F dark).
 *
 * Strategy colours are fixed across every chart on the site, so a reader who
 * learns "SCAFFOLD is aqua" on one page keeps that mapping on the next. The
 * slot order (blue, orange, aqua, yellow) is the validated adjacent order. With
 * four strategies on one scatter, the all-pairs check cannot be met by hue
 * alone, so the scatter also gives each strategy its own marker shape.
 */

import type { Strategy } from '@/types/results'

export const STRATEGY_COLOURS: Record<Strategy, string> = {
  fedavg: 'var(--viz-1)',
  fedprox: 'var(--viz-2)',
  scaffold: 'var(--viz-3)',
  moon: 'var(--viz-4)'
}

/** Secondary encoding for the strategies, so identity never rests on hue. */
export const STRATEGY_MARKERS: Record<Strategy, 'circle' | 'square' | 'triangle' | 'diamond'> = {
  fedavg: 'circle',
  fedprox: 'square',
  scaffold: 'triangle',
  moon: 'diamond'
}

export const FEDAVGM_COLOUR = 'var(--viz-5)'
export const CENTRALIZED_COLOUR = 'var(--viz-ink-2)'

/** Chance is a status line, not a series: it uses the reserved critical colour. */
export const CHANCE_COLOUR = 'var(--viz-critical)'

/** Text on charts uses text tokens, never a series colour. */
export const CHART_TEXT = 'var(--viz-text)'

export const colourFor = (strategy: Strategy | null, isFedAvgM = false) => {
  if (isFedAvgM) return FEDAVGM_COLOUR
  if (strategy === null) return CENTRALIZED_COLOUR

  return STRATEGY_COLOURS[strategy] ?? CENTRALIZED_COLOUR
}

/*
 * Privacy conditions.
 *
 * Epsilon is ordered, so the three protected conditions are one blue ramp that
 * darkens as the budget tightens. The unprotected baseline is drawn in ink: it
 * is a different kind of thing, not the fourth step of the same scale.
 */
export const UNPROTECTED_COLOUR = 'var(--viz-ink)'
export const EPSILON_COLOURS: Record<number, string> = {
  8: 'var(--viz-eps8)',
  4: 'var(--viz-eps4)',
  1: 'var(--viz-eps1)'
}

export const conditionColour = (epsilon: number | null) =>
  epsilon === null ? UNPROTECTED_COLOUR : (EPSILON_COLOURS[epsilon] ?? CENTRALIZED_COLOUR)

/** Categorical slots in fixed order, for multi-run comparison where strategy is not the axis. */
export const SERIES_COLOURS = [
  'var(--viz-1)',
  'var(--viz-2)',
  'var(--viz-3)',
  'var(--viz-4)',
  'var(--viz-5)',
  'var(--viz-6)',
  'var(--viz-7)',
  'var(--viz-8)'
]

/** Two-measure client charts: samples held, and the per-client quantity beside it. */
export const SIZE_COLOUR = 'var(--viz-1)'
export const SECOND_MEASURE_COLOUR = 'var(--viz-2)'
