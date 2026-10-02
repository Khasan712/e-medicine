import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { I18nProvider } from '../i18n/I18nProvider'
import { AuthProvider } from '../state/AuthProvider'
import { CartProvider } from '../state/CartProvider'
import { CatalogProvider } from '../state/CatalogProvider'
import { ThemeProvider } from '../state/ThemeProvider'
import { ToastProvider } from '../state/ToastProvider'

/** App state, outermost first: server cache → toasts → language → theme → account → menu → cart. */
export function Providers({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <CatalogProvider>
                <CartProvider>{children}</CartProvider>
              </CatalogProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
