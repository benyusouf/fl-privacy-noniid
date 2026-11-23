'use client'

// Component Imports
import Figure from './Figure'
import StepControls, { useSteps } from './StepControls'
import type { Step } from './StepControls'
import { ArrowDefs, Badge, Box, Edge, Label, useSvgId } from './primitives'

/*
 * One round of cross-silo federated learning.
 * Redrawn from Figure 1.1 and slide 2 of the defence deck.
 */

const STEPS: Step[] = [
  { title: 'Broadcast', body: 'The server sends the current global model wᵗ to every client. All fifteen take part in every round.' },
  { title: 'Train locally', body: 'Each client trains the model on its own data for two local epochs. The data never leaves the institution.' },
  { title: 'Return updates', body: 'Clients send back their model updates, never raw records. This update is the object the privacy mechanisms protect and the attack targets.' },
  { title: 'Aggregate', body: 'The server averages the updates (FedAvg: a weighted average) into the new global model wᵗ⁺¹, and the round repeats: 60 rounds in every run.' }
]

const CLIENTS = [
  { name: 'Hospital A', mix: [0.58, 0.28, 0.14] },
  { name: 'Hospital B', mix: [0.18, 0.2, 0.62] },
  { name: 'Bank C', mix: [0.06, 0.74, 0.2] },
  { name: 'Clinic D', mix: [0.42, 0.08, 0.5] },
  { name: 'Client 15', mix: [0.26, 0.5, 0.24] }
]

const W = 150
const X0 = 30
const GAP = 186
const CY = 286

const FederatedRound = () => {
  const id = useSvgId()
  const steps = useSteps(STEPS.length)
  const s = steps.step
  const all = s < 0

  return (
    <Figure
      title='One round of federated training'
      source='Redrawn from Figure 1.1 and the defence deck. Client names are illustrative; the study has fifteen.'
      caption='Bars sketch each client’s label mix: the silos do not hold comparable data, which is the problem the study is about.'
      controls={<StepControls steps={STEPS} state={steps} label='Steps of one training round' />}
    >
      <svg viewBox='0 0 960 400' role='img' aria-label='A central server exchanging the model with five of the fifteen clients'>
        <ArrowDefs id={id} />

        <Box
          x={250}
          y={20}
          w={460}
          h={70}
          tone='strong'
          title='Central server'
          lines={[s === 3 ? 'weighted average of the fifteen updates → wᵗ⁺¹' : 'holds the shared global model']}
          active={s === 3}
          muted={!all && s !== 0 && s !== 3}
          i={0}
        />
        <Badge x={250} y={20} n={4} active={s === 3} />

        {/* repeat loop */}
        <Edge id={id} d='M 712 42 C 800 42, 800 78, 712 78' dashed active={s === 3} muted={!all && s !== 3} />
        <Label x={790} y={64} anchor='start' muted={!all && s !== 3}>
          repeat for 60 rounds
        </Label>

        {CLIENTS.map((c, k) => {
          const x = X0 + k * GAP
          const cx = x + W / 2

          return (
            <g key={c.name}>
              <Edge
                id={id}
                d={`M ${cx - 12} 94 L ${cx - 12} ${CY - 6}`}
                active={s === 0}
                muted={!all && s !== 0}
                flow
                i={k}
              />
              <Edge
                id={id}
                d={`M ${cx + 12} ${CY - 6} L ${cx + 12} 94`}
                active={s === 2}
                muted={!all && s !== 2}
                flow
                i={k + 5}
              />
              <Box x={x} y={CY} w={W} h={92} title={c.name} top active={s === 1} muted={!all && s !== 1 && s !== 0 && s !== 2} i={k + 1} align='start'>
                {/* label-mix bar */}
                {(() => {
                  let off = 0

                  return c.mix.map((m, j) => {
                    const w = (W - 28) * m

                    const el = (
                      <rect
                        key={j}
                        x={x + 14 + off}
                        y={CY + 46}
                        width={Math.max(w - 2, 1)}
                        height={8}
                        rx={2}
                        className={j === 0 ? 'dg-fill-ink' : j === 1 ? 'dg-fill-accent' : 'dg-fill-line'}
                      />
                    )

                    off += w

                    return el
                  })
                })()}
                <text x={x + 14} y={CY + 74} className='dg-node__line' style={{ fontSize: 12.5 }}>
                  {s === 1 ? `wᵗ → w${['₁', '₂', '₃', '₄', '₁₅'][k]}ᵗ, 2 epochs` : 'local data'}
                </text>
              </Box>
            </g>
          )
        })}

        <Badge x={X0 + 2 * GAP + W / 2 - 34} y={170} n={1} active={s === 0} />
        <Badge x={X0 + 2 * GAP + W / 2 + 34} y={170} n={3} active={s === 2} />
        <Badge x={X0 + 4 * GAP + W - 4} y={CY} n={2} active={s === 1} />

        <Label x={X0 + 1 * GAP + W / 2 - 22} y={196} anchor='end' muted={!all && s !== 0} tone={s === 0 ? 'accent' : 'muted'}>
          global model wᵗ, down
        </Label>
        <Label x={X0 + 3 * GAP + W / 2 + 22} y={196} anchor='start' muted={!all && s !== 2} tone={s === 2 ? 'accent' : 'muted'}>
          model updates only, up
        </Label>
      </svg>
    </Figure>
  )
}

export default FederatedRound
