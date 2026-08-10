'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import { useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'

// Component Imports
import ChartFrame from './ChartFrame'
import SvgTooltip from './SvgTooltip'
import ChartLegend from './ChartLegend'

// Type Imports
import type { Run } from '@/types/results'

// Lib Imports
import { chanceLevel, curvePoints, numClasses } from '@/lib/results'
import { SERIES_COLOURS, CHANCE_COLOUR, colourFor } from './palette'
import { extent, linePath } from '@/lib/chart-geometry.mjs'

type Props = {
  runs: Run[]
  /** 'test_acc' | 'mean_client_acc' | 'test_loss' | 'client_acc_var' */
  metric?: string
  colourByStrategy?: boolean
  showChanceLine?: boolean
}

const AccuracyCurveChart = ({ runs, metric = 'test_acc', colourByStrategy = true, showChanceLine = true }: Props) => {
  const theme = useTheme()
  const [hover, setHover] = useState<number | null>(null)

  const isAccuracy = metric === 'test_acc' || metric === 'mean_client_acc'

  const series = useMemo(
    () =>
      runs.map((run, i) => {
        const pts = curvePoints(run)
          .map(p => {
            const step = p[run.stepUnit]
            const v = p[metric]

            return {
              step: typeof step === 'number' ? step : null,
              value: typeof v === 'number' ? (isAccuracy ? v * 100 : v) : null
            }
          })
          .filter(p => p.step !== null) as { step: number; value: number | null }[]

        return {
          run,
          points: pts,
          colour: colourByStrategy ? colourFor(run.strategy, run.isFedAvgM) : SERIES_COLOURS[i % SERIES_COLOURS.length]
        }
      }),
    [runs, metric, isAccuracy, colourByStrategy]
  )

  const xExtent = useMemo(
    () => extent(series.flatMap(s => s.points.map(p => p.step))) ?? [0, 1],
    [series]
  )

  const yExtent = useMemo(() => {
    const e = extent(series.flatMap(s => s.points.map(p => p.value))) ?? [0, 1]

    // Accuracy reads better anchored at zero; loss does not.
    return isAccuracy ? [0, Math.max(e[1] * 1.08, 1)] : [e[0] - (e[1] - e[0]) * 0.08, e[1] + (e[1] - e[0]) * 0.08]
  }, [series, isAccuracy]) as [number, number]

  // Every step present in any run, for the hover crosshair.
  const steps = useMemo(() => {
    const s = new Set<number>()

    series.forEach(ser => ser.points.forEach(p => s.add(p.step)))

    return [...s].sort((a, b) => a - b)
  }, [series])

  if (!runs.length) return <Typography color='text.secondary'>No runs selected.</Typography>

  const datasets = new Set(runs.map(r => r.dataset))
  const chance = datasets.size === 1 ? chanceLevel(runs[0].dataset) * 100 : null

  const stepUnits = new Set(runs.map(r => r.stepUnit))
  const mixedUnits = stepUnits.size > 1

  const hoverStep = hover === null ? null : steps[hover]

  return (
    <div>
      {mixedUnits && (
        <Typography variant='caption' color='error.main' className='mbe-2 block'>
          These runs are measured in different units ({[...stepUnits].join(' and ')}) and should not share an axis.
        </Typography>
      )}

      <ChartFrame
        xDomain={[xExtent[0], xExtent[1]]}
        yDomain={yExtent}
        xLabel={mixedUnits ? 'step' : runs[0].stepUnit}
        yLabel={isAccuracy ? 'test accuracy (%)' : metric}
        formatY={(v, all) => (isAccuracy ? `${v.toFixed(all.some(t => t % 1) ? 1 : 0)}%` : v.toFixed(2))}
        formatX={v => String(Math.round(v))}
      >
        {({ x, y, area }) => (
          <>
            {showChanceLine && isAccuracy && chance !== null && chance >= yExtent[0] && chance <= yExtent[1] && (
              <>
                <line
                  x1={area.x0}
                  x2={area.x1}
                  y1={y(chance)}
                  y2={y(chance)}
                  stroke={CHANCE_COLOUR}
                  strokeDasharray='6 4'
                />
                <text x={area.x1} y={y(chance) - 5} textAnchor='end' fontSize={11} fill={CHANCE_COLOUR}>
                  chance ({numClasses(runs[0].dataset)} classes) = {chance.toFixed(2)}%
                </text>
              </>
            )}

            {series.map(s => (
              <path
                key={s.run.name}
                d={linePath(s.points.map(p => ({ x: x(p.step), y: p.value === null ? null : y(p.value) })))}
                fill='none'
                stroke={s.colour}
                strokeWidth={2}
                strokeLinejoin='round'
              />
            ))}

            {/* crosshair + markers */}
            {hoverStep !== null && (
              <>
                <line
                  x1={x(hoverStep)}
                  x2={x(hoverStep)}
                  y1={area.y0}
                  y2={area.y1}
                  stroke={theme.palette.text.disabled}
                  strokeDasharray='3 3'
                />
                {series.map(s => {
                  const p = s.points.find(q => q.step === hoverStep)

                  if (!p || p.value === null) return null

                  return <circle key={s.run.name} cx={x(hoverStep)} cy={y(p.value)} r={3.5} fill={s.colour} />
                })}
              </>
            )}

            {/* invisible hit targets, one per step */}
            {steps.map((st, i) => (
              <rect
                key={st}
                x={x(st) - (area.width / Math.max(steps.length, 1)) / 2}
                y={area.y0}
                width={Math.max(area.width / Math.max(steps.length, 1), 1)}
                height={area.height}
                fill='transparent'
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}

            {hoverStep !== null &&
              (() => {
                const rows = series
                  .map(s => ({ s, p: s.points.find(q => q.step === hoverStep) }))
                  .filter(r => r.p && r.p.value !== null)

                if (!rows.length) return null

                const top = rows.reduce((a, b) => ((a.p!.value ?? 0) > (b.p!.value ?? 0) ? a : b))

                return (
                  <SvgTooltip
                    x={x(hoverStep)}
                    y={y(top.p!.value!)}
                    bounds={area}
                    lines={[
                      { text: `${mixedUnits ? 'step' : runs[0].stepUnit} ${hoverStep}`, bold: true },
                      ...rows.map(r => ({
                        text: `${runs.length === 1 ? r.s.run.strategyLabel : r.s.run.name}: ${
                          isAccuracy ? `${r.p!.value!.toFixed(2)}%` : r.p!.value!.toFixed(4)
                        }`,
                        colour: r.s.colour
                      }))
                    ]}
                  />
                )
              })()}
          </>
        )}
      </ChartFrame>

      <ChartLegend
        items={series.map(s => ({
          label: runs.length === 1 ? s.run.strategyLabel : s.run.name,
          colour: s.colour
        }))}
      />
    </div>
  )
}

export default AccuracyCurveChart
