// MUI Imports
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

type Props = {
  eyebrow?: string
  title: string
  lede?: string
  status?: { label: string; color: 'success' | 'warning' | 'info' | 'default' | 'error' }
}

const PageHeader = ({ eyebrow, title, lede, status }: Props) => (
  <div className='flex flex-col gap-2 mbe-6'>
    {eyebrow && (
      <Typography variant='overline' color='text.secondary'>
        {eyebrow}
      </Typography>
    )}
    <div className='flex items-center gap-3 flex-wrap'>
      <Typography variant='h4'>{title}</Typography>
      {status && <Chip size='small' variant='tonal' color={status.color} label={status.label} />}
    </div>
    {lede && (
      <Typography color='text.secondary' className='max-is-[80ch]'>
        {lede}
      </Typography>
    )}
  </div>
)

export default PageHeader
