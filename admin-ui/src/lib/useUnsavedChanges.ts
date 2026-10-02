import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'
import { useConfirm } from '../components/feedback/feedback'
import { useI18n } from '../i18n/context'

/**
 * Asks before leaving a form with unsaved changes (in-app navigation and tab close).
 * Returns `allowLeave()` — call it right before navigating away after a successful save.
 */
export function useUnsavedChanges(dirty: boolean): () => void {
  const { t } = useI18n()
  const confirm = useConfirm()
  const dirtyRef = useRef(dirty)
  const bypass = useRef(false)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && !bypass.current && currentLocation.pathname !== nextLocation.pathname,
  )
  const blockerRef = useRef(blocker)
  useEffect(() => {
    blockerRef.current = blocker
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let active = true
    void confirm({
      title: t('unsaved_title'),
      message: t('unsaved_text'),
      confirmLabel: t('unsaved_leave'),
      cancelLabel: t('unsaved_stay'),
    }).then((leave) => {
      if (!active) return
      if (leave) blockerRef.current.proceed?.()
      else blockerRef.current.reset?.()
    })
    return () => {
      active = false
    }
  }, [blocker.state, confirm, t])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypass.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return useCallback(() => {
    bypass.current = true
  }, [])
}
