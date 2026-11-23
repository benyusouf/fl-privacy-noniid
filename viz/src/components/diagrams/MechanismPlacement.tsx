'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, Label, useSvgId } from './primitives'

/*
 * Figure 3.4, where each privacy mechanism acts in the pipeline.
 */

type Focus = 'all' | 'dp' | 'sa'

const CLIENT = [
  { t: 'Local training on Dᵢ', l: ['two epochs of SGD'], m: null },
  { t: 'Per-example gradients', l: ['clipped to norm C'], m: 'dp' },
  { t: 'Gaussian noise added', l: ['N(0, σ²C²)'], m: 'dp' },
  { t: 'Parameter delta Δwᵢ', l: ['formed for transmission'], m: null },
  { t: 'Pairwise masks applied', l: ['(Equation 3.8)'], m: 'sa' }
] as const

const SERVER = [
  { t: 'Receives fifteen masked', l: ['updates; reads none of them'] },
  { t: 'Sums them; every mask', l: ['appears once with each sign'] },
  { t: 'Masks cancel exactly;', l: ['the true sum remains'] },
  { t: 'Weighted average → wᵗ⁺¹', l: ['(Equation 3.1)'] }
]

const MechanismPlacement = () => {
  const id = useSvgId()
  const [focus, setFocus] = useState<Focus>('all')

  const y = (i: number) => 44 + i * 74
  const mutedClient = (m: string | null) => focus !== 'all' && m !== focus
  const mutedServer = focus === 'dp'

  return (
    <Figure
      title='Where each defence acts'
      source='Redrawn from Figure 3.4 (privacy mechanism placement).'
      caption='Differential privacy changes the update itself before it leaves the client. Secure aggregation changes only how it travels: the server still receives, and can compute, the exact sum.'
      action={
        <div className='seg' role='group' aria-label='Highlight a mechanism'>
          {(
            [
              ['all', 'Both'],
              ['dp', 'Differential privacy'],
              ['sa', 'Secure aggregation']
            ] as [Focus, string][]
          ).map(([v, l]) => (
            <button key={v} type='button' aria-pressed={focus === v} onClick={() => setFocus(v)}>
              {l}
            </button>
          ))}
        </div>
      }
      minWidth={760}
    >
      <svg viewBox='0 0 1000 420' role='img' aria-label='Placement of differential privacy and secure aggregation in the pipeline'>
        <ArrowDefs id={id} />
        <Label x={150} y={24} tone='ink' size={14} weight={600}>
          Inside the client
        </Label>
        <Label x={840} y={24} tone='ink' size={14} weight={600}>
          At the server
        </Label>

        {CLIENT.map((c, i) => (
          <g key={c.t}>
            {i > 0 && <Edge id={id} d={`M 150 ${y(i) - 16} L 150 ${y(i) - 2}`} muted={mutedClient(c.m)} i={i} />}
            <Box
              x={20}
              y={y(i)}
              w={260}
              h={56}
              title={c.t}
              lines={[...c.l]}
              titleSize={13.5}
              lineSize={12}
              active={c.m !== null && (focus === c.m || focus === 'all')}
              muted={mutedClient(c.m)}
              i={i}
            />
          </g>
        ))}

        {/* DP bracket */}
        <g className={`dg-fade${focus === 'sa' ? ' is-muted' : ''}`}>
          <path d={`M 292 ${y(1) + 4} L 304 ${y(1) + 4} L 304 ${y(2) + 52} L 292 ${y(2) + 52}`} className='dg-stroke-accent' strokeWidth={1.5} />
          <Box x={318} y={y(1) + 18} w={250} h={96} tone='accent' title='Differential privacy acts here' lines={['on the update, before', 'it is transmitted']} titleSize={13.5} lineSize={12} i={6} />
        </g>

        {/* SA marker */}
        <g className={`dg-fade${focus === 'dp' ? ' is-muted' : ''}`}>
          <Box x={318} y={y(4) - 6} w={250} h={68} tone='accent' title='Secure aggregation acts here' lines={['on the transmission']} titleSize={13.5} lineSize={12} i={7} />
        </g>

        <Edge id={id} d={`M 570 ${y(4) + 28} L 640 ${y(4) + 28} L 640 ${y(0) + 30} L 706 ${y(0) + 30}`} active={focus !== 'dp'} muted={mutedServer} flow i={6} />
        <Label x={648} y={y(2) + 30} anchor='start' muted={mutedServer}>
          transmit
        </Label>

        {SERVER.map((c, i) => (
          <g key={c.t}>
            {i > 0 && <Edge id={id} d={`M 840 ${y(i) + 4 - 16 + (i * 16) / 3} L 840 ${y(i) + 8 + (i * 16) / 3}`} muted={mutedServer} i={8 + i} />}
            <Box
              x={710}
              y={y(i) + 10 + (i * 16) / 3}
              w={270}
              h={58}
              tone={i === 3 ? 'strong' : 'default'}
              title={c.t}
              lines={c.l}
              titleSize={13.5}
              lineSize={12}
              muted={mutedServer}
              active={focus === 'sa' && i === 2}
              i={8 + i}
            />
          </g>
        ))}
      </svg>
    </Figure>
  )
}

export default MechanismPlacement
