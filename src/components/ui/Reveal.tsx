import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Stagger offset in seconds, applied as a delay. */
  delay?: number
  /** Direction the block travels in from. */
  from?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
}

const OFFSET = 24

/**
 * Scroll-triggered entrance animation used across every section.
 *
 * Respects `prefers-reduced-motion` by rendering the content statically.
 */
export function Reveal({
  children,
  delay = 0,
  from = 'up',
  className,
}: RevealProps) {
  const reduceMotion = useReducedMotion()

  const initial =
    from === 'none' || reduceMotion
      ? { opacity: 0 }
      : {
          opacity: 0,
          x: from === 'left' ? -OFFSET : from === 'right' ? OFFSET : 0,
          y: from === 'up' ? OFFSET : from === 'down' ? -OFFSET : 0,
        }

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}