/*
 * Single source of truth for author identity and links.
 *
 * The footer and the author menu both read from here, so changing a handle or
 * adding a link is a one-line edit rather than a hunt through components.
 */

export type SocialLink = {
  label: string
  href: string
  /** Iconify class name from the bundled Tabler set. */
  icon: string
}

const author = {
  name: 'Abdullahi Yusuf',
  initials: 'AY',
  role: 'MSc Computer Science',
  affiliation: 'University of Abuja',

  /*
   * Drop a square image at viz/public/images/author.jpg to replace the initials.
   * Until that file exists, MUI's Avatar falls back to the initials rather than
   * showing a broken image, so the site is never visibly wrong.
   */
  avatar: '/images/author.jpeg',

  repository: 'https://github.com/benyusouf/fl-privacy-noniid',

  social: [
    { label: 'Website', href: 'https://benyusouf.dev', icon: 'tabler-world' },
    { label: 'GitHub', href: 'https://github.com/benyusouf', icon: 'tabler-brand-github' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/benyusouf', icon: 'tabler-brand-linkedin' },
    { label: 'X', href: 'https://x.com/benyusouf', icon: 'tabler-brand-x' }
  ] as SocialLink[]
}

export default author
