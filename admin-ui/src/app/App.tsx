import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { ThemeProvider } from '../theme/ThemeProvider'
import { createQueryClient } from './queryClient'
import { routes } from './routes'

export function App({ queryClient }: { queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  const [router] = useState(() => createBrowserRouter(routes))
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
