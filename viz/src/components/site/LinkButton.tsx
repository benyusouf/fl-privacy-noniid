'use client'

// React Imports
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Button from '@mui/material/Button'
import type { ButtonProps } from '@mui/material/Button'

type Props = Omit<ButtonProps, 'href' | 'component' | 'LinkComponent'> & {
  href: string
  children: ReactNode
}

/*
 * A Button that navigates.
 *
 * Two separate problems are solved here.
 *
 * 1. Server/client boundary. MUI's Button carries its own "use client"
 *    directive, so writing <Button component={Link}> inside a server component
 *    passes a function — the Link component itself — across the boundary, and
 *    React cannot serialize it. Composing the two inside a client component
 *    keeps the reference on the client side; server pages pass only a string.
 *
 * 2. Typing. The obvious spelling, component={Link}, does not type-check:
 *    ButtonProps defaults to a 'button' root, so its ref is Ref<HTMLButtonElement>
 *    while Link renders an anchor, and none of MUI's three overloads accept the
 *    combination. LinkComponent is the prop MUI added for precisely this case —
 *    ButtonBase renders an anchor whenever href is present and uses LinkComponent
 *    as the element, so client-side routing is preserved without touching the
 *    polymorphic component API.
 *
 * If LinkComponent ever goes away, the fallback is to drop it and keep href
 * alone. That still works and still type-checks; it costs a full page load per
 * navigation instead of a client-side transition.
 */
const LinkButton = ({ href, children, ...rest }: Props) => (
  <Button LinkComponent={Link} href={href} {...rest}>
    {children}
  </Button>
)

export default LinkButton
