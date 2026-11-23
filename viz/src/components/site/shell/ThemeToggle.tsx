'use client'

// React Imports
import { useEffect, useState } from 'react'

// MUI Imports
import Tooltip from '@mui/material/Tooltip'
import { useColorScheme } from '@mui/material/styles'

// Type Imports
import type { Mode } from '@core/types'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const OPTIONS: { mode: Mode; icon: string; label: string }[] = [
  { mode: 'light', icon: 'tabler-sun', label: 'Light theme' },
  { mode: 'dark', icon: 'tabler-moon', label: 'Dark theme' },
  { mode: 'system', icon: 'tabler-device-desktop', label: 'Match system' }
]

/*
 * Three-way theme switch. Writing to settings is enough: ModeChanger passes the
 * value to MUI, which persists it under themeConfig.modeStorageKey, and
 * InitColorSchemeScript reads that key before first paint, so a returning
 * visitor never sees the wrong theme flash.
 */
const ThemeToggle = () => {
  const { updateSettings } = useSettings()
  const { mode, setMode } = useColorScheme()

  // MUI's stored mode is the source of truth. It is only known in the browser,
  // so nothing is marked checked until after hydration (no mismatch).
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const current: Mode | null = mounted ? ((mode as Mode | undefined) ?? 'system') : null

  return (
    <div role='radiogroup' aria-label='Colour theme' className='theme-toggle'>
      {OPTIONS.map(o => (
        <Tooltip key={o.mode} title={o.label}>
          <button
            type='button'
            role='radio'
            aria-checked={current === o.mode}
            aria-label={o.label}
            className='theme-toggle__btn'
            onClick={() => {
              setMode(o.mode)
              updateSettings({ mode: o.mode })
            }}
          >
            <i className={o.icon} aria-hidden />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}

export default ThemeToggle
