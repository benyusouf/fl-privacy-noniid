// Component Imports
import PageHeader from '@/components/site/PageHeader'
import Rq1View from '@/views/rq1/Rq1View'
import NonIidTaxonomy from '@/components/diagrams/NonIidTaxonomy'
import SectionHead from '@/components/site/SectionHead'

export const metadata = {
  title: 'Headline result (RQ1) — FL with non-IID data',
  description:
    'Final accuracy against measured Hellinger distance for four aggregation strategies, compared with a centralized baseline.'
}

const Page = () => (
  <div className='flex flex-col'>
    <PageHeader
      eyebrow='RQ1 · Phase A'
      title='Federated versus centralized as heterogeneity rises'
      status={{ label: 'Phase A complete', color: 'success' }}
      lede='How does federated learning compare with centralized training as data heterogeneity increases, across four aggregation strategies? Accuracy is plotted against measured Hellinger distance rather than the partition parameter that produced it.'
    />
    <NonIidTaxonomy />
    <SectionHead
      title='What the results show'
      lede='Final accuracy for each strategy and partition, against the heterogeneity each partition actually produced.'
    />
    <Rq1View />
  </div>
)

export default Page
