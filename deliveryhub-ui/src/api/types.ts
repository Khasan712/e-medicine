// Platform API types — docs/api.md, section "Platform API".

export interface PlatformUser {
  id: number
  phone_number: string
  first_name: string
}

export type BusinessStatus = 'active' | 'suspended'
export type BotRole = 'client' | 'admin'

export interface Bot {
  username: string
  /** The bot service polls this bot right now. */
  alive: boolean
  created_via: 'managed' | 'token'
}

export interface BusinessStats {
  orders_today: number
  revenue_today: number
  orders_total: number
  customers: number
}

export interface BusinessCard {
  slug: string
  name: string
  status: BusinessStatus
  logo: string | null
  brand_color: string
  tagline: string
  created_at: string
  links: { shop: string; admin: string }
  stats: BusinessStats
  bots: Record<BotRole, Bot | null>
}

export interface BusinessDetail extends BusinessCard {
  support_phone: string
  delivery_time: string
  min_order: number
  owner: { name: string; phone: string } | null
  platform_bot: { username: string } | null
  missing_roles: BotRole[]
}

export interface BusinessTotals {
  businesses: number
  active: number
  orders_today: number
  revenue_today: number
}

export interface BusinessList {
  /** PLATFORM_DOMAIN: businesses live at `<slug>.<domain>`. */
  domain?: string
  totals: BusinessTotals
  results: BusinessCard[]
}

export type SlugError = 'slug_invalid' | 'slug_reserved' | 'slug_taken'

export type SlugCheck = { available: true } | { available: false; error: SlugError }

export interface Credentials {
  phone: string
  password: string
}

/** Editable profile fields of a business (create and PATCH). */
export interface BusinessProfileInput {
  name: string
  tagline: string
  support_phone: string
  delivery_time: string
  min_order: number
  brand_color: string
}

/** PATCH body: any profile fields; `logo: null` removes the logo (a new logo goes as a file, multipart). */
export type BusinessProfilePatch = Partial<BusinessProfileInput> & { logo?: null }

export interface BusinessCreateInput extends BusinessProfileInput {
  slug: string
  owner_name: string
  owner_phone: string
  owner_password: string
}

export interface BusinessCreated {
  business: BusinessDetail
  credentials: Credentials
}

export interface SetupLink {
  url: string
  qr_svg: string
  expires_at: string
}
