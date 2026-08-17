// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'
import LinkButton from '@/components/site/LinkButton'
import PageHeader from '@/components/site/PageHeader'
import PhaseProgress from '@/components/site/PhaseProgress'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { PhaseProgressItem } from '@/components/site/PhaseProgress'

// Lib Imports
import { allRuns } from '@/lib/results'

export const metadata = {
  title: 'Phases A–E — FL with non-IID data',
  description: 'The five experimental phases, what each varies and holds fixed, and the status of each.'
}

type Phase = {
  id: string
  title: string
  rq: string
  icon: string
  color: ThemeColor
  /** Runs the design calls for. Phase E trains nothing. */
  planned: number
  noTraining?: boolean
  varies: string
  fixed: string
  answers: string
  note?: string
  href?: string
  hrefLabel?: string
}

// Phase names are locked by a table in Chapter One and are never renamed.
const PHASES: Phase[] = [
  {
    id: 'A',
    title: 'Heterogeneity and aggregation strategy',
    rq: 'RQ1',
    icon: 'tabler-chart-dots',
    color: 'primary',
    planned: 72,
    varies: 'Partition protocol (five), aggregation strategy (four), dataset (two), seed where budget allowed.',
    fixed:
      '15 clients, full participation, 60 communication rounds, 2 local epochs per round, learning rate 0.01, batch size 64, 20,000 training / 5,000 test subsample. No privacy mechanism of any kind.',
    answers:
      'How far federated training falls behind centralized training as measured heterogeneity rises, and whether any of the four strategies closes that gap.',
    note: 'The baseline every later phase is measured against, so its cost had to be paid first. Every Phase B run names a Phase A run as its comparator.',
    href: '/rq1',
    hrefLabel: 'See the heterogeneity results'
  },
  {
    id: 'B',
    title: 'Differential privacy',
    rq: 'RQ2',
    icon: 'tabler-lock',
    color: 'success',
    planned: 36,
    varies: 'Privacy budget ε ∈ {8, 4, 1} across the three Dirichlet partitions and all four strategies, at seed 0.',
    fixed:
      'The Phase A training configuration, so that any accuracy change is attributable to the privacy mechanism. Sample-level granularity, δ = 1×10⁻⁵, clipping norm 1.0.',
    answers:
      'What accuracy sample-level differential privacy costs, and what it does to the relationship between heterogeneity and accuracy that Phase A established.',
    note: 'Every run is matched to a Phase A run identical but for the mechanism. Seed 0 throughout, which is why these runs cannot rank the strategies against one another.',
    href: '/privacy',
    hrefLabel: 'See the cost of privacy'
  },
  {
    id: 'C',
    title: 'Secure aggregation',
    rq: 'RQ2',
    icon: 'tabler-shield-check',
    color: 'info',
    planned: 4,
    varies: 'Masking scheme and its parameters, against a plain control at the same configuration.',
    fixed: 'The Phase A training configuration.',
    answers:
      'What secure aggregation adds in communication cost, and whether it composes with differential privacy without further accuracy loss.',
    note: 'Runs record masking and aggregation time per round alongside the usual metrics, so the overhead is measured rather than assumed.'
  },
  {
    id: 'D',
    title: 'Privacy granularity and budget scheduling',
    rq: 'RQ3',
    icon: 'tabler-adjustments',
    color: 'warning',
    planned: 8,
    varies: 'DP granularity (sample / user / silo level) and time-adaptive budget spending schedules.',
    fixed: 'Total privacy budget, so that schedules are compared at equal ε.',
    answers:
      'Which granularity is viable at cross-silo scale with 15 clients, and whether spending the budget unevenly across rounds beats spending it uniformly.'
  },
  {
    id: 'E',
    title: 'Gradient inversion',
    rq: 'RQ4',
    icon: 'tabler-shield-lock',
    color: 'error',
    planned: 14,
    noTraining: true,
    varies: 'Attack objective, model architecture, and the strength of the defence in place.',
    fixed: 'The target batch and the channel under attack — the update the protocol actually exposes.',
    answers: 'Whether training data can be reconstructed from what clients transmit, and whether the pipeline stops it.',
    note: 'A probe directory exists in the repository but has no recorded configuration and unresolved provenance, so no Phase E figures appear on this site.'
  }
]

