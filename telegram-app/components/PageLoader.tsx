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

export default function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] space-y-6">
      <div className="w-12 h-12 flex items-center justify-center">
        <span
          className="material-symbols-outlined text-primary"
          style={{
            fontSize: 44,
            fontVariationSettings: "'FILL' 1",
            animation: 'loader-spin 1.1s linear infinite',
          }}
        >
          progress_activity
        </span>
      </div>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
    </div>
  )
}
