'use client'

// Component Imports
import Figure from './Figure'
import StepControls, { useSteps } from './StepControls'
import type { Step } from './StepControls'
import { ArrowDefs, Box, Edge, Label, useSvgId } from './primitives'

/*
 * Figure 2.3, pairwise masking with three clients: why the server can add up
 * updates it cannot read.
 */

const STEPS: Step[] = [
  { title: 'Agree masks', body: 'Every pair of clients agrees a shared random mask. Three clients make three pairs; the study’s fifteen make 105.' },
  { title: 'Mask the update', body: 'Each client adds the masks it shares with higher-numbered clients and subtracts those it shares with lower-numbered ones. What it sends looks like noise to the server.' },
  { title: 'Sum', body: 'The server adds the three masked vectors. It never sees an unmasked update.' },
  { title: 'Masks cancel', body: 'Every mask appears once with each sign, so the masks cancel and the server is left with x₁ + x₂ + x₃ exactly: the sum it needs, and nothing about any single client.' }
]

const CL = [
  { x: 40, name: 'Client 1', send: 'x₁ + m₁₂ + m₁₃' },
  { x: 370, name: 'Client 2', send: 'x₂ − m₁₂ + m₂₃' },
  { x: 700, name: 'Client 3', send: 'x₃ − m₁₃ − m₂₃' }
]

const PairwiseMasking = () => {
  const id = useSvgId()
  const steps = useSteps(STEPS.length)
  const s = steps.step
  const all = s < 0

  const serverLines =
    s === 0 || s === 1
      ? ['waiting for three masked vectors']
      : s === 2
        ? ['(x₁+x₂+x₃) + (m₁₂−m₁₂) + (m₁₃−m₁₃) + (m₂₃−m₂₃)']
        : ['(x₁+x₂+x₃) + (m₁₂−m₁₂) + (m₁₃−m₁₃) + (m₂₃−m₂₃)', '= x₁ + x₂ + x₃']

  return (
    <Figure
      title='How masked updates add up to the true sum'
      source='Redrawn from Figure 2.3 (pairwise masking).'
      controls={<StepControls steps={STEPS} state={steps} label='Steps of pairwise masking' />}
      minWidth={720}
    >
      <svg viewBox='0 0 960 414' role='img' aria-label='Three clients exchange pairwise masks that cancel when the server sums their updates'>
        <ArrowDefs id={id} />

        <Box
          x={250}
          y={12}
          w={460}
          h={96}
          tone='strong'
          title='Server sums the masked vectors'
          lines={serverLines}
          lineSize={13}
          active={s >= 2}
          muted={!all && s < 2}
          mono={false}
        />

        {CL.map((c, k) => (
          <g key={c.name}>
            <Edge
              id={id}
              d={`M ${c.x + 110} 250 L ${c.x + 110 + (480 - (c.x + 110)) * 0.45} 112`}
              active={s === 1 || s === 2}
              muted={!all && s !== 1 && s !== 2}
              flow
              i={k}
            />
            <Box
              x={c.x}
              y={252}
              w={220}
              h={80}
              title={c.name}
              lines={[s === 0 ? 'holds xᵢ, its true update' : `sends ${c.send}`]}
              lineSize={13}
              active={s === 1}
              muted={!all && s !== 1 && s !== 0}
              i={k + 1}
            />
          </g>
        ))}

        {/* mask edges */}
        <Edge id={id} d='M 262 292 L 368 292' arrow='both' active={s === 0} muted={!all && s !== 0 && s !== 3} i={4} />
        <Label x={315} y={284} tone={s === 0 || s === 3 ? 'accent' : 'muted'} muted={!all && s !== 0 && s !== 3}>
          m₁₂
        </Label>
        <Edge id={id} d='M 592 292 L 698 292' arrow='both' active={s === 0} muted={!all && s !== 0 && s !== 3} i={5} />
        <Label x={645} y={284} tone={s === 0 || s === 3 ? 'accent' : 'muted'} muted={!all && s !== 0 && s !== 3}>
          m₂₃
        </Label>
        <Edge id={id} d='M 150 334 C 150 392, 810 392, 810 334' arrow='both' active={s === 0} muted={!all && s !== 0 && s !== 3} i={6} />
        <Label x={480} y={404} tone={s === 0 || s === 3 ? 'accent' : 'muted'} muted={!all && s !== 0 && s !== 3}>
          m₁₃, shared by clients 1 and 3
        </Label>
      </svg>
    </Figure>
  )
}

export default PairwiseMasking
