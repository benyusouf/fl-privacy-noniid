'use client'

// React Imports
import { useId } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/*
 * SVG building blocks shared by every diagram. Colour is never set here:
 * everything is a class, and site.css maps classes to theme variables, so one
 * drawing serves both themes.
 */

/** A unique, CSS-safe id prefix for markers inside one SVG. */
export const useSvgId = () => useId().replace(/[^a-zA-Z0-9_-]/g, '')

export const ArrowDefs = ({ id }: { id: string }) => (
  <defs>
    <marker id={`${id}-a`} viewBox='0 0 10 10' refX='8.5' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'>
      <path d='M0 0.5 L9 5 L0 9.5 Z' className='dg-head' />
    </marker>
    <marker id={`${id}-b`} viewBox='0 0 10 10' refX='8.5' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'>
      <path d='M0 0.5 L9 5 L0 9.5 Z' className='dg-head dg-head--accent' />
    </marker>
  </defs>
)

type Tone = 'default' | 'strong' | 'soft' | 'zone' | 'dashed' | 'accent'

export type BoxProps = {
  x: number
  y: number
  w: number
  h: number
  title?: string
  lines?: string[]
  tone?: Tone
  active?: boolean
  muted?: boolean
  /** Order of entrance when the figure reveals. */
  i?: number
  align?: 'middle' | 'start'
  titleSize?: number
  lineSize?: number
  rx?: number
  /** Makes the box focusable and hoverable. */
  onEnter?: () => void
  onLeave?: () => void
  onClick?: () => void
  label?: string
  children?: ReactNode
  mono?: boolean
  /** Pin the text block to the top of the box instead of centring it. */
  top?: boolean
}

export const Box = ({
  x,
  y,
  w,
  h,
  title,
  lines = [],
  tone = 'default',
  active = false,
  muted = false,
  i = 0,
  align = 'middle',
  titleSize = 14,
  lineSize = 12.5,
  rx = 8,
  onEnter,
  onLeave,
  onClick,
  label,
  children,
  mono = false,
  top: pinTop = false
}: BoxProps) => {
  const interactive = Boolean(onEnter || onClick)
  const lh = lineSize * 1.4
  const total = (title ? titleSize * 1.35 : 0) + lines.length * lh
  const top = pinTop ? y + 10 : y + h / 2 - total / 2
  const tx = align === 'middle' ? x + w / 2 : x + 14
  const anchor = align === 'middle' ? 'middle' : 'start'

  const onKey = (e: KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <g
      className={`dg-node dg-node--${tone}${active ? ' is-active' : ''}${muted ? ' is-muted' : ''}${interactive ? ' is-interactive' : ''}`}
      style={{ ['--i' as string]: i }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onClick}
      onKeyDown={onKey}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? (label ?? [title, ...lines].filter(Boolean).join('. ')) : undefined}
    >
      <rect x={x} y={y} width={w} height={h} rx={rx} className='dg-node__box' />
      {title && (
        <text
          x={tx}
          y={top + titleSize}
          textAnchor={anchor}
          className={`dg-node__title${mono ? ' dg-mono' : ''}`}
          style={{ fontSize: titleSize }}
        >
          {title}
        </text>
      )}
      {lines.map((l, k) => (
        <text
          key={k}
          x={tx}
          y={top + (title ? titleSize * 1.35 : 0) + lh * k + lineSize + 1}
          textAnchor={anchor}
          className='dg-node__line'
          style={{ fontSize: lineSize }}
        >
          {l}
        </text>
      ))}
      {children}
    </g>
  )
}

type EdgeProps = {
  d: string
  id: string
  active?: boolean
  muted?: boolean
  arrow?: 'end' | 'start' | 'both' | 'none'
  dashed?: boolean
  /** Animated dashes showing direction of travel, only while active. */
  flow?: boolean
  i?: number
}

export const Edge = ({ d, id, active = false, muted = false, arrow = 'end', dashed = false, flow = false, i = 0 }: EdgeProps) => {
  const m = `url(#${id}-${active ? 'b' : 'a'})`

  return (
    <path
      d={d}
      className={`dg-edge${active ? ' is-active' : ''}${muted ? ' is-muted' : ''}${dashed ? ' is-dashed' : ''}${
        flow && active ? ' dg-flow' : ''
      }`}
      style={{ ['--i' as string]: i }}
      markerEnd={arrow === 'end' || arrow === 'both' ? m : undefined}
      markerStart={arrow === 'start' || arrow === 'both' ? m : undefined}
    />
  )
}

type LabelProps = {
  x: number
  y: number
  children: ReactNode
  anchor?: 'start' | 'middle' | 'end'
  size?: number
  tone?: 'ink' | 'muted' | 'accent'
  weight?: number
  muted?: boolean
  mono?: boolean
}

export const Label = ({ x, y, children, anchor = 'middle', size = 12.5, tone = 'muted', weight, muted, mono }: LabelProps) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    className={`dg-label dg-label--${tone}${muted ? ' is-muted' : ''}${mono ? ' dg-mono' : ''}`}
    style={{ fontSize: size, fontWeight: weight }}
  >
    {children}
  </text>
)

/** A small numbered badge, for steps drawn on the diagram itself. */
export const Badge = ({ x, y, n, active = false }: { x: number; y: number; n: number | string; active?: boolean }) => (
  <g className={`dg-badge${active ? ' is-active' : ''}`}>
    <circle cx={x} cy={y} r={11} />
    <text x={x} y={y + 4} textAnchor='middle'>
      {n}
    </text>
  </g>
)
