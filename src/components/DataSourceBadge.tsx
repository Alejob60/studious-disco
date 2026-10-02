import { motion } from 'motion/react'
import { CloudOff, Radio, RefreshCw } from 'lucide-react'
import type { ForecastSource } from '../lib/api'

/**
 * Tells the viewer whether the numbers on screen came from the live AWS stack.
 *
 * Honest by design: during a demo it must be obvious which mode is running,
 * otherwise a fallback silently passes for the real thing.
 */
export function DataSourceBadge({
  source,
  loading,
  warning,
}: {
  source: ForecastSource
  loading: boolean
  warning: string | null
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-body">
        <RefreshCw className="size-3 animate-spin" />
        Consultando la API
      </span>
    )
  }

  if (source === 'live') {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        title="Pronóstico y agente servidos por AWS (Lambda + Bedrock)"
        className="inline-flex items-center gap-1.5 rounded-full border border-aws/30 bg-aws-bg px-3 py-1.5 text-[11px] font-medium text-aws"
      >
        <Radio className="size-3" strokeWidth={2.5} />
        Datos en vivo · AWS
      </motion.span>
    )
  }

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      title={warning ?? 'Sin API configurada: VITE_API_URL no está definido'}
      className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[11px] font-medium text-gold"
    >
      <CloudOff className="size-3" strokeWidth={2.5} />
      Modo demostración
    </motion.span>
  )
}