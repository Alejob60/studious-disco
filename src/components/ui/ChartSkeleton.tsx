/** Placeholder shown while the Recharts bundle downloads. */
export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-2.5 w-72 animate-pulse rounded bg-white/5" />
      </div>

      <div className="relative h-[280px] w-full overflow-hidden rounded-lg bg-white/[0.02] sm:h-[360px] lg:h-[420px]">
        {/* Static sparkline silhouette so the layout does not jump on swap. */}
        <svg
          viewBox="0 0 800 360"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full opacity-30"
          aria-hidden
        >
          <polyline
            points="0,240 70,215 140,225 210,200 280,180 350,160 420,185 490,175 560,165 630,95 700,125 770,150 800,165"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="2"
            strokeDasharray="6 8"
          />
        </svg>
      </div>
    </div>
  )
}