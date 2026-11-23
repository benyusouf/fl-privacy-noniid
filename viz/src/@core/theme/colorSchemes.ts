// MUI Imports
import type { Theme } from '@mui/material/styles'

// Type Imports
import type { Skin } from '@core/types'

/*
 * Colour tokens — overhaul of 22 November 2026.
 *
 * One accent (a deep teal taken from the defence deck) and a neutral ramp. The
 * template's purple, its tinted navy dark mode and its five-colour icon tiles
 * are gone. Status colours exist only to mark state (a diverged run, a caveat)
 * and are deliberately muted so a page never reads as multi-coloured.
 *
 *   light: canvas #FFFFFF  ink #0A0A0A  ink-2 #525252  border #E5E5E5  accent #0E6F6B
 *   dark:  canvas #0A0A0A  ink #EDEDED  ink-2 #A1A1A1  border #262626  accent #4FB8AE
 *
 * Every text pair clears WCAG AA at body size; the secondary ink clears 7:1 in
 * both modes, so there is no faint grey body text anywhere on the site.
 */

type Tone = { main: string; light: string; dark: string; contrastText: string }

const opacities = (name: string) => ({
  lighterOpacity: `rgb(var(--mui-palette-${name}-mainChannel) / 0.06)`,
  lightOpacity: `rgb(var(--mui-palette-${name}-mainChannel) / 0.1)`,
  mainOpacity: `rgb(var(--mui-palette-${name}-mainChannel) / 0.16)`,
  darkOpacity: `rgb(var(--mui-palette-${name}-mainChannel) / 0.24)`,
  darkerOpacity: `rgb(var(--mui-palette-${name}-mainChannel) / 0.32)`
})

const tone = (name: string, t: Tone) => ({ ...t, ...opacities(name) })

type Mode = 'light' | 'dark'

const TOKENS: Record<
  Mode,
  {
    ink: string
    ink2: string
    ink3: string
    inkChannel: string
    canvas: string
    paper: string
    paperChannel: string
    subtle: string
    border: string
    borderStrong: string
    primary: Tone
    secondary: Tone
    error: Tone
    warning: Tone
    info: Tone
    success: Tone
    tooltipBg: string
    tooltipText: string
  }
> = {
  light: {
    ink: '#0A0A0A',
    ink2: '#525252',
    ink3: '#6B6B6B',
    inkChannel: '10 10 10',
    canvas: '#FFFFFF',
    paper: '#FFFFFF',
    paperChannel: '255 255 255',
    subtle: '#FAFAFA',
    border: '#E5E5E5',
    borderStrong: '#D4D4D4',
    primary: { main: '#0E6F6B', light: '#13847F', dark: '#0A5653', contrastText: '#FFFFFF' },
    secondary: { main: '#525252', light: '#737373', dark: '#404040', contrastText: '#FFFFFF' },
    error: { main: '#B42318', light: '#D92D20', dark: '#912018', contrastText: '#FFFFFF' },
    warning: { main: '#A15C07', light: '#B86E0E', dark: '#7A4505', contrastText: '#FFFFFF' },
    info: { main: '#3F5A73', light: '#52708C', dark: '#2F4558', contrastText: '#FFFFFF' },
    success: { main: '#1F7A4D', light: '#258F5A', dark: '#17603C', contrastText: '#FFFFFF' },
    tooltipBg: '#0A0A0A',
    tooltipText: '#FFFFFF'
  },
  dark: {
    ink: '#EDEDED',
    ink2: '#A1A1A1',
    ink3: '#8F8F8F',
    inkChannel: '237 237 237',
    canvas: '#0A0A0A',
    paper: '#0F0F0F',
    paperChannel: '15 15 15',
    subtle: '#141414',
    border: '#262626',
    borderStrong: '#363636',
    primary: { main: '#4FB8AE', light: '#6CC7BE', dark: '#3A9A91', contrastText: '#0A0A0A' },
    secondary: { main: '#A1A1A1', light: '#BDBDBD', dark: '#8A8A8A', contrastText: '#0A0A0A' },
    error: { main: '#F2706A', light: '#F58E89', dark: '#E0524C', contrastText: '#0A0A0A' },
    warning: { main: '#E2A447', light: '#EBB86A', dark: '#C98C30', contrastText: '#0A0A0A' },
    info: { main: '#93AECB', light: '#ABC1D8', dark: '#7A97B6', contrastText: '#0A0A0A' },
    success: { main: '#5CC48F', light: '#7BD2A6', dark: '#44AB77', contrastText: '#0A0A0A' },
    tooltipBg: '#EDEDED',
    tooltipText: '#0A0A0A'
  }
}

