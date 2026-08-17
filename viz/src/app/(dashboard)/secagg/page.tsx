// Component Imports
import PageHeader from '@/components/site/PageHeader'
import SecaggView from '@/views/secagg/SecaggView'

// Lib Imports
import { maskedRuns, secaggRuns } from '@/lib/results'

export const metadata = {
  title: 'Secure aggregation (RQ2) — FL with non-IID data',
  description:
    'What secure aggregation costs in accuracy, bandwidth and computation, measured against unmasked pairs — and why masking the update alone is not enough for SCAFFOLD.'
}

const Page = () => (
  <div className='flex flex-col'>
    <PageHeader
      eyebrow='RQ2 · Phase C'
      title='Secure aggregation'
      status={{ label: `Phase C complete · ${secaggRuns.length} runs`, color: 'success' }}
      lede={`What masking costs, measured against unmasked pairs at the same configuration. It costs nothing in accuracy and nothing in bandwidth; it costs computation, and that cost tracks the size of what is masked. ${maskedRuns.length} masked runs, each paired with a plain twin that in turn reproduces its Phase A original exactly.`}
    />
    <SecaggView />
  </div>
)

export default Page
