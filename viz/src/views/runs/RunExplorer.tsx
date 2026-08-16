'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

// Component Imports
import AccuracyCurveChart from '@/components/charts/AccuracyCurveChart'
import Caveat from '@/components/site/Caveat'
import FigureData from '@/components/site/FigureData'
import LinkButton from '@/components/site/LinkButton'
import RunDetail from '@/components/site/RunDetail'
import RunLink from '@/components/site/RunLink'

// Type Imports
import type { Dataset, Partition, Strategy } from '@/types/results'

// Lib Imports
import {
  PARTITION_ORDER,
  STRATEGY_ORDER,

  collapsed,
  curvePoints,
  endedBelowChance,
  EPSILONS,
  VOLATILITY_THRESHOLD_PTS,
  filterRuns,
  finalGapPts,
  hasUnrepresentativeFinal,
  isVolatile,
  pct,
  volatilityPts
} from '@/lib/results'
import { runHref } from '@/lib/runHref'

const MAX_COMPARE = 6

const STRATEGY_LABEL: Record<Strategy, string> = {
  fedavg: 'FedAvg',
  fedprox: 'FedProx',
  scaffold: 'SCAFFOLD',
  moon: 'MOON'
}

const PARTITION_LABEL: Record<Partition, string> = {
  dir100: 'Dirichlet α = 100',
  'dir1.0': 'Dirichlet α = 1.0',
  'dir0.1': 'Dirichlet α = 0.1',
  quantity: 'Quantity skew β = 0.5',
  path1: 'Pathological, 1 class'
}

