/*
 * Site navigation and the reading journey.
 *
 * One list drives the sidebar, the previous/next links at the foot of every
 * page and the "you are here" rail beside the results. Adding a page is a
 * one-line change here.
 */

export type NavItem = {
  href: string
  label: string
  /** Tabler icon class, rendered monochrome. */
  icon: string
  /** Research question the page answers, if any. */
  rq?: 'RQ1' | 'RQ2' | 'RQ3'
  /** One sentence for the "next" card: what the reader will find there. */
  summary: string
}

export type NavGroup = {
  label: string | null
  /** True for the five results pages, which are read in order. */
  journey?: boolean
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: '/',
        label: 'Overview',
        icon: 'tabler-home',
        summary: 'What the study asks, how it is built and where each answer lives.'
      }
    ]
  },
  {
    label: 'Results',
    journey: true,
    items: [
      {
        href: '/rq1',
        label: 'Heterogeneity',
        icon: 'tabler-chart-dots',
        rq: 'RQ1',
        summary: 'Federated against centralized training as measured heterogeneity rises, for four strategies.'
      },
      {
        href: '/privacy',
        label: 'Cost of privacy',
        icon: 'tabler-lock',
        rq: 'RQ2',
        summary: 'What sample-level differential privacy costs, and how the noise flattens the heterogeneity effect.'
      },
      {
        href: '/secagg',
        label: 'Secure aggregation',
        icon: 'tabler-shield-check',
        rq: 'RQ2',
        summary: 'Masking measured against unmasked pairs: free in accuracy and bandwidth, paid for in computation.'
      },
      {
        href: '/granularity',
        label: 'What privacy protects',
        icon: 'tabler-building-bank',
        rq: 'RQ2',
        summary: 'Protecting one institution rather than one record, and whether spending the budget unevenly helps.'
      },
      {
        href: '/attack',
        label: 'Gradient inversion',
        icon: 'tabler-shield-lock',
        rq: 'RQ3',
        summary: 'What an honest-but-curious server recovers from an update, with and without each defence.'
      }
    ]
  },
  {
    label: 'Explore',
    items: [
      {
        href: '/runs',
        label: 'Run explorer',
        icon: 'tabler-table',
        summary: 'Filter and compare every recorded run, then open any one for its full record.'
      },
      {
        href: '/phases',
        label: 'Phases A–E',
        icon: 'tabler-list-check',
        summary: 'What each of the five phases varies, holds fixed and answers.'
      },
      {
        href: '/downloads',
        label: 'Data and records',
        icon: 'tabler-download',
        summary: 'Every recorded file, per run or as one archive.'
      }
    ]
  },
  {
    label: 'Background',
    items: [
      {
        href: '/concepts',
        label: 'Concepts',
        icon: 'tabler-bulb',
        summary: 'Short explainers for the ideas the results depend on, each linked to its evidence.'
      },
      {
        href: '/methodology',
        label: 'Methodology',
        icon: 'tabler-flask',
        summary: 'The experimental design, the architecture and the threat model.'
      },
      {
        href: '/limitations',
        label: 'Limitations',
        icon: 'tabler-alert-triangle',
        summary: 'What the study cannot conclude, stated in full.'
      }
    ]
  }
]

/** Reading order for previous/next links. */
export const READING_ORDER: NavItem[] = NAV.flatMap(g => g.items)

export const JOURNEY: NavItem[] = NAV.find(g => g.journey)?.items ?? []

/** Strip basePath-free trailing slashes so '/rq1/' and '/rq1' compare equal. */
export const normalisePath = (p: string | null) => {
  if (!p) return '/'
  const trimmed = p.replace(/\/+$/, '')

  return trimmed === '' ? '/' : trimmed
}

/** The nav item a path belongs to; run pages belong to the run explorer. */
export const itemForPath = (path: string | null): NavItem | null => {
  const p = normalisePath(path)

  if (p.startsWith('/runs/')) return READING_ORDER.find(i => i.href === '/runs') ?? null

  return READING_ORDER.find(i => i.href === p) ?? null
}
