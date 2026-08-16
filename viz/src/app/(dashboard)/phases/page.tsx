// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

// Component Imports
import LinkButton from '@/components/site/LinkButton'
import PageHeader from '@/components/site/PageHeader'
import Caveat from '@/components/site/Caveat'

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
  status: 'complete' | 'pending'
  varies: string
  fixed: string
  answers: string
  note?: string
  /** How much work the phase represents, for the pending ones. */
  runs?: string
}

// Phase names are locked by a table in Chapter One and are never renamed.
const PHASES: Phase[] = [
  {
    id: 'A',
    title: 'Heterogeneity and aggregation strategy',
    rq: 'RQ1',
    status: 'complete',
    varies: 'Partition protocol (five), aggregation strategy (four), dataset (two), seed where budget allowed.',
    fixed:
      '15 clients, full participation, 60 communication rounds, 2 local epochs per round, learning rate 0.01, batch size 64, 20,000 training / 5,000 test subsample. No privacy mechanism of any kind.',
    answers:
      'How far federated training falls behind centralized training as measured heterogeneity rises, and whether any of the four strategies closes that gap.',
    note: 'The baseline every later phase is measured against, so its cost had to be paid first. Every Phase B run names a Phase A run as its comparator.'
  },
  {
    id: 'B',
    title: 'Differential privacy',
    rq: 'RQ2',
    status: 'complete',
    varies: 'Privacy budget ε ∈ {8, 4, 1} across the three Dirichlet partitions and all four strategies, at seed 0.',
    fixed: 'The Phase A training configuration, so that any accuracy change is attributable to the privacy mechanism. Sample-level granularity, δ = 1×10⁻⁵, clipping norm 1.0.',
    answers:
      'What accuracy sample-level differential privacy costs, and what it does to the relationship between heterogeneity and accuracy that Phase A established.',
    note: 'Every run is matched to a Phase A run identical but for the mechanism. Seed 0 throughout, which is why these runs cannot rank the strategies against one another.'
  },
  {
    id: 'C',
    title: 'Secure aggregation',
    rq: 'RQ2',
    status: 'pending',
    runs: '4 runs',
    varies: 'Masking scheme and its parameters, layered on the Phase B configurations.',
    fixed: 'The Phase A training configuration.',
    answers:
      'What secure aggregation adds in communication cost, and whether it composes with differential privacy without further accuracy loss.'
  },
  {
    id: 'D',
    title: 'Privacy granularity and budget scheduling',
    rq: 'RQ3',
    status: 'pending',
    runs: '8 runs',
    varies: 'DP granularity (sample / user / silo level) and time-adaptive budget spending schedules.',
    fixed: 'Total privacy budget, so that schedules are compared at equal ε.',
    answers:
      'Which granularity is viable at cross-silo scale with 15 clients, and whether spending the budget unevenly across rounds beats spending it uniformly.'
  },
  {
    id: 'E',
    title: 'Gradient inversion',
    rq: 'RQ4',
    status: 'pending',
    runs: '14 attack conditions, no training',
    varies: 'Attack objective, model architecture, and the strength of the defence in place.',
    fixed: 'The target batch and the channel under attack — the update the protocol actually exposes.',
    answers: 'Whether training data can be reconstructed from what clients transmit, and whether the pipeline stops it.',
    note: 'A probe directory exists in the repository but has no recorded configuration and unresolved provenance, so no Phase E figures appear on this site.'
  }
]

const Page = () => {
  const phaseA = allRuns.filter(r => r.phase === 'A')
  const phaseB = allRuns.filter(r => r.phase === 'B')

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='Experimental design'
        title='Phases A–E'
        lede='Five phases, each isolating one variable against a fixed baseline. Phase names are fixed by Chapter One. Phases that have not been run are shown with that status rather than omitted.'
      />

      <Caveat severity='info' title='Two phases of five have results'>
        Phase A is complete at {phaseA.length} runs and Phase B at {phaseB.length}, giving {allRuns.length} of the 120
        training runs the design calls for. Phases C, D and E are pending — 4 runs, 8 runs, and 14 attack conditions
        that train nothing. Showing them as pending is deliberate: a reader should be able to see the shape of the
        whole study and how much of it has been executed.
      </Caveat>

      <div className='flex flex-col gap-6'>
        {PHASES.map(p => (
          <Card key={p.id}>
            <CardHeader
              title={
                <div className='flex items-center gap-3 flex-wrap'>
                  <Typography variant='h6'>Phase {p.id}</Typography>
                  <Typography variant='h6' color='text.secondary'>
                    {p.title}
                  </Typography>
                  <Chip size='small' variant='tonal' color='primary' label={p.rq} />
                  <Chip
                    size='small'
                    variant='tonal'
                    color={p.status === 'complete' ? 'success' : 'default'}
                    label={p.status === 'complete' ? 'complete' : 'pending'}
                  />
                  {p.runs && <Chip size='small' variant='tonal' color='secondary' label={p.runs} />}
                </div>
              }
            />
            <CardContent className='flex flex-col gap-4'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div>
                  <Typography variant='subtitle2' color='text.secondary' className='mbe-1'>
                    What varies
                  </Typography>
                  <Typography variant='body2'>{p.varies}</Typography>
                </div>
                <div>
                  <Typography variant='subtitle2' color='text.secondary' className='mbe-1'>
                    What is held fixed
                  </Typography>
                  <Typography variant='body2'>{p.fixed}</Typography>
                </div>
                <div>
                  <Typography variant='subtitle2' color='text.secondary' className='mbe-1'>
                    What it answers
                  </Typography>
                  <Typography variant='body2'>{p.answers}</Typography>
                </div>
              </div>

              {p.note && (
                <>
                  <Divider />
                  <Typography variant='body2' color='text.secondary'>
                    {p.note}
                  </Typography>
                </>
              )}

              {p.status === 'complete' && (
                <div className='flex gap-2 flex-wrap'>
                  <LinkButton href={p.id === 'B' ? '/privacy' : '/rq1'} size='small' variant='tonal'>
                    {p.id === 'B' ? 'The cost of privacy' : 'Headline result'}
                  </LinkButton>
                  <LinkButton href='/runs' size='small' variant='tonal' color='secondary'>
                    Browse the runs
                  </LinkButton>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default Page
