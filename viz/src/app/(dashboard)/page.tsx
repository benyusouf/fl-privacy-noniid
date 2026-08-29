// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

// Component Imports
import LinkButton from '@/components/site/LinkButton'
import PageHeader from '@/components/site/PageHeader'
import StatCard from '@/components/site/StatCard'
import CustomAvatar from '@core/components/mui/Avatar'

// Lib Imports
import { allRuns, bundle, centralizedRuns, countedRuns, federatedRuns, protectedRuns, seedGroups } from '@/lib/results'
import { archiveUrl, downloads } from '@/lib/downloads'

// Config Imports
import author from '@configs/author'

export const metadata = {
  title: 'Federated Learning with Non-IID Data — results explorer',
  description:
    'Results, charts and downloadable data from Abdullahi Yusuf\u2019s MSc research into privacy-preserving federated learning with non-IID data.'
}

/*
 * The three research questions, verbatim from §1.7 of the dissertation.
 *
 * Dr Omolara's review of 20 August 2026 reduced six objectives and four
 * questions to three and three (D90). The old second and third questions were
 * both budget questions differing only in axis — the protected unit against the
 * rounds — so they merged into RQ2, and the old fourth question became RQ3.
 * There is no fourth research question in the study any more.
 *
 * `short` is the Table 1.2 phrasing, used where the full text is too long to
 * sit in a card. Neither string is paraphrased.
 */
const RQS = [
  {
    id: 'RQ1',
    objective: 'Objective 1',
    phase: 'Phase A',
    status: 'answered',
    icon: 'tabler-chart-dots',
    color: 'primary' as const,
    q: 'How does federated learning compare with centralized training as non-IID severity increases, across the four aggregation strategies?',
    short:
      'Federated learning compared with centralized training under increasing non-IID severity, across four aggregation strategies',
    links: [{ href: '/rq1', label: 'See the answer' }]
  },
  {
    id: 'RQ2',
    objective: 'Objective 2',
    phase: 'Phases B, C and D',
    status: 'answered',
    icon: 'tabler-lock',
    color: 'success' as const,
    q: 'What do differential privacy and secure aggregation cost a cross-silo federation in accuracy, communication and computation as heterogeneity varies, and how should the privacy budget be allocated, across the protected unit and across rounds, for differential privacy to remain viable at this scale?',
    short:
      'Accuracy, communication and computation cost of differential privacy and secure aggregation, read against measured heterogeneity; the granularity of the protected unit; the time-adaptive spending schedule',
    links: [
      { href: '/privacy', label: 'What privacy costs' },
      { href: '/secagg', label: 'Secure aggregation' },
      { href: '/granularity', label: 'What it protects' }
    ]
  },
  {
    id: 'RQ3',
    objective: 'Objective 3',
    phase: 'Phase E',
    status: 'pending',
    icon: 'tabler-shield-lock',
    color: 'error' as const,
    q: 'Can a gradient-inversion attack recover training data from unprotected model updates, and do the integrated privacy mechanisms mitigate or prevent the attack?',
    short:
      'Gradient-inversion attack on unprotected updates, and whether the integrated mechanisms mitigate or prevent it',
    links: [{ href: '/phases', label: 'See what it will involve' }]
  }
]

/*
 * What the site offers, stated plainly.
 *
 * Kept factual about the records: reconstructed records exist for every run,
 * transcripts do not exist yet. Promising "logs" without that distinction would
 * be the one thing on this page that is not true.
 */
const CAPABILITIES = [
  {
    icon: 'tabler-chart-dots',
    color: 'primary' as const,
    title: 'See how heterogeneity affects accuracy',
    body: 'Accuracy against measured Hellinger distance for four aggregation strategies, against a centralized baseline.',
    href: '/rq1',
    action: 'Open the heterogeneity results'
  },
  {
    icon: 'tabler-lock',
    color: 'success' as const,
    title: 'See what differential privacy costs',
    body: 'The accuracy cost at each privacy budget, how it changes the heterogeneity relationship, and which clients carry the noise.',
    href: '/privacy',
    action: 'Open the privacy results'
  },
  {
    icon: 'tabler-shield-check',
    color: 'info' as const,
    title: 'See what secure aggregation costs',
    body: 'Masking measured against unmasked pairs — free in accuracy and bandwidth, paid for in computation — and why masking the update alone leaves SCAFFOLD exposed.',
    href: '/secagg',
    action: 'Open the secure aggregation results'
  },
  {
    icon: 'tabler-building-bank',
    color: 'warning' as const,
    title: 'See what the guarantee protects',
    body: 'Protecting one institution rather than one record, and whether spending the privacy budget unevenly helps. The strongest negative result in the study.',
    href: '/granularity',
    action: 'Open the granularity results'
  },
  {
    icon: 'tabler-table',
    color: 'secondary' as const,
    title: 'Explore every run',
    body: 'Filter and compare all recorded runs, then open any one of them for its full record: curves, partition, configuration and files.',
    href: '/runs',
    action: 'Open the run explorer'
  },
  {
    icon: 'tabler-download',
    color: 'warning' as const,
    title: 'Download the results',
    body: 'Raw metrics, configurations, partition reports, privacy calibration, timings and per-run records — individually or as one archive.',
    href: '/downloads',
    action: 'Open data and records'
  },
  {
    icon: 'tabler-table-export',
    color: 'info' as const,
    title: 'Take the data behind any chart',
    body: 'Every chart and table has a download giving the exact rows it was drawn from, with the runs they came from named in the file.',
    href: '/rq1',
    action: 'See an example'
  },
  {
    icon: 'tabler-flask',
    color: 'error' as const,
    title: 'Read how it was done',
    body: 'The experimental design and threat model, explanations of the concepts involved, and a full account of what the study cannot conclude.',
    href: '/methodology',
    action: 'Open the methodology'
  }
]

