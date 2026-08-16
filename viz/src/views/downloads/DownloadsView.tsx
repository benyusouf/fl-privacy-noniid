'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

// Component Imports
import RunLink from '@/components/site/RunLink'

// Lib Imports
import { downloads, fileUrl } from '@/lib/downloads'
import { allRuns } from '@/lib/results'

const FILE_KINDS = ['metrics.csv', 'config_used.json', 'partition_report.json', 'dp_calibration.json', 'timing.txt', 'provenance.txt', 'run.log']

const DownloadsView = () => {
  const [kind, setKind] = useState<string>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()

    return allRuns
      .filter(r => (q ? r.name.toLowerCase().includes(q) : true))
      .map(r => ({
        run: r,
        files: (downloads.runs[r.name] ?? []).filter(f => (kind === 'all' ? true : f.file === kind))
      }))
      .filter(r => r.files.length > 0)
  }, [kind, query])

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = {}

    for (const files of Object.values(downloads.runs)) for (const f of files) c[f.file] = (c[f.file] ?? 0) + 1

    return c
  }, [])

  return (
    <div className='flex flex-col gap-6'>
      <Card>
        <CardHeader title='What is published' subheader={`${downloads.totalFiles} files, ${downloads.totalLabel}`} />
        <CardContent className='flex flex-col gap-4'>
          <div className='flex gap-2 flex-wrap'>
            {FILE_KINDS.filter(k => kindCounts[k]).map(k => (
              <Chip key={k} size='small' variant='tonal' label={`${k} × ${kindCounts[k]}`} />
            ))}
          </div>
          <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
            {downloads.note}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title='Records of each run'
          subheader='Reconstructed records exist for every run; transcripts do not yet exist for any'
        />
        <CardContent className='flex flex-col gap-3'>
          <Typography className='max-is-[85ch]'>
            <strong>provenance.txt</strong> is a <em>reconstructed record</em>: assembled after the fact from the
            artefacts a run left behind — its configuration, its metrics, its timing. It says so in its own header.
          </Typography>
          <Typography className='max-is-[85ch]'>
            <strong>run.log</strong> would be a <em>transcript</em>: what the process actually printed while it ran.
            None of the {allRuns.length} runs published here has one. Transcript capture begins with Phase C, so these
            two will coexist from then on and must not be read as the same kind of evidence.
          </Typography>
          <div className='flex gap-2 flex-wrap'>
            <Chip size='small' variant='tonal' color='secondary' label={`Reconstructed records: ${allRuns.filter(r => r.hasProvenance).length}`} />
            <Chip size='small' variant='tonal' color='default' label={`Transcripts: ${allRuns.filter(r => r.hasLog).length}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title='Every file, by run'
          subheader={`${rows.length} run${rows.length === 1 ? '' : 's'} shown`}
          action={
            <div className='flex gap-2 flex-wrap'>
              <TextField
                size='small'
                label='Filter by run name'
                value={query}
                onChange={e => setQuery(e.target.value)}
                className='min-is-[220px]'
              />
              <FormControl size='small' className='min-is-[190px]'>
                <InputLabel>File</InputLabel>
                <Select label='File' value={kind} onChange={e => setKind(e.target.value)}>
                  <MenuItem value='all'>All files</MenuItem>
                  {FILE_KINDS.filter(k => kindCounts[k]).map(k => (
                    <MenuItem key={k} value={k}>
                      {k}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          }
        />
        <CardContent>
          <TableContainer className='max-bs-[620px] overflow-auto'>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Run</TableCell>
                  <TableCell>Files</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ run, files }) => (
                  <TableRow key={run.name} hover>
                    <TableCell className='align-top'>
                      <RunLink name={run.name} />
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-x-4 gap-y-1 flex-wrap'>
                        {files.map(f => (
                          <a
                            key={f.file}
                            href={fileUrl(run.name, f.file)}
                            download={f.file}
                            className='flex items-center gap-1 text-primary no-underline'
                            title={f.description}
                          >
                            <i className='tabler-download text-[15px]' />
                            <span className='text-xs'>{f.file}</span>
                            <span className='text-xs text-textDisabled'>{f.sizeLabel}</span>
                          </a>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {rows.length === 0 && (
            <Typography color='text.secondary' className='mbs-4'>
              No runs match that filter.
            </Typography>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default DownloadsView
