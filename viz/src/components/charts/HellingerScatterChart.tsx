'use client'

// React Imports
import { useMemo, useState } from 'react'

// Component Imports
import ChartFrame from './ChartFrame'
import ChartLegend from './ChartLegend'
import SvgTooltip from './SvgTooltip'

// Type Imports
import type { Dataset, Strategy } from '@/types/results'

// Lib Imports
import { STRATEGY_ORDER, centralizedBaseline, chanceLevel, rq1Points } from '@/lib/results'
import { CENTRALIZED_COLOUR, CHANCE_COLOUR, CHART_TEXT, STRATEGY_COLOURS, STRATEGY_MARKERS } from './palette'
import { linePath } from '@/lib/chart-geometry.mjs'

type Props = {
  dataset: Dataset
  /**
   * Linked highlighting with the table beside the chart: the strategy (and,
   * optionally, partition) the reader is pointing at anywhere on the page.
   */
  focus?: { strategy: Strategy; partition?: string | null } | null
  onFocus?: (f: { strategy: Strategy; partition?: string | null } | null) => void
}

/** Marker shapes give every strategy a second, non-colour identity. */
const Marker = ({
  shape,
  cx,
  cy,
  r,
  fill,
  stroke
}: {
  shape: 'circle' | 'square' | 'triangle' | 'diamond'
  cx: number
  cy: number
  r: number
  fill: string
  stroke: string
}) => {
  const common = { fill, stroke, strokeWidth: 2 }

  if (shape === 'square') return <rect x={cx - r * 0.9} y={cy - r * 0.9} width={r * 1.8} height={r * 1.8} rx={1.5} {...common} />
  if (shape === 'triangle')
    return <path d={`M ${cx} ${cy - r * 1.15} L ${cx + r * 1.05} ${cy + r * 0.8} L ${cx - r * 1.05} ${cy + r * 0.8} Z`} {...common} />
  if (shape === 'diamond')
    return <path d={`M ${cx} ${cy - r * 1.2} L ${cx + r * 1.2} ${cy} L ${cx} ${cy + r * 1.2} L ${cx - r * 1.2} ${cy} Z`} {...common} />

  return <circle cx={cx} cy={cy} r={r} {...common} />
}

const LABEL: Record<Strategy, string> = {
  fedavg: 'FedAvg',
  fedprox: 'FedProx',
  scaffold: 'SCAFFOLD',
  moon: 'MOON'
}

/*
 * The headline RQ1 view.
 *
 * Accuracy is plotted against *measured* mean Hellinger distance, never against
 * the Dirichlet alpha that generated the partition. Reporting heterogeneity as
 * the measured quantity is a central methodological commitment of the study, and
 * it is also the more honest axis: alpha is what was asked for, Hellinger is what
 * was obtained.
 *
 * Error bars span min to max across seeds — a range, not a standard deviation or
 * a confidence interval. With n = 3 the range is the statistic that does not
 * overstate what is known. Single-seed points carry no bar and are drawn hollow.
 */
