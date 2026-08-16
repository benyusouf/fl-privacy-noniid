// Component Imports
import PageHeader from '@/components/site/PageHeader'
import PrivacyView from '@/views/privacy/PrivacyView'

export const metadata = {
  title: 'The cost of differential privacy (RQ2) — FL with non-IID data',
  description:
    'What sample-level differential privacy costs in accuracy, how that cost interacts with data heterogeneity, and which clients carry the noise.'
}

const Page = () => (
  <div className='flex flex-col'>
    <PageHeader
      eyebrow='RQ2 · Phase B'
      title='The cost of differential privacy'
      status={{ label: 'Phase B complete · 36 runs', color: 'success' }}
      lede='What accuracy differential privacy costs, and what it does to the relationship between heterogeneity and accuracy that Phase A established. The headline cost is about nineteen points; the more interesting result is that accuracy stops tracking heterogeneity at all.'
    />
    <PrivacyView />
  </div>
)

export default Page
