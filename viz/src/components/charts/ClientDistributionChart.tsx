'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

// Component Imports
import ChartFrame from './ChartFrame'
import ChartLegend from './ChartLegend'
import SvgTooltip from './SvgTooltip'

// Type Imports
import type { Run } from '@/types/results'

// Lib Imports
import { bandScale, extent, subBands } from '@/lib/chart-geometry.mjs'

type Props = {
  run: Run
}

const SIZE_COLOUR = '#666CFF'
const HELLINGER_COLOUR = '#FDB528'

/*
 * Per-client view of what the partition protocol actually produced.
 *
 * Two quantities per client: how much data it holds, and how far its label
 * distribution sits from the global one. The mean Hellinger line is drawn so
 * that the single summary number used on the RQ1 chart can be seen against the
 * spread it summarises — at alpha = 0.1 the per-client values vary widely, and
 * the mean alone hides that.
 *
 * Two independent y-scales are in play, so each series is labelled with its own
 * axis and the two are given clearly different colours.
 */
const ClientDistributionChart = ({ run }: Props) => {
  const theme = useTheme()
  const [hover, setHover] = useState<number | null>(null)

  const data = useMemo(() => {
    if (!run.clientSizes) return []

    return run.clientSizes.map((size, i) => ({
      i,
      size,
      hellinger: run.hellingerPerClient?.[i] ?? null,
      classes: run.classesPerClient?.[i] ?? null
    }))
  }, [run])

  if (!data.length) {
    return (
      <Typography color='text.secondary'>
        No partition report — centralized runs have no clients to partition across.
      </Typography>
    )
  }

  const sizeMax = (extent(data.map(d => d.size)) ?? [0, 1])[1]

  return (
    <div>
      <ChartFrame
        vbHeight={320}
        margin={{ top: 16, right: 56, bottom: 44, left: 64 }}
        xDomain={[0, data.length]}
        yDomain={[0, sizeMax * 1.1]}
        xLabel='client'
        yLabel='training samples'
        xTickCount={Math.min(data.length, 8)}
        formatX={v => String(Math.round(v))}
        formatY={v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
      >
        {({ y, area }) => {
          const band = bandScale(data.length, area.x0, area.x1, 0.25)
          const sub = subBands(band.barWidth, 2)

          // Hellinger is on 0..1; map it onto the same pixel band as sizes.
          const hy = (h: number) => area.y1 - h * area.height

          return (
            <>
              {/* right-hand axis for Hellinger */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => (
                <text
                  key={`h${t}`}
                  x={area.x1 + 8}
                  y={hy(t)}
                  dominantBaseline='middle'
                  fontSize={11}
                  fill={HELLINGER_COLOUR}
                >
                  {t.toFixed(2)}
                </text>
              ))}
              <text
                transform={`translate(${area.x1 + 46} ${(area.y0 + area.y1) / 2}) rotate(90)`}
                textAnchor='middle'
                fontSize={12}
                fill={HELLINGER_COLOUR}
              >
                Hellinger distance
              </text>

              {run.hellingerMean !== null && (
                <>
                  <line
                    x1={area.x0}
                    x2={area.x1}
                    y1={hy(run.hellingerMean)}
                    y2={hy(run.hellingerMean)}
                    stroke={HELLINGER_COLOUR}
                    strokeDasharray='5 4'
                  />
                  <text x={area.x0 + 4} y={hy(run.hellingerMean) - 5} fontSize={11} fill={HELLINGER_COLOUR}>
                    mean H = {run.hellingerMean.toFixed(3)}
                  </text>
                </>
              )}

              {data.map(d => (
                <g key={d.i}>
                  <rect
                    x={band.start(d.i) + sub.offset(0)}
                    y={y(d.size)}
                    width={sub.width}
                    height={Math.max(area.y1 - y(d.size), 0)}
                    fill={SIZE_COLOUR}
                    opacity={hover === null || hover === d.i ? 1 : 0.45}
                  />
                  {d.hellinger !== null && (
                    <rect
                      x={band.start(d.i) + sub.offset(1)}
                      y={hy(d.hellinger)}
                      width={sub.width}
                      height={Math.max(area.y1 - hy(d.hellinger), 0)}
                      fill={HELLINGER_COLOUR}
                      opacity={hover === null || hover === d.i ? 1 : 0.45}
                    />
                  )}
                  <rect
                    x={band.center(d.i) - band.band / 2}
                    y={area.y0}
                    width={band.band}
                    height={area.height}
                    fill='transparent'
                    onMouseEnter={() => setHover(d.i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              ))}

              {hover !== null && data[hover] && (
                <SvgTooltip
                  x={band.center(hover)}
                  y={y(data[hover].size)}
                  bounds={area}
                  lines={[
                    { text: `client ${hover}`, bold: true },
                    { text: `${data[hover].size.toLocaleString()} samples`, colour: SIZE_COLOUR },
                    {
                      text: `H = ${data[hover].hellinger?.toFixed(4) ?? '—'}`,
                      colour: HELLINGER_COLOUR
                    },
                    { text: `${data[hover].classes ?? '—'} classes present`, colour: theme.palette.text.secondary }
                  ]}
                />
              )}
            </>
          )
        }}
      </ChartFrame>

      <ChartLegend
        items={[
          { label: 'training samples', colour: SIZE_COLOUR, note: '(left axis)' },
          { label: 'Hellinger distance', colour: HELLINGER_COLOUR, note: '(right axis)' }
        ]}
      />
    </div>
  )
}

export default ClientDistributionChart
