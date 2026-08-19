// MUI Imports
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'

// Component Imports
import PageHeader from '@/components/site/PageHeader'
import Caveat from '@/components/site/Caveat'
import SectionCard from '@/components/site/SectionCard'

// Lib Imports
import { allRuns, bytes, federatedRuns } from '@/lib/results'

export const metadata = {
  title: 'Methodology — FL with non-IID data',
  description: 'Experimental design, partition protocols, architectures and threat model.'
}

const Page = () => {
  // Read the shared configuration off a representative federated run rather than
  // restating it, so this page cannot drift from what was executed.
  const ref = federatedRuns.find(r => r.dataset === 'cifar10') ?? federatedRuns[0]
  const cfg = ref?.config as Record<string, any>
  const model = (cfg?.model ?? {}) as Record<string, any>

  const partitions = [
    { protocol: 'Dirichlet, α = 100', kind: 'Label skew, near-homogeneous', h: '≈ 0.03' },
    { protocol: 'Dirichlet, α = 1.0', kind: 'Label skew, moderate', h: '≈ 0.31' },
    { protocol: 'Dirichlet, α = 0.1', kind: 'Label skew, severe', h: '≈ 0.65' },
    { protocol: 'Pathological, 1 class per client', kind: 'Label skew, extreme', h: '≈ 0.83' },
    { protocol: 'Quantity skew, β = 0.5', kind: 'Volume skew, even labels', h: '≈ 0.10' }
  ]

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='Background'
        title='Methodology'
        lede='The experimental design, the partition protocols, the architectures and the threat model. Where a value can be read from the recorded configurations it is read rather than restated.'
      />

      <div className='flex flex-col gap-6'>
        <SectionCard icon='tabler-topology-star-3' color='primary' title='Setting' subtitle='Cross-silo, full participation'>
            <Typography>
              A cross-silo federation of {cfg?.num_clients ?? 15} institutional clients with full participation in
              every round — the regime where clients are a small number of organisations rather than a large number of
              devices. Full participation removes client sampling as a source of variance, which matters when most
              configurations were affordable at only one seed.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Everything runs in a single process on CPU. There is no network, no device, and no real deployment: this
              is a simulation, and quantities that would be measured in a deployment are computed analytically here.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-settings' color='info' title='Training configuration' subtitle='Held fixed across all of Phase A'>
            <TableContainer>
              <Table size='small'>
                <TableBody>
                  <TableRow>
                    <TableCell>Clients</TableCell>
                    <TableCell align='right'>{cfg?.num_clients ?? '—'}, full participation</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Communication rounds</TableCell>
                    <TableCell align='right'>{cfg?.rounds ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Local epochs per round</TableCell>
                    <TableCell align='right'>{cfg?.local_epochs ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Learning rate</TableCell>
                    <TableCell align='right'>{cfg?.lr ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Batch size</TableCell>
                    <TableCell align='right'>{model.batch_size ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Model</TableCell>
                    <TableCell align='right'>
                      {model.backend ?? '—'}, width {model.width ?? '—'}, {model.img_size ?? '—'}×
                      {model.img_size ?? '—'}×{model.in_channels ?? '—'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Subsample (train / test)</TableCell>
                    <TableCell align='right'>
                      {cfg?.subsample?.toLocaleString() ?? '—'} / {cfg?.subsample_test?.toLocaleString() ?? '—'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Parameters per model</TableCell>
                    <TableCell align='right'>
                      {ref?.bytesUpPerRound && cfg?.num_clients
                        ? (ref.bytesUpPerRound / (4 * cfg.num_clients)).toLocaleString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant='caption' color='text.secondary' className='block mbs-3'>
              Datasets are subsampled to {cfg?.subsample?.toLocaleString() ?? '—'} training images. This is a CPU
              budget decision, and it caps the absolute accuracy every method can reach — the centralized baseline
              reaches roughly 50% on CIFAR-10, well below what the architecture would achieve on the full set. The
              comparisons between methods are unaffected; the absolute numbers are not comparable to published
              CIFAR-10 results.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-chart-pie' color='secondary' title='Partition protocols' subtitle='Five protocols, reported by measured distance'>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Protocol</TableCell>
                    <TableCell>What it varies</TableCell>
                    <TableCell align='right'>measured mean H</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {partitions.map(p => (
                    <TableRow key={p.protocol}>
                      <TableCell>{p.protocol}</TableCell>
                      <TableCell>{p.kind}</TableCell>
                      <TableCell align='right'>{p.h}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant='caption' color='text.secondary' className='block mbs-3'>
              Measured values vary with seed; the figures here are the means across the runs on this site. Each
              run&apos;s own partition report is shown in the run explorer.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-code' color='success' title='Implementation' subtitle='Written directly, not assembled from a framework'>
            <Typography>
              The round loop, the four aggregation strategies, the partitioning, the differential-privacy path and the
              masking are all implemented directly in this repository. Flower was evaluated and rejected: it ships
              FedAvg and FedProx but neither SCAFFOLD nor MOON, so two of the four strategies under comparison would
              have had to be written by hand regardless.
            </Typography>
            <Caveat severity='info' title='This is not a Flower project'>
              No federated-learning framework is used anywhere in the pipeline. Any description of this work as
              built on Flower, FedML or similar is incorrect.
            </Caveat>
        </SectionCard>

        <SectionCard icon='tabler-arrows-exchange' color='warning' title='Communication cost' subtitle='An analytic quantity, not a measurement'>
            <Typography>
              Nothing is transmitted anywhere — this is a single process. Uplink cost is computed as parameters × 4
              bytes × clients, giving {bytes(ref?.bytesUpPerRound ?? null)} per round for the model used here. It
              should be read as a property of the protocol at this model size, not as observed network traffic.
            </Typography>
            <Caveat title='The recorded byte counts do not distinguish the strategies'>
              SCAFFOLD transmits a control variate alongside each update and should therefore cost roughly twice what
              FedAvg costs per round. That multiplier is <strong>not present in the recorded data</strong>: every
              strategy records an identical {bytes(ref?.bytesUpPerRound ?? null)} per round. This site reports the
              figures as recorded rather than applying a correction, so that what is shown here matches the CSV files
              in the repository. The discrepancy is unresolved and is flagged rather than smoothed over.
            </Caveat>
        </SectionCard>

        <SectionCard icon='tabler-shield-lock' color='error' title='Threat model'>
            <Typography>
              The server is treated as <strong>honest-but-curious</strong>: it follows the protocol correctly but will
              try to learn what it can from what it receives. This is the standard assumption for cross-silo
              federation, where the aggregator is typically a known and contractually bound party rather than an
              arbitrary adversary.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              The attack surface examined is therefore the channel the protocol itself opens — the model updates
              clients send each round — rather than compromise of a client, poisoning of the aggregate, or collusion
              between clients. Byzantine robustness is outside the scope of this study.
            </Typography>
        </SectionCard>

        <SectionCard icon='tabler-database' color='primary' title='Recording' subtitle={`${allRuns.length} runs on this site`}>
            <Typography variant='body2'>
              Each run directory records its metrics per round, the partition it was given, the configuration it
              actually executed with, and a wall-clock timing. The configuration file is the authoritative record:
              where a description and a config disagree, the config is what ran.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Runs superseded by later methodology decisions remain in the repository under a suffixed name and are
              excluded from this site, as are the synthetic smoke-test fixture and an attack probe with no recorded
              configuration.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Recorded and counted are not the same thing. Section 3.11 excludes calibration and diagnostic activity
              from the study&apos;s run totals, so a diagnostic run — one made to interpret another run rather than to
              produce a result — is published and browsable here but does not add to a phase count. This site shows
              both numbers rather than quietly picking one.
            </Typography>
        </SectionCard>
      </div>
    </div>
  )
}

export default Page
