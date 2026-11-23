'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'

/*
 * Figure 2.6, the research gap: three strands of literature and where the
 * reviewed studies sit among them. The study sits where all three overlap.
 */

type Circle = 'noniid' | 'privacy' | 'scale'

const CIRCLES: { key: Circle; cx: number; cy: number; label: string; lx: number; ly: number; anchor: 'start' | 'end' | 'middle' }[] = [
  { key: 'noniid', cx: 245, cy: 265, label: 'Non-IID handling', lx: 70, ly: 30, anchor: 'start' },
  { key: 'privacy', cx: 465, cy: 265, label: 'Privacy mechanisms', lx: 640, ly: 30, anchor: 'end' },
  { key: 'scale', cx: 355, cy: 445, label: 'Cross-silo scale', lx: 355, ly: 690, anchor: 'middle' }
]

const REGIONS: { in: Circle[]; x: number; y: number; lines: string[] }[] = [
  { in: ['noniid'], x: 140, y: 170, lines: ['Zhao et al. (2018)', 'Li et al. (2020)', 'Karimireddy et al. (2020)', 'Li, He and Song (2021)', 'Seo et al. (2025)'] },
  { in: ['privacy'], x: 570, y: 170, lines: ['Abadi et al. (2016)', 'Bonawitz et al. (2017)', 'McMahan et al. (2018)', 'Zhu et al. (2019)', 'Geiping et al. (2020)'] },
  { in: ['scale'], x: 355, y: 585, lines: ['Tzortzis et al. (2025)', 'Gupta et al. (2025)'] },
  { in: ['noniid', 'privacy'], x: 355, y: 150, lines: ['Jimenez-Gutierrez', 'et al. (2025b)', '(names the gap)'] },
  { in: ['noniid', 'scale'], x: 232, y: 420, lines: ['Li, Jiang, et al. (2021)', 'Jimenez-Gutierrez', 'et al. (2025a)'] },
  { in: ['privacy', 'scale'], x: 478, y: 420, lines: ['Geyer et al. (2017)', 'Kiani et al. (2025)', '(approximate scale)'] }
]

const ResearchGap = () => {
  const [hover, setHover] = useState<Circle | 'study' | null>(null)

  const regionMuted = (r: (typeof REGIONS)[number]) =>
    hover !== null && hover !== 'study' && !r.in.includes(hover)

  return (
    <Figure
      title='Where the study sits in the literature'
      source='Redrawn from Figure 2.6 (research gap).'
      caption='No reviewed study combines non-IID handling, privacy mechanisms and cross-silo scale, with results reported against a measured heterogeneity value. Hover a strand to see which studies address it.'
      action={
        <div className='seg' role='group' aria-label='Highlight a strand of literature'>
          {CIRCLES.map(c => (
            <button
              key={c.key}
              type='button'
              aria-pressed={hover === c.key}
              onMouseEnter={() => setHover(c.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c.key)}
              onBlur={() => setHover(null)}
            >
              {c.label}
            </button>
          ))}
        </div>
      }
      minWidth={520}
    >
      <svg viewBox='0 0 710 710' role='img' aria-label='Venn diagram of three literatures with this study at the centre' style={{ maxInlineSize: 640, marginInline: 'auto' }}>
        {CIRCLES.map((c, i) => (
          <g key={c.key} className='dg-enter' style={{ ['--i' as string]: i }}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={215}
              className={`venn${hover === c.key || hover === 'study' ? ' is-active' : ''}${hover && hover !== c.key && hover !== 'study' ? ' is-muted' : ''}`}
              onMouseEnter={() => setHover(c.key)}
              onMouseLeave={() => setHover(null)}
            />
            <text x={c.lx} y={c.ly} textAnchor={c.anchor} className='dg-label dg-label--ink' style={{ fontSize: 15, fontWeight: 600 }}>
              {c.label}
            </text>
          </g>
        ))}

        {REGIONS.map((r, k) => (
          <g key={k} className={`dg-fade dg-enter${regionMuted(r) ? ' is-muted' : ''}`} style={{ ['--i' as string]: k + 3 }} pointerEvents='none'>
            {r.lines.map((l, j) => (
              <text key={j} x={r.x} y={r.y + j * 17} textAnchor='middle' className='dg-label' style={{ fontSize: 12.5 }}>
                {l}
              </text>
            ))}
          </g>
        ))}

        <g
          className='dg-enter'
          style={{ ['--i' as string]: 10, cursor: 'pointer' }}
          onMouseEnter={() => setHover('study')}
          onMouseLeave={() => setHover(null)}
          tabIndex={0}
          onFocus={() => setHover('study')}
          onBlur={() => setHover(null)}
          role='button'
          aria-label='This study: all three strands, reported against measured heterogeneity'
        >
          <rect x={268} y={290} width={174} height={70} rx={10} className='dg-fill-ink' />
          <text x={355} y={316} textAnchor='middle' className='dg-fill-surface' style={{ fontSize: 14, fontWeight: 600 }}>
            This study
          </text>
          <text x={355} y={335} textAnchor='middle' className='dg-fill-surface' style={{ fontSize: 11.5, opacity: 0.8 }}>
            reported against measured
          </text>
          <text x={355} y={350} textAnchor='middle' className='dg-fill-surface' style={{ fontSize: 11.5, opacity: 0.8 }}>
            heterogeneity
          </text>
        </g>
      </svg>
    </Figure>
  )
}

export default ResearchGap
