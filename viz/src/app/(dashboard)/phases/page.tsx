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
import { allRuns, centralizedRuns, federatedRuns } from '@/lib/results'

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
    note: 'This is the only phase with recorded results. It is also the baseline that every later phase is measured against, so its cost had to be paid first.'
  },
  {
    id: 'B',
    title: 'Differential privacy',
    rq: 'RQ2',
    status: 'pending',
    varies: 'Privacy budget ε, clipping norm, noise multiplier — against the Phase A heterogeneity ladder.',
    fixed: 'The Phase A training configuration, so that any accuracy change is attributable to the privacy mechanism.',
    answers: 'What accuracy differential privacy costs, and whether that cost grows with heterogeneity.'
  },
  {
    id: 'C',
    title: 'Secure aggregation',
    rq: 'RQ2',
    status: 'pending',
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
    varies: 'Attack objective, model architecture, and the strength of the defence in place.',
    fixed: 'The target batch and the channel under attack — the update the protocol actually exposes.',
    answers: 'Whether training data can be reconstructed from what clients transmit, and whether the pipeline stops it.',
    note: 'A probe directory exists in the repository but has no recorded configuration and unresolved provenance, so no Phase E figures appear on this site.'
  }
]

const Page = () => {
  const phaseA = allRuns.filter(r => r.phase === 'A')

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='Experimental design'
        title='Phases A–E'
        lede='Five phases, each isolating one variable against a fixed baseline. Phase names are fixed by Chapter One. Phases that have not been run are shown with that status rather than omitted.'
      />

      <Caveat severity='info' title='One phase of five has results'>
        Phase A is complete at {phaseA.length} runs ({federatedRuns.length} federated, {centralizedRuns.length}{' '}
        centralized). Phases B–E are pending. Showing them as pending is
        deliberate: a reader should be able to see the shape of the whole study and how much of it has been executed.
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
                <div className='flex gap-2'>
                  <LinkButton href='/rq1' size='small' variant='tonal'>
                    Headline result
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
