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
import StatCard from '@/components/site/StatCard'
import Caveat from '@/components/site/Caveat'

// Lib Imports
import { allRuns, bundle, centralizedRuns, federatedRuns, seedGroups } from '@/lib/results'

export const metadata = {
  title: 'Federated Learning with Non-IID Data — results explorer',
  description:
    'Results explorer supplementing an MSc dissertation on privacy-preserving federated learning under non-IID data.'
}

const RQS = [
  {
    id: 'RQ1',
    phase: 'A',
    q: 'How does federated learning compare with centralized training as data heterogeneity increases, across four aggregation strategies?'
  },
  {
    id: 'RQ2',
    phase: 'B, C',
    q: 'What accuracy and communication cost do differential privacy and secure aggregation add, and how do those costs interact with heterogeneity?'
  },
  {
    id: 'RQ3',
    phase: 'D',
    q: 'Which differential-privacy granularity is viable at cross-silo scale, and does time-adaptive budget spending help?'
  },
  {
    id: 'RQ4',
    phase: 'E',
    q: 'Can gradient inversion recover training data, and does the pipeline stop it?'
  }
]

const Page = () => {
  const groups = seedGroups(federatedRuns)
  const multiSeed = groups.filter(g => !g.singleSeed).length
  const singleSeed = groups.filter(g => g.singleSeed).length

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='MSc Computer Science · University of Abuja'
        title='Federated Learning for Privacy-Preserving AI Models'
        lede='A study on secure, decentralized model training with non-IID data. This site is a browsable supplement to the dissertation: every figure and table an examiner needs is in the dissertation document itself, and nothing here is required to read it.'
      />

      <Caveat severity='info' title='What this site is'>
        A supplement, not a dependency. The dissertation stands alone. This explorer exists so that the recorded runs
        can be inspected directly rather than only through the figures selected for the written document.
      </Caveat>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mbe-6'>
        <StatCard label='Runs recorded' value={String(allRuns.length)} hint='Phase A, superseded runs excluded' />
        <StatCard
          label='Federated / centralized'
          value={`${federatedRuns.length} / ${centralizedRuns.length}`}
          hint='15 institutional clients, full participation'
        />
        <StatCard
          label='Configurations at 3 seeds'
          value={`${multiSeed} of ${multiSeed + singleSeed}`}
          hint={`${singleSeed} run at a single seed`}
        />
        <StatCard label='Datasets' value='2' hint='CIFAR-10 and PathMNIST' />
      </div>

      <Card className='mbe-6'>
        <CardHeader title='The four research questions' />
        <CardContent className='flex flex-col gap-4'>
          {RQS.map(rq => (
            <div key={rq.id} className='flex gap-4 items-start'>
              <Chip size='small' variant='tonal' color='primary' label={rq.id} className='mbs-1' />
              <div className='flex flex-col gap-1'>
                <Typography>{rq.q}</Typography>
                <Typography variant='caption' color='text.secondary'>
                  Phase {rq.phase}
                </Typography>
              </div>
            </div>
          ))}
        </CardContent>
        <Divider />
        <CardContent>
          <Typography variant='body2' color='text.secondary'>
            Only Phase A has been run. Phases B–E are pending, and are shown on this site with that status rather than
            hidden.
          </Typography>
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mbe-6'>
        <Card>
          <CardHeader title='What the study measures' />
          <CardContent className='flex flex-col gap-3'>
            <Typography>
              A cross-silo federated learning simulation across 15 institutional clients with full participation,
              comparing four aggregation strategies — <strong>FedAvg</strong>, <strong>FedProx</strong>,{' '}
              <strong>SCAFFOLD</strong> and <strong>MOON</strong> — against a centralized baseline as data
              heterogeneity increases.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              FedAvgM appears alongside them as a <em>configuration of FedAvg</em> with server momentum, not as a fifth
              strategy. Its recorded configuration confirms this: it carries{' '}
              <code>strategy: &quot;fedavg&quot;</code> and differs only by <code>server_momentum</code> and{' '}
              <code>server_lr</code>.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title='How heterogeneity is reported' />
          <CardContent className='flex flex-col gap-3'>
            <Typography>
              Five partition protocols generate the client splits: Dirichlet α ∈ {'{'}100, 1.0, 0.1{'}'}, a pathological
              one-class-per-client split, and quantity skew at β = 0.5.
            </Typography>
            <Typography>
              Heterogeneity is then reported as <strong>measured Hellinger distance</strong>, never as the protocol
              parameter alone. α is what was asked for; Hellinger is what was obtained, and the two do not map onto each
              other cleanly.
            </Typography>
            <LinkButton href='/rq1' variant='tonal' size='small' className='self-start'>
              See the headline result
            </LinkButton>
          </CardContent>
        </Card>
      </div>

      <Card className='mbe-6'>
        <CardHeader
          title='Implementation'
          subheader='Three things that are commonly assumed about work like this, and are not true here'
        />
        <CardContent className='flex flex-col gap-3'>
          <Typography>
            <strong>No federated-learning framework is used.</strong> The round loop, the four strategies, the
            partitioning, the differential-privacy path and the masking are all implemented directly. Flower was
            evaluated and dropped because it ships FedAvg and FedProx but neither SCAFFOLD nor MOON.
          </Typography>
          <Typography>
            <strong>Communication cost is analytic, not measured.</strong> Nothing is transmitted — this is a
            single-process simulation. Byte counts are computed from parameter counts and client counts, and should be
            read as a protocol quantity rather than as network traffic.
          </Typography>
          <Typography>
            <strong>Wall-clock timings are not a measurement.</strong> Identical configurations differ by up to 17.9×
            because system sleep is counted as compute. Timings are recorded on this site but never plotted as if they
            meant something.
          </Typography>
        </CardContent>
      </Card>

      <Typography variant='caption' color='text.secondary'>
        Results bundle built from {bundle.runCount} run directories, {bundle.excluded.length} excluded as superseded or
        non-Phase-A. Dataset <code>{bundle.dataHash}</code> — a content hash of the recorded results, so the same
        figures always carry the same identifier.
      </Typography>
    </div>
  )
}

export default Page
