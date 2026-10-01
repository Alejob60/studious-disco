import { BrainCircuit } from 'lucide-react'

/** Closing bar with the hackathon attribution. */
export function Footer() {
  return (
    <footer className="relative z-10 mt-8 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-body">
          <BrainCircuit className="size-4 text-gold" strokeWidth={1.75} />
          <span>
            Atelier <span className="text-gold">Predict</span>
          </span>
        </div>

        <p className="text-center text-xs text-white/35 sm:text-right">
          Construido para el Hackathon AWS Zero to Shipped 2026
        </p>
      </div>
    </footer>
  )
}