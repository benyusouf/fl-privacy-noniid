// MUI Imports
import type { Theme } from '@mui/material/styles'

/*
 * Type scale — a 1.25 ratio from a 15px body, set for reading rather than for
 * dashboards. Headings are semibold with slightly negative tracking; nothing is
 * set in all caps (overline is redefined as a sentence-case small label).
 */
const typography = (fontFamily: string): Theme['typography'] =>
  ({
    fontFamily: [fontFamily, '"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'].join(','),
    fontSize: 14,
    fontWeightLight: 400,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    h1: { fontSize: '2.75rem', fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.028em' },
    h2: { fontSize: '2.125rem', fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.024em' },
    h3: { fontSize: '1.625rem', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.018em' },
    h4: { fontSize: '1.3125rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.012em' },
    h5: { fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.4, letterSpacing: '-0.006em' },
    h6: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.45 },
    subtitle1: { fontSize: '0.9375rem', lineHeight: 1.55 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.65 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    button: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5, textTransform: 'none', letterSpacing: 0 },
    caption: { fontSize: '0.8125rem', lineHeight: 1.5, letterSpacing: 0 },
    overline: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.4, letterSpacing: 0, textTransform: 'none' }
  }) as Theme['typography']

export default typography
