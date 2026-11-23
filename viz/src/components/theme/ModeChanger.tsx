// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import { useColorScheme } from '@mui/material/styles'

// Type Imports
import type { SystemMode } from '@core/types'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

/*
 * Keeps the settings context and MUI's colour scheme in step.
 *
 * MUI's stored mode (localStorage, read before first paint by
 * InitColorSchemeScript) is the source of truth. On mount the settings context
 * is updated from it, never the other way round: pushing the settings default
 * into MUI on mount would overwrite the reader's saved choice with 'system'
 * on every page load. After mount, a change made through the settings (the
 * theme toggle) is passed to MUI.
 */
const ModeChanger = ({ systemMode }: { systemMode: SystemMode }) => {
  const { mode, setMode } = useColorScheme()
  const { settings, updateSettings } = useSettings()
  const lastSettingsMode = useRef(settings.mode)

  void systemMode

  // MUI -> settings: adopt the stored mode once MUI has read it.
  useEffect(() => {
    if (mode && mode !== settings.mode) {
      lastSettingsMode.current = mode
      updateSettings({ mode }, { updateCookie: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // settings -> MUI: only when the settings value itself changes (the toggle).
  useEffect(() => {
    if (settings.mode && settings.mode !== lastSettingsMode.current) {
      lastSettingsMode.current = settings.mode
      setMode(settings.mode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode])

  return null
}

export default ModeChanger
