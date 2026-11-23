'use client'

// Component Imports
import Figure from './Figure'
import StepControls, { useSteps } from './StepControls'
import type { Step } from './StepControls'
import { ArrowDefs, Badge, Box, Edge, Label, useSvgId } from './primitives'

/*
 * Figure 2.2, the DP-SGD pipeline: what sample-level differential privacy does
 * inside each client at every training step.
 */

const STAGES = [
  { t: 'Per-example gradients', l: ['∇L(θ, xᵢ) for each', 'example in the batch'] },
  { t: 'Clip to norm C', l: ['each gradient scaled', 'so its L2 norm ≤ C'] },
  { t: 'Add Gaussian noise', l: ['N(0, σ²C²I) added to', 'the summed gradients'] },
  { t: 'Average', l: ['divide by the', 'batch size'] },
  { t: 'Update θ', l: ['descent step on the', 'noisy average'] }
]

const STEPS: Step[] = [
  { title: 'Per-example gradients', body: 'Instead of one gradient for the batch, the client computes a gradient for every example, so that no single record can dominate.' },
  { title: 'Clip', body: 'Each per-example gradient is scaled down to L2 norm at most C. That bounds how much any one record can move the model: the sensitivity. Here C = 1.0.' },
  { title: 'Add noise', body: 'Gaussian noise with standard deviation σC is added to the summed gradients. σ is calibrated per client, so the smallest silos carry the most noise.' },
  { title: 'Average', body: 'The noisy sum is divided by the batch size, giving the gradient estimate the optimiser sees.' },
  { title: 'Update', body: 'The model takes an ordinary descent step on the noisy average, and the loop repeats for every training step of every round.' },
  { title: 'Account', body: 'A privacy accountant tracks the cumulative privacy loss across all steps and reports the total (ε, δ), with δ = 10⁻⁵. A federation can claim only its worst client’s ε.' }
]

const X = (i: number) => 10 + i * 192

const DpSgdPipeline = () => {
  const id = useSvgId()
  const steps = useSteps(STEPS.length)
  const s = steps.step
  const all = s < 0

  return (
    <Figure
      title='What sample-level differential privacy does at each training step'
      source='Redrawn from Figure 2.2 (the DP-SGD pipeline).'
      controls={<StepControls steps={STEPS} state={steps} label='Steps of DP-SGD' />}
      minWidth={760}
    >
      <svg viewBox='0 0 960 320' role='img' aria-label='DP-SGD: per-example gradients, clip, add noise, average, update, with a privacy accountant'>
        <ArrowDefs id={id} />
        {STAGES.map((st, i) => (
          <g key={st.t}>
            {i > 0 && <Edge id={id} d={`M ${X(i) - 30} 82 L ${X(i) - 4} 82`} active={s === i} muted={!all && s !== i} i={i} />}
            <Box
              x={X(i)}
              y={34}
              w={162}
              h={96}
              title={st.t}
              lines={st.l}
              titleSize={13.5}
              lineSize={12}
              active={s === i}
              muted={!all && s !== i && s !== 5}
              tone={i === 2 ? 'strong' : 'default'}
              i={i}
            />
            <Badge x={X(i) + 6} y={34} n={i + 1} active={s === i} />
          </g>
        ))}

        {/* accountant */}
        <Edge id={id} d={`M ${X(2) + 81} 132 L ${X(2) + 81} 210`} dashed active={s === 5} muted={!all && s !== 5} />
        <Label x={X(2) + 90} y={176} anchor='start' muted={!all && s !== 5}>
          σ and every step are recorded
        </Label>
        <Box
          x={300}
          y={212}
          w={360}
          h={76}
          tone='accent'
          title='Privacy accountant'
          lines={['tracks the cumulative loss across steps', 'and reports the total (ε, δ)']}
          active={s === 5}
          muted={!all && s !== 5}
          i={6}
        />
        <Badge x={306} y={212} n={6} active={s === 5} />

        {/* repeat loop */}
        <Edge
          id={id}
          d={`M ${X(4) + 81} 132 L ${X(4) + 81} 300 L ${X(0) + 81} 300 L ${X(0) + 81} 134`}
          dashed
          active={s === 4}
          muted={!all && s !== 4}
        />
        <Label x={X(4) + 72} y={292} anchor='end' muted={!all && s !== 4}>
          repeat for every training step
        </Label>
      </svg>
    </Figure>
  )
}

export default DpSgdPipeline
