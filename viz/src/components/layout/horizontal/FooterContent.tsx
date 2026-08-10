'use client'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import FooterInner from '@components/layout/shared/FooterInner'

// Hook Imports
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

// Util Imports
import { horizontalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useHorizontalNav()

  return (
    <div
      className={classnames(horizontalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <FooterInner compact={isBreakpointReached} />
    </div>
  )
}

export default FooterContent
