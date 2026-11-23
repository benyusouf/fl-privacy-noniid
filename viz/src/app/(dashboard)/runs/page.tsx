// Component Imports
import PageHeader from '@/components/site/PageHeader'
import SectionHead from '@/components/site/SectionHead'
import DataFlow from '@/components/diagrams/DataFlow'
import RunExplorer from '@/views/runs/RunExplorer'

export const metadata = {
  title: 'Run explorer — FL with non-IID data',
  description: 'Filter, inspect and compare every recorded run: accuracy curves, partition reports and exact configurations.'
}

const Page = () => (
  <div className='flex flex-col'>
    <PageHeader
      eyebrow='All recorded runs, Phases A to D'
      title='Run explorer'
      lede='Every recorded run, with its accuracy curve, the partition it was given, and the exact configuration it executed with. Superseded runs are excluded.'
    />
    <DataFlow />
      <SectionHead
        title='Every recorded run'
        lede='Filter, compare, and open any run for its full record.'
      />
      <RunExplorer />
  </div>
)

export default Page
