import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '../api/client'

/** Client errors (4xx) and a suspended business will not fix themselves; network hiccups and 5xx get two more
 * tries. */
export function shouldRetry(failures: number, error: unknown): boolean {
  if (isApiError(error) && ((error.status >= 400 && error.status < 500) || error.code === 'business_suspended')) {
    return false
  }
  return failures < 2
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: shouldRetry },
      mutations: { retry: false },
    },
  })
}
