// Component Imports
import PageHeader from '@/components/site/PageHeader'
import SectionHead from '@/components/site/SectionHead'
import InversionLoop from '@/components/diagrams/InversionLoop'
import ThreatModel from '@/components/diagrams/ThreatModel'
import AttackView from '@/views/attack/AttackView'

// Lib Imports
import { attack } from '@/lib/attack'

export const metadata = {
  title: 'Gradient inversion (RQ3) — FL with non-IID data',
  description:
    'Whether a gradient-inversion attack recovers training data from what clients transmit, and whether differential privacy and secure aggregation stop it. Every reconstruction is shown.'
}

const Page = () => {
  const recorded = attack?.recorded ?? 0
  const planned = attack?.planned ?? 14

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='RQ3 · Phase E'
        title='What an attacker can recover'
        status={
          recorded >= planned
            ? { label: `Phase E complete · ${recorded} attack conditions`, color: 'success' }
            : { label: `Phase E · ${recorded} of ${planned} attack conditions`, color: 'info' }
        }
        lede='An honest-but-curious server optimises a synthetic image until its gradient matches what a client sent. Fourteen conditions cross six defences with the two objects a client could transmit — one batch gradient, or the multi-epoch update this pipeline actually sends — on the classical attack network, with the study’s own SmallCNN as an architectural control. Every reconstruction is shown beside the image it tried to recover.'
      />
      <InversionLoop />
      <div className='mbs-6'>
        <ThreatModel />
      </div>
      <SectionHead
        title='What the attack recovered'
        lede='Fourteen conditions, every reconstruction beside the image it tried to recover.'
      />
      <AttackView />
    </div>
  )
}

export default Page
