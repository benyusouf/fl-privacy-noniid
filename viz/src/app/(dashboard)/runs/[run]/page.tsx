// Next Imports
import { notFound } from 'next/navigation'

// MUI Imports
import Chip from '@mui/material/Chip'

// Component Imports
import LinkButton from '@/components/site/LinkButton'
import PageHeader from '@/components/site/PageHeader'
import RunDetail from '@/components/site/RunDetail'

// Lib Imports
import { allRunSlugs, runNameFromSlug } from '@/lib/runHref'
import { runByName } from '@/lib/results'

type Props = {
  params: Promise<{ run: string }>
}

/*
 * One page per run.
 *
 * Static export has to enumerate every dynamic route at build time, which is
 * exactly what generateStaticParams does here — 108 pages, one per recorded run.
 * The point is citability: a run becomes a URL that can be linked, bookmarked or
 * quoted, rather than a state you have to reproduce by setting filters.
 */
export const generateStaticParams = async () => allRunSlugs().map(run => ({ run }))

export const generateMetadata = async ({ params }: Props) => {
  const { run: slug } = await params
  const name = runNameFromSlug(slug)

  return {
    title: name ? `${name} — run record` : 'Run not found',
    description: name ? `Full record of run ${name}: accuracy curve, partition, configuration and published files.` : undefined
  }
}

const Page = async ({ params }: Props) => {
  const { run: slug } = await params
  const name = runNameFromSlug(slug)
  const run = name ? runByName(name) : null

  if (!run) notFound()

  return (
    <div className='flex flex-col'>
      <PageHeader
        eyebrow={`Phase ${run.phase} · run record`}
        title={run.name}
        lede={`${run.datasetLabel} · ${run.strategyLabel}${
          run.partitionLabel ? ` · ${run.partitionLabel}` : ''
        } · seed ${run.seed ?? '—'}`}
      />

      <div className='flex gap-2 flex-wrap mbe-6'>
        <LinkButton href='/runs' size='small' variant='tonal' color='secondary'>
          Back to the run explorer
        </LinkButton>
        {run.dp && <Chip variant='tonal' color='secondary' label={`ε = ${run.dp.targetEpsilon}`} className='self-center' />}
        {run.dp === null && <Chip variant='tonal' color='success' label='no privacy mechanism' className='self-center' />}
      </div>

      <RunDetail run={run} />
    </div>
  )
}

export default Page
