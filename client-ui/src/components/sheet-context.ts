import { createContext, useContext, type PointerEvent } from 'react'

export interface SheetContextValue {
  titleId: string
  close: () => void
  /** Pointer handlers that make an element a drag handle (drag down to dismiss on phones). */
  dragProps: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onPointerMove: (event: PointerEvent<HTMLElement>) => void
    onPointerUp: (event: PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  }
}

export const SheetContext = createContext<SheetContextValue | null>(null)

/** For parts of a sheet (custom headers): close it, label it, use it as a drag handle. */
export function useSheet(): SheetContextValue {
  const context = useContext(SheetContext)
  if (!context) throw new Error('Sheet parts must be used inside <Sheet>')
  return context
}
