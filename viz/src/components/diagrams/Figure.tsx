'use client'

// React Imports
import type { ReactNode } from 'react'

// Hook Imports
import { useInView } from './useInView'

type Props = {
  /** Short, specific title: what the diagram explains. */
  title: string
  /** One or two sentences under the drawing. */
  caption?: ReactNode
  /** Where the drawing comes from, e.g. "Redrawn from Figure 2.2". */
  source?: string
  /** Step controls or a legend, rendered between the drawing and the caption. */
  controls?: ReactNode
  /** Optional element on the right of the title row (a toggle, say). */
  action?: ReactNode
  children: ReactNode
  /** Smallest width the drawing may shrink to before it scrolls sideways. */
  minWidth?: number
  className?: string
}

/*
 * Frame for every explanatory diagram on the site.
 *
 * The diagrams are redrawn from the dissertation's figures and the defence
 * deck as inline SVG, styled entirely through CSS variables, so they follow the
 * light/dark theme and the single accent. Each plays one entrance when it first
 * scrolls into view (nodes settle in, flows draw) and is then still unless the
 * reader steps through it.
 */
const Figure = ({ title, caption, source, controls, action, children, minWidth = 620, className = '' }: Props) => {
  const [ref, inView] = useInView<HTMLElement>()

  return (
    <figure ref={ref} className={`dg-figure${inView ? ' is-visible' : ''} ${className}`}>
      <div className='dg-figure__head'>
        <figcaption className='dg-figure__title'>{title}</figcaption>
        {action && <div className='dg-figure__action'>{action}</div>}
      </div>
      <div className='dg-figure__canvas'>
        <div style={{ minInlineSize: minWidth }}>{children}</div>
      </div>
      {controls && <div className='dg-figure__controls'>{controls}</div>}
      {(caption || source) && (
        <div className='dg-figure__foot'>
          {caption && <div className='dg-figure__caption'>{caption}</div>}
          {source && <p className='dg-figure__source'>{source}</p>}
        </div>
      )}
    </figure>
  )
}

export default Figure
