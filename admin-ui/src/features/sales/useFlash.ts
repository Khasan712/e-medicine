import { useCallback, useEffect, useRef, useState } from 'react'

const FLASH_MS = 1600

/** Short highlight of changed things (AI-filled fields, added lines, a new sale). */
export function useFlash() {
  const [flashed, setFlashed] = useState<ReadonlySet<string>>(new Set())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const later = useCallback((ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      run()
    }, ms)
    timers.current.add(timer)
  }, [])

  const flash = useCallback(
    (key: string, delay = 0) => {
      later(delay, () => {
        setFlashed((current) => new Set(current).add(key))
        later(FLASH_MS, () =>
          setFlashed((current) => {
            const next = new Set(current)
            next.delete(key)
            return next
          }),
        )
      })
    },
    [later],
  )

  const isFlashed = useCallback((key: string) => flashed.has(key), [flashed])

  return { flash, isFlashed }
}
