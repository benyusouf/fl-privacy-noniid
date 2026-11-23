// Next Imports
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'

/*
 * IBM Plex Sans for everything people read; IBM Plex Mono only for identifiers
 * that are literally code (run names, file names, config keys). Plex was drawn
 * for technical documentation, which is what this site is.
 *
 * Declared once here so the root layout (CSS variables on <body>) and the MUI
 * theme (font-family) load the same font instance.
 */
export const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' })

export const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })

export const fontVariables = `${plexSans.variable} ${plexMono.variable}`
