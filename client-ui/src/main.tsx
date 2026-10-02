import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { createQueryClient } from './app/queryClient'
import './index.css'
import { initTelegram, waitForTelegramSdk } from './lib/telegram'

async function start() {
  // Inside Telegram, index.html is loading telegram-web-app.js — the app needs it before the first render
  // (theme, sign-in with initData). On the website this resolves immediately.
  await waitForTelegramSdk()
  // index.html marks the page as a Mini App from the launch parameters; keep the mark only if the SDK agrees.
  if (!initTelegram()) document.documentElement.removeAttribute('data-tg')
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App queryClient={createQueryClient()} />
    </StrictMode>,
  )
}

void start()
