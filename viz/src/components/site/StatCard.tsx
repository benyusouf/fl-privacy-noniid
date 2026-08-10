// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

type Props = {
  label: string
  value: string
  hint?: string
}

const StatCard = ({ label, value, hint }: Props) => (
  <Card>
    <CardContent className='flex flex-col gap-1'>
      <Typography variant='body2' color='text.secondary'>
        {label}
      </Typography>
      <Typography variant='h5'>{value}</Typography>
      {hint && (
        <Typography variant='caption' color='text.secondary'>
          {hint}
        </Typography>
      )}
    </CardContent>
  </Card>
)

export default StatCard
