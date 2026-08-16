'use client'

// MUI Imports
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'

// Type Imports
import type { Run } from '@/types/results'

// Lib Imports
import { fileUrl, filesFor } from '@/lib/downloads'

type Props = {
  run: Run
}

const RunFiles = ({ run }: Props) => {
  const files = filesFor(run.name)

  if (!files.length) return <Typography color='text.secondary'>No published files for this run.</Typography>

  return (
    <div>
      <TableContainer>
        <Table size='small'>
          <TableBody>
            {files.map(f => (
              <TableRow key={f.file} hover>
                <TableCell>
                  <a
                    href={fileUrl(run.name, f.file)}
                    download={f.file}
                    className='flex items-center gap-2 text-primary no-underline'
                  >
                    <i className='tabler-download text-[16px]' />
                    <code className='text-xs'>{f.file}</code>
                  </a>
                </TableCell>
                <TableCell>
                  <Typography variant='caption' color='text.secondary'>
                    {f.description}
                  </Typography>
                </TableCell>
                <TableCell align='right'>
                  <Typography variant='caption' color='text.secondary'>
                    {f.sizeLabel}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/*
        A transcript and a reconstructed record are not the same thing. A
        transcript is what the run printed as it ran; a reconstructed record was
        assembled afterwards from the artefacts it left behind. The provenance
        file says so in its own header, and labelling them alike here would
        undercut that.
      */}
      <div className='flex gap-2 flex-wrap items-center mbs-3'>
        {run.hasProvenance && <Chip size='small' variant='tonal' color='secondary' label='Reconstructed record' />}
        {run.hasLog && <Chip size='small' variant='tonal' color='success' label='Run transcript' />}
        {!run.hasLog && (
          <Typography variant='caption' color='text.secondary'>
            No transcript was captured for this run; the record was reconstructed from its artefacts afterwards.
          </Typography>
        )}
      </div>
    </div>
  )
}

export default RunFiles
