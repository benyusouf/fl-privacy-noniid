// React Imports
import type { ReactNode } from 'react'

// MUI Imports
import Chip from '@mui/material/Chip'

type Props = {
  /** Context line above the title, e.g. "RQ1 · Phase A". A leading RQn is drawn as a tag. */
  eyebrow?: string
  title: string
  lede?: ReactNode
  status?: { label: string; color: 'success' | 'warning' | 'info' | 'default' | 'error' }
  /** Set the title in the code face, for identifiers such as run names. */
  mono?: boolean
}

/*
 * Page title block. The research question a page answers is pulled out of the
 * context line and shown as the one accent-coloured tag on the page, so a
 * reader always knows which question they are looking at.
 */
const PageHeader = ({ eyebrow, title, lede, status, mono = false }: Props) => {
  const match = eyebrow?.match(/^(RQ\d)\s*[·,]?\s*(.*)$/)
  const rq = match?.[1]
  const rest = match ? match[2] : eyebrow

  return (
    <header className='page-head'>
      {(eyebrow || status) && (
        <div className='page-head__context'>
          {rq && <span className='page-head__rq'>{rq}</span>}
          {rest && <span>{rest}</span>}
          {status && <Chip size='small' variant='tonal' color={status.color} label={status.label} />}
        </div>
      )}
      <h1 className={`page-head__title${mono ? ' page-head__title--mono' : ''}`}>{title}</h1>
      {lede && <p className='page-head__lede'>{lede}</p>}
    </header>
  )
}

export default PageHeader
