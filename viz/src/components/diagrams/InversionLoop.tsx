'use client'

// Component Imports
import Figure from './Figure'
import StepControls, { useSteps } from './StepControls'
import type { Step } from './StepControls'
import { ArrowDefs, Badge, Box, Edge, Label, useSvgId } from './primitives'

/*
 * Figure 2.5, the gradient-inversion loop: how an honest-but-curious server
 * turns an update back into an image.
 */

const STEPS: Step[] = [
  { title: 'Observe', body: 'The server receives a client’s update: here either one batch gradient or the multi-epoch delta the pipeline actually transmits.' },
  { title: 'Initialise', body: 'It starts from a dummy image and label drawn at random.' },
  { title: 'Forward and backward', body: 'It runs the dummy pair through the same model and computes the gradient that dummy data would have produced, ∇W′.' },
  { title: 'Compare', body: 'A gradient-matching loss measures how far ∇W′ is from the observed ∇W. This study uses layer-wise cosine distance.' },
  { title: 'Update the dummy', body: 'The dummy image is adjusted by gradient descent to reduce the loss, and the loop repeats while the loss is still falling.' },
  { title: 'Reconstruct', body: 'When the loss is minimised the dummy is the reconstruction. It is scored by PSNR against the real image, where higher PSNR means a better reconstruction and so worse privacy.' }
]

const InversionLoop = () => {
  const id = useSvgId()
  const steps = useSteps(STEPS.length)
  const s = steps.step
  const all = s < 0
  const on = (k: number) => s === k
  const mute = (...ks: number[]) => !all && !ks.includes(s)

  return (
    <Figure
      title='How a gradient-inversion attack works'
      source='Redrawn from Figure 2.5 (the gradient-inversion loop).'
      controls={<StepControls steps={STEPS} state={steps} label='Steps of the attack' />}
      minWidth={760}
    >
      <svg viewBox='0 0 1000 372' role='img' aria-label='Gradient inversion loop: dummy data is optimised until its gradient matches the observed one'>
        <ArrowDefs id={id} />

        <Box x={20} y={20} w={200} h={66} tone='strong' title='Observed gradient ∇W' lines={['from the client’s update']} active={on(0)} muted={mute(0, 3)} i={0} />
        <Badge x={26} y={20} n={1} active={on(0)} />

        <Box x={540} y={20} w={220} h={66} title='Compare' lines={['gradient-matching loss', '(cosine distance)']} active={on(3)} muted={mute(3)} i={4} />
        <Badge x={546} y={20} n={4} active={on(3)} />

        <Box x={20} y={160} w={200} h={66} title='Dummy image and label' lines={['initialised at random']} active={on(1)} muted={mute(1, 4)} i={1} />
        <Badge x={26} y={160} n={2} active={on(1)} />

        <Box x={280} y={160} w={200} h={66} title='Forward and backward' lines={['pass on the dummy pair']} active={on(2)} muted={mute(2)} i={2} />
        <Badge x={286} y={160} n={3} active={on(2)} />

        <Box x={555} y={160} w={190} h={66} title='Dummy gradient ∇W′' active={on(2)} muted={mute(2, 3)} i={3} />

        <Box x={280} y={292} w={200} h={66} title='Update the dummy image' lines={['gradient descent on the loss']} active={on(4)} muted={mute(4)} i={5} />
        <Badge x={286} y={292} n={5} active={on(4)} />

        <Box x={800} y={160} w={180} h={66} tone='accent' title='Reconstruction' lines={['scored by PSNR']} active={on(5)} muted={mute(5)} i={6} />
        <Badge x={806} y={160} n={6} active={on(5)} />

        <Edge id={id} d='M 222 53 L 536 53' active={on(0) || on(3)} muted={mute(0, 3)} />
        <Edge id={id} d='M 222 193 L 276 193' active={on(2)} muted={mute(2)} i={1} />
        <Edge id={id} d='M 482 193 L 551 193' active={on(2)} muted={mute(2)} i={2} />
        <Edge id={id} d='M 650 158 L 650 90' active={on(3)} muted={mute(3)} i={3} />
        <Edge id={id} d='M 560 88 L 512 130 L 512 325 L 484 325' active={on(4)} muted={mute(4)} i={4} />
        <Label x={520} y={262} anchor='start' muted={mute(4)}>
          loss not yet
        </Label>
        <Label x={520} y={278} anchor='start' muted={mute(4)}>
          minimised
        </Label>
        <Edge id={id} d='M 278 325 L 120 325 L 120 230' dashed active={on(4)} muted={mute(4)} i={5} />
        <Label x={200} y={316} muted={mute(4)}>
          repeat
        </Label>
        <Edge id={id} d='M 762 53 L 890 53 L 890 156' active={on(5)} muted={mute(5)} i={6} />
        <Label x={898} y={110} anchor='start' muted={mute(5)}>
          loss minimised
        </Label>
      </svg>
    </Figure>
  )
}

export default InversionLoop
