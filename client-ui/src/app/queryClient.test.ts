import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it('retries network trouble and server errors twice', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(shouldRetry(1, new ApiError('server_error', 500))).toBe(true)
    expect(shouldRetry(2, new ApiError('server_error', 500))).toBe(false)
  })

  it('does not retry what cannot fix itself', () => {
    expect(shouldRetry(0, new ApiError('not_found', 404))).toBe(false)
    expect(shouldRetry(0, new ApiError('business_suspended', 503))).toBe(false)
  })
})
