import { plurals, ru, uz, type DictKey, type PluralKey } from './dict'

export type Lang = 'uz' | 'ru'
export type Vars = Record<string, string | number>

const DICTS: Record<Lang, Record<DictKey, string>> = { uz, ru }

export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

export function translate(lang: Lang, key: DictKey, vars?: Vars): string {
  return interpolate(DICTS[lang][key] ?? uz[key] ?? key, vars)
}

const pluralRules: Partial<Record<Lang, Intl.PluralRules>> = {}

export function translatePlural(lang: Lang, key: PluralKey, count: number, vars?: Vars): string {
  const rules = (pluralRules[lang] ??= new Intl.PluralRules(lang === 'ru' ? 'ru-RU' : 'uz-UZ'))
  const forms = plurals[lang][key] as Partial<Record<Intl.LDMLPluralRule, string>>
  const form = forms[rules.select(count)] ?? forms.other ?? ''
  return interpolate(form, { count, ...vars })
}

export function isLang(value: unknown): value is Lang {
  return value === 'uz' || value === 'ru'
}

/** Picks the name in the interface language, falling back to the other one. */
export function localName(item: { name_uz?: string | null; name_ru?: string | null } | null | undefined, lang: Lang): string {
  if (!item) return ''
  const uzName = item.name_uz?.trim() ?? ''
  const ruName = item.name_ru?.trim() ?? ''
  return lang === 'ru' ? ruName || uzName : uzName || ruName
}
