'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

// Component Imports
import AccuracyCurveChart from '@/components/charts/AccuracyCurveChart'
import Caveat from '@/components/site/Caveat'
import FigureData from '@/components/site/FigureData'
import RunLink from '@/components/site/RunLink'
import SectionCard from '@/components/site/SectionCard'
import StatCard from '@/components/site/StatCard'

// Lib Imports
import { bytes, curvePoints, secaggPairs, secaggScaling } from '@/lib/results'

const SecaggView = () => {
  const pairs = useMemo(() => secaggPairs(), [])
  const scaling = useMemo(() => secaggScaling(), [])

  const [which, setWhich] = useState(0)
  const pair = pairs[which]

  if (!pair) return <Typography color='text.secondary'>No secure aggregation runs are recorded yet.</Typography>

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <StatCard
          label='Accuracy cost'
          value='none'
          hint='round 1 identical, by construction'
          icon='tabler-equal'
          color='success'
        />
        <StatCard
          label='Bandwidth cost'
          value={pair.bytesRatio ? `${pair.bytesRatio.toFixed(4)}×` : '—'}
          hint='payload unchanged by masking'
          icon='tabler-arrows-exchange'
          color='success'
        />
        <StatCard
          label='Masking cost'
          value={scaling?.maskRatio ? `${scaling.maskRatio.toFixed(2)}×` : '—'}
          hint={`against a ${scaling?.payloadRatio?.toFixed(2) ?? '—'}× payload`}
          icon='tabler-cpu'
          color='warning'
        />
        <StatCard
          label='Pairs measured'
          value={String(pairs.length)}
          hint='each masked run against a plain twin'
          icon='tabler-git-compare'
          color='info'
        />
      </div>

      <SectionCard
        icon='tabler-alert-triangle'
        color='error'
        title='Masking the update is not enough for SCAFFOLD'
        subtitle='A security finding, and the most consequential thing in this phase'
      >
        <Typography className='max-is-[85ch]'>
          The first version of Phase C masked the model but transmitted SCAFFOLD&apos;s control variate in the clear.
          It measured a cost ratio of 0.98× against a 2.00× payload — masking appeared to be free for SCAFFOLD, which
          should have been suspicious rather than encouraging.
        </Typography>
        <Typography className='max-is-[85ch]'>
          It was worse than a mismeasurement. The control variate update is
        </Typography>
        <pre className='text-xs overflow-auto p-4 rounded bg-actionHover max-is-[85ch]'>
          {'c_i_new  =  c_i  −  c  +  (w_global − w_local) / (steps · lr)'}
        </pre>
        <Typography className='max-is-[85ch]'>
          and the server knows every term but <code>w_local</code>: it received <code>c_i</code> last round, computed{' '}
          <code>c</code> itself, broadcast <code>w_global</code>, and <code>steps</code> and <code>lr</code> are
          public. So it can rearrange for the one unknown.{' '}
          <strong>The server recovers each client&apos;s local model exactly</strong> — measured at 6.94×10⁻¹⁸, which
          is floating-point zero. Masking the update while publishing the control variate gives SCAFFOLD no protection
          whatsoever.
        </Typography>
        <div className='flex gap-2 flex-wrap'>
          <Chip size='small' variant='tonal' color='error' label='reconstruction error 6.94e-18' />
          <Chip size='small' variant='tonal' color='error' label='before the fix: 0.98× cost against 2.00× payload' />
          <Chip size='small' variant='tonal' color='success' label='after: 1.96× — both objects masked' />
        </div>
        <Typography className='max-is-[85ch]'>
          The fix masks the control variate too, with independent masks. Because{' '}
          <code>scaffold_server_update</code> reduces to the mean of the <code>c_i</code> — a linear aggregate — the
          server still recovers exactly what it needs while seeing no individual variate. That is what the runs on this
          page measure.
        </Typography>
        <Caveat severity='info' title='Scope, precisely'>
          This applies to secure aggregation used <strong>without</strong> differential privacy, which is Phase C.
          Under differential privacy the control variate is a function of a DP-protected local model, so releasing it
          is post-processing and the guarantee holds. <strong>Phase B is unaffected.</strong>
        </Caveat>
      </SectionCard>

      <SectionCard
        icon='tabler-equal'
        color='success'
        title='Masking costs nothing in accuracy'
        subtitle='And that is arithmetic, not a measurement'
        action={
          <div className='flex gap-2 items-center flex-wrap'>
            <FigureData
              filename={`secagg_${pair.strategy}_paired_accuracy`}
              columns={['round', 'plain_test_acc', 'masked_test_acc', 'abs_difference_points']}
              rows={curvePoints(pair.plain).map((p, i) => {
                const m = curvePoints(pair.masked)[i]

                return [
                  p.round,
                  p.test_acc,
                  m?.test_acc ?? null,
                  p.test_acc !== null && m?.test_acc != null ? Math.abs(p.test_acc - m.test_acc) * 100 : null
                ]
              })}
              sources={[pair.plain.name, pair.masked.name]}
            />
            {pairs.length > 1 && (
              <ToggleButtonGroup exclusive size='small' value={which} onChange={(_, v) => v !== null && setWhich(v)}>
                {pairs.map((p, i) => (
                  <ToggleButton key={p.masked.name} value={i}>
                    {p.strategyLabel}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </div>
        }
      >
        <AccuracyCurveChart runs={[pair.plain, pair.masked]} metric='test_acc' colourByStrategy={false} />

        <div className='flex gap-2 flex-wrap mbs-2'>
          <Chip
            size='small'
            variant='tonal'
            color='success'
            label={`round 1 difference: ${pair.round1DiffPts?.toExponential(2) ?? '—'} points`}
          />
          <Chip size='small' variant='tonal' label={`largest later difference: ${pair.maxWanderPts.toFixed(2)} pts`} />
          <Chip size='small' variant='tonal' label={`final: ${pair.finalDiffPts?.toFixed(2) ?? '—'} pts`} />
        </div>

        <Typography className='max-is-[85ch]'>
          At round 1 the two runs agree <strong>exactly</strong> — the masks sum to about 1×10⁻¹⁴, so the first
          aggregate is arithmetically the same number the plain run computed. Masking does not approximate the average;
          it reproduces it.
        </Typography>

        <Caveat severity='info' title='Why the curves separate after round 1'>
          A residue at 1×10⁻¹⁴ changes where round 2 starts from, and two runs of a non-convex optimisation then follow
          slightly different paths. The largest gap here is {pair.maxWanderPts.toFixed(2)} points, against a
          seed-to-seed spread of roughly 6 points at this same cell. <strong>This is not a cost of masking</strong> —
          it is rounding amplified through training, and it carries no information.
        </Caveat>
      </SectionCard>

      <SectionCard
        icon='tabler-arrows-exchange'
        color='success'
        title='Masking costs nothing in bandwidth'
        subtitle='A masked update has the same shape as a plaintext one'
      >
        <TableContainer>
          <Table size='small'>
            <TableBody>
              <TableRow>
                <TableCell>Payload per round, plain</TableCell>
                <TableCell align='right'>{bytes(pair.bytesPlain)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Payload per round, masked</TableCell>
                <TableCell align='right'>{bytes(pair.bytesMasked)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ratio</TableCell>
                <TableCell align='right'>
                  <strong>{pair.bytesRatio?.toFixed(4) ?? '—'}×</strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
          Worth stating against the 1.73× expansion Bonawitz et al. report, most of which pays for the dropout recovery
          this implementation does not have. A protocol that tolerates clients vanishing mid-round carries extra
          traffic to do so; this one assumes full participation, which the cross-silo setting makes reasonable.
        </Typography>
      </SectionCard>

      <SectionCard
        icon='tabler-cpu'
        color='warning'
        title='Masking costs computation, and the cost tracks payload size'
        subtitle='Processor seconds per round — not elapsed'
        action={
          <FigureData
            filename='secagg_overhead'
            columns={[
              'strategy',
              'payload_bytes_per_round',
              'mask_processor_s_per_round',
              'aggregate_processor_s_per_round',
              'key_agreement_recorded',
              'key_agreement_protocol'
            ]}
            rows={pairs.map(p => [
              p.strategyLabel,
              p.bytesPlain,
              p.maskSeconds,
              p.aggregateSeconds,
              p.keyAgreementRecorded,
              p.keyAgreementProtocol
            ])}
            sources={pairs.flatMap(p => [p.masked.name, p.plain.name])}
          />
        }
      >
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell />
                {pairs.map(p => (
                  <TableCell key={p.masked.name} align='right'>
                    {p.strategyLabel}
                  </TableCell>
                ))}
                <TableCell align='right'>ratio</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Payload per round</TableCell>
                {pairs.map(p => (
                  <TableCell key={p.masked.name} align='right'>
                    {p.bytesPlain?.toLocaleString()} B
                  </TableCell>
                ))}
                <TableCell align='right'>
                  <strong>{scaling?.payloadRatio?.toFixed(2) ?? '—'}×</strong>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Masking, processor s/round</TableCell>
                {pairs.map(p => (
                  <TableCell key={p.masked.name} align='right'>
                    {p.maskSeconds.toFixed(4)}
                  </TableCell>
                ))}
                <TableCell align='right'>
                  <strong>{scaling?.maskRatio?.toFixed(2) ?? '—'}×</strong>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Aggregation, processor s/round</TableCell>
                {pairs.map(p => (
                  <TableCell key={p.masked.name} align='right'>
                    {p.aggregateSeconds.toFixed(4)}
                  </TableCell>
                ))}
                <TableCell align='right'>{scaling?.aggregateRatio?.toFixed(2) ?? '—'}×</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Typography className='max-is-[85ch]'>
          SCAFFOLD transmits a control variate alongside the update, so its payload is twice FedAvg&apos;s. The masking
          cost follows it at {scaling?.maskRatio?.toFixed(2) ?? '—'}× against a {scaling?.payloadRatio?.toFixed(2) ?? '—'}×
          payload. That correspondence is what the phase was designed to produce, and SCAFFOLD is in it precisely to
          give the cost a second point on the scale.
        </Typography>
      </SectionCard>

      <SectionCard
        icon='tabler-messages'
        color='info'
        title='Key agreement: what was recorded, and what a deployment carries'
      >
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Messages per round</TableCell>
                {pairs.map(p => (
                  <TableCell key={p.masked.name} align='right'>
                    {p.strategyLabel}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Recorded by this implementation</TableCell>
                {pairs.map(p => (
                  <TableCell key={p.masked.name} align='right'>
                    {p.keyAgreementRecorded}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Protocol figure, n(n−1)</TableCell>
                {pairs.map(p => (
                  <TableCell key={p.masked.name} align='right'>
                    <strong>{p.keyAgreementProtocol}</strong>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Typography className='max-is-[85ch]'>
          The simulation performs one key agreement per masked object, so SCAFFOLD — which masks both the update and
          its control variate — records twice FedAvg&apos;s count. A deployment would derive both mask sets from a
          single pairwise secret through a key-derivation function, giving 210 either way.{' '}
          <strong>The computation genuinely doubles; the traffic need not.</strong> Both figures are shown because the
          recorded one is what the files contain and the protocol one is what a real system would carry.
        </Typography>
      </SectionCard>

      <SectionCard
        icon='tabler-clock-off'
        color='error'
        title='Why these costs are processor time'
        subtitle='The clearest demonstration in the study that elapsed time cannot carry a claim'
      >
        <div className='flex gap-2 flex-wrap'>
          <Chip
            size='small'
            variant='tonal'
            color='error'
            label={`masked: ${pair.elapsedMasked?.toFixed(1) ?? '—'} s/round elapsed`}
          />
          <Chip
            size='small'
            variant='tonal'
            label={`plain: ${pair.elapsedPlain?.toFixed(1) ?? '—'} s/round elapsed`}
          />
          <Chip
            size='small'
            variant='tonal'
            color='success'
            label={`processor cost of masking: +${pair.totalSeconds.toFixed(4)} s/round`}
          />
        </div>
        <Typography className='max-is-[85ch]'>
          On this pair the arm doing measurably more work recorded the <em>faster</em> elapsed time. Two runs, back to
          back, half an hour apart, on the same machine. Processor time shows masking costing{' '}
          {pair.totalSeconds.toFixed(4)} seconds per round; elapsed time shows it saving time, which is impossible.
          Every overhead figure on this page is processor time for that reason, and elapsed time is never plotted
          anywhere on this site.
        </Typography>
      </SectionCard>

      <SectionCard
        icon='tabler-checkbox'
        color='success'
        title='A free integrity check'
        subtitle='Each plain arm reproduces its Phase A twin exactly'
      >
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Plain arm</TableCell>
                <TableCell>Phase A twin</TableCell>
                <TableCell align='right'>largest difference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pairs.map(p => (
                <TableRow key={p.plain.name}>
                  <TableCell>
                    <RunLink name={p.plain.name} />
                  </TableCell>
                  <TableCell>{p.twin ? <RunLink name={p.twin.name} /> : '—'}</TableCell>
                  <TableCell align='right'>
                    {p.twinMaxDiffPts === null ? '—' : `${p.twinMaxDiffPts.toExponential(2)} points`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
          The same configuration run weeks apart gives the same numbers to the digit. That was not the point of Phase
          C, but it is worth having: it says the pipeline is deterministic and that nothing drifted between the phases.
        </Typography>
      </SectionCard>
    </div>
  )
}

export default SecaggView
