// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

// Type Imports
import type { ThemeColor } from '@core/types'

export type PhaseProgressItem = {
  id: string
  title: string
  status: 'complete' | 'running' | 'pending'
  /** Runs recorded so far, and how many the design calls for. */
  done: number
  planned: number
  /** True when the phase trains nothing, so a run count would mislead. */
  noTraining?: boolean
}

type Props = {
  phases: PhaseProgressItem[]
}

const COLOUR: Record<PhaseProgressItem['status'], ThemeColor> = {
  complete: 'success',
  running: 'info',
  pending: 'secondary'
}

/*
 * How far the study has got, at a glance.
 *
 * Five nodes on a rail, echoing the site's mark: a filled node is a finished
 * phase, a ringed node one in progress, a hollow node one not started. Counts
 * come from the recorded data rather than from a hardcoded list, so the strip
 * cannot claim more progress than there are runs to support.
 */
const PhaseProgress = ({ phases }: Props) => {
  const totalDone = phases.reduce((a, p) => a + (p.noTraining ? 0 : p.done), 0)
  const totalPlanned = phases.reduce((a, p) => a + (p.noTraining ? 0 : p.planned), 0)

  return (
    <Card>
      <CardContent className='flex flex-col gap-5'>
        <div className='flex items-baseline justify-between gap-3 flex-wrap'>
          <Typography variant='h6'>Progress through the five phases</Typography>
          <Typography variant='body2' color='text.secondary'>
            {totalDone} of {totalPlanned} training runs recorded
          </Typography>
        </div>

        <LinearProgress
          variant='determinate'
          value={totalPlanned ? (totalDone / totalPlanned) * 100 : 0}
          color='primary'
          className='bs-2 rounded'
        />

        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4'>
          {phases.map(p => {
            const colour = COLOUR[p.status]

            return (
              <div key={p.id} className='flex flex-col gap-2'>
                <div className='flex items-center gap-2'>
                  <span
                    className='flex items-center justify-center bs-8 is-8 rounded-full text-sm font-medium'
                    style={
                      p.status === 'pending'
                        ? {
                            border: `2px solid var(--mui-palette-${colour}-main)`,
                            color: `var(--mui-palette-${colour}-main)`
                          }
                        : {
                            background: `var(--mui-palette-${colour}-main)`,
                            color: `var(--mui-palette-${colour}-contrastText)`
                          }
                    }
                  >
                    {p.id}
                  </span>
                  {p.status === 'complete' && <i className='tabler-check text-[18px] text-success' />}
                  {p.status === 'running' && <i className='tabler-progress text-[18px] text-info' />}
                </div>
                <Typography variant='body2' className='font-medium'>
                  {p.title}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {p.noTraining ? `${p.planned} attack conditions` : `${p.done} of ${p.planned} runs`}
                </Typography>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default PhaseProgress
