import { useEffect, useLayoutEffect, useRef } from 'react'
import { mainButton, telegram, type MainButtonConfig } from './telegram'

const noop = () => {}

/** Sheets win over screens when both want the Telegram MainButton. */
export const MAIN_BUTTON_SCREEN = 0
export const MAIN_BUTTON_SHEET = 10
/** Pass to useMainButton to keep the button hidden while the component is on top. */
export const HIDE_MAIN_BUTTON = { text: '', onClick: noop, hidden: true } as const

/**
 * Shows Telegram's MainButton with `config` while the component is mounted (pass null to give it up).
 * Outside Telegram it does nothing — the page renders its own button instead.
 */
export function useMainButton(config: MainButtonConfig | null, priority = MAIN_BUTTON_SCREEN): void {
  const id = useRef(0)

  useLayoutEffect(() => {
    if (!telegram()) return
    const registered = mainButton.register(priority)
    id.current = registered
    return () => {
      mainButton.unregister(registered)
      id.current = 0
    }
  }, [priority])

  const text = config?.text
  const disabled = config?.disabled
  const progress = config?.progress
  const shine = config?.shine
  const hidden = config?.hidden
  const onClick = config?.onClick

  useLayoutEffect(() => {
    if (!id.current) return
    if (hidden) mainButton.update(id.current, { text: '', onClick: noop, hidden: true })
    else mainButton.update(id.current, text && onClick ? { text, disabled, progress, shine, onClick } : null)
  }, [text, disabled, progress, shine, hidden, onClick])
}

/** Telegram's BackButton: shown while `visible`, calls the latest `onBack`. */
export function useBackButton(visible: boolean, onBack: () => void): void {
  const handler = useRef(onBack)
  useLayoutEffect(() => {
    handler.current = onBack
  }, [onBack])

  useEffect(() => {
    const webApp = telegram()
    if (!webApp) return
    const listener = () => handler.current()
    webApp.BackButton.onClick(listener)
    return () => {
      webApp.BackButton.offClick(listener)
    }
  }, [])

  useEffect(() => {
    const button = telegram()?.BackButton
    if (!button) return
    if (visible) button.show()
    else button.hide()
  }, [visible])
}
