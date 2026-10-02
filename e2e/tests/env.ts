import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const port = process.env.E2E_PORT ?? '8100'

/** Addresses of the parts, as the web container serves them locally (`*.localhost` → 127.0.0.1). */
export const urls = {
  platform: `http://hub.localhost:${port}`,
  admin: (slug: string) => `http://${slug}-admin.localhost:${port}`,
  shop: (slug: string) => `http://${slug}.localhost:${port}`,
}

interface Account {
  phone: string
  password: string
}

/** Our panel's test account: E2E_PLATFORM_PHONE / E2E_PLATFORM_PASSWORD, else the local `.dev-accounts.txt`. */
export function platformAccount(): Account {
  const { E2E_PLATFORM_PHONE: phone, E2E_PLATFORM_PASSWORD: password } = process.env
  if (phone && password) return { phone, password }
  const file = fileURLToPath(new URL('../../.dev-accounts.txt', import.meta.url))
  const line = existsSync(file) ? readFileSync(file, 'utf8').split('\n').find((row) => row.startsWith('platform')) : undefined
  const match = line?.match(/phone=(\S+) password=(\S+)/)
  if (!match) throw new Error('Set E2E_PLATFORM_PHONE and E2E_PLATFORM_PASSWORD (a platform staff account)')
  return { phone: match[1], password: match[2] }
}

/** A business of this run: the slug starts with `e2e-` (`manage.py delete_business --prefix e2e-` removes them). */
export function newBusiness() {
  const stamp = Date.now().toString(36)
  const digits = String(Date.now()).slice(-7)
  return {
    name: `E2E Burger ${stamp}`,
    slug: `e2e-${stamp}`,
    owner: { name: 'E2E Egasi', phone: `+99890${digits}`, password: `e2e-pass-${stamp}` },
  }
}
