// Type Imports
import type { ThemeColor } from '@core/types'

type Props = {
  label: string
  value: string
  hint?: string
  /** Accepted for call-site compatibility; stat tiles no longer carry icons. */
  icon?: string
  color?: ThemeColor
}

/*
 * A single figure: label, value, and the qualification that keeps it honest.
 * No coloured icon tile — the number is the point.
 */
const StatCard = ({ label, value, hint }: Props) => (
  <div className='stat'>
    <span className='stat__label'>{label}</span>
    <span className='stat__value'>{value}</span>
    {hint && <span className='stat__hint'>{hint}</span>}
  </div>
)

export default StatCard
