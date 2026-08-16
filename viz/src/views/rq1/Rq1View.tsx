'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
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
import Caveat from '@/components/site/Caveat'
import FigureData from '@/components/site/FigureData'
import HellingerScatterChart from '@/components/charts/HellingerScatterChart'

// Type Imports
import type { Dataset } from '@/types/results'

// Lib Imports
import {
  PARTITION_ORDER,
  STRATEGY_ORDER,
  centralizedBaseline,
  federatedRuns,
  hasUnrepresentativeFinal,
  pct,
  seedGroups
} from '@/lib/results'

const Rq1View = () => {
  const [dataset, setDataset] = useState<Dataset>('cifar10')

  // Unprotected only, matching rq1Points(). RQ1 is the no-mechanism baseline;
  // without this filter the Phase B runs join the table and, since the lookup
  // below takes the first group per (partition, strategy), a differentially
  // private cell could be shown as if it were the baseline.
  const groups = useMemo(
    () => seedGroups(federatedRuns.filter(r => r.dataset === dataset && !r.isFedAvgM && r.dp === null && r.arm === null)),
    [dataset]
  )

  const baseline = useMemo(() => centralizedBaseline(dataset), [dataset])

  // One row per partition, one column per strategy.
  const rows = PARTITION_ORDER.map(p => ({
    partition: p,
    label: groups.find(g => g.partition === p)?.partitionLabel ?? p,
    hellinger: groups.find(g => g.partition === p)?.meanHellinger ?? null,
    cells: STRATEGY_ORDER.map(s => groups.find(g => g.partition === p && g.strategy === s) ?? null)
  })).filter(r => r.cells.some(Boolean))

  const anySingleSeed = groups.some(g => g.singleSeed)

  // Runs whose last recorded round misstates them by more than five points.
  const unstable = useMemo(
    () =>
      federatedRuns.filter(
        r => r.dataset === dataset && !r.isFedAvgM && r.dp === null && r.arm === null && hasUnrepresentativeFinal(r)
      ),
    [dataset]
  )

  return (
    <div className='flex flex-col gap-6'>
      <Card>
        <CardHeader
          title='Final accuracy against measured heterogeneity'
          subheader='Each point is one (strategy, partition) block. Bars span min to max across seeds.'
          action={
            <div className='flex gap-2 items-center flex-wrap'>
            <FigureData
              filename={`rq1_accuracy_vs_hellinger_${dataset}`}
              columns={['strategy', 'partition', 'hellinger_mean', 'mean_final_acc', 'min_acc', 'max_acc', 'seeds']}
              rows={groups.map(g => [
                g.strategyLabel, g.partition, g.meanHellinger,
                g.meanFinalAcc * 100, g.minFinalAcc * 100, g.maxFinalAcc * 100, g.n
              ])}
              sources={groups.flatMap(g => g.runs.map(r => r.name))}
            />
            <ToggleButtonGroup
              exclusive
              size='small'
              value={dataset}
              onChange={(_, v) => v && setDataset(v as Dataset)}
            >
              <ToggleButton value='cifar10'>CIFAR-10</ToggleButton>
              <ToggleButton value='pathmnist'>PathMNIST</ToggleButton>
            </ToggleButtonGroup>
            </div>
          }
        />
        <CardContent>
          <HellingerScatterChart dataset={dataset} />
          <Typography variant='caption' color='text.secondary' className='block mbs-4'>
            The x-axis is the measured mean Hellinger distance between each client&apos;s label distribution and the
            global one — not the Dirichlet α that generated the partition. Reporting the measured quantity rather than
            the protocol parameter is a deliberate commitment of this study: α is the request, Hellinger is the result,
            and quantity skew at β = 0.5 lands at a lower measured heterogeneity than its name suggests.
          </Typography>
        </CardContent>
      </Card>

      {anySingleSeed && (
        <Caveat title='Single-seed points carry no error bar'>
          Only the CIFAR-10 Dirichlet block, its centralized baseline and FedAvgM were run at three seeds. Every other
          configuration has one seed, and a difference between single-seed points is not evidence of a difference
          between methods. Where three seeds exist on CIFAR-10 at α = 0.1, the seed range is roughly ±5.8 points —
          wider than most of the gaps between strategies at that heterogeneity.
        </Caveat>
      )}

      {unstable.length > 0 && (
        <Caveat severity='error' title='Some of these final values are not settled results'>
          {unstable.length} run{unstable.length === 1 ? '' : 's'} in this dataset end more than five points from the
          mean of their own last ten rounds, because the accuracy series is still oscillating at round 60:{' '}
          {unstable.map(r => `${r.strategyLabel} ${r.partitionLabel} (${pct(r.finalAcc)} final vs ${pct(r.tailMean)} over the last ten)`).join('; ')}. Those
          points are plotted at their final value like every other, so read them as one sample from a swinging series
          rather than as a converged accuracy.
        </Caveat>
      )}

      <Card>
        <CardHeader
          title={`Final test accuracy — ${dataset === 'cifar10' ? 'CIFAR-10' : 'PathMNIST'}`}
          subheader={
            baseline
              ? `Centralized baseline: ${baseline.mean.toFixed(2)}%${
                  baseline.singleSeed ? ' (single seed)' : ` (mean of ${baseline.n}, range ${baseline.min.toFixed(2)}–${baseline.max.toFixed(2)}%)`
                }, measured over ${baseline.steps} ${baseline.stepUnit}s`
              : undefined
          }
        />
        <CardContent>
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Partition</TableCell>
                  <TableCell align='right'>measured H</TableCell>
                  {STRATEGY_ORDER.map(s => (
                    <TableCell key={s} align='right'>
                      {s === 'scaffold' ? 'SCAFFOLD' : s === 'fedavg' ? 'FedAvg' : s === 'fedprox' ? 'FedProx' : 'MOON'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.partition}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell align='right'>{r.hellinger === null ? '—' : r.hellinger.toFixed(3)}</TableCell>
                    {r.cells.map((g, i) => (
                      <TableCell key={i} align='right'>
                        {g === null ? (
                          '—'
                        ) : (
                          <span>
                            {(g.meanFinalAcc * 100).toFixed(2)}
                            {g.singleSeed ? (
                              <Typography component='span' variant='caption' color='text.secondary'>
                                {' '}
                                ⁿ¹
                              </Typography>
                            ) : (
                              <Typography component='span' variant='caption' color='text.secondary'>
                                {' '}
                                ±{(g.spread * 100).toFixed(2)}
                              </Typography>
                            )}
                          </span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant='caption' color='text.secondary' className='block mbs-3'>
            ± values are the full range across seeds (max − min), not a standard deviation or a confidence interval.
            With three seeds the range is the statistic that does not overstate what is known. ⁿ¹ marks a single-seed
            cell.
          </Typography>
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card>
          <CardHeader title='What the shape of this chart shows' />
          <CardContent className='flex flex-col gap-3'>
            <Typography>
              All four strategies track each other closely at low measured heterogeneity and separate as it rises. At
              the pathological split — the highest measured H — every strategy collapses, and the gap between
              federated and centralized training is far larger than any gap between strategies.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              FedAvg, FedProx and MOON are separated by fractions of a point across most of the range. Where three
              seeds exist, those gaps sit inside the seed range, so the chart should be read as showing that the
              strategies are hard to tell apart on this benchmark rather than that any one of them wins.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title='SCAFFOLD is the weakest, and the pathological block is unstable' />
          <CardContent className='flex flex-col gap-3'>
            <Typography>
              SCAFFOLD falls behind the other three as heterogeneity rises. On PathMNIST with the pathological split it
              spends <strong>15 of 60 rounds below the chance line</strong>, against 0, 0 and 1 for FedAvg, FedProx and
              MOON — that part is specific to SCAFFOLD and is the strongest evidence against it here.
            </Typography>
            <div className='flex gap-2 flex-wrap'>
              <Chip size='small' variant='tonal' color='warning' label='peak 37.89% at round 48' />
              <Chip size='small' variant='tonal' color='error' label='round 60: 8.24%' />
              <Chip size='small' variant='tonal' color='secondary' label='last 10 rounds: 17.96%' />
              <Chip size='small' variant='tonal' color='default' label='chance = 11.11%' />
            </div>
            <Typography variant='body2' color='text.secondary'>
              But the 8.24% is not a settled endpoint. Every strategy oscillates violently on this configuration —
              4.5 to 11.9 points of movement per round, against about 1.2 elsewhere — so the last round records a phase
              of an oscillation rather than a converged value. SCAFFOLD sat at 24.40% at round 57. MOON&apos;s
              headline 44.21% is the mirror image of the same problem: it was at 22.48% one round earlier and simply
              stopped on an upswing. Both figures are shown here with the mean of their last ten rounds beside them.
            </Typography>
          </CardContent>
        </Card>
      </div>

      <Caveat title='MOON runs under a configuration its authors did not use' severity='info'>
        The contrastive weight is 1.0 against the value of 5 reported as best for CIFAR-10 in the original work, there
        is no projection head, and neither the authors&apos; momentum nor their weight decay is applied. Any comparison
        involving MOON on this site inherits that caveat — it is a result about this configuration of MOON, not about
        MOON as published.
      </Caveat>
    </div>
  )
}

export default Rq1View
