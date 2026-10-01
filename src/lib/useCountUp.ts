import { useEffect, useRef, useState } from 'react'
import { useInView } from 'motion/react'

/**
 * Animates a number from 0 to `target` once the element scrolls into view.
 *
 * Honours `prefers-reduced-motion` by snapping straight to the final value,
 * and always finishes on the exact target so rounding never drifts.
 */
export function useCountUp(target: number, decimals = 0, duration = 1400) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [value, setValue] = useState(0)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!inView) return

    if (prefersReducedMotion) {
      setValue(target)
      return
    }

    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      // easeOutExpo — fast start, gentle settle, reads as "expensive".
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setValue(Number((target * eased).toFixed(decimals)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, target, decimals, duration, prefersReducedMotion])

  return { ref, value }
}