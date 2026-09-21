export const SUPPORTED_LOCALES = [
  'EN',
  'ZH-HANS',
  'FR',
  'ES',
  'DE',
  'PT-BR',
  'IT',
  'ID',
  'VI',
  'TH',
] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export type LocaleOption = {
  code: Locale
  label: string
  shortLabel: string
}

export const LOCALE_STORAGE_KEY = 'bestrack_locale'

export const localeOptions: LocaleOption[] = [
  { code: 'EN', label: 'English', shortLabel: 'EN' },
  { code: 'ZH-HANS', label: '简体中文', shortLabel: 'ZH-HANS' },
  { code: 'FR', label: 'Français', shortLabel: 'FR' },
  { code: 'ES', label: 'Español', shortLabel: 'ES' },
  { code: 'DE', label: 'Deutsch', shortLabel: 'DE' },
  { code: 'PT-BR', label: 'Português (Brasil)', shortLabel: 'PT-BR' },
  { code: 'IT', label: 'Italiano', shortLabel: 'IT' },
  { code: 'ID', label: 'Bahasa Indonesia', shortLabel: 'ID' },
  { code: 'VI', label: 'Tiếng Việt', shortLabel: 'VI' },
  { code: 'TH', label: 'ไทย', shortLabel: 'TH' },
]

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null

  const normalized = value.trim()
  const canonical = normalized.toUpperCase()
  if (isSupportedLocale(canonical)) return canonical

  const lower = normalized.toLowerCase()
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans') return 'ZH-HANS'
  if (lower === 'en' || lower.startsWith('en-')) return 'EN'
  if (lower === 'fr' || lower.startsWith('fr-')) return 'FR'
  if (lower === 'es' || lower.startsWith('es-')) return 'ES'
  if (lower === 'de' || lower.startsWith('de-')) return 'DE'
  if (lower === 'pt' || lower.startsWith('pt-')) return 'PT-BR'
  if (lower === 'it' || lower.startsWith('it-')) return 'IT'
  if (lower === 'id' || lower.startsWith('id-')) return 'ID'
  if (lower === 'vi' || lower.startsWith('vi-')) return 'VI'
  if (lower === 'th' || lower.startsWith('th-')) return 'TH'

  return null
}

export function resolveInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const urlLocale = normalizeLocale(new URLSearchParams(window.location.search).get('lang'))
    if (urlLocale) return urlLocale

    const storedLocale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
    if (storedLocale) return storedLocale
  }

  return 'EN'
}

const htmlLocaleMap: Record<Locale, string> = {
  EN: 'en',
  'ZH-HANS': 'zh-Hans',
  FR: 'fr-FR',
  ES: 'es-ES',
  DE: 'de-DE',
  'PT-BR': 'pt-BR',
  IT: 'it-IT',
  ID: 'id-ID',
  VI: 'vi-VN',
  TH: 'th-TH',
}

export function toHtmlLocale(locale: Locale) {
  return htmlLocaleMap[locale]
}

export function syncLocaleToUrl(locale: Locale) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.set('lang', locale)
  window.history.replaceState(window.history.state, '', url)
}

export function persistLocale(locale: Locale) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}
