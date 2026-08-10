// Component Imports
import Providers from '@components/Providers'
import BlankLayout from '@layouts/BlankLayout'
import NotFound from '@views/NotFound'

// Util Imports
import { getServerMode, getSystemMode } from '@core/utils/serverHelpers'

/*
 * 404 page.
 *
 * This replaces the template's catch-all route at app/[...not-found]/page.tsx.
 * A catch-all is a dynamic segment, and output: 'export' has to enumerate every
 * route at build time — so it refused the build with "missing
 * generateStaticParams()". There is no sensible list of not-found paths to
 * enumerate, which is the wrong shape of solution anyway.
 *
 * app/not-found.tsx is the App Router convention for this. Under static export
 * Next.js renders it to 404.html, which is precisely the file GitHub Pages
 * serves for an unmatched path — so the 404 works on the deployed site without
 * any routing configuration.
 */
const NotFoundPage = async () => {
  // Vars
  const direction = 'ltr'
  const mode = await getServerMode()
  const systemMode = await getSystemMode()

  return (
    <Providers direction={direction}>
      <BlankLayout systemMode={systemMode}>
        <NotFound mode={mode} />
      </BlankLayout>
    </Providers>
  )
}

export default NotFoundPage
