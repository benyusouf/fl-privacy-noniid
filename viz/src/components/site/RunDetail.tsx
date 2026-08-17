'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'

// Component Imports
import AccuracyCurveChart from '@/components/charts/AccuracyCurveChart'
import ClientDistributionChart from '@/components/charts/ClientDistributionChart'
import ClientNoiseChart from '@/components/charts/ClientNoiseChart'
import Caveat from '@/components/site/Caveat'
import FigureData from '@/components/site/FigureData'
import RunFiles from '@/components/site/RunFiles'
import RunLink from '@/components/site/RunLink'

// Type Imports
import type { Run } from '@/types/results'

// Lib Imports
import { bytes, curvePoints, endedBelowChance, hasUnrepresentativeFinal, pct, volatilityPts } from '@/lib/results'

type Props = {
  run: Run
  /** Rendered inside the explorer, where the surrounding card is already there. */
  embedded?: boolean
}

/*
 * The full record of a single run.
 *
 * Shared by the run explorer's inline panel and the per-run page at
 * /runs/<name>, so that a run looks the same wherever it is reached and there is
 * exactly one place to change what a run shows.
 */
const RunDetail = ({ run, embedded = false }: Props) => {
  const Wrapper = embedded ? 'div' : Card
  const Inner = embedded ? 'div' : CardContent

  return (
    <Wrapper>
      {!embedded && (
        <CardHeader
          title={<code className='text-sm'>{run.name}</code>}
          subheader={`${run.datasetLabel} · ${run.strategyLabel}${
            run.partitionLabel ? ` · ${run.partitionLabel}` : ''
          } · seed ${run.seed ?? '—'}`}
        />
      )}
      <Inner className='flex flex-col gap-6'>
        {endedBelowChance(run) && (
          <Caveat severity='error' title='This run diverged'>
            It ends at {pct(run.finalAcc)}, below the chance level for this dataset, having peaked at{' '}
            {pct(run.bestAcc)} at {run.stepUnit} {run.bestStep}. Read this as divergence with a named peak, not as a
            low final score.
          </Caveat>
        )}

        {hasUnrepresentativeFinal(run) && !endedBelowChance(run) && (
          <Caveat title='The final value is not a settled result'>
            This run ends more than five points from the mean of its own last ten {run.stepUnit}s, because the accuracy
            series is still oscillating when it stops. The last-ten mean is {pct(run.tailMean)}.
          </Caveat>
        )}

        <div>
          <div className='flex items-center justify-between gap-2 flex-wrap mbe-2'>
            <Typography variant='subtitle2'>Accuracy</Typography>
            <FigureData
              filename={`${run.name}_accuracy`}
              columns={run.curve.cols}
              rows={curvePoints(run).map(p => run.curve.cols.map(c => p[c]))}
              sources={[run.name]}
            />
          </div>
          <AccuracyCurveChart runs={[run]} metric='test_acc' />
        </div>

        {run.clientSizes && (
          <div>
            <div className='flex items-center justify-between gap-2 flex-wrap mbe-2'>
              <Typography variant='subtitle2'>What the partition produced</Typography>
              <FigureData
                filename={`${run.name}_partition`}
                columns={['client', 'samples', 'hellinger', 'classes_present']}
                rows={run.clientSizes.map((n, i) => [
                  i,
                  n,
                  run.hellingerPerClient?.[i] ?? null,
                  run.classesPerClient?.[i] ?? null
                ])}
                sources={[run.name]}
              />
            </div>
            <ClientDistributionChart run={run} />
          </div>
        )}

        {run.dp && (
          <div>
            <Typography variant='subtitle2' className='mbe-2'>
              Privacy guarantee
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      Delivered ε
                      <Typography variant='caption' color='text.secondary' className='block'>
                        the worst client&apos;s realised budget — the guarantee the federation can claim
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>{run.dp.deliveredEpsilon.toFixed(4)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Target ε (directory label)</TableCell>
                    <TableCell align='right'>
                      {run.dp.targetEpsilon}
                      {!run.dp.labelHonoured && (
                        <Chip size='small' variant='tonal' color='error' label='not honoured' className='mis-2' />
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Granularity / δ / clipping norm</TableCell>
                    <TableCell align='right'>
                      {run.dp.granularity} · {run.dp.delta} · {run.dp.maxGradNorm}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      σ range across clients
                      <Typography variant='caption' color='text.secondary' className='block'>
                        noise is calibrated per client, so the burden is unequal
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      {run.dp.sigmaMin.toFixed(2)} – {run.dp.sigmaMax.toFixed(2)} ({run.dp.sigmaRatio.toFixed(2)}×)
                    </TableCell>
                  </TableRow>
                  {run.comparator && (
                    <TableRow>
                      <TableCell>Measured against</TableCell>
                      <TableCell align='right'>
                        <RunLink name={run.comparator} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <div className='flex items-center justify-between gap-2 flex-wrap mbs-4 mbe-2'>
              <Typography variant='subtitle2'>Noise per client</Typography>
              <FigureData
                filename={`${run.name}_dp_clients`}
                columns={['client', 'n', 'q', 'steps', 'sigma', 'realised_epsilon', 'saturated']}
                rows={run.dp.clients.map(c => [c.client, c.n, c.q, c.steps, c.sigma, c.realised_epsilon, c.saturated])}
                sources={[run.name]}
              />
            </div>
            <ClientNoiseChart run={run} />
          </div>
        )}

        {run.secagg && (
          <div>
            <Typography variant='subtitle2' className='mbe-2'>
              Secure aggregation
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableBody>
                  <TableRow>
                    <TableCell>Masking</TableCell>
                    <TableCell align='right'>
                      {run.secagg.enabled ? 'enabled' : 'plain control — costs are zero by construction'}
                    </TableCell>
                  </TableRow>
                  {run.secagg.enabled && (
                    <>
                      <TableRow>
                        <TableCell>
                          Masking / aggregation
                          <Typography variant='caption' color='text.secondary' className='block'>
                            processor seconds per round, not elapsed
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          {run.secagg.maskProcessorSecondsPerRound.toFixed(4)} /{' '}
                          {run.secagg.aggregateProcessorSecondsPerRound.toFixed(4)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          Key agreement per round
                          <Typography variant='caption' color='text.secondary' className='block'>
                            recorded by this implementation / protocol figure n(n−1)
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          {run.secagg.keyAgreementMessagesPerRound} / {run.secagg.keyAgreementMessagesProtocol}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                  {run.secagg.pair && (
                    <TableRow>
                      <TableCell>Plain pair</TableCell>
                      <TableCell align='right'>
                        <RunLink name={run.secagg.pair} />
                      </TableCell>
                    </TableRow>
                  )}
                  {run.secagg.equals && (
                    <TableRow>
                      <TableCell>
                        Reproduces
                        <Typography variant='caption' color='text.secondary' className='block'>
                          the Phase A run this control run matches exactly
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <RunLink name={run.secagg.equals} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        )}

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <div>
            <Typography variant='subtitle2' className='mbe-2'>
              Recorded quantities
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableBody>
                  <TableRow>
                    <TableCell>Steps recorded</TableCell>
                    <TableCell align='right'>
                      {run.steps} {run.stepUnit}s
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Final / best accuracy</TableCell>
                    <TableCell align='right'>
                      {pct(run.finalAcc)} / {pct(run.bestAcc)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Mean of last ten / round-to-round change</TableCell>
                    <TableCell align='right'>
                      {pct(run.tailMean)} / {volatilityPts(run)?.toFixed(2) ?? '—'} pts
                    </TableCell>
                  </TableRow>
                  {run.hellingerMean !== null && (
                    <TableRow>
                      <TableCell>Hellinger mean / max</TableCell>
                      <TableCell align='right'>
                        {run.hellingerMean.toFixed(4)} / {run.hellingerMax?.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  )}
                  {run.bytesUpPerRound !== null && (
                    <TableRow>
                      <TableCell>
                        Uplink per round
                        <Typography variant='caption' color='text.secondary' className='block'>
                          analytic, not measured
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>{bytes(run.bytesUpPerRound)}</TableCell>
                    </TableRow>
                  )}
                  {run.secondsPerRound !== null && (
                    <TableRow>
                      <TableCell>
                        Seconds per round
                        <Typography variant='caption' color='error.main' className='block'>
                          unreliable — see Limitations
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>{run.secondsPerRound.toFixed(1)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          <div>
            <Typography variant='subtitle2' className='mbe-2'>
              Configuration as executed
            </Typography>
            <Typography variant='caption' color='text.secondary' className='block mbe-2'>
              Verbatim from <code>config_used.json</code> — the authoritative record of what this run actually did.
            </Typography>
            <pre className='text-xs overflow-auto max-bs-[380px] p-4 rounded bg-actionHover'>
              {JSON.stringify(run.config, null, 2)}
            </pre>
          </div>
        </div>

        <div>
          <Typography variant='subtitle2' className='mbe-2'>
            Published files
          </Typography>
          <RunFiles run={run} />
        </div>
      </Inner>
    </Wrapper>
  )
}

export default RunDetail
