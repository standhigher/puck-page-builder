import type { Locale } from './locales'

type DateTimeFormatOptions = {
  timeZone?: string
}

const localeMap: Record<Locale, string> = {
  EN: 'en-US',
  'ZH-HANS': 'zh-CN',
  FR: 'fr-FR',
  ES: 'es-ES',
  DE: 'de-DE',
  'PT-BR': 'pt-BR',
  IT: 'it-IT',
  ID: 'id-ID',
  VI: 'vi-VN',
  TH: 'th-TH',
}

const tryParseDate = (time: string) => {
  const normalized = time.trim()
  if (!normalized) return null

  const isoCandidate =
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(normalized) && !normalized.includes('T')
      ? normalized.replace(' ', 'T')
      : normalized
  const parsed = Date.parse(isoCandidate)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed)
}

const getFormatter = (
  locale: Locale,
  options: Intl.DateTimeFormatOptions & DateTimeFormatOptions,
) => new Intl.DateTimeFormat(localeMap[locale], options)

export function formatTrackingDateLabel(
  time: string,
  locale: Locale,
  options: DateTimeFormatOptions = {},
) {
  const date = tryParseDate(time)
  if (!date) return time
  return getFormatter(locale, {
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(date)
}

export function formatTrackingDateTime(
  time: string,
  locale: Locale,
  options: DateTimeFormatOptions = {},
) {
  const date = tryParseDate(time)
  if (!date) return time
  return getFormatter(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: locale === 'EN',
    ...options,
  }).format(date)
}
