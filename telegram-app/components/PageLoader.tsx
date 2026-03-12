import { useEffect, useRef, useState } from 'react'

const MIN_DISPLAY_MS = 2000

/**
 * Hook that returns true only after both `ready` is true AND
 * at least MIN_DISPLAY_MS have elapsed since mount.
 * This guarantees the loader is visible for a minimum duration.
 */
export function useMinLoader(ready: boolean): boolean {
  const [elapsed, setElapsed] = useState(false)
  // eslint-disable-next-line react-hooks/purity
  const mountTime = useRef(Date.now())

  useEffect(() => {
    const remaining = MIN_DISPLAY_MS - (Date.now() - mountTime.current)
    if (remaining <= 0) {
      setElapsed(true)
      return
    }
    const t = setTimeout(() => setElapsed(true), remaining)
    return () => clearTimeout(t)
  }, [])

  return ready && elapsed
}

// Full-page loading state — football thrown edge-to-edge with arc trajectory.
export default function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] space-y-6">
      <div className="relative w-60 h-24 flex items-center justify-center">
        {/* Shadow on the ground */}
        <div
          className="absolute bottom-2 w-10 h-2 rounded-full bg-[#D4AF37]/20"
          style={{ animation: 'football-shadow 1.4s ease-in-out infinite' }}
        />
        {/* Flying football */}
        <span
          className="material-symbols-outlined text-[#D4AF37] drop-shadow-[0_0_12px_rgba(212,175,55,0.6)]"
          style={{
            fontSize: 44,
            fontVariationSettings: "'FILL' 1",
            animation: 'football-throw 1.4s ease-in-out infinite',
          }}
        >
          sports_football
        </span>
      </div>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
    </div>
  )
}
