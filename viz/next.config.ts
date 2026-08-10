import type { NextConfig } from 'next'

/*
 * Static export configuration for GitHub Pages.
 *
 * BASEPATH must be set at build time to the repository name when deploying to a
 * project page (https://<user>.github.io/<repo>), and left unset in development.
 *   dev    : pnpm dev
 *   deploy : BASEPATH=/fl-privacy-noniid pnpm build
 *
 * Note on assetPrefix: Next.js already prefixes static assets with basePath, so
 * setting assetPrefix to the same value double-prefixes them and breaks every
 * asset URL. basePath alone is correct here.
 *
 * The template's original redirects() block (/ -> /home) has been removed:
 * redirects() is unsupported under output: 'export' and would fail the build.
 * The home page now lives at the root route instead.
 */

const basePath = process.env.BASEPATH || ''

const nextConfig: NextConfig = {
  output: 'export',
  basePath,

  /*
   * Pin the workspace root to this directory.
   *
   * Next.js infers the root by walking up for lockfiles, and there is a stray
   * package-lock.json in the home directory that wins that search — it would
   * otherwise treat /Users/<user> as the project root, which affects module
   * resolution and file tracing.
   *
   * process.cwd() rather than __dirname: every npm script here runs from viz/,
   * and process.cwd() cannot throw regardless of whether this config is loaded
   * as ESM or CJS.
   */
  turbopack: {
    root: process.cwd()
  },

  // GitHub Pages serves directory-style URLs; this emits <route>/index.html
  trailingSlash: true,

  // The Next.js image optimizer needs a server, which a static export does not have
  images: {
    unoptimized: true
  },

  /*
   * Exposed so that raw asset paths — MUI <Avatar src>, plain <img>, anything
   * Next.js does not rewrite itself — can be prefixed via utils/asset.ts.
   * Without this they resolve to the domain root and 404 on a project page.
   */
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  }
}

export default nextConfig
