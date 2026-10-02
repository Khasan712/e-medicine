import { useEffect, type RefObject } from 'react'

/**
 * Moves the focus to `ref` when the component mounts — for the input of the current step of a dialog
 * (the WAI-ARIA dialog pattern), without the `autoFocus` attribute.
 */
export function useFocusOnMount(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    if (enabled) ref.current?.focus({ preventScroll: true })
  }, [ref, enabled])
}
