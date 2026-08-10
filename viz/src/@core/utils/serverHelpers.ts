/*
 * Static-export-safe replacement for the template's cookie-reading server helpers.
 *
 * The stock Vuexy version calls cookies() from 'next/headers'. That is a dynamic
 * server API and is not supported under output: 'export' — it fails the build.
 *
 * There is no request at build time, so there is no cookie to read. These helpers
 * now return the themeConfig defaults, which become the pre-rendered initial state.
 * Theme, skin and layout preferences still work at runtime: SettingsProvider uses
 * the client-side useObjectCookie hook, which reads the real cookie in the browser
 * after hydration. The only visible consequence is that a returning visitor who has
 * chosen a non-default theme may see one frame of the default before the client
 * picks their preference back up — the normal trade-off for a static site.
 */

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'
import type { SystemMode } from '@core/types'

// Config Imports
import themeConfig from '@configs/themeConfig'

export const getSettingsFromCookie = async (): Promise<Settings> => {
  // No request context during static export — the client hydrates real settings.
  return {}
}

export const getMode = async () => {
  return themeConfig.mode
}

export const getSystemMode = async (): Promise<SystemMode> => {
  const mode = themeConfig.mode

  return (mode === 'system' ? 'light' : mode) || 'light'
}

export const getServerMode = async () => {
  const mode = themeConfig.mode
  const systemMode = await getSystemMode()

  return mode === 'system' ? systemMode : mode
}

export const getSkin = async () => {
  return themeConfig.skin
}
