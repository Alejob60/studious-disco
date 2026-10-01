import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { BrainCircuit, Zap } from 'lucide-react'

/** Sticky top bar: brand on the left, AWS badge on the right. */
export function Header() {
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const hairlineScale = useTransform(scrollYProgress, [0, 0.08], [0, 1])

  return (
    <motion.header
      initial={reduceMotion ? false : { y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50 border-b border-line bg-ink/70 backdrop-blur-xl"
    >
      {/* Gold hairline that wipes in as you scroll — decorative only. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px origin-left bg-gradient-to-r from-gold to-gold-light"
        style={{ scaleX: hairlineScale }}
      />

      <nav className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg border border-gold/30 bg-gold/10 transition-colors group-hover:bg-gold/20">
            <BrainCircuit className="size-5 text-gold" strokeWidth={1.75} />
          </span>
          <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
            Atelier <span className="text-gold">Predict</span>
          </span>
        </a>

        <div className="flex items-center gap-3 sm:gap-6">
          <a
            href="#agente"
            className="hidden text-sm text-body transition-colors hover:text-gold sm:block"
          >
            Agente
          </a>
          <a
            href="#pronostico"
            className="hidden text-sm text-body transition-colors hover:text-gold sm:block"
          >
            Pronóstico
          </a>

          <motion.span
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            className="flex items-center gap-1.5 rounded-full border border-aws/30 bg-aws-bg px-3 py-1.5 text-[11px] font-medium text-aws sm:text-xs"
          >
            <Zap className="size-3.5" strokeWidth={2.5} />
            Powered by AWS
          </motion.span>
        </div>
      </nav>
    </motion.header>
  )
}