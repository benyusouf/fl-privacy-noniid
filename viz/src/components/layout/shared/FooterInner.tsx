'use client'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Tooltip from '@mui/material/Tooltip'

// Config Imports
import author from '@configs/author'

type Props = {
  /** Hide the social links on small screens, matching the template's behaviour. */
  compact?: boolean
}

/*
 * Footer contents, shared by the vertical and horizontal layouts.
 *
 * The template shipped the same markup duplicated across both layout footers,
 * which meant every change had to be made twice and could silently drift. The
 * two footers now differ only in the layout class applied by their wrappers.
 *
 * On the licence line: MIT covers the research code written for this study. It
 * does not cover the Vuexy template this interface is built on, which is
 * commercially licensed — hence the wording "research code", not "this site".
 */
const FooterInner = ({ compact = false }: Props) => (
  <>
    <p className='text-textSecondary'>
      <span>{`© ${new Date().getFullYear()} `}</span>
      <Link href={author.social[0].href} target='_blank' rel='noopener noreferrer' className='text-primary'>
        {author.name}
      </Link>
      <span className='hidden sm:inline'>
        {' · '}
        <Link
          href={`${author.repository}/blob/main/LICENSE`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary'
        >
          Research code under MIT
        </Link>
      </span>
    </p>

    {!compact && (
      <div className='flex items-center gap-1'>
        {author.social.map(link => (
          <Tooltip key={link.label} title={link.label} placement='top'>
            <Link
              href={link.href}
              target='_blank'
              rel='noopener noreferrer'
              aria-label={link.label}
              className='flex items-center justify-center bs-8 is-8 rounded text-textSecondary hover:text-primary'
            >
              <i className={`${link.icon} text-[20px]`} />
            </Link>
          </Tooltip>
        ))}
      </div>
    )}
  </>
)

export default FooterInner
