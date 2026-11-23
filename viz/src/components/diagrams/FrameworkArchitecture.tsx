'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, Label, useSvgId } from './primitives'

/*
 * Figure 3.1, the framework architecture: one server process, fifteen clients,
 * and the hooks where the privacy mechanisms attach. Hover a client component
 * to read what it is.
 */

const PARTS = [
  {
    key: 'data',
    t: 'Local partition D₁',
    l: ['non-IID, from the partition protocol'],
    d: 'Each client holds its own slice of the dataset, produced by one of the five partition protocols. It is never transmitted.'
  },
  {
    key: 'model',
    t: 'SmallCNN',
    l: ['flcore/models_torch.py'],
    d: 'Every client trains the same small convolutional network, so differences between arms come from the strategy or the mechanism, not the model.',
    mono: true
  },
  {
    key: 'objective',
    t: 'Local objective',
    l: ['FedAvg / FedProx / SCAFFOLD / MOON', 'plain SGD, momentum 0 (shared constant)'],
    d: 'The aggregation strategy changes only the local objective and what is sent back. All four share one aggregation routine and one local optimizer.'
  },
  {
    key: 'dp',
    t: 'DP-SGD hook',
    l: ['per-example clip to C, add N(0, σ²C²)'],
    d: 'Where sample-level differential privacy acts: inside the client, on every training step, before anything leaves.'
  },
  {
    key: 'mask',
    t: 'Masking hook',
    l: ['pairwise masks, flcore/secagg.py'],
    d: 'Where secure aggregation acts: on the update as it is transmitted, so the server can sum updates it cannot read.'
  }
]

const FrameworkArchitecture = () => {
  const id = useSvgId()
  const [hover, setHover] = useState<string | null>(null)
  const active = PARTS.find(p => p.key === hover)

  return (
    <Figure
      title='The framework, end to end'
      source='Redrawn from Figure 3.1 (framework architecture). No federated-learning framework is used; every part is implemented directly.'
      controls={
        <p className='dg-steps__text' aria-live='polite'>
          {active ? (
            <>
              <strong>{active.t}.</strong> {active.d}
            </>
          ) : (
            <span>Hover or focus a part of Client 1 to see what it does.</span>
          )}
        </p>
      }
      minWidth={760}
    >
      <svg viewBox='0 0 1000 420' role='img' aria-label='Framework architecture: server, fifteen clients, privacy hooks'>
        <ArrowDefs id={id} />

        <Box
          x={250}
          y={8}
          w={500}
          h={86}
          tone='strong'
          title='Server, flcore/federated.py'
          lines={['weighted aggregation (Equation 3.1), strategy dispatch,', 'server momentum (FedAvgM), privacy accountant']}
          lineSize={12.5}
          i={0}
        />

        <Box x={8} y={150} w={470} h={262} tone='zone' i={1} />
        <Label x={28} y={176} anchor='start' tone='ink' size={14} weight={600}>
          Client 1
        </Label>
        {PARTS.map((p, k) => {
          const pos =
            k === 0
              ? { x: 28, y: 190, w: 210 }
              : k === 1
                ? { x: 250, y: 190, w: 208 }
                : { x: 28, y: 190 + (k - 1) * 54 + 6, w: 430 }

          return (
            <Box
              key={p.key}
              x={pos.x}
              y={pos.y}
              w={pos.w}
              h={k < 2 ? 50 : 46}
              title={p.t}
              lines={p.l}
              align='start'
              titleSize={13}
              lineSize={11.5}
              tone={p.key === 'dp' || p.key === 'mask' ? 'accent' : 'default'}
              active={hover === p.key}
              muted={hover !== null && hover !== p.key}
              onEnter={() => setHover(p.key)}
              onLeave={() => setHover(null)}
              i={2 + k}
            />
          )
        })}

        {['Client 2', 'Client 3', 'Client 4'].map((c, k) => (
          <Box key={c} x={520 + k * 112} y={150} w={100} h={60} title={c} titleSize={13} i={7 + k} />
        ))}
        <Label x={870} y={186} tone='ink' size={16}>
          …
        </Label>
        <Box x={892} y={150} w={100} h={60} title='Client 15' titleSize={13} i={10} />

        <Edge id={id} d='M 330 96 L 330 146' i={1} />
        <Label x={322} y={126} anchor='end'>
          global model wᵗ
        </Label>
        <Edge id={id} d='M 410 146 L 410 96' active={hover === 'mask'} i={2} />
        <Label x={418} y={126} anchor='start' tone={hover === 'mask' ? 'accent' : 'muted'}>
          update, masked if secure aggregation is active
        </Label>
        {[570, 682, 794, 942].map((x, k) => (
          <Edge key={x} id={id} d={`M ${x} 146 L ${600 + k * 44} 98`} arrow='both' i={3 + k} />
        ))}

        <Label x={735} y={262} anchor='middle' size={12.5}>
          Every client runs the same code;
        </Label>
        <Label x={735} y={280} anchor='middle' size={12.5}>
          only its partition differs.
        </Label>
      </svg>
    </Figure>
  )
}

export default FrameworkArchitecture
