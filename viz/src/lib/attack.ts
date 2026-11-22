/*
 * Phase E — typed access to the attack conditions.
 *
 * Selections and groupings of recorded values only. The PSNR figures, floors
 * and calibrations are copied from each condition's result.json by
 * build-data.mjs; nothing here recomputes them.
 */

import { bundle } from '@/lib/results'
import { downloads } from '@/lib/downloads'

import type { AttackCondition, AttackDefence, AttackObject } from '@/types/results'
import { asset } from '@/utils/asset'

export const attack = bundle.attack

export const attackConditions: AttackCondition[] = attack?.conditions ?? []

/** Images and records live under the published runs/ tree, like every other file. */
export const attackFileUrl = (path: string) => asset(`/data/runs/${path}`)

export const DEFENCE_ORDER: AttackDefence[] = ['none', 'dp8', 'dp4', 'dp1', 'sa', 'sadp8']
export const OBJECT_ORDER: AttackObject[] = ['grad', 'delta']

export const conditionOf = (arch: 'lenet' | 'smallcnn', defence: AttackDefence, object: AttackObject) =>
  attackConditions.find(c => c.arch === arch && c.defence === defence && c.object === object) ?? null

/** LeNet rows in defence order, one cell per attack object. */
export const lenetMatrix = () =>
  DEFENCE_ORDER.map(d => ({
    defence: d,
    label: conditionOf('lenet', d, 'grad')?.defenceLabel ?? d,
    grad: conditionOf('lenet', d, 'grad'),
    delta: conditionOf('lenet', d, 'delta')
  }))

export const smallcnnRow = () => ({
  grad: conditionOf('smallcnn', 'none', 'grad'),
  delta: conditionOf('smallcnn', 'none', 'delta')
})

/** The strongest reconstruction among conditions with any defence in place. */
export const bestDefended = () =>
  attackConditions
    .filter(c => c.defence !== 'none')
    .reduce<AttackCondition | null>((best, c) => (best === null || c.psnrMean > best.psnrMean ? c : best), null)

export const attackFilesFor = (id: string) => downloads.attack?.[id] ?? []

export const db = (v: number | null | undefined, dp = 2) => (v === null || v === undefined ? '—' : `${v.toFixed(dp)} dB`)
