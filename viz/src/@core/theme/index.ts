// Next Imports
import type { Theme } from '@mui/material/styles'

import { plexSans } from '@configs/fonts'

// MUI Imports

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'
import type { SystemMode, Skin } from '@core/types'

// Theme Options Imports
import overrides from './overrides'
import colorSchemes from './colorSchemes'
import spacing from './spacing'
import shadows from './shadows'
import customShadows from './customShadows'
import typography from './typography'


const theme = (settings: Settings, mode: SystemMode, direction: Theme['direction']): Theme => {
  return {
    direction,
    components: overrides(settings.skin as Skin),
    colorSchemes: colorSchemes(settings.skin as Skin),
    ...spacing,
    shape: {
      borderRadius: 6,
      customBorderRadius: {
        xs: 2,
        sm: 4,
        md: 6,
        lg: 10,
        xl: 12
      }
    },
    shadows: shadows(mode),
    typography: typography(plexSans.style.fontFamily),
    customShadows: customShadows(mode),
    mainColorChannels: {
      light: '10 10 10',
      dark: '237 237 237',
      lightShadow: '10 10 10',
      darkShadow: '0 0 0'
    }
  } as Theme
}

export default theme
