import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, buildUrl, onApiEvent, readCookie, request } from '../api/client'
import { errorMessage, mapFieldErrors } from '../api/errors'
import { safeNext } from '../auth/session'
import { translate, translatePlural } from '../i18n/translate'
import { readableTextColor } from '../lib/color'
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatPhone,
  initials,
  mapLinks,
  parseAmount,
  weekdayShort,
} from '../lib/format'
import { pageList } from '../lib/pagination'
import { server } from './server'

const NBSP = ' '
const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate('uz', key, vars)

describe('formatting', () => {
  it('formats money in so\'m / сум with non-breaking group separators', () => {
    expect(formatMoney(1234567, 'uz')).toBe(`1${NBSP}234${NBSP}567${NBSP}so'm`)
    expect(formatMoney(82000, 'ru')).toBe(`82${NBSP}000${NBSP}сум`)
    expect(formatMoney(0, 'uz')).toBe(`0${NBSP}so'm`)
  })

  it('parses amounts typed loosely', () => {
    expect(parseAmount('35 000')).toBe(35000)
    expect(parseAmount("35,000 so'm")).toBe(35000)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })

  it('formats dates relative to today in both languages', () => {
    const now = new Date(2026, 9, 2, 18, 0)
    expect(formatDateTime(new Date(2026, 9, 2, 14, 5), 'uz', now)).toBe('Bugun, 14:05')
    expect(formatDateTime(new Date(2026, 9, 1, 9, 30), 'ru', now)).toBe('Вчера, 09:30')
    expect(formatDate('2025-12-31T10:00:00', 'ru')).toBe('31 дек 2025')
    expect(formatDate('2026-10-01', 'uz')).toBe('1 okt 2026')
    expect(weekdayShort('2026-10-05', 'uz')).toBe('Du')
    expect(weekdayShort('2026-10-05', 'ru')).toBe('Пн')
  })

  it('formats phones, initials, durations and map links', () => {
    expect(formatPhone('+998901234567')).toBe('+998 90 123 45 67')
    expect(formatPhone('12345')).toBe('12345')
    expect(initials('Aziz', 'Karimov')).toBe('AK')
    expect(initials('  ')).toBe('?')
    expect(formatDuration(65)).toBe('1:05')
    expect(mapLinks('41.31', '69.27')?.google).toBe('https://maps.google.com/?q=41.31,69.27')
    expect(mapLinks('', '')).toBeNull()
    expect(mapLinks(null, 69)).toBeNull()
  })

  it('picks readable text on a brand colour', () => {
    expect(readableTextColor('#ff6b00')).toBe('#0f172a')
    expect(readableTextColor('#1e3a8a')).toBe('#ffffff')
    expect(readableTextColor('#fde047')).toBe('#0f172a')
  })

  it('lists page buttons with gaps', () => {
    expect(pageList(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageList(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12])
    expect(pageList(1, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12])
    expect(pageList(12, 12)).toEqual([1, 'gap', 8, 9, 10, 11, 12])
  })
})

describe('i18n', () => {
  it('uses Russian plural forms and the same Uzbek form for every count', () => {
    expect(translatePlural('ru', 'orders', 1)).toBe('1 заказ')
    expect(translatePlural('ru', 'orders', 3)).toBe('3 заказа')
    expect(translatePlural('ru', 'orders', 5)).toBe('5 заказов')
    expect(translatePlural('ru', 'orders', 21)).toBe('21 заказ')
    expect(translatePlural('uz', 'orders', 1)).toBe('1 ta buyurtma')
    expect(translatePlural('uz', 'orders', 5)).toBe('5 ta buyurtma')
  })

  it('fills placeholders', () => {
    expect(t('welcome', { name: 'Aziz' })).toBe('Xush kelibsiz, Aziz')
    expect(translate('ru', 'error_rate_limited', { seconds: 30 })).toBe('Слишком много запросов. Попробуйте через 30 с.')
  })

  it('accepts only same-app return paths', () => {
    expect(safeNext('/orders?status=ordered')).toBe('/orders?status=ordered')
    expect(safeNext('//evil.example')).toBe('/')
    expect(safeNext('https://evil.example')).toBe('/')
    expect(safeNext('/login')).toBe('/')
    expect(safeNext(null)).toBe('/')
  })
})

describe('API client', () => {
  it('builds URLs without empty parameters', () => {
    expect(buildUrl('/orders', { status: '', source: 'web', page: 2, search: undefined })).toBe('/api/v1/orders?source=web&page=2')
  })

  it('fetches a fresh CSRF token and retries once after csrf_failed', async () => {
    let attempts = 0
    server.use(
      http.post('/api/v1/units', ({ request }) => {
        attempts += 1
        if (attempts === 1) return HttpResponse.json({ error: 'csrf_failed' }, { status: 403 })
        return HttpResponse.json({ id: 9, name_uz: 'kg', name_ru: 'кг', token: request.headers.get('x-csrftoken') }, { status: 201 })
      }),
    )
    document.cookie = 'csrftoken=stale; path=/'
    const result = await request<{ token: string }>('POST', '/units', { json: { name_uz: 'kg', name_ru: 'кг' } })
    expect(attempts).toBe(2)
    expect(result.token).toBe(readCookie('csrftoken'))
    expect(result.token).not.toBe('stale')
  })

  it('announces 401 (session expired) but not for quiet requests', async () => {
    const events: string[] = []
    const off = onApiEvent((event) => events.push(event.type))
    server.use(http.get('/api/v1/dashboard', () => HttpResponse.json({ error: 'auth_required' }, { status: 401 })))

    await expect(request('GET', '/dashboard')).rejects.toMatchObject({ status: 401, code: 'auth_required' })
    await expect(request('GET', '/dashboard', { quiet401: true })).rejects.toBeInstanceOf(ApiError)
    expect(events).toEqual(['unauthorized'])
    off()
  })

  it('turns failures into coded errors and readable messages', async () => {
    server.use(
      http.get('/api/v1/units', () => HttpResponse.error()),
      http.get('/api/v1/categories', () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })),
    )
    const network = await request('GET', '/units').catch((error: unknown) => error)
    expect(network).toMatchObject({ code: 'network', status: 0 })
    expect(errorMessage(network, t)).toBe("Server bilan aloqa yo'q. Internetni tekshiring.")

    const gateway = await request('GET', '/categories').catch((error: unknown) => error)
    expect(gateway).toMatchObject({ code: 'http_502', status: 502 })
    expect(errorMessage(gateway, t)).toBe("Serverda xatolik. Birozdan so'ng qayta urinib ko'ring.")
  })

  it('maps validation field codes to messages', () => {
    const error = new ApiError(400, 'validation', { fields: { phone: ['invalid'], name_uz: ['required', 'max_length'] } })
    expect(mapFieldErrors(error, t)).toEqual({ phone: "Noto'g'ri qiymat", name_uz: 'Majburiy maydon' })
    expect(mapFieldErrors(new ApiError(400, 'empty'), t)).toEqual({})
  })

  it('sends the interface language and JSON headers', async () => {
    const seen = vi.fn<(language: string | null, accept: string | null) => void>()
    server.use(
      http.get('/api/v1/units', ({ request: incoming }) => {
        seen(incoming.headers.get('accept-language'), incoming.headers.get('accept'))
        return HttpResponse.json([])
      }),
    )
    await request('GET', '/units')
    expect(seen).toHaveBeenCalledWith(expect.stringMatching(/^(uz|ru)$/), 'application/json')
  })
})
