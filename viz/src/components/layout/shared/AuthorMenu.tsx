'use client'

// React Imports
import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Avatar from '@mui/material/Avatar'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Divider from '@mui/material/Divider'
import Fade from '@mui/material/Fade'
import MenuItem from '@mui/material/MenuItem'
import MenuList from '@mui/material/MenuList'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Typography from '@mui/material/Typography'

// Config Imports
import author from '@configs/author'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { asset } from '@/utils/asset'

/*
 * Author menu.
 *
 * This replaces the template's UserDropdown, which was an account menu — profile,
 * settings, pricing, FAQ, logout. None of those exist here: the site is a static
 * export with no accounts and no server to log out of, so a logout button would
 * have been a control that did nothing.
 *
 * What the slot is actually useful for is attribution, so it now identifies who
 * wrote the study and links out to them.
 */
const AuthorMenu = () => {
  // States
  const [open, setOpen] = useState(false)

  // Refs
  const anchorRef = useRef<HTMLDivElement>(null)

  // Hooks
  const { settings } = useSettings()

  const handleToggle = () => setOpen(prev => !prev)

  const handleClose = (event?: MouseEvent | TouchEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  return (
    <>
      <Avatar
        ref={anchorRef}
        alt={author.name}
        src={asset(author.avatar)}
        onClick={handleToggle}
        className='cursor-pointer bs-[38px] is-[38px] mis-2'
      >
        {/* Shown until public/images/author.jpg exists, and if it ever fails to load */}
        {author.initials}
      </Avatar>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[260px] !mbs-3 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{ transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top' }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-6 gap-3' tabIndex={-1}>
                    <Avatar alt={author.name} src={asset(author.avatar)}>
                      {author.initials}
                    </Avatar>
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {author.name}
                      </Typography>
                      <Typography variant='caption'>{author.role}</Typography>
                      <Typography variant='caption'>{author.affiliation}</Typography>
                    </div>
                  </div>

                  <Divider className='mlb-1' />

                  {author.social.map(link => (
                    <MenuItem
                      key={link.label}
                      component={Link}
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='mli-2 gap-3'
                      onClick={() => setOpen(false)}
                    >
                      <i className={link.icon} />
                      <Typography color='text.primary'>{link.label}</Typography>
                      <i className='tabler-external-link text-textDisabled text-[15px] mis-auto' />
                    </MenuItem>
                  ))}

                  <Divider className='mlb-1' />

                  <MenuItem
                    component={Link}
                    href={author.repository}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mli-2 gap-3'
                    onClick={() => setOpen(false)}
                  >
                    <i className='tabler-code' />
                    <Typography color='text.primary'>Study repository</Typography>
                    <i className='tabler-external-link text-textDisabled text-[15px] mis-auto' />
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default AuthorMenu
