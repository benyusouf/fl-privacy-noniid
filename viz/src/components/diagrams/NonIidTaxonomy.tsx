'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, Label, useSvgId } from './primitives'

/*
 * Figure 2.1, the non-IID taxonomy, with the study's own scope marked on it:
 * label skew and quantity skew are produced by controlled partitions; feature
 * and temporal skew are outside scope (defence deck, slide 11).
 */

const TYPES = [
  {
    t: 'Label skew',
    l: ['Clients hold different', 'mixes of the classes'],
    ex: ['One hospital sees mostly one diagnosis,', 'another a different mix'],
    scope: 'Studied: Dirichlet α = 100, 1.0, 0.1 and pathological one-class',
    inScope: true,
    // tiny per-client class bars
    glyph: [
      [0.7, 0.2, 0.1],
      [0.1, 0.2, 0.7],
      [0.3, 0.6, 0.1]
    ]
  },
  {
    t: 'Quantity skew',
    l: ['Clients hold different', 'amounts of data'],
    ex: ['A large teaching hospital', 'and a small clinic'],
    scope: 'Studied: quantity skew, β = 0.5',
    inScope: true,
    glyph: [
      [1, 0, 0],
      [0.35, 0, 0],
      [0.12, 0, 0]
    ]
  },
  {
    t: 'Feature skew',
    l: ['Same classes, but the inputs', 'differ in appearance'],
    ex: ['Two hospitals image the same', 'conditions with different scanners'],
    scope: 'Outside scope: partitions cannot reproduce real feature skew',
    inScope: false,
    glyph: null
  },
  {
    t: 'Temporal and spatial skew',
    l: ['Distribution changes across', 'time or location'],
    ex: ['Seasonal case patterns', 'differing by region'],
    scope: 'Outside scope',
    inScope: false,
    glyph: null
  }
]

const NonIidTaxonomy = () => {
  const id = useSvgId()
  const [hover, setHover] = useState<number | null>(null)

  const rowY = (i: number) => 10 + i * 96
  const muted = (i: number) => hover !== null && hover !== i

  return (
    <Figure
      title='Four ways client data can differ'
      source='Redrawn from Figure 2.1, with the study’s scope marked.'
      caption='The study produces label skew and quantity skew with controlled partitions, then measures how heterogeneous each partition actually is with Hellinger distance. Feature and temporal skew are named limitations.'
      minWidth={760}
    >
      <svg viewBox='0 0 1000 392' role='img' aria-label='Non-IID taxonomy: label, quantity, feature and temporal skew'>
        <ArrowDefs id={id} />
        <Box x={8} y={150} w={190} h={86} tone='strong' title='Non-IID data' lines={['in federated learning']} i={0} />

        {TYPES.map((t, i) => {
          const y = rowY(i)

          return (
            <g key={t.t}>
              <Edge id={id} d={`M 200 193 C 240 193, 240 ${y + 38}, 278 ${y + 38}`} active={hover === i} muted={muted(i)} i={i} />
              <Box
                x={280}
                y={y}
                w={290}
                h={76}
                title={t.t}
                lines={t.l}
                align='start'
                i={i + 1}
                tone={t.inScope ? 'default' : 'dashed'}
                active={hover === i}
                muted={muted(i)}
                onEnter={() => setHover(i)}
                onLeave={() => setHover(null)}
              >
                {t.glyph &&
                  t.glyph.map((row, r) => {
                    let off = 0

                    return row.map((v, c) => {
                      const w = 64 * v

                      const el =
                        v > 0 ? (
                          <rect
                            key={`${r}${c}`}
                            x={490 + off}
                            y={y + 18 + r * 14}
                            width={Math.max(w - 1.5, 1)}
                            height={9}
                            rx={2}
                            className={c === 0 ? 'dg-fill-ink' : c === 1 ? 'dg-fill-accent' : 'dg-fill-line'}
                          />
                        ) : null

                      off += w

                      return el
                    })
                  })}
              </Box>
              <Edge id={id} d={`M 572 ${y + 38} L 606 ${y + 38}`} arrow='none' muted={muted(i)} i={i + 4} />
              <Box x={608} y={y} w={384} h={76} tone='soft' lines={t.ex} align='start' top i={i + 5} muted={muted(i)} lineSize={12.5} />
              <Label x={622} y={y + 66} anchor='start' size={11.5} tone={t.inScope ? 'accent' : 'muted'} weight={t.inScope ? 600 : 400} muted={muted(i)}>
                {t.scope}
              </Label>
            </g>
          )
        })}
      </svg>
    </Figure>
  )
}

export default NonIidTaxonomy