const HellingerScatterChart = ({ dataset, focus = null, onFocus }: Props) => {
  const [hover, setHover] = useState<string | null>(null)
  const dimmed = (s: Strategy) => focus !== null && focus.strategy !== s

  const points = useMemo(() => rq1Points(dataset), [dataset])
  const baseline = useMemo(() => centralizedBaseline(dataset), [dataset])

  const byStrategy = useMemo(
    () =>
      STRATEGY_ORDER.map(s => ({
        strategy: s,
        colour: STRATEGY_COLOURS[s],
        points: points.filter(p => p.strategy === s)
      })).filter(g => g.points.length > 0),
    [points]
  )

  const chance = chanceLevel(dataset) * 100

  const yMax = Math.max(
    ...points.map(p => p.yMax),
    baseline?.max ?? 0,
    chance
  )

  const hovered = points.find(p => p.key === hover) ?? null

  return (
    <div>
      <ChartFrame
        vbHeight={420}
        xDomain={[0, 0.9]}
        yDomain={[0, yMax * 1.1]}
        xLabel='measured mean Hellinger distance'
        yLabel='final test accuracy (%)'
        formatY={v => `${v.toFixed(0)}%`}
      >
        {({ x, y, area }) => (
          <>
            {/* chance line */}
            <line x1={area.x0} x2={area.x1} y1={y(chance)} y2={y(chance)} stroke={CHANCE_COLOUR} strokeDasharray='6 4' />
            <text x={area.x1} y={y(chance) + 14} textAnchor='end' fontSize={11} fill={CHART_TEXT}>
              chance = {chance.toFixed(2)}%
            </text>

            {/* centralized baseline */}
            {baseline && (
              <>
                <line
                  x1={area.x0}
                  x2={area.x1}
                  y1={y(baseline.mean)}
                  y2={y(baseline.mean)}
                  stroke={CENTRALIZED_COLOUR}
                  strokeDasharray='4 4'
                />
                <text x={area.x1} y={y(baseline.mean) - 6} textAnchor='end' fontSize={11} fill={CHART_TEXT}>
                  centralized {baseline.mean.toFixed(2)}% {baseline.singleSeed ? '(n=1)' : `(n=${baseline.n})`}
                </text>
              </>
            )}

            {/* one connecting line per strategy, in ascending heterogeneity */}
            {byStrategy.map(g => (
              <path
                key={`l${g.strategy}`}
                d={linePath(g.points.map(p => ({ x: x(p.x), y: y(p.y) })))}
                fill='none'
                stroke={g.colour}
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                opacity={dimmed(g.strategy) ? 0.12 : focus ? 0.9 : 0.55}
                style={{ transition: 'opacity 200ms' }}
              />
            ))}

            {/* error bars, then markers */}
            {byStrategy.map(g =>
              g.points.map(p =>
                p.singleSeed ? null : (
                  <g key={`e${p.key}`} stroke={g.colour} strokeWidth={1.5} opacity={dimmed(g.strategy) ? 0.15 : 1} style={{ transition: 'opacity 200ms' }}>
                    <line x1={x(p.x)} x2={x(p.x)} y1={y(p.yMin)} y2={y(p.yMax)} />
                    <line x1={x(p.x) - 4} x2={x(p.x) + 4} y1={y(p.yMin)} y2={y(p.yMin)} />
                    <line x1={x(p.x) - 4} x2={x(p.x) + 4} y1={y(p.yMax)} y2={y(p.yMax)} />
                  </g>
                )
              )
            )}

            {byStrategy.map(g =>
              g.points.map(p => (
                <g
                  key={`p${p.key}`}
                  onMouseEnter={() => {
                    setHover(p.key)
                    onFocus?.({ strategy: g.strategy, partition: p.partition })
                  }}
                  onMouseLeave={() => {
                    setHover(null)
                    onFocus?.(null)
                  }}
                  style={{ cursor: 'pointer', transition: 'opacity 200ms' }}
                  opacity={dimmed(g.strategy) ? 0.18 : 1}
                >
                  <circle cx={x(p.x)} cy={y(p.y)} r={12} fill='transparent' />
                  <Marker
                    shape={STRATEGY_MARKERS[g.strategy]}
                    cx={x(p.x)}
                    cy={y(p.y)}
                    r={hover === p.key || (focus?.strategy === g.strategy && focus?.partition === p.partition) ? 7 : 5}
                    fill={p.singleSeed ? 'var(--viz-surface)' : g.colour}
                    stroke={g.colour}
                  />
                </g>
              ))
            )}

            {hovered && (
              <SvgTooltip
                x={x(hovered.x)}
                y={y(hovered.y)}
                bounds={area}
                lines={[
                  { text: hovered.strategyLabel, bold: true },
                  { text: hovered.partitionLabel ?? '' },
                  { text: `H = ${hovered.x.toFixed(3)}` },
                  {
                    text: hovered.singleSeed
                      ? `${hovered.y.toFixed(2)}%  (single seed)`
                      : `${hovered.y.toFixed(2)}%  (mean of ${hovered.n}; ${hovered.yMin.toFixed(2)}–${hovered.yMax.toFixed(2)})`
                  }
                ]}
              />
            )}
          </>
        )}
      </ChartFrame>

      <ChartLegend
        items={byStrategy.map(g => ({ label: LABEL[g.strategy], colour: g.colour, key: g.strategy, marker: STRATEGY_MARKERS[g.strategy] }))}
        active={focus?.strategy ?? null}
        onActive={k => onFocus?.(k ? { strategy: k as Strategy } : null)}
      />
      <p className='text-center mbs-2'>
        <span className='text-textSecondary text-xs'>
          Hollow markers are single-seed points and carry no error bar. Bars span min–max across seeds.
        </span>
      </p>
    </div>
  )
}

export default HellingerScatterChart
