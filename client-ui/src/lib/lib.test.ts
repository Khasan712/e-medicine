import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { api, ApiError, onUnauthorized } from '../api/client'
import { server } from '../test/server'
import { brandVariables, contrast, parseHex } from './color'
import { displayPhone, formatAmount, formatDateTime, formatLocalPhone, localDigits, toE164 } from './format'

describe('format', () => {
  it('formats money with non-breaking thousands separators', () => {
    expect(formatAmount(1250000)).toBe('1\u00a0250\u00a0000')
    expect(formatAmount(900)).toBe('900')
    expect(formatAmount(Number.NaN)).toBe('0')
  })

  it('normalises Uzbek phone numbers', () => {
    expect(localDigits('+998 (90) 123-45-67')).toBe('901234567')
    expect(localDigits('998901234567')).toBe('901234567')
    expect(localDigits('99 812 34 56')).toBe('998123456') // operator 99, not the country code
    expect(formatLocalPhone('9012345')).toBe('90 123 45')
    expect(toE164('901234567')).toBe('+998901234567')
    expect(displayPhone('+998901234567')).toBe('+998 90 123 45 67')
    expect(displayPhone('+7 999 000')).toBe('+7 999 000')
  })

  it('formats dates relative to today in both languages', () => {
    const now = new Date(2026, 9, 2, 18, 0)
    expect(formatDateTime(new Date(2026, 9, 2, 14, 5).toISOString(), 'uz', now)).toBe('Bugun, 14:05')
    expect(formatDateTime(new Date(2026, 9, 1, 9, 30).toISOString(), 'ru', now)).toBe('Вчера, 09:30')
    expect(formatDateTime(new Date(2026, 8, 20, 12, 0).toISOString(), 'uz', now)).toBe('20-sentabr, 12:00')
    expect(formatDateTime(new Date(2026, 8, 20, 12, 0).toISOString(), 'ru', now)).toBe('20 сентября, 12:00')
    expect(formatDateTime(new Date(2025, 0, 3, 8, 0).toISOString(), 'uz', now)).toBe('2025-yil 3-yanvar, 08:00')
  })
})

describe('brand colour', () => {
  it('derives readable variables from the business colour', () => {
    const orange = brandVariables('#FF6B00')
    expect(orange['--brand']).toBe('#ff6b00')
    expect(orange['--brand-ink']).toBe('#ffffff')

    const yellow = brandVariables('#ffd400')
    expect(yellow['--brand-ink']).toBe('#16161a') // dark text on a light brand
    expect(contrast(parseHex(yellow['--brand-text-light'])!, parseHex('#ffffff')!)).toBeGreaterThanOrEqual(3)

    const navy = brandVariables('#101b3c')
    expect(contrast(parseHex(navy['--brand-text-dark'])!, parseHex('#17181b')!)).toBeGreaterThanOrEqual(3)

    expect(brandVariables('not a colour')['--brand']).toBe('#ff5a1f')
  })
})

describe('api client', () => {
  it('turns error bodies into ApiError with the code and extra data', async () => {
    server.use(
      http.post('/api/v1/auth/phone/verify', () =>
        HttpResponse.json({ error: 'invalid_code', attempts_left: 2 }, { status: 400 }),
      ),
    )
    const error = await api('auth/phone/verify', { method: 'POST', body: {} }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'invalid_code', status: 400, data: { attempts_left: 2 } })
  })

  it('reports network failures as "network"', async () => {
    server.use(http.get('/api/v1/shop', () => HttpResponse.error()))
    await expect(api('shop')).rejects.toMatchObject({ code: 'network', status: 0 })
  })

  it('notifies listeners about a rejected token on 401', async () => {
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)
    await expect(api('orders', { token: 'stale' })).rejects.toMatchObject({ code: 'auth_required', status: 401 })
    expect(listener).toHaveBeenCalledWith('stale')
    unsubscribe()
  })
})
