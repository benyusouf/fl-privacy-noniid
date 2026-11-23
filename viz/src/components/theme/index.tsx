'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'

// MUI Imports
import { deepmerge } from '@mui/utils'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import CssBaseline from '@mui/material/CssBaseline'
import type {} from '@mui/material/themeCssVarsAugmentation' //! Do not remove this import otherwise you will get type errors while making a production build
import type {} from '@mui/lab/themeAugmentation' //! Do not remove this import otherwise you will get type errors while making a production build

// Third-party Imports
import { useMedia } from 'react-use'
import stylisRTLPlugin from 'stylis-plugin-rtl'

// Type Imports
import type { ChildrenType, Direction, SystemMode } from '@core/types'

// Component Imports
import ModeChanger from './ModeChanger'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Core Theme Imports
import defaultCoreTheme from '@core/theme'

type Props = ChildrenType & {
  direction: Direction
  systemMode: SystemMode
}

const CustomThemeProvider = (props: Props) => {
  // Props
  const { children, direction, systemMode } = props

  // Hooks
  const { settings } = useSettings()
  const isDark = useMedia('(prefers-color-scheme: dark)', systemMode === 'dark')

  /*
   * The resolved mode only feeds shadow strings into the theme (colours are CSS
   * variables switched by the data attribute). It must be identical on the
   * server and on the client's first render, or emotion generates different
   * class names and React reports a hydration mismatch (#418) whenever the
   * reader's saved or OS theme is dark. So the build-time mode is used until
   * the component has mounted, and the real one after.
   */
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  let currentMode: SystemMode = systemMode

  if (mounted) {
    if (settings.mode === 'system') {
      currentMode = isDark ? 'dark' : 'light'
    } else {
      currentMode = settings.mode as SystemMode
    }
  }

  /*
   * The template merged a user-selectable primary colour (stored in the settings
   * cookie) over the theme. The overhaul has exactly one accent, defined in
   * colorSchemes.ts, so that merge is gone: a stale cookie from the old design
   * can no longer repaint the site purple.
   */
  const theme = useMemo(() => {
    const coreTheme = deepmerge(defaultCoreTheme(settings, currentMode, direction), {
      cssVariables: { colorSchemeSelector: 'data' }
    })

    return createTheme(coreTheme)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.skin, currentMode])

  return (
    <AppRouterCacheProvider
      options={{
        prepend: true,
        ...(direction === 'rtl' && {
          key: 'rtl',
          stylisPlugins: [stylisRTLPlugin]
        })
      }}
    >
      <ThemeProvider
        theme={theme}
        defaultMode='system'
        modeStorageKey={themeConfig.modeStorageKey}
        forceThemeRerender
      >
        <>
          <ModeChanger systemMode={systemMode} />
          <CssBaseline />
          {children}
        </>
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}

export default CustomThemeProvider
