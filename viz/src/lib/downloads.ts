/*
 * Access to the published raw files.
 *
 * Every figure the site shows comes from a file it also serves. These helpers
 * build the URLs for those files.
 *
 * Paths go through asset() because the site deploys under a basePath on GitHub
 * Pages: a hand-built "/data/..." URL works in development and 404s in
 * production, which is the worst way for this to fail.
 */

import downloadsJson from '@/data/generated/downloads.json'

import type { Downloads } from '@/types/results'
import { asset } from '@/utils/asset'

export const downloads = downloadsJson as unknown as Downloads

export const filesFor = (runName: string) => downloads.runs[runName] ?? []

export const fileUrl = (runName: string, file: string) => asset(`/data/runs/${runName}/${file}`)

export const archiveUrl = () => asset(`/data/${downloads.archive.path}`)

/**
 * A reconstructed record and a captured transcript are different things and must
 * never be presented as the same. The provenance file says so in its own header;
 * these labels keep the site consistent with it.
 */
export const recordLabel = (file: string) =>
  file === 'provenance.txt' ? 'Reconstructed record' : file === 'run.log' ? 'Run transcript' : null