const Page = () => {
  // Baseline arm only. Later phases reuse the Phase A grid at a single seed by
  // design, so including them would report that decision as missing coverage.
  const groups = seedGroups(federatedRuns.filter(r => r.dp === null && r.arm === null))
  const multiSeed = groups.filter(g => !g.singleSeed).length
  const singleSeed = groups.filter(g => g.singleSeed).length

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow={`${author.name} · ${author.role} · ${author.affiliation}`}
        title='Federated Learning for Privacy-Preserving AI Models'
        lede='The complete record of this research on secure, decentralized model training with non-IID data. Every experiment, every result, every chart and every file the study produced is here, and all of it can be read on the page or taken away as data.'
      />

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mbe-6'>
        <StatCard
          label='Runs recorded'
          value={String(allRuns.length)}
          hint={`${countedRuns.length} counted; ${allRuns.length - countedRuns.length} diagnostic`}
          icon='tabler-database'
          color='primary'
        />
        <StatCard
          label='Federated / centralized'
          value={`${federatedRuns.length} / ${centralizedRuns.length}`}
          hint='15 institutional clients, full participation'
          icon='tabler-topology-star-3'
          color='info'
        />
        <StatCard
          label='Under differential privacy'
          value={String(protectedRuns.length)}
          hint='sample-level, client-level and time-adaptive'
          icon='tabler-lock'
          color='success'
        />
        <StatCard
          label='Repeated at three seeds'
          value={`${multiSeed} of ${multiSeed + singleSeed}`}
          hint='of the unprotected configurations'
          icon='tabler-repeat'
          color='warning'
        />
      </div>

      <Card className='mbe-6'>
        <CardHeader title='What you can do here' />
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5'>
            {CAPABILITIES.map(c => (
              <div key={c.title} className='flex gap-4 items-start'>
                <CustomAvatar color={c.color} skin='light' variant='rounded' size={40}>
                  <i className={`${c.icon} text-[22px]`} />
                </CustomAvatar>
                <div className='flex flex-col items-start gap-1'>
                  <Typography className='font-medium'>{c.title}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {c.body}
                  </Typography>
                  <LinkButton href={c.href} size='small' variant='text' className='p-0 min-is-0'>
                    {c.action}
                  </LinkButton>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Typography variant='h5' className='mbe-4'>
        The three research questions
      </Typography>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mbe-6'>
        {RQS.map(rq => (
          <Card key={rq.id}>
            <CardContent className='flex flex-col gap-3 bs-full'>
              <div className='flex items-center gap-3'>
                <CustomAvatar color={rq.color} skin='light' variant='rounded' size={40}>
                  <i className={`${rq.icon} text-[24px]`} />
                </CustomAvatar>
                <div className='flex flex-col'>
                  <Typography className='font-medium'>{rq.id}</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {rq.objective} · {rq.phase}
                  </Typography>
                </div>
                <Chip
                  size='small'
                  variant='tonal'
                  color={rq.status === 'answered' ? 'success' : 'default'}
                  label={rq.status}
                  className='mis-auto'
                />
              </div>
              <Typography variant='body2'>{rq.short}</Typography>
              <div className='flex gap-1 flex-wrap mbs-auto'>
                {rq.links.map(l => (
                  <LinkButton key={l.href} href={l.href} size='small' variant='tonal' color={rq.color}>
                    {l.label}
                  </LinkButton>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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

      <Card className='mbe-6'>
        <CardHeader
          title='Every figure here comes from a file you can download'
          subheader={`${downloads.totalFiles} files, ${downloads.totalLabel}`}
        />
        <CardContent className='flex flex-col gap-3'>
          <Typography>
            Each run publishes its metrics, the configuration it executed with, its partition report where it has one,
            and a record of itself. Nothing on this site is computed from anything that is not served alongside it — if
            a number here cannot be traced to one of these files, it should not be here.
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {downloads.note}
          </Typography>
          <Button
            component='a'
            href={archiveUrl()}
            download
            variant='tonal'
            size='small'
            className='self-start'
            startIcon={<i className='tabler-download' />}
          >
            Download all results ({downloads.archive.sizeLabel})
          </Button>
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
