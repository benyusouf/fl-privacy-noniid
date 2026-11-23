// React Imports
import type { ReactNode } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'

// Type Imports
import type { ThemeColor } from '@core/types'

type Props = {
  title: string
  subtitle?: string
  /** Tabler icon, drawn small and monochrome beside the title. */
  icon: string
  /** Kept for call-site compatibility; the overhaul uses one accent, so colour is ignored. */
  color?: ThemeColor
  action?: ReactNode
  children: ReactNode
  /** Constrain body text to a comfortable measure. Off for tables and charts. */
  prose?: boolean
  /** A small explanatory diagram shown beside the text on wide screens. */
  figure?: ReactNode
  id?: string
}

/*
 * A titled section. The template's tinted, multi-coloured icon tiles are gone:
 * the icon is a quiet monochrome glyph, and the title carries the hierarchy.
 */
const SectionCard = ({ title, subtitle, icon, action, children, prose = false, figure, id }: Props) => (
  <Card id={id} className='scroll-mt-20'>
    <CardHeader
      title={
        <span className='flex items-center gap-2.5'>
          <i className={`${icon} text-[18px] text-[var(--ink-3)]`} aria-hidden />
          <span>{title}</span>
        </span>
      }
      subheader={subtitle}
      action={action}
    />
    {figure ? (
      <CardContent className='section-card__split'>
        <div className='flex flex-col gap-3 min-is-0 prose'>{children}</div>
        <div className='section-card__figure'>{figure}</div>
      </CardContent>
    ) : (
      <CardContent className={`flex flex-col gap-3${prose ? ' max-is-[78ch] prose' : ''}`}>{children}</CardContent>
    )}
  </Card>
)

export default SectionCard
