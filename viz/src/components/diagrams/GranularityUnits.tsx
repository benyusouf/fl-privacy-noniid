'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, Label, useSvgId } from './primitives'

/*
 * What the guarantee protects: one record (sample-level) or one institution
 * (client-level). Drawn from Figure 3.4 and slide 8 of the defence deck.
 */

type View = 'both' | 'sample' | 'client'

const Panel = ({ x, kind, id, dim }: { x: number; kind: 'sample' | 'client'; id: string; dim: boolean }) => {
  const isSample = kind === 'sample'
  const clientsX = [x + 14, x + 160, x + 306]

  return (
    <g className={`dg-fade${dim ? ' is-muted' : ''}`}>
      <Label x={x + 225} y={18} tone='ink' size={14.5} weight={600}>
        {isSample ? 'Sample-level: protects one record' : 'Client-level: protects one institution'}
      </Label>

      <Box
        x={x + 95}
        y={34}
        w={260}
        h={62}
        tone='strong'
        title='Server'
        lines={[isSample ? 'averages noisy updates' : 'clips each update to C, adds noise σC/N']}
        lineSize={12}
        active={!isSample && !dim}
      />

      {clientsX.map((cx, k) => (
        <g key={k}>
          <Edge id={id} d={`M ${cx + 65} 176 L ${x + 225 + (k - 1) * 70} 100`} i={k} />
          <Box
            x={cx}
            y={178}
            w={130}
            h={104}
            title={k === 2 ? 'Client 15' : `Client ${k + 1}`}
            active={!isSample && k === 1 && !dim}
            i={k + 1}
          >
            {/* records */}
            {Array.from({ length: 12 }).map((_, r) => {
              const rx = cx + 22 + (r % 6) * 17
              const ry = 178 + 44 + Math.floor(r / 6) * 18
              const hit = isSample && k === 1 && r === 4

              return (
                <g key={r}>
                  <circle cx={rx} cy={ry} r={4.5} className={hit ? 'dg-fill-accent' : 'dg-fill-ink2'} opacity={hit ? 1 : 0.55} />
                  {hit && <circle cx={rx} cy={ry} r={9} className='dg-stroke-accent' strokeWidth={1.5} />}
                </g>
              )
            })}
            <text x={cx + 65} y={178 + 94} textAnchor='middle' className='dg-node__line' style={{ fontSize: 11.5 }}>
              {isSample ? (k === 1 ? 'clip + noise per step' : 'DP-SGD inside') : 'plain local training'}
            </text>
          </Box>
        </g>
      ))}

      <Label x={x + 225} y={310} size={12.5}>
        {isSample ? 'Clipping at C = 1.0, ε = 1, 4 and 8, δ = 10⁻⁵' : 'N = 15, q = 1: every client, every round'}
      </Label>
      <Label x={x + 225} y={330} size={12.5} tone='accent' weight={600}>
        {isSample ? 'One training record’s influence is bounded' : 'One institution’s whole participation is bounded'}
      </Label>
    </g>
  )
}

const GranularityUnits = () => {
  const id = useSvgId()
  const [view, setView] = useState<View>('both')

  return (
    <Figure
      title='What the privacy guarantee protects'
      source='Drawn from Figure 3.4 and slide 8 of the defence deck.'
      caption='The same nominal ε means different things. Sample-level noise is added inside each client and benefits from subsampling; client-level noise is added once to the aggregate, scaled by C/N, and with all fifteen clients in every round there is no subsampling to amplify it.'
      action={
        <div className='seg' role='group' aria-label='Choose a granularity'>
          {(
            [
              ['both', 'Compare'],
              ['sample', 'Sample-level'],
              ['client', 'Client-level']
            ] as [View, string][]
          ).map(([v, l]) => (
            <button key={v} type='button' aria-pressed={view === v} onClick={() => setView(v)}>
              {l}
            </button>
          ))}
        </div>
      }
      minWidth={760}
    >
      <svg viewBox='0 0 960 342' role='img' aria-label='Sample-level against client-level differential privacy'>
        <ArrowDefs id={id} />
        <Panel x={0} kind='sample' id={id} dim={view === 'client'} />
        <line x1={480} x2={480} y1={10} y2={330} className='dg-stroke-line' strokeDasharray='4 4' />
        <Panel x={510} kind='client' id={id} dim={view === 'sample'} />
      </svg>
    </Figure>
  )
}

export default GranularityUnits
