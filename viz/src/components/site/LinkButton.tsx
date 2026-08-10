'use client'

// React Imports
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Button from '@mui/material/Button'
import type { ButtonProps } from '@mui/material/Button'

type Props = Omit<ButtonProps, 'href' | 'component'> & {
  href: string
  children: ReactNode
}

/*
 * A Button that navigates.
 *
 * MUI's Button carries its own "use client" directive, so writing
 * <Button component={Link}> inside a server component passes a function — the
 * Link component itself — across the server/client boundary. React cannot
 * serialize that, and the page fails at render with "Functions cannot be passed
 * directly to Client Components".
 *
 * Composing the two inside a client component keeps the function reference on
 * the client side, where it never has to be serialized. Server pages then pass
 * only a plain href string.
 */
const LinkButton = ({ href, children, ...rest }: Props) => (
  <Button component={Link} href={href} {...rest}>
    {children}
  </Button>
)

export default LinkButton
