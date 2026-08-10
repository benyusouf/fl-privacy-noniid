'use client'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import FooterInner from '@components/layout/shared/FooterInner'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useVerticalNav()

  return (
    <div
      className={classnames(verticalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <FooterInner compact={isBreakpointReached} />
    </div>
  )
}

export default FooterContent
