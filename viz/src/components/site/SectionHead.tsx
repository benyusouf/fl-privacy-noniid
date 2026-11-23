// React Imports
import type { ReactNode } from 'react'

type Props = {
  title: string
  lede?: ReactNode
  id?: string
}

/** A section title within a page: one heading level below the page title. */
const SectionHead = ({ title, lede, id }: Props) => (
  <div className='section-head' id={id}>
    <h2 className='section-head__title'>{title}</h2>
    {lede && <p className='section-head__lede'>{lede}</p>}
  </div>
)

export default SectionHead
