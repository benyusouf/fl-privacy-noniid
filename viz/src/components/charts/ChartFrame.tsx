'use client'

// React Imports
import type { ReactNode } from 'react'

// MUI Imports
import { useTheme } from '@mui/material/styles'

// Geometry Imports
import { DEFAULT_MARGIN, formatTick, niceTicks, plotArea, scaleLinear } from '@/lib/chart-geometry.mjs'

export type Scales = {
  x: (v: number) => number
  y: (v: number) => number
  area: { x0: number; y0: number; x1: number; y1: number; width: number; height: number }
}

type Props = {
  /** viewBox width/height. The SVG scales to its container; these set the aspect ratio. */
  vbWidth?: number
  vbHeight?: number
  margin?: { top: number; right: number; bottom: number; left: number }
  xDomain: [number, number]
  yDomain: [number, number]
  xLabel?: string
  yLabel?: string
  xTickCount?: number
  yTickCount?: number
  formatX?: (v: number, all: number[]) => string
  formatY?: (v: number, all: number[]) => string
  children: (s: Scales) => ReactNode
  /** Rendered above the plot content, e.g. reference bands. */
  underlay?: (s: Scales) => ReactNode
}

/*
 * Axis frame shared by every chart on the site.
 *
 * All arithmetic comes from chart-geometry.mjs, which is unit-tested with bare
 * Node. This component only turns numbers into elements, so there is nothing
 * here that can be numerically wrong.
 *
 * The SVG uses a fixed viewBox scaled to the container width rather than
 * measuring the DOM. That keeps rendering deterministic — no ResizeObserver, no
 * layout effects, no hydration mismatch between the static export and the
 * browser — at the cost of text scaling with the chart.
 */
const ChartFrame = ({
  vbWidth = 900,
  vbHeight = 380,
  margin = DEFAULT_MARGIN,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  xTickCount = 6,
  // 6 rather than 5: on a 0–55% accuracy domain, 5 targets a step of 20 and
  // yields only 0/20/40. 6 targets 10 and gives a readable 0/10/…/50.
  yTickCount = 6,
  formatX,
  formatY,
  children,
  underlay
}: Props) => {
  const theme = useTheme()

  const area = plotArea(vbWidth, vbHeight, margin)
  const x = scaleLinear(xDomain, [area.x0, area.x1])
  const y = scaleLinear(yDomain, [area.y1, area.y0])

  const xTicks: number[] = niceTicks(xDomain[0], xDomain[1], xTickCount)
  const yTicks: number[] = niceTicks(yDomain[0], yDomain[1], yTickCount)

  const fx = (v: number) => (formatX ? formatX(v, xTicks) : formatTick(v, xTicks))
  const fy = (v: number) => (formatY ? formatY(v, yTicks) : formatTick(v, yTicks))

  const axis = theme.palette.divider
  const text = theme.palette.text.secondary
  const scales: Scales = { x, y, area }

  return (
    <svg
      viewBox={`0 0 ${vbWidth} ${vbHeight}`}
      width='100%'
      role='img'
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* grid */}
      {yTicks.map(t => (
        <line key={`gy${t}`} x1={area.x0} x2={area.x1} y1={y(t)} y2={y(t)} stroke={axis} strokeDasharray='3 3' />
      ))}
      {xTicks.map(t => (
        <line key={`gx${t}`} y1={area.y0} y2={area.y1} x1={x(t)} x2={x(t)} stroke={axis} strokeDasharray='3 3' />
      ))}

      {underlay?.(scales)}

      {/* axes */}
      <line x1={area.x0} x2={area.x1} y1={area.y1} y2={area.y1} stroke={axis} />
      <line x1={area.x0} x2={area.x0} y1={area.y0} y2={area.y1} stroke={axis} />

      {/* tick labels */}
      {yTicks.map(t => (
        <text key={`ty${t}`} x={area.x0 - 8} y={y(t)} textAnchor='end' dominantBaseline='middle' fontSize={12} fill={text}>
          {fy(t)}
        </text>
      ))}
      {xTicks.map(t => (
        <text key={`tx${t}`} x={x(t)} y={area.y1 + 18} textAnchor='middle' fontSize={12} fill={text}>
          {fx(t)}
        </text>
      ))}

      {/* axis titles */}
      {xLabel && (
        <text x={(area.x0 + area.x1) / 2} y={vbHeight - 6} textAnchor='middle' fontSize={12} fill={text}>
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          transform={`translate(14 ${(area.y0 + area.y1) / 2}) rotate(-90)`}
          textAnchor='middle'
          fontSize={12}
          fill={text}
        >
          {yLabel}
        </text>
      )}

      {children(scales)}
    </svg>
  )
}

export default ChartFrame
