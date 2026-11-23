'use client'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, Label, useSvgId } from './primitives'

/*
 * Figure 3.3, the threat model: what stays inside the client, what the
 * honest-but-curious server observes, and what is out of scope.
 */

const TRUSTED = [
  'Local data partition: never transmitted',
  'Local training loop and optimizer state',
  'Client state: control variate, previous local model',
  'DP-SGD applied here, before anything leaves'
]

const OBSERVED = [
  'The transmitted update (plaintext, or masked)',
  'The aggregate sum of all fifteen updates',
  'Every global model, round after round',
  'Architecture, hyperparameters, client count'
]

const OUT = [
  ['Client-side deviation:', 'poisoning, backdoor insertion'],
  ['Sybil attacks; collusion', 'between clients and server'],
  ['An actively malicious server', 'that deviates from the protocol']
]

const ThreatModel = () => {
  const id = useSvgId()

  return (
    <Figure
      title='What the adversary can and cannot see'
      source='Redrawn from Figure 3.3 (threat model).'
      caption='The server is honest but curious: it follows the protocol and studies everything it receives. The transmitted update is the only channel into the client, and it is the object every defence in the study acts on.'
      minWidth={760}
    >
      <svg viewBox='0 0 1000 400' role='img' aria-label='Threat model: trusted client, observed channel, out-of-scope attacks'>
        <ArrowDefs id={id} />

        <Box x={8} y={8} w={410} h={250} tone='zone' i={0} />
        <Label x={28} y={36} anchor='start' tone='ink' size={14} weight={600}>
          Trusted: inside the client
        </Label>
        {TRUSTED.map((t, i) => (
          <Box key={t} x={28} y={52 + i * 50} w={370} h={40} lines={[t]} align='start' i={i + 1} lineSize={12.5} tone={i === 3 ? 'accent' : 'default'} />
        ))}

        <Box x={582} y={8} w={410} h={250} tone='strong' i={5} />
        <Label x={602} y={36} anchor='start' size={14} weight={600}>
          <tspan className='dg-on-strong'>Observed by the server</tspan>
        </Label>
        {OBSERVED.map((t, i) => (
          <Box key={t} x={602} y={52 + i * 50} w={370} h={40} lines={[t]} align='start' i={i + 6} lineSize={12.5} active={i === 0} />
        ))}

        <Edge id={id} d='M 420 72 L 598 72' active flow i={2} />
        <Label x={509} y={100} tone='accent' size={12.5} weight={600}>
          the only channel
        </Label>
        <Label x={509} y={116} tone='accent' size={12.5} weight={600}>
          the adversary sees
        </Label>

        <Box x={8} y={282} w={984} h={110} tone='dashed' i={10} />
        <Label x={28} y={308} anchor='start' tone='ink' size={14} weight={600}>
          Out of scope
        </Label>
        {OUT.map((t, i) => (
          <Box key={t[0]} x={28 + i * 322} y={322} w={300} h={56} lines={t} align='start' i={11 + i} tone='soft' lineSize={12.5} />
        ))}
      </svg>
    </Figure>
  )
}

export default ThreatModel
