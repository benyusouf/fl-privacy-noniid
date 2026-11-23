'use client'

// Next Imports
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Data Imports
import { READING_ORDER, itemForPath, normalisePath } from './navigation'

/*
 * Previous / next at the foot of every page, in reading order. The "next" card
 * carries a one-line summary so the reader knows why to keep going. Run detail
 * pages return to the explorer instead of advancing.
 */
const JourneyNav = () => {
  const pathname = normalisePath(usePathname())
  const current = itemForPath(pathname)

  if (!current) return null

  if (pathname.startsWith('/runs/')) {
    return (
      <nav className='journey-nav' aria-label='Continue reading'>
        <Link href='/runs' className='journey-nav__card journey-nav__card--prev'>
          <span className='journey-nav__dir'>
            <i className='tabler-arrow-left' aria-hidden /> Back to
          </span>
          <span className='journey-nav__title'>Run explorer</span>
        </Link>
      </nav>
    )
  }

  const i = READING_ORDER.findIndex(n => n.href === current.href)
  const prev = i > 0 ? READING_ORDER[i - 1] : null
  const next = i < READING_ORDER.length - 1 ? READING_ORDER[i + 1] : null

  return (
    <nav className='journey-nav' aria-label='Continue reading'>
      {prev ? (
        <Link href={prev.href} className='journey-nav__card journey-nav__card--prev'>
          <span className='journey-nav__dir'>
            <i className='tabler-arrow-left' aria-hidden /> Previous
          </span>
          <span className='journey-nav__title'>
            {prev.label}
            {prev.rq && <span className='journey-nav__rq'>{prev.rq}</span>}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className='journey-nav__card journey-nav__card--next'>
          <span className='journey-nav__dir'>
            Next <i className='tabler-arrow-right' aria-hidden />
          </span>
          <span className='journey-nav__title'>
            {next.label}
            {next.rq && <span className='journey-nav__rq'>{next.rq}</span>}
          </span>
          <span className='journey-nav__summary'>{next.summary}</span>
        </Link>
      )}
    </nav>
  )
}

export default JourneyNav
