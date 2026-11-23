// MUI Imports
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'

// Type Imports
import type { ChildrenType } from '@core/types'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'
import '@/app/site.css'

// Font Imports
import { fontVariables } from '@configs/fonts'

// Config Imports
import themeConfig from '@configs/themeConfig'

export const metadata = {
  title: {
    default: 'Federated Learning with Non-IID Data — research results',
    template: '%s'
  },
  description:
    'The complete record of Abdullahi Yusuf\u2019s MSc research into privacy-preserving federated learning with non-IID data: every experiment, result, chart and file, all available to view and download.'
}

const RootLayout = async (props: ChildrenType) => {
  const { children } = props

  // Type guard to ensure lang is a valid Locale

  // Vars

  const direction = 'ltr'

  return (
    <html id='__next' lang='en' dir={direction} suppressHydrationWarning>
      <body className={`flex is-full min-bs-full flex-auto flex-col ${fontVariables}`}>
        <InitColorSchemeScript attribute='data' defaultMode='system' modeStorageKey={themeConfig.modeStorageKey} />
        {children}
      </body>
    </html>
  )
}

export default RootLayout