const RunExplorer = () => {
  const [dataset, setDataset] = useState<Dataset | 'all'>('all')
  const [strategy, setStrategy] = useState<Strategy | 'all'>('all')
  const [partition, setPartition] = useState<Partition | 'all'>('all')
  const [seed, setSeed] = useState<number | 'all'>('all')
  const [mode, setMode] = useState<'all' | 'federated' | 'centralized'>('all')
  const [privacy, setPrivacy] = useState<'all' | 'none' | number>('all')
  const [metric, setMetric] = useState('test_acc')
  const [selected, setSelected] = useState<string[]>([])
  const [focused, setFocused] = useState<string | null>(null)

  const runs = useMemo(
    () => filterRuns({ dataset, strategy, partition, seed, mode, privacy }),
    [dataset, strategy, partition, seed, mode, privacy]
  )

  const selectedRuns = useMemo(() => runs.filter(r => selected.includes(r.name)), [runs, selected])
  const focusedRun = useMemo(() => runs.find(r => r.name === focused) ?? null, [runs, focused])

  const toggle = (name: string) =>
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length >= MAX_COMPARE ? prev : [...prev, name]
    )

  // Comparing across datasets or across round/epoch units is a category error;
  // the chart warns, but flag it at the point of selection too.
  const mixedDatasets = new Set(selectedRuns.map(r => r.dataset)).size > 1
  const mixedUnits = new Set(selectedRuns.map(r => r.stepUnit)).size > 1

  const metricOptions = useMemo(() => {
    const cols = new Set<string>()

    selectedRuns.forEach(r => r.curve.cols.forEach(c => cols.add(c)))

    return ['test_acc', 'test_loss', 'mean_client_acc', 'client_acc_var'].filter(c => cols.has(c))
  }, [selectedRuns])

  // Selection can change so that the chosen metric no longer exists on any
  // selected run — centralized runs record neither mean_client_acc nor
  // client_acc_var. Fall back rather than rendering an empty chart.
  const activeMetric = metricOptions.includes(metric) ? metric : (metricOptions[0] ?? 'test_acc')

  return (
    <div className='flex flex-col gap-6'>
      <Card>
        <CardHeader title='Filter' subheader={`${runs.length} run${runs.length === 1 ? '' : 's'} match`} />
        <CardContent>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4'>
            <FormControl size='small' fullWidth>
              <InputLabel>Dataset</InputLabel>
              <Select label='Dataset' value={dataset} onChange={e => setDataset(e.target.value as Dataset | 'all')}>
                <MenuItem value='all'>All</MenuItem>
                <MenuItem value='cifar10'>CIFAR-10</MenuItem>
                <MenuItem value='pathmnist'>PathMNIST</MenuItem>
              </Select>
            </FormControl>

            <FormControl size='small' fullWidth>
              <InputLabel>Strategy</InputLabel>
              <Select label='Strategy' value={strategy} onChange={e => setStrategy(e.target.value as Strategy | 'all')}>
                <MenuItem value='all'>All</MenuItem>
                {STRATEGY_ORDER.map(s => (
                  <MenuItem key={s} value={s}>
                    {STRATEGY_LABEL[s]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size='small' fullWidth>
              <InputLabel>Partition</InputLabel>
              <Select
                label='Partition'
                value={partition}
                onChange={e => setPartition(e.target.value as Partition | 'all')}
              >
                <MenuItem value='all'>All</MenuItem>
                {PARTITION_ORDER.map(p => (
                  <MenuItem key={p} value={p}>
                    {PARTITION_LABEL[p]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size='small' fullWidth>
              <InputLabel>Seed</InputLabel>
              <Select
                label='Seed'
                value={seed}
                onChange={e => setSeed(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <MenuItem value='all'>All</MenuItem>
                <MenuItem value={0}>0</MenuItem>
                <MenuItem value={1}>1</MenuItem>
                <MenuItem value={2}>2</MenuItem>
              </Select>
            </FormControl>

            <FormControl size='small' fullWidth>
              <InputLabel>Training</InputLabel>
              <Select label='Training' value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
                <MenuItem value='all'>All</MenuItem>
                <MenuItem value='federated'>Federated</MenuItem>
                <MenuItem value='centralized'>Centralized</MenuItem>
              </Select>
            </FormControl>

            <FormControl size='small' fullWidth>
              <InputLabel>Privacy</InputLabel>
              <Select
                label='Privacy'
                value={privacy}
                onChange={e => setPrivacy(e.target.value === 'all' || e.target.value === 'none' ? e.target.value : Number(e.target.value))}
              >
                <MenuItem value='all'>All</MenuItem>
                <MenuItem value='none'>No mechanism</MenuItem>
                {EPSILONS.map(v => (
                  <MenuItem key={v} value={v}>
                    ε = {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </CardContent>
      </Card>

      {selectedRuns.length > 0 && (
        <Card>
          <CardHeader
            title={`Comparing ${selectedRuns.length} run${selectedRuns.length === 1 ? '' : 's'}`}
            action={
              <div className='flex gap-2 items-center'>
                {metricOptions.length > 1 && (
                  <ToggleButtonGroup exclusive size='small' value={activeMetric} onChange={(_, v) => v && setMetric(v)}>
                    {metricOptions.map(m => (
                      <ToggleButton key={m} value={m}>
                        {m}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )}
                <FigureData
                  filename='comparison'
                  columns={['run', 'step', activeMetric]}
                  rows={selectedRuns.flatMap(r =>
                    curvePoints(r).map(p => [r.name, p[r.stepUnit], p[activeMetric]])
                  )}
                  sources={selectedRuns.map(r => r.name)}
                />
                <Button size='small' variant='tonal' color='secondary' onClick={() => setSelected([])}>
                  Clear
                </Button>
              </div>
            }
          />
          <CardContent>
            {mixedDatasets && (
              <Caveat severity='error' title='Different datasets on one axis'>
                CIFAR-10 has ten classes and PathMNIST nine, so their accuracies are not on a comparable scale and the
                chance line differs. Compare within a dataset.
              </Caveat>
            )}
            {mixedUnits && (
              <Caveat severity='error' title='Rounds and epochs on one axis'>
                Federated runs are measured in communication rounds and centralized runs in training epochs. One round
                is two local epochs across fifteen clients — these units do not correspond, and the x-axis here is
                meaningless.
              </Caveat>
            )}
            <AccuracyCurveChart runs={selectedRuns} metric={activeMetric} colourByStrategy={!mixedDatasets} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          title='Runs'
          subheader={`Select up to ${MAX_COMPARE} to overlay; open a run for its full record`}
          action={
            <FigureData
              filename='runs_table'
              columns={[
                'run','phase','dataset','strategy','partition','seed','target_epsilon','delivered_epsilon',
                'hellinger_mean','final_acc','best_acc','best_step','tail10_mean'
              ]}
              rows={runs.map(r => [
                r.name, r.phase, r.dataset, r.strategyLabel, r.partition, r.seed,
                r.dp?.targetEpsilon ?? null, r.dp?.deliveredEpsilon ?? null,
                r.hellingerMean, r.finalAcc, r.bestAcc, r.bestStep, r.tailMean
              ])}
              sources={runs.map(r => r.name)}
              label='Download this table'
            />
          }
        />
        <CardContent>
          <TableContainer>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox' />
                  <TableCell>Run</TableCell>
                  <TableCell>Strategy</TableCell>
                  <TableCell>Partition</TableCell>
                  <TableCell align='right'>Seed</TableCell>
                  <TableCell align='right'>measured H</TableCell>
                  <TableCell align='right'>Final</TableCell>
                  <TableCell align='right'>Best</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map(r => {
                  const isSel = selected.includes(r.name)
                  const below = endedBelowChance(r)
                  const lost = collapsed(r)
                  const noisy = hasUnrepresentativeFinal(r)

                  return (
                    <TableRow key={r.name} hover selected={focused === r.name}>
                      <TableCell padding='checkbox'>
                        <Checkbox
                          size='small'
                          checked={isSel}
                          disabled={!isSel && selected.length >= MAX_COMPARE}
                          onChange={() => toggle(r.name)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <RunLink name={r.name} />
                          <Tooltip title={focused === r.name ? 'Hide details' : 'Preview details here'}>
                            <IconButton
                              size='small'
                              onClick={() => setFocused(focused === r.name ? null : r.name)}
                              aria-label={focused === r.name ? 'Hide details' : 'Preview details'}
                            >
                              <i
                                className={focused === r.name ? 'tabler-chevron-up text-[16px]' : 'tabler-chevron-down text-[16px]'}
                              />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.isFedAvgM ? (
                          <Tooltip title='A configuration of FedAvg with server momentum, not a separate strategy'>
                            <Chip size='small' variant='tonal' color='secondary' label='FedAvg + momentum' />
                          </Tooltip>
                        ) : (
                          r.strategyLabel
                        )}
                      </TableCell>
                      <TableCell>{r.partitionLabel ?? '—'}</TableCell>
                      <TableCell align='right'>{r.seed ?? '—'}</TableCell>
                      <TableCell align='right'>
                        {r.hellingerMean === null ? '—' : r.hellingerMean.toFixed(3)}
                      </TableCell>
                      <TableCell align='right'>
                        {pct(r.finalAcc)}
                        {noisy && r.tailMean !== null && (
                          <Typography component='span' variant='caption' color='warning.main' className='block'>
                            last 10: {pct(r.tailMean)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align='right'>
                        {pct(r.bestAcc)}
                        {r.bestStep !== null && (
                          <Typography component='span' variant='caption' color='text.secondary'>
                            {' '}
                            @{r.bestStep}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex gap-1 flex-wrap'>
                          {r.dp && (
                            <Tooltip title={`Delivered ε = ${r.dp.deliveredEpsilon.toFixed(4)} — the worst client's realised budget`}>
                              <Chip size='small' variant='tonal' color='secondary' label={`ε = ${r.dp.targetEpsilon}`} />
                            </Tooltip>
                          )}
                          {below && <Chip size='small' variant='tonal' color='error' label='below chance' />}
                          {lost && !below && <Chip size='small' variant='tonal' color='warning' label='lost ground' />}
                          {noisy && (
                            <Tooltip
                              title={`Final value is ${finalGapPts(r)?.toFixed(1)} points from the mean of the last 10 rounds — it records where the oscillation happened to be at round ${r.steps}, not where the run settled.`}
                            >
                              <Chip size='small' variant='tonal' color='error' label='final unrepresentative' />
                            </Tooltip>
                          )}
                          {isVolatile(r) && !noisy && (
                            <Tooltip title={`Mean round-to-round change ${volatilityPts(r)?.toFixed(1)} points`}>
                              <Chip size='small' variant='tonal' color='warning' label='oscillating' />
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {runs.length === 0 && (
            <Typography color='text.secondary' className='mbs-4'>
              No runs match these filters.
            </Typography>
          )}
          <Typography variant='caption' color='text.secondary' className='block mbs-3'>
            &quot;below chance&quot; marks a federated run whose final accuracy is under 1/n for its dataset — it has
            diverged, not merely underfitted. &quot;lost ground&quot; marks a run finishing five or more points below
            its own best. &quot;final unrepresentative&quot; marks a run whose last round sits five or more points from
            the mean of its last ten, so the final figure records a phase of an oscillation rather than a settled
            value; the last-ten mean is shown beneath it. &quot;oscillating&quot; marks a run averaging{' '}
            {VOLATILITY_THRESHOLD_PTS}+ points of change per round.
          </Typography>
        </CardContent>
      </Card>

      {focusedRun && (
        <Card>
          <CardHeader
            title={<RunLink name={focusedRun.name} plain />}
            subheader={`${focusedRun.datasetLabel} · ${focusedRun.strategyLabel}${
              focusedRun.partitionLabel ? ` · ${focusedRun.partitionLabel}` : ''
            } · seed ${focusedRun.seed ?? '—'}`}
            action={
              <div className='flex gap-2'>
                <LinkButton href={runHref(focusedRun.name)} size='small' variant='tonal'>
                  Open full record
                </LinkButton>
                <Button size='small' variant='tonal' color='secondary' onClick={() => setFocused(null)}>
                  Close
                </Button>
              </div>
            }
          />
          <CardContent>
            <RunDetail run={focusedRun} embedded />
          </CardContent>
        </Card>
      )}

    </div>
  )
}

export default RunExplorer
