// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Type Imports
import type { ThemeColor } from '@core/types'

type Props = {
  label: string
  value: string
  hint?: string
  /** Iconify class from the bundled Tabler set. */
  icon?: string
  color?: ThemeColor
}

/*
 * Summary figure, in the template's own idiom: value on the left, a tinted
 * rounded avatar carrying the icon on the right. Using CustomAvatar rather than
 * a bare <i> keeps the tint tied to the theme palette, so it follows the primary
 * colour and dark mode without a second definition.
 */
const StatCard = ({ label, value, hint, icon, color = 'primary' }: Props) => (
  <Card>
    <CardContent className='flex items-start justify-between gap-3'>
      <div className='flex flex-col gap-1'>
        <Typography variant='body2' color='text.secondary'>
          {label}
        </Typography>
        <Typography variant='h4'>{value}</Typography>
        {hint && (
          <Typography variant='caption' color='text.secondary'>
            {hint}
          </Typography>
        )}
      </div>
      {icon && (
        <CustomAvatar color={color} skin='light' variant='rounded' size={44}>
          <i className={`${icon} text-[26px]`} />
        </CustomAvatar>
      )}
    </CardContent>
  </Card>
)

export default StatCard
