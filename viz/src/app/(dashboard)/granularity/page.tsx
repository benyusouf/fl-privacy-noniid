// Component Imports
import PageHeader from '@/components/site/PageHeader'
import GranularityView from '@/views/granularity/GranularityView'

// Lib Imports
import { phaseDRuns } from '@/lib/results'

export const metadata = {
  title: 'What the guarantee protects (RQ3) — FL with non-IID data',
  description:
    'Whether client-level differential privacy is viable at cross-silo scale, and whether time-adaptive budget spending helps. The strongest negative result in the study.'
}

const Page = () => {
  const counted = phaseDRuns.filter(r => r.counted).length

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow='RQ3 · Phase D'
        title='What the guarantee protects'
        status={{ label: `Phase D complete · ${counted} counted runs`, color: 'success' }}
        lede='Sample-level differential privacy protects one record; client-level protects one institution. They are not the same strength at the same nominal ε, and at fifteen silos under full participation the stronger guarantee cannot be bought at any budget this study tried. Every arm here shares one cell — CIFAR-10, FedAvg, Dirichlet α = 0.1, seed 0 — so only the mechanism differs.'
      />
      <GranularityView />
    </div>
  )
}

export default Page
