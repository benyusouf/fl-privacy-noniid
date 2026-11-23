'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, useSvgId } from './primitives'

/*
 * How a number reaches the page. Two lanes leave the recorded results: one
 * builds the data bundle every chart reads, the other publishes the raw files
 * for download. Nothing on the site is computed from anything not served
 * alongside it.
 */

type Lane = 'bundle' | 'files'

type Props = {
  /** Highlight one lane by default, e.g. 'files' on the downloads page. */
  emphasis?: Lane
  title?: string
}

const DataFlow = ({ emphasis, title = 'How a recorded run becomes a page' }: Props) => {
  const id = useSvgId()
  const [hover, setHover] = useState<Lane | null>(null)
  const lane = hover ?? emphasis ?? null
  const m = (l: Lane) => lane !== null && lane !== l

  return (
    <Figure
      title={title}
      source='The build pipeline in viz/scripts. CSV is converted at build time; the browser never parses it.'
      caption='Every figure on the site is drawn from the bundle, and every file the bundle was built from is published beside it, so any number can be traced to the file it came from.'
      action={
        <div className='seg' role='group' aria-label='Highlight a lane'>
          <button type='button' aria-pressed={lane === 'bundle'} onClick={() => setHover(h => (h === 'bundle' ? null : 'bundle'))}>
            Charts and tables
          </button>
          <button type='button' aria-pressed={lane === 'files'} onClick={() => setHover(h => (h === 'files' ? null : 'files'))}>
            Downloads
          </button>
        </div>
      }
      minWidth={760}
    >
      <svg viewBox='0 0 1000 250' role='img' aria-label='Data flow from recorded results to the site'>
        <ArrowDefs id={id} />
        <Box
          x={8}
          y={60}
          w={220}
          h={130}
          tone='strong'
          title='results/<run>/'
          mono
          lines={['metrics.csv', 'config_used.json', 'partition_report.json', 'dp_calibration.json, …']}
          lineSize={12}
          i={0}
        />

        <Edge id={id} d='M 230 100 C 270 100, 270 52, 306 52' active={lane === 'bundle'} muted={m('bundle')} i={1} />
        <Box x={308} y={20} w={200} h={64} title='build-data.mjs' mono lines={['detects each CSV schema']} active={lane === 'bundle'} muted={m('bundle')} i={1} onEnter={() => setHover('bundle')} onLeave={() => setHover(null)} />
        <Edge id={id} d='M 510 52 L 564 52' active={lane === 'bundle'} muted={m('bundle')} i={2} />
        <Box x={566} y={20} w={190} h={64} title='results.json' mono lines={['one typed bundle']} active={lane === 'bundle'} muted={m('bundle')} i={2} onEnter={() => setHover('bundle')} onLeave={() => setHover(null)} />
        <Edge id={id} d='M 758 52 L 806 52' active={lane === 'bundle'} muted={m('bundle')} i={3} />
        <Box x={808} y={20} w={184} h={64} tone='accent' title='Every chart and table' lines={['and its CSV export']} active={lane === 'bundle'} muted={m('bundle')} i={3} />

        <Edge id={id} d='M 230 150 C 270 150, 270 198, 306 198' active={lane === 'files'} muted={m('files')} i={4} />
        <Box x={308} y={166} w={200} h={64} title='build-downloads.mjs' mono lines={['copies every recorded file']} active={lane === 'files'} muted={m('files')} i={4} onEnter={() => setHover('files')} onLeave={() => setHover(null)} />
        <Edge id={id} d='M 510 198 L 564 198' active={lane === 'files'} muted={m('files')} i={5} />
        <Box x={566} y={166} w={190} h={64} title='public/data/runs/' mono lines={['plus one archive']} active={lane === 'files'} muted={m('files')} i={5} onEnter={() => setHover('files')} onLeave={() => setHover(null)} />
        <Edge id={id} d='M 758 198 L 806 198' active={lane === 'files'} muted={m('files')} i={6} />
        <Box x={808} y={166} w={184} h={64} tone='accent' title='Download links' lines={['per run, and in full']} active={lane === 'files'} muted={m('files')} i={6} />
      </svg>
    </Figure>
  )
}

export default DataFlow
