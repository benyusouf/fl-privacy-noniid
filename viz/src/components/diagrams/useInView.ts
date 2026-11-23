'use client'

// React Imports
import { useEffect, useRef, useState } from 'react'

/*
 * True once the element has scrolled into view, and stays true. Used to play a
 * figure's one entrance. Without IntersectionObserver (or under reduced motion,
 * where the CSS neutralises the transition anyway) it resolves immediately.
 */
export const useInView = <T extends Element>(rootMargin = '0px 0px -10% 0px') => {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current

    if (!el || inView) return

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)

      return
    }

    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin, threshold: 0.05 }
    )

    io.observe(el)

    return () => io.disconnect()
  }, [inView, rootMargin])

  return [ref, inView] as const
}
