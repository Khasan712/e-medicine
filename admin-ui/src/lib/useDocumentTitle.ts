import { useEffect } from 'react'

/** Sets the browser tab title: «Buyurtmalar · Burger House». */
export function useDocumentTitle(title: string | null | undefined, suffix?: string | null) {
  useEffect(() => {
    if (!title) return
    document.title = suffix ? `${title} · ${suffix}` : title
  }, [title, suffix])
}
