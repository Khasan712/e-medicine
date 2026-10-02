import type { QueryClient } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { AppShell } from './AppShell'
import { Providers } from './Providers'

export function App({ queryClient }: { queryClient: QueryClient }) {
  return (
    <Providers queryClient={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </Providers>
  )
}
