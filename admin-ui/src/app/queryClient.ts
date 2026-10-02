import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        // Retry only temporary failures (network / 5xx), never 4xx answers.
        retry: (count, error) =>
          count < 2 && error instanceof ApiError && (error.code === 'network' || error.status >= 500),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}
