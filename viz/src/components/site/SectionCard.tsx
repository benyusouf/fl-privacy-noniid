// React Imports
import type { ReactNode } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Type Imports
import type { ThemeColor } from '@core/types'

type Props = {
  title: string
  subtitle?: string
  icon: string
  color?: ThemeColor
  action?: ReactNode
  children: ReactNode
  /** Constrain body text to a comfortable measure. Off for tables and charts. */
  prose?: boolean
}

/*
 * A titled section with a tinted icon.
 *
 * The background pages — phases, concepts, methodology, limitations — were long
 * runs of visually identical cards, which made them read as one undifferentiated
 * wall. Giving each section an icon and a colour lets a reader navigate by shape
 * rather than by reading every heading, and keeps the four pages consistent with
 * each other rather than each drifting into its own layout.
 */
const SectionCard = ({ title, subtitle, icon, color = 'primary', action, children, prose = false }: Props) => (
  <Card>
    <CardHeader
      avatar={
        <CustomAvatar color={color} skin='light' variant='rounded' size={42}>
          <i className={`${icon} text-[24px]`} />
        </CustomAvatar>
      }
      title={<Typography variant='h6'>{title}</Typography>}
      subheader={
        subtitle && (
          <Typography variant='body2' color='text.secondary'>
            {subtitle}
          </Typography>
        )
      }
      action={action}
    />
    <CardContent className={prose ? 'flex flex-col gap-3 max-is-[85ch]' : 'flex flex-col gap-3'}>{children}</CardContent>
  </Card>
)

export default SectionCard
