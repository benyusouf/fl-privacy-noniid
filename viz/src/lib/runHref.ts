/*
 * URLs for per-run pages.
 *
 * Run names contain dots — dir0.1, dir1.0 — and a dot inside a route segment is
 * the kind of thing that works locally and then behaves differently on a static
 * host, where segments can be read as file extensions. Rather than find out
 * after deployment, the dot is replaced for the URL only.
 *
 * The mapping must stay reversible, so the module refuses to load if two run
 * names ever collapse to the same slug. That check runs at module load, which
 * means during the build — a collision fails the build rather than producing two
 * pages that overwrite each other.
 */

import { allRuns } from '@/lib/results'

export const runSlug = (name: string) => name.replace(/\./g, '-')

const bySlug = new Map<string, string>()

for (const run of allRuns) {
  const slug = runSlug(run.name)
  const existing = bySlug.get(slug)

  if (existing && existing !== run.name) {
    throw new Error(
      `Run slug collision: "${existing}" and "${run.name}" both map to "${slug}". ` +
        'Change runSlug() so the mapping stays one-to-one.'
    )
  }

  bySlug.set(slug, run.name)
}

export const runNameFromSlug = (slug: string) => bySlug.get(slug) ?? null

export const runHref = (name: string) => `/runs/${runSlug(name)}`

export const allRunSlugs = () => [...bySlug.keys()]
