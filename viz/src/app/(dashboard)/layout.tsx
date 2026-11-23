// Type Imports
import type { ChildrenType } from '@core/types'

// Component Imports
import Providers from '@components/Providers'
import SiteShell from '@/components/site/shell/SiteShell'

/*
 * Every page shares one shell: header, sidebar with the results journey, a
 * single reading column and previous/next links. It replaces the template's
 * vertical and horizontal layouts, which the site no longer uses.
 */
const Layout = async (props: ChildrenType) => {
  const { children } = props

  return (
    <Providers direction='ltr'>
      <SiteShell>{children}</SiteShell>
    </Providers>
  )
}

export default Layout
