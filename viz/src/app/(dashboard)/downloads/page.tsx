// MUI Imports
import Button from '@mui/material/Button'

// Component Imports
import PageHeader from '@/components/site/PageHeader'
import DownloadsView from '@/views/downloads/DownloadsView'

// Lib Imports
import { archiveUrl, downloads } from '@/lib/downloads'

export const metadata = {
  title: 'Data and records — FL with non-IID data',
  description:
    'Every recorded file from every run: metrics, configurations, partition reports, privacy calibration, timings and run records.'
}

const Page = () => (
  <div className='flex flex-col'>
    <PageHeader
      eyebrow='Data'
      title='Data and records'
      lede='Every figure on this site is computed from files served here. Nothing is shown that cannot be traced back to one of them, and model checkpoints are the only recorded artefact deliberately withheld.'
    />

    <div className='mbe-6'>
      <Button
        component='a'
        href={archiveUrl()}
        download
        variant='contained'
        startIcon={<i className='tabler-download' />}
      >
        Download everything ({downloads.archive.sizeLabel})
      </Button>
    </div>

    <DownloadsView />
  </div>
)

export default Page
