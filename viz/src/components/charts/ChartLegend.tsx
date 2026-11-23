'use client'

// MUI Imports
import Typography from '@mui/material/Typography'

type Props = {
  items: { label: string; colour: string; note?: string; key?: string; marker?: 'circle' | 'square' | 'triangle' | 'diamond' }[]
  /** Linked highlighting: the key of the hovered item, and a setter. */
  active?: string | null
  onActive?: (key: string | null) => void
}

const Swatch = ({ colour, marker }: { colour: string; marker?: Props['items'][number]['marker'] }) => (
  <svg width={12} height={12} viewBox='0 0 12 12' aria-hidden style={{ flex: 'none' }}>
    {marker === 'square' ? (
      <rect x={1.5} y={1.5} width={9} height={9} rx={1.5} fill={colour} />
    ) : marker === 'triangle' ? (
      <path d='M6 1 L11 10.5 L1 10.5 Z' fill={colour} />
    ) : marker === 'diamond' ? (
      <path d='M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z' fill={colour} />
    ) : marker === 'circle' ? (
      <circle cx={6} cy={6} r={5} fill={colour} />
    ) : (
      <rect x={0} y={0} width={12} height={12} rx={2} fill={colour} />
    )}
  </svg>
)

/*
 * Rendered as HTML below the chart rather than inside the SVG, so that long
 * labels wrap and can be selected and read by a screen reader.
 */
const ChartLegend = ({ items, active = null, onActive }: Props) => {
  if (!items.length) return null

  return (
    <div className='flex flex-wrap gap-x-5 gap-y-2 mbs-3 justify-center'>
      {items.map(i => {
        const key = i.key ?? i.label
        const dim = active !== null && active !== key

        const content = (
          <>
            <Swatch colour={i.colour} marker={i.marker} />
            <Typography variant='caption' color='text.secondary' component='span'>
              {i.label}
              {i.note && ` ${i.note}`}
            </Typography>
          </>
        )

        return onActive ? (
          <button
            key={key}
            type='button'
            className='chart-legend__item'
            style={{ opacity: dim ? 0.4 : 1 }}
            aria-pressed={active === key}
            onMouseEnter={() => onActive(key)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(key)}
            onBlur={() => onActive(null)}
          >
            {content}
          </button>
        ) : (
          <div key={key} className='flex items-center gap-2'>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export default ChartLegend
