// MUI Imports
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

// Component Imports
import PageHeader from '@/components/site/PageHeader'
import SectionCard from '@/components/site/SectionCard'
import StatCard from '@/components/site/StatCard'

// Lib Imports
import { federatedRuns, seedGroups, timingStats } from '@/lib/results'

export const metadata = {
  title: 'Limitations — FL with non-IID data',
  description: 'What this study cannot conclude, and why — stated in full rather than summarised.'
}

const Page = () => {
  const timing = timingStats()
  const groups = seedGroups(federatedRuns)
  const single = groups.filter(g => g.singleSeed).length
  const multi = groups.filter(g => !g.singleSeed).length

  // The widest seed range anywhere in the data — the scale that any claimed
  // difference between methods has to be read against.
  const widest = [...groups].sort((a, b) => b.spread - a.spread)[0]

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='Background'
        title='Limitations'
        lede='What this study cannot conclude, and why. This section is given real space deliberately: several of the results below are only interpretable alongside the constraint that produced them, and a declared limitation is worth more than a tidy number.'
      />

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-6 mbe-6'>
        <StatCard
          label='Configurations at one seed'
          value={`${single} of ${single + multi}`}
          hint='no variance estimate available'
          icon='tabler-repeat-off'
          color='error'
        />
        <StatCard
          label='Widest seed range'
          value={widest ? `${(widest.spread * 100).toFixed(2)} pts` : '—'}
          hint={widest ? `${widest.strategyLabel}, ${widest.partitionLabel}` : undefined}
          icon='tabler-arrows-vertical'
          color='warning'
        />
        <StatCard
          label='Timing spread'
          value={timing ? `${timing.ratio.toFixed(1)}×` : '—'}
          hint={timing ? `${timing.min.toFixed(1)}–${timing.max.toFixed(1)} s/round across ${timing.n} runs` : undefined}
          icon='tabler-clock-off'
          color='error'
        />
      </div>

      <div className='flex flex-col gap-6'>
        <SectionCard
          icon='tabler-repeat-off'
          color='error'
          title='Most configurations were run once'
          action={<Chip size='small' variant='tonal' color='error' label='affects every comparison' />}
          prose
        >
            <Typography>
              Only the CIFAR-10 Dirichlet block, its centralized baseline and FedAvgM were run at three seeds. The
              other {single} configurations have one seed each, and a single run gives no estimate of its own
              variance.
            </Typography>
            <Typography>
              This is not a minor caveat, because where three seeds do exist the spread is large. The widest range in
              the data is <strong>{widest ? `${(widest.spread * 100).toFixed(2)} points` : '—'}</strong>, and at
              CIFAR-10 α = 0.1 the three leading strategies are separated by less than half a point — comfortably
              inside seed noise.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Some of those single-seed configurations are single-seed by design rather than by budget: Phase B and
              Phase C reuse the Phase A grid at seed 0 so that a mechanism is the only thing that changes. The
              consequence is the same either way — neither carries a variance estimate of its own.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Consequently: no difference between strategies reported on this site should be read as significant
              unless three seeds support it, and most do not. The results establish the <em>shape</em> of the
              relationship between heterogeneity and accuracy far more securely than any ranking of methods.
            </Typography>
        </SectionCard>

        <SectionCard
          icon='tabler-clock-off'
          color='error'
          title='Wall-clock timings are not measurements'
          action={<Chip size='small' variant='tonal' color='error' label='never plotted' />}
          prose
        >
            <Typography>
              Timings were recorded for {timing?.n ?? 0} runs and range from {timing?.min.toFixed(1)} to{' '}
              {timing?.max.toFixed(1)} seconds per round — a factor of {timing?.ratio.toFixed(1)}. Identical
              configurations differ by up to 17.9×, because runs that spanned a system sleep counted the sleep as
              compute.
            </Typography>
            <Typography>
              The figure of record for cost per round is <strong>48.6 s</strong>, the mean over the subset of runs that
              did not span a sleep. Every other timing in the repository should be treated as an upper bound
              contaminated by idle time.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Timings are shown per run in the explorer, labelled as unreliable, and are not plotted anywhere on this
              site. Nothing in the study&apos;s conclusions rests on them.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-arrows-exchange' color='warning' title='Communication cost is analytic, and does not separate the strategies' prose>
            <Typography>
              No bytes cross a network in this study. Uplink cost is computed from parameter and client counts, which
              makes it a property of the protocol rather than an observation, and means it captures none of what
              dominates real federated deployments: stragglers, retransmission, connection setup, bandwidth
              asymmetry.
            </Typography>
            <Typography>
              Beyond that, the recorded byte counts are <strong>identical across all four strategies</strong>, so they
              do not reflect SCAFFOLD&apos;s control-variate overhead. The site reports them as recorded rather than
              correcting them, which means communication cost currently distinguishes nothing.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-settings-exclamation' color='warning' title='MOON runs under a configuration its authors did not use' prose>
            <Typography>
              The contrastive weight is 1.0 where the original work reports 5 as best for CIFAR-10; there is no
              projection head; and neither the authors&apos; momentum nor their weight decay is applied.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              MOON&apos;s results here are therefore results about this configuration of MOON. They are not evidence
              about MOON as published, and a finding that MOON does not outperform FedAvg in these runs should not be
              generalised.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-cpu' color='info' title='Scale, and what it caps' prose>
            <Typography>
              Everything runs on CPU with subsampled datasets and a small convolutional model. The centralized
              baseline reaches roughly 50% on CIFAR-10 — far below what is achievable on the full dataset with a
              larger architecture.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              This constrains the claims available. Relative comparisons under a fixed budget are supported; absolute
              accuracies are not comparable with published CIFAR-10 numbers, and it remains open whether the gaps
              observed here would persist at full scale, where a higher-capacity model might absorb heterogeneity
              that this one cannot.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-list-check' color='info' title='Four phases of five' prose>
            <Typography>
              Phases A through D are complete, which answers RQ1, RQ2 and RQ3. Only RQ4 — whether gradient inversion
              can recover training data, and whether the pipeline stops it — has no results at all.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Any statement on this site about gradient inversion describes a design, not a finding. The attack
              pipeline is implemented, but implemented is not measured.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-photo' color='secondary' title='Two datasets, one modality' prose>
            <Typography>
              CIFAR-10 provides comparability with the literature and PathMNIST provides a healthcare setting where
              the privacy motivation is real. Both are image classification with small inputs and balanced-ish global
              label distributions.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Nothing here speaks to text, tabular or time-series federation, nor to settings where the global label
              distribution is itself heavily imbalanced — which is common in exactly the clinical applications the
              healthcare framing invokes.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-users' color='secondary' title='Full participation, and few clients' prose>
            <Typography>
              Every client participates in every round, and there are fifteen of them. That is a reasonable model of
              cross-silo federation and a poor model of cross-device federation, where thousands of clients are
              sampled and most never appear twice.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Client sampling is a major source of variance in cross-device settings and is entirely absent here.
              Fifteen clients also makes silo-level differential privacy unusually demanding, since each client is a
              large fraction of the federation.
            </Typography>
        </SectionCard>
      </div>
    </div>
  )
}

export default Page
