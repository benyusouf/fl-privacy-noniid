'use client'

// MUI Imports
import Typography from '@mui/material/Typography'

type Props = {
  items: { label: string; colour: string; note?: string }[]
}

/*
 * Rendered as HTML below the chart rather than inside the SVG, so that long
 * labels wrap and can be selected and read by a screen reader.
 */
const ChartLegend = ({ items }: Props) => {
  if (!items.length) return null

  return (
    <div className='flex flex-wrap gap-4 mbs-3 justify-center'>
      {items.map(i => (
        <div key={i.label} className='flex items-center gap-2'>
          <span
            style={{ background: i.colour, inlineSize: 12, blockSize: 12, borderRadius: 2, display: 'inline-block' }}
          />
          <Typography variant='caption' color='text.secondary'>
            {i.label}
            {i.note && ` ${i.note}`}
          </Typography>
        </div>
      ))}
    </div>
  )
}

export default ChartLegend
