'use client'

// Next Imports
import Link from 'next/link'

// Lib Imports
import { runHref } from '@/lib/runHref'

type Props = {
  name: string
  /** Render plainly when the target is the page already being viewed. */
  plain?: boolean
}

/*
 * A run name that goes somewhere.
 *
 * Every run has its own page, so a run name is always a link — in the explorer,
 * in the comparator table, in the privacy view. That makes a run citable: it can
 * be linked to directly rather than reproduced by setting filters.
 */
const RunLink = ({ name, plain = false }: Props) => {
  if (plain) return <code className='text-xs'>{name}</code>

  return (
    <Link href={runHref(name)} className='text-primary no-underline hover:underline'>
      <code className='text-xs'>{name}</code>
    </Link>
  )
}

export default RunLink
