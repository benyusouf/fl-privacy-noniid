'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, useSvgId } from './primitives'

export type PipelinePhase = {
  id: string
  /** Locked phase name, as given by Table 1.2. */
  title: string
  rq: string
  /** Count to show, already computed by the page from the recorded data. */
  count: number
  unit: string
}

type Props = { phases: PipelinePhase[] }

/*
 * The five phases as one pipeline, from slide 9 of the defence deck. Bars are
 * proportional to the recorded counts the page passes in; nothing here is a
 * literal. Select a phase to jump to its section.
 */
const PhasePipeline = ({ phases }: Props) => {
  const id = useSvgId()
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...phases.map(p => p.count))

  const wrap = (s: string) => {
    const words = s.split(' ')
    const lines: string[] = ['']

    words.forEach(w => {
      if ((lines[lines.length - 1] + ' ' + w).trim().length > 20) lines.push(w)
      else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim()
    })

    return lines
  }

  return (
    <Figure
      title='Five phases, each isolating one factor'
      source='Drawn from slide 9 of the defence deck. Counts are read from the recorded results.'
      caption='Each phase builds on the last: Phase B is costed against Phase A, and Phase E attacks the object the earlier phases transmit. Select a phase to read its design.'
      minWidth={760}
    >
      <svg viewBox='0 0 1000 250' role='img' aria-label='Phases A to E with their research questions and counts'>
        <ArrowDefs id={id} />
        {phases.map((p, i) => {
          const x = 8 + i * 200
          const lines = wrap(p.title)
          const barW = Math.max(6, (164 * p.count) / max)

          return (
            <g key={p.id}>
              {i > 0 && <Edge id={id} d={`M ${x - 22} 96 L ${x - 4} 96`} i={i} muted={hover !== null} />}
              <Box
                x={x}
                y={10}
                w={176}
                h={226}
                tone='default'
                active={hover === p.id}
                muted={hover !== null && hover !== p.id}
                onEnter={() => setHover(p.id)}
                onLeave={() => setHover(null)}
                onClick={() => document.getElementById(`phase-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                label={`Phase ${p.id}: ${p.title}. ${p.count} ${p.unit}. Answers ${p.rq}. Go to section.`}
                i={i}
              >
                <text x={x + 16} y={56} className='dg-node__title' style={{ fontSize: 34, fontWeight: 500 }}>
                  {p.id}
                </text>
                <text x={x + 160} y={36} textAnchor='end' className='dg-label dg-label--accent' style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {p.rq}
                </text>
                {lines.map((l, k) => (
                  <text key={k} x={x + 16} y={92 + k * 18} className='dg-node__title' style={{ fontSize: 13.5 }}>
                    {l}
                  </text>
                ))}
                <rect x={x + 16} y={178} width={164} height={8} rx={4} className='dg-fill-line' opacity={0.5} />
                <rect x={x + 16} y={178} width={barW} height={8} rx={4} className={p.unit.startsWith('attack') ? 'dg-fill-ink' : 'dg-fill-accent'} />
                <text x={x + 16} y={212} className='dg-node__line' style={{ fontSize: 12.5 }}>
                  {p.count} {p.unit}
                </text>
              </Box>
            </g>
          )
        })}
      </svg>
    </Figure>
  )
}

export default PhasePipeline
