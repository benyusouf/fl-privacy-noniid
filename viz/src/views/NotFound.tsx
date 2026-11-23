'use client'

// Next Imports
import Link from 'next/link'

// Type Imports
import type { SystemMode } from '@core/types'

// Component Imports
import LogoMark from '@components/layout/shared/LogoMark'

/*
 * 404. The template's cartoon illustration and background mask are gone: a
 * plain statement of what happened and the two useful ways forward.
 */
const NotFound = ({ mode }: { mode: SystemMode }) => {
  void mode

  return (
    <main className='flex items-center justify-center min-bs-[100dvh] p-6'>
      <div className='flex flex-col items-start gap-4 max-is-[460px]'>
        <LogoMark className='text-[28px] text-[var(--accent)]' aria-hidden />
        <p className='text-sm text-[var(--ink-2)]'>Error 404</p>
        <h1 className='page-head__title'>This page is not part of the results explorer</h1>
        <p className='page-head__lede'>
          The address may be mistyped, or the page may have moved. Every result is reachable from the overview, and
          every run from the run explorer.
        </p>
        <div className='flex gap-3 flex-wrap mbs-2'>
          <Link href='/' className='btn btn--primary'>
            Go to the overview
          </Link>
          <Link href='/runs' className='btn'>
            Open the run explorer
          </Link>
        </div>
      </div>
    </main>
  )
}

export default NotFound
