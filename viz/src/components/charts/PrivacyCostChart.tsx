'use client'

// React Imports
import { useMemo, useState } from 'react'

// Component Imports
import ChartFrame from './ChartFrame'
import ChartLegend from './ChartLegend'
import SvgTooltip from './SvgTooltip'

// Type Imports
import type { Dataset } from '@/types/results'

// Lib Imports
import { privacyCostSeries } from '@/lib/results'
import { conditionColour } from './palette'
import { linePath } from '@/lib/chart-geometry.mjs'

type Props = {
  dataset: Dataset
}

/*
 * The RQ2 headline.
 *
 * Accuracy against measured heterogeneity, one line per privacy condition. The
 * shape is the finding: the unprotected line slopes as heterogeneity rises, the
 * protected lines run flat beneath it. The partitions have not become similar —
 * measured Hellinger distance still spans the same range on the x-axis — but
 * accuracy stops responding to it once noise is added.
 *
 * Each point is the mean across the four strategies, with a whisker showing
 * their range. Strategies are deliberately not drawn separately: Phase B is
 * single-seed, and the Phase A seed spread at the same cell is wider than any
 * between-strategy difference at fixed epsilon, so separate lines would invite a
 * ranking the data cannot support.
 */
const PrivacyCostChart = ({ dataset }: Props) => {
  const [hover, setHover] = useState<string | null>(null)

  const series = useMemo(() => privacyCostSeries(dataset), [dataset])

  const all = series.flatMap(s => s.points)
  const yMax = Math.max(...all.map(p => p.max))
  const xMax = Math.max(...all.map(p => p.hellinger))

  const hovered = all.find(p => `${p.partition}` === hover)

  return (
    <div>
      <ChartFrame
        vbHeight={420}
        xDomain={[0, Math.max(xMax * 1.15, 0.7)]}
        yDomain={[0, yMax * 1.15]}
        xLabel='measured mean Hellinger distance'
        yLabel='final test accuracy (%)'
        formatY={v => `${v.toFixed(0)}%`}
      >
        {({ x, y, area }) => (
          <>
            {series.map(s => {
              const colour = conditionColour(s.condition.epsilon)
              const isBaseline = s.condition.epsilon === null

              return (
                <g key={s.condition.key}>
                  {/* range across the four strategies */}
                  {s.points.map(p => (
                    <line
                      key={`w${s.condition.key}${p.partition}`}
                      x1={x(p.hellinger)}
                      x2={x(p.hellinger)}
                      y1={y(p.min)}
                      y2={y(p.max)}
                      stroke={colour}
                      strokeWidth={1}
                      opacity={0.45}
                    />
                  ))}
                  <path
                    d={linePath(s.points.map(p => ({ x: x(p.hellinger), y: y(p.acc) })))}
                    fill='none'
                    stroke={colour}
                    strokeWidth={isBaseline ? 3 : 2}
                    strokeLinejoin='round'
                  />
                  {s.points.map(p => (
                    <circle
                      key={`p${s.condition.key}${p.partition}`}
                      cx={x(p.hellinger)}
                      cy={y(p.acc)}
                      r={isBaseline ? 6 : 4.5}
                      fill={colour}
                      stroke={colour}
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )
            })}

            {/* one hit target per partition, spanning the plot height */}
            {series[0]?.points.map(p => (
              <rect
                key={`hit${p.partition}`}
                x={x(p.hellinger) - 26}
                y={area.y0}
                width={52}
                height={area.height}
                fill='transparent'
                onMouseEnter={() => setHover(p.partition)}
                onMouseLeave={() => setHover(null)}
              />
            ))}

            {hovered && (
              <SvgTooltip
                x={x(hovered.hellinger)}
                y={y(hovered.acc)}
                bounds={area}
                lines={[
                  { text: hovered.partitionLabel ?? hovered.partition, bold: true },
                  { text: `H = ${hovered.hellinger.toFixed(3)}` },
                  ...series.map(s => {
                    const pt = s.points.find(q => q.partition === hovered.partition)

                    return {
                      text: pt ? `${s.condition.label}: ${pt.acc.toFixed(2)}%` : `${s.condition.label}: —`,
                      colour: conditionColour(s.condition.epsilon)
                    }
                  })
                ]}
              />
            )}
          </>
        )}
      </ChartFrame>

      <ChartLegend
        items={series.map(s => ({
          label: s.condition.label,
          colour: conditionColour(s.condition.epsilon)
        }))}
      />
      <p className='text-center mbs-2'>
        <span className='text-textDisabled text-xs'>
          Each point is the mean of four strategies at seed 0; the whisker is their range, not a confidence interval.
        </span>
      </p>
    </div>
  )
}

export default PrivacyCostChart