const FACETS = [
  { key: 'varies' as const, label: 'What varies', icon: 'tabler-arrows-shuffle' },
  { key: 'fixed' as const, label: 'What is held fixed', icon: 'tabler-lock-square' },
  { key: 'answers' as const, label: 'What it answers', icon: 'tabler-help-circle' }
]

const Page = () => {
  // Counts come from the recorded runs, never from a literal — a phase cannot
  // claim progress the data does not show.
  const recorded = (id: string) => allRuns.filter(r => r.phase === id).length

  const statusOf = (p: Phase): PhaseProgressItem['status'] => {
    const done = recorded(p.id)

    if (done >= p.planned) return 'complete'

    return done > 0 ? 'running' : 'pending'
  }

  const progress: PhaseProgressItem[] = PHASES.map(p => ({
    id: p.id,
    title: p.title,
    status: statusOf(p),
    done: recorded(p.id),
    planned: p.planned,
    noTraining: p.noTraining
  }))

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='Experimental design'
        title='Phases A–E'
        lede='Five phases, each isolating one variable against a fixed baseline. Phases that have not been run are shown with that status rather than omitted, so the shape of the whole study is visible alongside how much of it has been executed.'
      />

      <div className='mbe-6'>
        <PhaseProgress phases={progress} />
      </div>

      <div className='flex flex-col gap-6'>
        {PHASES.map(p => {
          const status = statusOf(p)
          const done = recorded(p.id)

          return (
            <Card key={p.id}>
              <CardContent className='flex flex-col gap-5'>
                <div className='flex items-start gap-4 flex-wrap'>
                  <CustomAvatar color={p.color} skin='light' variant='rounded' size={48}>
                    <i className={`${p.icon} text-[28px]`} />
                  </CustomAvatar>
                  <div className='flex flex-col gap-1 flex-1 min-is-[240px]'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <Typography variant='h6'>
                        Phase {p.id} — {p.title}
                      </Typography>
                      <Chip size='small' variant='tonal' color={p.color} label={p.rq} />
                    </div>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <Chip
                        size='small'
                        variant='tonal'
                        color={status === 'complete' ? 'success' : status === 'running' ? 'info' : 'secondary'}
                        label={
                          status === 'complete'
                            ? `complete · ${done} runs`
                            : status === 'running'
                              ? `in progress · ${done} of ${p.planned}`
                              : p.noTraining
                                ? `pending · ${p.planned} attack conditions`
                                : `pending · ${p.planned} runs`
                        }
                      />
                      {p.noTraining && <Chip size='small' variant='tonal' label='trains nothing' />}
                    </div>
                  </div>
                  {p.href && (
                    <LinkButton href={p.href} size='small' variant='tonal' color={p.color}>
                      {p.hrefLabel}
                    </LinkButton>
                  )}
                </div>

                <Divider />

                <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                  {FACETS.map(f => (
                    <div key={f.key} className='flex flex-col gap-2'>
                      <div className='flex items-center gap-2'>
                        <i className={`${f.icon} text-[18px] text-textSecondary`} />
                        <Typography variant='subtitle2' color='text.secondary'>
                          {f.label}
                        </Typography>
                      </div>
                      <Typography variant='body2'>{p[f.key]}</Typography>
                    </div>
                  ))}
                </div>

                {p.note && (
                  <div className='flex gap-2 items-start p-4 rounded bg-actionHover'>
                    <i className='tabler-info-circle text-[18px] text-textSecondary mbs-[2px]' />
                    <Typography variant='body2' color='text.secondary'>
                      {p.note}
                    </Typography>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default Page
