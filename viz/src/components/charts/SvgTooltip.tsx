'use client'

// MUI Imports
import { useTheme } from '@mui/material/styles'

type Props = {
  x: number
  y: number
  lines: { text: string; bold?: boolean; colour?: string }[]
  /** Plot bounds, so the tooltip flips rather than overflowing the viewBox. */
  bounds: { x0: number; x1: number; y0: number; y1: number }
}

const LINE_H = 16
const PAD = 8
// Approximate advance width for the sans-serif stack at 12px. Deliberate
// over-estimate: a slightly wide box looks fine, a narrow one clips its text.
const CHAR_W = 6.6

/*
 * Tooltip drawn inside the SVG rather than as a positioned HTML element.
 *
 * The charts scale via viewBox, so an HTML tooltip would need the mouse position
 * converted from screen space back into viewBox space — a measurement step that
 * breaks in exactly the places that are hard to test. Drawing in SVG keeps the
 * tooltip in the same coordinate system as the data it describes.
 */
const SvgTooltip = ({ x, y, lines, bounds }: Props) => {
  const theme = useTheme()

  const w = Math.max(...lines.map(l => l.text.length * CHAR_W)) + PAD * 2
  const h = lines.length * LINE_H + PAD * 2

  // Flip to the other side of the cursor when there is not room.
  const left = x + 12 + w > bounds.x1 ? x - 12 - w : x + 12
  const top = Math.min(Math.max(y - h / 2, bounds.y0), bounds.y1 - h)

  return (
    <g pointerEvents='none'>
      <rect
        x={left}
        y={top}
        width={w}
        height={h}
        rx={6}
        fill={theme.palette.background.paper}
        stroke={theme.palette.divider}
        opacity={0.97}
      />
      {lines.map((l, i) => (
        <text
          key={i}
          x={left + PAD}
          y={top + PAD + LINE_H * i + LINE_H / 2}
          dominantBaseline='middle'
          fontSize={12}
          fontWeight={l.bold ? 600 : 400}
          fill={l.colour ?? theme.palette.text.primary}
        >
          {l.text}
        </text>
      ))}
    </g>
  )
}

export default SvgTooltip
