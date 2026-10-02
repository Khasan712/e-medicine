import { useEffect, useState } from 'react'

/** The value once it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** A data: URL to preview a picked image (read in the background; null until ready or without a file). */
export function useFilePreview(file: File | null): string | null {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
  useEffect(() => {
    if (!file) return undefined
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setPreview({ file, url: reader.result })
    }
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])
  return file && preview?.file === file ? preview.url : null
}

/** `true` for `ms` after `trigger()` — for "Copied ✓"-style feedback. */
export function useFlag(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return undefined
    const timer = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(timer)
  }, [on, ms])
  return [on, () => setOn(true)]
}
