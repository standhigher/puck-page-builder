import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LOCALE_STORAGE_KEY,
  localeOptions,
  normalizeLocale,
  persistLocale,
  resolveInitialLocale,
  syncLocaleToUrl,
  SUPPORTED_LOCALES,
  toHtmlLocale,
} from './locales'

describe('locale helpers', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('exposes the supported locale list for the tracking page', () => {
    expect(SUPPORTED_LOCALES).toEqual([
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
    ])
    expect(localeOptions).toHaveLength(10)
    expect(LOCALE_STORAGE_KEY).toBe('bestrack_locale')
  })

  it('normalizes browser and url locale aliases', () => {
    expect(normalizeLocale('zh')).toBe('ZH-HANS')
    expect(normalizeLocale('zh-hans')).toBe('ZH-HANS')
    expect(normalizeLocale('zh-CN')).toBe('ZH-HANS')
    expect(normalizeLocale('en-GB')).toBe('EN')
    expect(normalizeLocale('fr-CA')).toBe('FR')
    expect(normalizeLocale('es-MX')).toBe('ES')
    expect(normalizeLocale('de-DE')).toBe('DE')
    expect(normalizeLocale('pt')).toBe('PT-BR')
    expect(normalizeLocale('pt-br')).toBe('PT-BR')
    expect(normalizeLocale('it-IT')).toBe('IT')
    expect(normalizeLocale('id-ID')).toBe('ID')
    expect(normalizeLocale('vi-VN')).toBe('VI')
    expect(normalizeLocale('th-TH')).toBe('TH')
  })

  it('falls back to english when no locale is available', () => {
    expect(resolveInitialLocale()).toBe('EN')
  })

  it('defaults to english instead of browser language when url and storage are empty', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          search: '',
        },
        localStorage: {
          getItem: () => null,
        },
        navigator: {
          language: 'zh-CN',
        },
      },
    })

    expect(resolveInitialLocale()).toBe('EN')
  })

  it('maps canonical keys to standard browser language tags', () => {
    expect(toHtmlLocale('EN')).toBe('en')
    expect(toHtmlLocale('ZH-HANS')).toBe('zh-Hans')
    expect(toHtmlLocale('PT-BR')).toBe('pt-BR')
  })

  it('persists and syncs canonical uppercase locale keys', () => {
    const storage = { getItem: () => null, setItem: vi.fn() }
    const replaceState = vi.fn()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          href: 'https://example.com/track/page?shop=demo',
        },
        history: { state: null, replaceState },
        localStorage: storage,
      },
    })

    persistLocale('PT-BR')
    syncLocaleToUrl('PT-BR')

    expect(storage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'PT-BR')
    expect(replaceState).toHaveBeenCalledWith(null, '', expect.any(URL))
    expect(replaceState.mock.calls[0][2].toString()).toBe(
      'https://example.com/track/page?shop=demo&lang=PT-BR',
    )
  })
})
