/*
 * Chart colours.
 *
 * Recharts has no theme integration, so series colours are assigned here and
 * fed in explicitly. Strategy colours are fixed across every chart on the site
 * so that a reader who learns "SCAFFOLD is orange" on one page keeps that
 * mapping on the next.
 */

import type { Strategy } from '@/types/results'

export const STRATEGY_COLOURS: Record<Strategy, string> = {
  fedavg: '#666CFF', // Vuexy primary
  fedprox: '#26C6F9', // info
  scaffold: '#FDB528', // warning — the strategy that misbehaves, given the warning hue
  moon: '#72E128' // success
}

export const FEDAVGM_COLOUR = '#9155FD'
export const CENTRALIZED_COLOUR = '#8592A3'
export const CHANCE_COLOUR = '#FF4D49'

export const colourFor = (strategy: Strategy | null, isFedAvgM = false) => {
  if (isFedAvgM) return FEDAVGM_COLOUR
  if (strategy === null) return CENTRALIZED_COLOUR

  return STRATEGY_COLOURS[strategy] ?? CENTRALIZED_COLOUR
}

/** Distinct colours for arbitrary multi-run comparison, where strategy is not the axis. */
export const SERIES_COLOURS = [
  '#666CFF',
  '#26C6F9',
  '#FDB528',
  '#72E128',
  '#9155FD',
  '#FF4D49',
  '#8592A3',
  '#00CFE8'
]
