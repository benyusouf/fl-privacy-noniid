'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'

// Component Imports
import Caveat from '@/components/site/Caveat'
import FigureData from '@/components/site/FigureData'
import RunLink from '@/components/site/RunLink'
import AccuracyCurveChart from '@/components/charts/AccuracyCurveChart'
import ClientNoiseChart from '@/components/charts/ClientNoiseChart'
import PrivacyCostChart from '@/components/charts/PrivacyCostChart'

// Type Imports
import type { Partition, Run } from '@/types/results'

// Lib Imports
import {
  DP_SEED,
  EPSILONS,
  clientNoise,
  comparatorRun,
  dpCell,
  dpPartitions,
  privacyCostSeries,
  privacyCostSummary,
  protectedRuns,
  pct
} from '@/lib/results'

const DATASET = 'cifar10' as const

const PrivacyView = () => {
  const summary = useMemo(() => privacyCostSummary(DATASET), [])
  const series = useMemo(() => privacyCostSeries(DATASET), [])
  const partitions = useMemo(() => dpPartitions(DATASET), [])

  const [noisePartition, setNoisePartition] = useState<Partition>(partitions[partitions.length - 1] ?? 'dir0.1')

  // Sigma is calibrated from client size AND the privacy budget, so it cannot be
  // shown without naming the budget it belongs to. The client size ratio and the
  // sampling ratio q are independent of epsilon; the sigma ratio is not.
  const [noiseEpsilon, setNoiseEpsilon] = useState<number>(1)

  // Any run at this partition carries the same client noise profile: sigma is
  // calibrated from client sizes and epsilon, not from the strategy.
  const noiseRun = useMemo(() => dpCell(DATASET, noisePartition, 'fedavg', noiseEpsilon), [noisePartition, noiseEpsilon])
  const noise = noiseRun ? clientNoise(noiseRun) : null

  // MOON at the near-homogeneous partition is unstable under DP in a way the
  // site's volatility tests do not catch — the movement is a slow U, not
  // round-to-round jitter — so it is surfaced explicitly rather than detected.
  const moonRuns = useMemo(
    () => [8, 4, 1].map(e => dpCell(DATASET, 'dir100', 'moon', e)).filter((r): r is Run => r !== null),
    []
  )

  const anyLabelDishonoured = protectedRuns.some(r => r.dp && !r.dp.labelHonoured)

  return (
    <div className='flex flex-col gap-6'>
      <Card>
        <CardHeader
          title='Accuracy stops tracking heterogeneity'
          subheader='CIFAR-10, seed 0. Each point averages the four aggregation strategies.'
          action={
            <FigureData
              filename='privacy_cost_by_heterogeneity'
              columns={['condition', 'target_epsilon', 'partition', 'hellinger_mean', 'mean_acc', 'min_acc', 'max_acc', 'strategies']}
              rows={series.flatMap(sr =>
                sr.points.map(pt => [
                  sr.condition.label, sr.condition.epsilon, pt.partition,
                  pt.hellinger, pt.acc, pt.min, pt.max, pt.n
                ])
              )}
              sources={series.flatMap(sr => sr.points.flatMap(pt => pt.runs.map(r => r.name)))}
            />
          }
        />
        <CardContent>
          <PrivacyCostChart dataset={DATASET} />
          <Typography variant='body2' className='mbs-4 max-is-[85ch]'>
            The cost of differential privacy is large and, on its own, uninteresting: around nineteen accuracy points
            at ε = 8. The result worth attention is the change in <strong>shape</strong>. Without a privacy mechanism,
            accuracy falls as measured heterogeneity rises — the relationship RQ1 established. With noise added, the
            lines flatten. The partitions have not become similar: measured Hellinger distance still spans the same
            range along the x-axis. Accuracy simply stops responding to it.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title='The cost, and the collapse'
          subheader='Mean over twelve cells: four strategies × three partitions'
          action={
            <FigureData
              filename='privacy_cost_summary'
              columns={['condition', 'target_epsilon', 'cells', 'mean_acc', 'cost_pts', 'spread_pts']}
              rows={summary.map(x => [
                x.condition.label, x.condition.epsilon, x.cells, x.acc, x.cost, x.spread
              ])}
            />
          }
        />
        <CardContent>
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Condition</TableCell>
                  <TableCell align='right'>Mean accuracy</TableCell>
                  <TableCell align='right'>Cost</TableCell>
                  <TableCell align='right'>Spread across partitions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.map(s => (
                  <TableRow key={s.condition.key}>
                    <TableCell>{s.condition.label}</TableCell>
                    <TableCell align='right'>{s.acc.toFixed(2)}%</TableCell>
                    <TableCell align='right'>{s.cost === null ? '—' : `${s.cost.toFixed(2)} pts`}</TableCell>
                    <TableCell align='right'>{s.spread.toFixed(2)} pts</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant='caption' color='text.secondary' className='block mbs-3'>
            &quot;Spread across partitions&quot; is the gap between the best and worst partition mean within a
            condition — how much accuracy still varies with heterogeneity. It is the quantity that collapses. Measured
            Hellinger distance across these partitions spans{' '}
            {summary[0] && `${summary[0].hellingerSpan[0].toFixed(3)} to ${summary[0].hellingerSpan[1].toFixed(3)}`}{' '}
            in every condition; only the accuracy response changes.
          </Typography>
        </CardContent>
      </Card>

      <Caveat title='These runs cannot rank the strategies'>
        Phase B is seed 0 throughout. The Phase A seed spread at the same cell is wider than any difference between
        strategies at a fixed ε, so no ordering of FedAvg, FedProx, SCAFFOLD and MOON under differential privacy is
        supported by this data. The chart above averages across strategies for that reason, and the range bar shows how
        far apart they sit rather than which is ahead.
      </Caveat>

      <Card>
        <CardHeader
          title='Who pays for the guarantee'
          subheader='Noise is calibrated per client, so the burden follows the partition'
          action={
            <div className='flex gap-2 flex-wrap'>
              <FormControl size='small' className='min-is-[200px]'>
                <InputLabel>Partition</InputLabel>
                <Select
                  label='Partition'
                  value={noisePartition}
                  onChange={e => setNoisePartition(e.target.value as Partition)}
                >
                  {partitions.map(p => (
                    <MenuItem key={p} value={p}>
                      {dpCell(DATASET, p, 'fedavg', noiseEpsilon)?.partitionLabel ?? p}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size='small' className='min-is-[120px]'>
                <InputLabel>Budget</InputLabel>
                <Select label='Budget' value={noiseEpsilon} onChange={e => setNoiseEpsilon(Number(e.target.value))}>
                  {EPSILONS.map(v => (
                    <MenuItem key={v} value={v}>
                      ε = {v}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          }
        />
        <CardContent>
          {noiseRun && noise && (
            <div className='flex justify-end mbe-2'>
              <FigureData
                filename={`${noiseRun.name}_client_noise`}
                columns={['client', 'n', 'q', 'steps', 'sigma', 'realised_epsilon', 'saturated']}
                rows={noise.clients.map(c => [c.client, c.n, c.q, c.steps, c.sigma, c.realised_epsilon, c.saturated])}
                sources={[noiseRun.name]}
              />
            </div>
          )}
          {noiseRun && <ClientNoiseChart run={noiseRun} />}
          {noise && (
            <div className='flex gap-2 flex-wrap mbs-4'>
              <Chip size='small' variant='tonal' color='primary' label={`client size ratio ${noise.sizeRatio.toFixed(2)}×`} />
              <Chip
                size='small'
                variant='tonal'
                color='secondary'
                label={`σ ratio ${noise.sigmaRatio.toFixed(2)}× at ε = ${noiseEpsilon}`}
              />
              <Chip size='small' variant='tonal' color='warning' label={`highest sampling ratio q = ${noise.maxQ.toFixed(3)}`} />
              <Chip
                size='small'
                variant='tonal'
                label={`smallest silo: ${noise.smallest.n} samples, σ = ${noise.smallest.sigma.toFixed(2)} at ε = ${noiseEpsilon}`}
              />
            </div>
          )}
          <Typography variant='body2' className='mbs-4 max-is-[85ch]'>
            Differential privacy accounting benefits from subsampling: each sample is unlikely to appear in any given
            batch, which weakens what an adversary learns. That benefit depends on the sampling ratio{' '}
            <code>q = batch / n</code> staying small. At the most skewed partition the smallest silo holds{' '}
            {noise?.smallest.n} samples against a batch of 64, so q reaches {noise?.maxQ.toFixed(2)} — nearly every
            sample appears in nearly every batch, amplification buys almost nothing, and σ has to rise steeply to reach
            the same ε. Chapter 3 §3.8.2 predicts this; these are the measurements.
          </Typography>
          <Typography variant='body2' color='text.secondary' className='mbs-2 max-is-[85ch]'>
            The client size ratio and the sampling ratio are properties of the partition and do not change with the
            privacy budget. The σ ratio does: at this partition it runs 6.19× at ε = 8, 7.03× at ε = 4 and 7.69× at
            ε = 1. Tightening the budget does not only add noise — it widens the gap between who carries it.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title='MOON is unstable under noise at the homogeneous partition'
          subheader='Dirichlet α = 100, CIFAR-10 — trajectories, not final scores'
        />
        <CardContent>
          {moonRuns.length > 0 && <AccuracyCurveChart runs={moonRuns} colourByStrategy={false} />}
          <Typography variant='body2' className='mbs-4 max-is-[85ch]'>
            These runs do not converge and then sit still. At ε = 8 the curve reaches 15.6% by round 10, falls to 11.3%
            by round 30, and recovers to 18.9% by round 60. At ε = 1 it peaks at 15.2% and then declines to 11.8%
            against a ten-class chance line of 10%. A single end-of-run number would describe none of that, which is
            why the trajectory is shown instead.
          </Typography>
          <Caveat severity='info' title='Cause not established'>
            Why MOON in particular destabilises under noise at the least skewed partition has not been determined. Its
            contrastive term compares representations against the global and previous models, and noise perturbs all
            three, but no measurement here isolates that as the mechanism. It is recorded as an observation, not
            explained.
          </Caveat>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title='What the guarantee actually is' />
        <CardContent className='flex flex-col gap-3'>
          <Typography className='max-is-[85ch]'>
            Every figure on this page reports <strong>delivered</strong> ε — the worst client&apos;s realised budget —
            rather than the target ε that names the directory. A federation can only claim the protection of its
            weakest member, so the delivered figure is the guarantee and the target is a label.
          </Typography>
          <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
            {anyLabelDishonoured
              ? 'Some runs on this site deliver a budget weaker than their label; those are flagged where they appear.'
              : 'On every run currently published the two agree, so the distinction changes no number here. It is stated because that was not always true: before the D69 re-run, labels and delivered budgets diverged.'}{' '}
            Privacy is applied at sample level, with δ = 1×10⁻⁵ and a clipping norm of 1.0.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title='Comparators'
          subheader='Every Phase B run is matched to a Phase A run identical but for the mechanism'
          action={
            <FigureData
              filename='phase_b_comparators'
              columns={['protected_run', 'target_epsilon', 'delivered_epsilon', 'protected_acc', 'comparator', 'comparator_acc', 'cost_pts']}
              rows={protectedRuns
                .filter(r => r.dataset === DATASET)
                .map(r => {
                  const c = comparatorRun(r)

                  
return [
                    r.name, r.dp?.targetEpsilon ?? null, r.dp?.deliveredEpsilon ?? null, r.finalAcc,
                    r.comparator, c?.finalAcc ?? null,
                    c && c.finalAcc !== null && r.finalAcc !== null ? (c.finalAcc - r.finalAcc) * 100 : null
                  ]
                })}
              sources={protectedRuns.filter(r => r.dataset === DATASET).flatMap(r => [r.name, r.comparator ?? ''])}
            />
          }
        />
        <CardContent>
          <TableContainer className='max-bs-[420px] overflow-auto'>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Protected run</TableCell>
                  <TableCell align='right'>delivered ε</TableCell>
                  <TableCell align='right'>accuracy</TableCell>
                  <TableCell>Comparator</TableCell>
                  <TableCell align='right'>accuracy</TableCell>
                  <TableCell align='right'>cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {protectedRuns
                  .filter(r => r.dataset === DATASET)
                  .map(r => {
                    const c = comparatorRun(r)
                    const cost = c && c.finalAcc !== null && r.finalAcc !== null ? (c.finalAcc - r.finalAcc) * 100 : null

                    return (
                      <TableRow key={r.name} hover>
                        <TableCell>
                          <RunLink name={r.name} />
                        </TableCell>
                        <TableCell align='right'>{r.dp?.deliveredEpsilon.toFixed(4)}</TableCell>
                        <TableCell align='right'>{pct(r.finalAcc)}</TableCell>
                        <TableCell>{r.comparator && <RunLink name={r.comparator} />}</TableCell>
                        <TableCell align='right'>{pct(c?.finalAcc ?? null)}</TableCell>
                        <TableCell align='right'>{cost === null ? '—' : `${cost.toFixed(2)} pts`}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant='caption' color='text.secondary' className='block mbs-3'>
            Comparators are recorded by the pipeline, not reconstructed from run names. Both sides are seed {DP_SEED}.
          </Typography>
        </CardContent>
      </Card>
    </div>
  )
}

export default PrivacyView
