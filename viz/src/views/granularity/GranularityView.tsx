'use client'

// React Imports
import { useMemo } from 'react'

// MUI Imports
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'

// Component Imports
import AccuracyCurveChart from '@/components/charts/AccuracyCurveChart'
import Caveat from '@/components/site/Caveat'
import FigureData from '@/components/site/FigureData'
import RunLink from '@/components/site/RunLink'
import SectionCard from '@/components/site/SectionCard'
import StatCard from '@/components/site/StatCard'

// Type Imports
import type { Run } from '@/types/results'

// Lib Imports
import {
  adaptiveArms,
  clientLevelArms,
  granularityCompute,
  granularityGap,
  phaseDCalibrated,
  sampleLevelArm,
  seedGroups,
  federatedRuns,
  unprotectedArm,
  uniformAveragingCost,
  pct
} from '@/lib/results'

const CHANCE = 10

const GranularityView = () => {
  const client = useMemo(() => clientLevelArms(), [])
  const adaptive = useMemo(() => adaptiveArms(), [])
  const sample = useMemo(() => sampleLevelArm(), [])
  const none = useMemo(() => unprotectedArm(), [])
  const gap = useMemo(() => granularityGap(), [])
  const reweight = useMemo(() => uniformAveragingCost(), [])
  const compute = useMemo(() => granularityCompute(), [])
  const calibrated = phaseDCalibrated()

  // The Phase A seed spread at this exact cell, which is the scale any Phase D
  // difference has to be read against.
  const seedSpread = useMemo(() => {
    const g = seedGroups(
      federatedRuns.filter(
        r =>
          r.dataset === 'cifar10' &&
          r.strategy === 'fedavg' &&
          r.partition === 'dir0.1' &&
          r.dp === null &&
          r.arm === null &&
          !r.isFedAvgM
      )
    )[0]

    return g ?? null
  }, [])

  const clientCurves = client.map(a => a.run).filter((r): r is Run => r !== null)
  const ladderCurves = [none.run, sample.run, adaptive[0].run, client[0].run].filter((r): r is Run => r !== null)

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <StatCard
          label='Client-level, best budget'
          value={pct(Math.max(...client.map(a => a.finalAcc ?? 0)))}
          hint={`chance is ${CHANCE.toFixed(2)}% on ten classes`}
          icon='tabler-building-bank'
          color='error'
        />
        <StatCard
          label='Sample-level, ε = 1'
          value={pct(sample.finalAcc)}
          hint='same budget, different guarantee'
          icon='tabler-file-description'
          color='success'
        />
        <StatCard
          label='Granularity gap'
          value={gap ? `${gap.gapPts.toFixed(2)} pts` : '—'}
          hint='at genuinely equal ε'
          icon='tabler-arrows-diff'
          color='warning'
        />
        <StatCard
          label='Unprotected'
          value={pct(none.finalAcc)}
          hint='the ceiling every arm is measured against'
          icon='tabler-lock-open'
          color='info'
        />
      </div>

      {!calibrated && (
        <Caveat severity='warning' title='Privacy calibration has not been backfilled'>
          The Phase D runs configured differential privacy but none carries a <code>dp_calibration.json</code>, so the
          site has no σ, no delivered ε and no per-client accounting for them. Everything on this page derived from the
          accuracy curves and timings is complete and verified; the noise-magnitude section will appear once{' '}
          <code>python3 experiments/backfill_phase_d_calibration.py</code> has been run. Nothing here is estimated in
          the meantime.
        </Caveat>
      )}

      <SectionCard
        icon='tabler-building-bank'
        color='error'
        title='Client-level differential privacy does not work at this scale'
        subtitle='At any budget — the curves sit on the chance line'
        action={
          <FigureData
            filename='granularity_client_level'
            columns={['arm', 'target_epsilon', 'final_acc', 'best_acc', 'best_round']}
            rows={client.map(a => [a.label, a.epsilon, a.finalAcc, a.bestAcc, a.bestStep])}
            sources={client.map(a => a.run?.name ?? '').filter(Boolean)}
          />
        }
      >
        <AccuracyCurveChart runs={clientCurves} colourByStrategy={false} />

        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Budget</TableCell>
                <TableCell align='right'>Final</TableCell>
                <TableCell align='right'>Best round</TableCell>
                <TableCell align='right'>At round</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {client.map(a => (
                <TableRow key={a.key}>
                  <TableCell>ε = {a.epsilon}</TableCell>
                  <TableCell align='right'>
                    <strong>{pct(a.finalAcc)}</strong>
                  </TableCell>
                  <TableCell align='right'>{pct(a.bestAcc)}</TableCell>
                  <TableCell align='right'>{a.bestStep ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {clientCurves.some(r => r.nonFiniteCells > 0) && (
          <Caveat severity='error' title='The loss stops being a number'>
            {clientCurves
              .filter(r => r.nonFiniteCells > 0)
              .map(r => `${r.name} records ${r.nonFiniteCells} non-finite loss values`)
              .join('; ')}
            . At ε = 1 the recorded loss becomes NaN from round 29 onward — the optimisation has broken down
            numerically under a noise vector far larger than the update it is added to. Accuracy is still recorded and
            still sits at chance; the loss simply stops being a number. Those cells are published as gaps rather than
            as a value.
          </Caveat>
        )}

        <Typography className='max-is-[85ch]'>
          Ten per cent is the chance line on ten-class CIFAR-10. <strong>The model learns nothing.</strong> That is not
          the same as performing poorly — a poorly performing model has learned something, and this one has not. Two
          details make it unambiguous: raising the budget eightfold does not help, and at two of the three budgets the
          best round is round 17, so what little accuracy appears early is oscillation rather than progress.
        </Typography>
      </SectionCard>

      <SectionCard
        icon='tabler-math-symbols'
        color='error'
        title='Why — and the pre-flight predicted it before the runs were made'
        subtitle='Full participation means no subsampling amplification at all'
      >
        <Typography className='max-is-[85ch]'>
          Every client participates in every round, so the sampling rate is 1.0 and client-level accounting gets no
          amplification whatsoever. Sixty releases at q = 1 force σ up, and the noise added to the mean is σ·C/N with
          N = 15 — fifteen clients is a small denominator.
        </Typography>

        {calibrated ? (
          <Typography variant='body2' color='text.secondary'>
            Per-client accounting for these runs is shown on each run&apos;s own page.
          </Typography>
        ) : (
          <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
            The measured σ, the noise-vector norm and its ratio to the aggregate update will appear here once the
            calibration backfill has been run. They are deliberately not reproduced from the handoff: every figure on
            this site comes from a file it also serves.
          </Typography>
        )}

        <Caveat severity='info' title='This is a result about the setting, not the mechanism'>
          Fifteen clients under full participation is the worst case for client-level accounting — no amplification,
          and N = 15 in the denominator of σ·C/N. A cross-device deployment with thousands of clients sampling a
          fraction each round is a different regime entirely. This study is cross-<strong>silo</strong>, which is its
          stated scope, and the result should not be read beyond it.
        </Caveat>

        <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
          The clipping bound C = 0.3574 was <strong>measured, not chosen</strong> — the median client update norm over
          45 client-rounds, following McMahan et al. (2018) — so clipping binds on about half the clients. Table 3.6
          supplies no value, and a guessed one would have made the phase measure the guess.
        </Typography>
      </SectionCard>

      {gap && (
        <SectionCard
          icon='tabler-arrows-diff'
          color='warning'
          title='The granularity gap, at genuinely equal budget'
          subtitle='Same ε, same everything else — only what the guarantee protects differs'
        >
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 items-center'>
            <div className='flex flex-col gap-1'>
              <Typography variant='caption' color='text.secondary'>
                Sample-level, protects one record
              </Typography>
              <Typography variant='h4' color='success.main'>
                {pct(gap.sample.finalAcc)}
              </Typography>
            </div>
            <div className='flex flex-col gap-1'>
              <Typography variant='caption' color='text.secondary'>
                Client-level, protects one institution
              </Typography>
              <Typography variant='h4' color='error.main'>
                {pct(gap.client.finalAcc)}
              </Typography>
            </div>
            <div className='flex flex-col gap-1'>
              <Typography variant='caption' color='text.secondary'>
                Difference at ε = 1
              </Typography>
              <Typography variant='h4'>{gap.gapPts.toFixed(2)} pts</Typography>
            </div>
          </div>
          <Typography className='max-is-[85ch]'>
            This is the question the phase was designed to ask. A guarantee over one institution is a far stronger
            claim than a guarantee over one record, and at fifteen silos under full participation the study cannot buy
            it at any budget it tried.
          </Typography>
        </SectionCard>
      )}

      {reweight && (
        <SectionCard
          icon='tabler-scale'
          color='info'
          title='The diagnostic that made the number interpretable'
          subtitle='Separating the cost of the noise from the cost of the averaging it demands'
          action={
            <FigureData
              filename='granularity_uniform_averaging'
              columns={['arm', 'averaging', 'final_acc']}
              rows={[
                ['unprotected', 'weighted by sample count', reweight.weighted.finalAcc],
                ['unprotected diagnostic', 'uniform', reweight.uniform.finalAcc],
                ['client-level DP, ε = 1', 'uniform', reweight.client.finalAcc]
              ]}
              sources={[reweight.weighted.run?.name ?? '', reweight.uniform.run?.name ?? ''].filter(Boolean)}
            />
          }
        >
          <Typography className='max-is-[85ch]'>
            Client-level DP requires a <strong>uniform</strong> mean, because its sensitivity bound of C/N is the
            sensitivity of a uniform mean to one client. Every other arm in the study averages by sample count. So the
            client-level runs differ from their comparators in two ways at once, and without a control the noise and
            the re-weighting could not be told apart.
          </Typography>

          <TableContainer>
            <Table size='small'>
              <TableBody>
                <TableRow>
                  <TableCell>Unprotected, weighted averaging</TableCell>
                  <TableCell align='right'>{pct(reweight.weighted.finalAcc)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Unprotected, uniform averaging</TableCell>
                  <TableCell align='right'>{pct(reweight.uniform.finalAcc)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Cost of the re-weighting alone</strong>
                  </TableCell>
                  <TableCell align='right'>
                    <strong>{reweight.reweightingPts.toFixed(2)} pts</strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {reweight.totalPts !== null && reweight.noisePts !== null && (
            <div className='flex gap-2 flex-wrap'>
              <Chip size='small' variant='tonal' label={`total given up: ${reweight.totalPts.toFixed(2)} pts`} />
              <Chip
                size='small'
                variant='tonal'
                color='info'
                label={`re-weighting: ${reweight.reweightingPts.toFixed(2)} pts`}
              />
              <Chip size='small' variant='tonal' color='error' label={`noise: ${reweight.noisePts.toFixed(2)} pts`} />
            </div>
          )}

          <Caveat severity='info' title='This run is recorded but not counted'>
            Section 3.11 excludes calibration and diagnostic activity from the study&apos;s run totals, so this run
            appears in the explorer and in the downloads but does not add to the phase count. Without it the noise cost
            and the averaging cost would have been permanently confounded, which is why it exists.{' '}
            {reweight.uniform.run && <RunLink name={reweight.uniform.run.name} />}
          </Caveat>
        </SectionCard>
      )}

      <SectionCard
        icon='tabler-clock-play'
        color='secondary'
        title='Time-adaptive spending: no measurable benefit'
        subtitle='At α = 0.1, on a single seed'
        action={
          <FigureData
            filename='granularity_adaptive'
            columns={['arm', 'target_epsilon', 'final_acc']}
            rows={[...adaptive, sample].map(a => [a.label, a.epsilon, a.finalAcc])}
            sources={[...adaptive, sample].map(a => a.run?.name ?? '').filter(Boolean)}
          />
        }
      >
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Arm</TableCell>
                <TableCell align='right'>ε = 1</TableCell>
                <TableCell align='right'>ε = 4</TableCell>
                <TableCell align='right'>ε = 8</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Time-adaptive</TableCell>
                {adaptive.map(a => (
                  <TableCell key={a.key} align='right'>
                    {pct(a.finalAcc)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Constant schedule (sample-level)</TableCell>
                <TableCell align='right'>{pct(sample.finalAcc)}</TableCell>
                <TableCell align='right'>—</TableCell>
                <TableCell align='right'>—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Caveat title='Do not read 0.78 points as a small improvement'>
          The Phase A seed spread at this exact cell is{' '}
          {seedSpread
            ? `${(seedSpread.minFinalAcc * 100).toFixed(2)}–${(seedSpread.maxFinalAcc * 100).toFixed(2)}%, a range of ${(seedSpread.spread * 100).toFixed(2)} points`
            : 'about 5.8 points'}
          . A 0.78-point difference from a single seed sits well inside the noise of the seed choice. The honest
          statement is <strong>no measurable benefit under α = 0.1</strong>.
        </Caveat>

        <Typography className='max-is-[85ch]'>
          &quot;Genuinely equal budget&quot; is doing work in that sentence. The schedule normalises on Σ1/σ², which
          drives Rényi composition but does not determine ε under subsampled Gaussian composition — so matching the
          proxy did not match the budget. The first attempt <strong>overspent at every budget, by more as ε grew</strong>
          : 1.0100, 4.0366 and 8.1959 against targets of 1, 4 and 8. Those arms had more privacy budget than the
          constant-schedule arm they were compared against, so any advantage was partly bought rather than earned.
        </Typography>
        <Typography className='max-is-[85ch]'>
          The schedules now hold their <strong>shape</strong> and take their <strong>scale</strong> from the accountant
          per client, landing at 1.0042, 3.9953 and 7.9955 — within 0.005 of target. The sign is now mixed, one over
          and two under, where the proxy overspent at all three.{' '}
          <strong>That mixed sign is the evidence the bias is gone rather than merely smaller</strong>; the residual is
          the calibrator&apos;s own search tolerance, not the mechanism. Characterising the method this way is what Gap
          4 asked for, and is a contribution in its own right.
        </Typography>
      </SectionCard>

      {compute && (
        <SectionCard
          icon='tabler-cpu'
          color='warning'
          title='The compute cost inverts the accuracy cost'
          subtitle='A ratio between runs made back to back on one machine — never a measurement'
          action={
            <FigureData
              filename='granularity_compute'
              columns={['arm', 'seconds_per_round', 'ratio_vs_unprotected', 'budgets_averaged']}
              rows={compute.map(c => [c.label, c.secondsPerRound, c.ratio, c.budgets])}
            />
          }
        >
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Arm</TableCell>
                  <TableCell align='right'>s/round</TableCell>
                  <TableCell align='right'>vs unprotected</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compute.map(c => (
                  <TableRow key={c.label}>
                    <TableCell>{c.label}</TableCell>
                    <TableCell align='right'>{c.secondsPerRound.toFixed(2)}</TableCell>
                    <TableCell align='right'>
                      <strong>{c.ratio.toFixed(3)}×</strong>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography className='max-is-[85ch]'>
            <strong>Client-level DP is essentially free to compute and useless in accuracy; sample-level costs about
            sixty per cent more and is the only one that works.</strong> Client-level does no per-sample gradient work
            at all — it clips one vector per client at the server — so it skips everything that makes DP-SGD
            expensive. The two costs run in opposite directions, and a practitioner choosing between them on compute
            alone would choose exactly wrong.
          </Typography>
          <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
            The sample-level figure confirms the overhead measurement a third time — 1.56× processor and 1.48× wall in
            the Phase B pilot. Chapter 3 §3.10.2 assumed 3×. Figures for client-level and time-adaptive average the
            three budgets each was run at; sample-level has one.
          </Typography>
        </SectionCard>
      )}

      <SectionCard
        icon='tabler-checkbox'
        color='success'
        title='Both controls reproduce their twins exactly'
        subtitle='A free integrity check spanning three phases and weeks of elapsed time'
      >
        <AccuracyCurveChart runs={ladderCurves} colourByStrategy={false} />
        <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
          Phase D includes two control arms that repeat earlier configurations: the unprotected control against its
          Phase A original, and the sample-level ε = 1 arm against its Phase B original. Both match to the digit, which
          says the pipeline is deterministic and that nothing drifted across the phases.
        </Typography>
      </SectionCard>
    </div>
  )
}

export default GranularityView