const scheme = (mode: Mode) => {
  const t = TOKENS[mode]

  return {
    palette: {
      primary: tone('primary', t.primary),
      secondary: tone('secondary', t.secondary),
      error: tone('error', t.error),
      warning: tone('warning', t.warning),
      info: tone('info', t.info),
      success: tone('success', t.success),
      text: {
        primary: t.ink,
        secondary: t.ink2,
        disabled: t.ink3,
        primaryChannel: t.inkChannel,
        secondaryChannel: t.inkChannel
      },
      divider: t.border,
      dividerChannel: mode === 'light' ? '229 229 229' : '38 38 38',
      background: {
        default: t.canvas,
        paper: t.paper,
        paperChannel: t.paperChannel
      },
      action: {
        active: `rgb(${t.inkChannel} / 0.64)`,
        hover: `rgb(${t.inkChannel} / 0.05)`,
        selected: `rgb(${t.inkChannel} / 0.08)`,
        disabled: `rgb(${t.inkChannel} / 0.32)`,
        disabledBackground: `rgb(${t.inkChannel} / 0.1)`,
        focus: `rgb(${t.inkChannel} / 0.12)`,
        focusOpacity: 0.12,
        activeChannel: t.inkChannel,
        selectedChannel: t.inkChannel
      },
      Alert: {
        errorColor: 'var(--mui-palette-text-primary)',
        warningColor: 'var(--mui-palette-text-primary)',
        infoColor: 'var(--mui-palette-text-primary)',
        successColor: 'var(--mui-palette-text-primary)',
        errorStandardBg: 'var(--mui-palette-background-paper)',
        warningStandardBg: 'var(--mui-palette-background-paper)',
        infoStandardBg: 'var(--mui-palette-background-paper)',
        successStandardBg: 'var(--mui-palette-background-paper)',
        errorFilledColor: 'var(--mui-palette-error-contrastText)',
        warningFilledColor: 'var(--mui-palette-warning-contrastText)',
        infoFilledColor: 'var(--mui-palette-info-contrastText)',
        successFilledColor: 'var(--mui-palette-success-contrastText)',
        errorFilledBg: 'var(--mui-palette-error-main)',
        warningFilledBg: 'var(--mui-palette-warning-main)',
        infoFilledBg: 'var(--mui-palette-info-main)',
        successFilledBg: 'var(--mui-palette-success-main)'
      },
      Avatar: { defaultBg: t.subtle },
      Chip: { defaultBorder: t.border },
      FilledInput: {
        bg: 'var(--mui-palette-action-hover)',
        hoverBg: 'var(--mui-palette-action-selected)',
        disabledBg: 'var(--mui-palette-action-hover)'
      },
      SnackbarContent: { bg: t.tooltipBg, color: t.tooltipText },
      Switch: {
        defaultColor: 'var(--mui-palette-common-white)',
        defaultDisabledColor: 'var(--mui-palette-common-white)',
        primaryDisabledColor: 'var(--mui-palette-common-white)',
        secondaryDisabledColor: 'var(--mui-palette-common-white)',
        errorDisabledColor: 'var(--mui-palette-common-white)',
        warningDisabledColor: 'var(--mui-palette-common-white)',
        infoDisabledColor: 'var(--mui-palette-common-white)',
        successDisabledColor: 'var(--mui-palette-common-white)'
      },
      Tooltip: { bg: t.tooltipBg },
      TableCell: { border: t.border },
      customColors: {
        bodyBg: t.canvas,
        chatBg: t.subtle,
        greyLightBg: t.subtle,
        inputBorder: t.borderStrong,
        tableHeaderBg: t.subtle,
        tooltipText: t.tooltipText,
        trackBg: t.border
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const colorSchemes = (_skin: Skin): Theme['colorSchemes'] =>
  ({
    light: scheme('light'),
    dark: scheme('dark')
  }) as Theme['colorSchemes']

export default colorSchemes
