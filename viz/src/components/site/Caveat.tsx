// MUI Imports
import type { ReactNode } from 'react'

import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'


type Props = {
  title?: string
  severity?: 'info' | 'warning' | 'error' | 'success'
  children: ReactNode
}

/*
 * Used wherever a number on this site needs a qualification attached to it.
 *
 * The study's posture is that a declared limitation beats a tidy number, so
 * these are deliberately placed next to the figures they qualify rather than
 * collected on a separate page. The Limitations section gathers them again,
 * but no figure should depend on the reader having gone there first.
 */
const Caveat = ({ title, severity = 'warning', children }: Props) => (
  <Alert severity={severity} className='mbe-4'>
    {title && <AlertTitle>{title}</AlertTitle>}
    {children}
  </Alert>
)

export default Caveat
