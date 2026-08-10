/*
 * Prefixes a public-folder path with the deployment base path.
 *
 * Next.js rewrites basePath into next/link hrefs and next/image sources
 * automatically, but NOT into raw string props like MUI's <Avatar src>. On a
 * GitHub Pages project site — served from /<repo>/ — an unprefixed "/images/x.jpg"
 * resolves to the domain root and 404s. The failure only appears in the deployed
 * build, never in development, which is what makes it worth a helper.
 *
 * NEXT_PUBLIC_BASE_PATH is set from BASEPATH in next.config.ts and is inlined at
 * build time, so this costs nothing at runtime.
 */

export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`
