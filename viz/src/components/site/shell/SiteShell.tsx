'use client'

// React Imports
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Component Imports
import LogoMark from '@components/layout/shared/LogoMark'
import ThemeToggle from './ThemeToggle'
import JourneyNav from './JourneyNav'

// Config Imports
import author from '@configs/author'

// Data Imports
import { JOURNEY, NAV, itemForPath, normalisePath } from './navigation'

/*
 * The layout shell, replacing the template's vertical layout.
 *
 * Docs-style: a slim header, a sticky sidebar whose "Results" group is drawn as
 * a numbered rail (the five results pages are meant to be read in order), and a
 * single left-aligned reading column. Below 1024px the sidebar becomes a
 * drawer opened from the header.
 */
const SiteShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const active = itemForPath(pathname)
  const activeJourneyIndex = JOURNEY.findIndex(i => i.href === active?.href)

  // Close the drawer on navigation, and on Escape.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className='site'>
      <a href='#main' className='skip-link'>
        Skip to content
      </a>

      <header className='site-header'>
        <div className='site-header__inner'>
          <button
            type='button'
            className='site-header__menu'
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls='site-sidebar'
            onClick={() => setOpen(o => !o)}
          >
            <i className={open ? 'tabler-x' : 'tabler-menu-2'} aria-hidden />
          </button>

          <Link href='/' className='site-brand' aria-label='Overview'>
            <LogoMark className='site-brand__mark' aria-hidden />
            <span className='site-brand__name'>Federated learning, non-IID</span>
            <span className='site-brand__sub'>MSc results</span>
          </Link>

          <div className='site-header__end'>
            <a
              href={author.repository}
              target='_blank'
              rel='noopener noreferrer'
              className='site-header__link'
              aria-label='Source code on GitHub'
            >
              <i className='tabler-brand-github' aria-hidden />
              <span className='hidden sm:inline'>Code</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className='site-body'>
        {open && <div className='site-scrim' onClick={() => setOpen(false)} aria-hidden />}

        <nav id='site-sidebar' className={`site-sidebar${open ? ' is-open' : ''}`} aria-label='Site'>
          {NAV.map(group => (
            <div key={group.label ?? 'root'} className='nav-group'>
              {group.label && <p className='nav-group__label'>{group.label}</p>}

              {group.journey ? (
                <ol className='nav-rail'>
                  {group.items.map((item, i) => {
                    const isActive = active?.href === item.href
                    const isPast = activeJourneyIndex > i

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`nav-rail__item${isActive ? ' is-active' : ''}${isPast ? ' is-past' : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <span className='nav-rail__node' aria-hidden>
                            {i + 1}
                          </span>
                          <span className='nav-rail__text'>
                            <span className='nav-rail__label'>{item.label}</span>
                            <span className='nav-rail__rq'>{item.rq}</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <ul className='nav-list'>
                  {group.items.map(item => {
                    const isActive = active?.href === item.href

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`nav-list__item${isActive ? ' is-active' : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <i className={item.icon} aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}

          <div className='nav-foot'>
            <p className='nav-foot__name'>{author.name}</p>
            <p>
              {author.role}, {author.affiliation}
            </p>
          </div>
        </nav>

        <div className='site-main-wrap'>
          <main id='main' className='site-main' data-path={normalisePath(pathname)}>
            {children}
            <JourneyNav />
          </main>

          <footer className='site-footer'>
            <p>
              © {new Date().getFullYear()}{' '}
              <a href={author.social[0].href} target='_blank' rel='noopener noreferrer'>
                {author.name}
              </a>
              . Research code under the{' '}
              <a href={`${author.repository}/blob/main/LICENSE`} target='_blank' rel='noopener noreferrer'>
                MIT licence
              </a>
              .
            </p>
            <ul className='site-footer__social'>
              {author.social.map(link => (
                <li key={link.label}>
                  <a href={link.href} target='_blank' rel='noopener noreferrer' aria-label={link.label}>
                    <i className={link.icon} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default SiteShell
