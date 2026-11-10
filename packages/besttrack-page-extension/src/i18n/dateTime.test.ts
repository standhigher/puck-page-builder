import { describe, expect, it } from 'vitest'
import {
  formatTrackingDateLabel,
  formatTrackingDateTime,
} from './dateTime'

describe('tracking date formatting', () => {
  const isoTime = '2026-08-05T09:00:30Z'

  it('formats node date labels by locale', () => {
    expect(formatTrackingDateLabel(isoTime, 'EN', { timeZone: 'UTC' })).toBe('Aug 5')
    expect(formatTrackingDateLabel(isoTime, 'ZH-HANS', { timeZone: 'UTC' })).toBe('8月5日')
  })

  it('formats detail timestamps by locale', () => {
    expect(formatTrackingDateTime(isoTime, 'EN', { timeZone: 'UTC' })).toBe('Aug 5, 9:00 AM')
    expect(formatTrackingDateTime(isoTime, 'ZH-HANS', { timeZone: 'UTC' })).toBe('8月5日 9:00')
    expect(formatTrackingDateTime(isoTime, 'PT-BR', { timeZone: 'UTC' })).toContain('5 de ago.')
    expect(formatTrackingDateTime(isoTime, 'IT', { timeZone: 'UTC' })).toContain('5 ago')
    expect(formatTrackingDateTime(isoTime, 'ID', { timeZone: 'UTC' })).toContain('5 Agu')
    expect(formatTrackingDateTime(isoTime, 'VI', { timeZone: 'UTC' })).toContain('5 thg 8')
    expect(formatTrackingDateTime(isoTime, 'TH', { timeZone: 'UTC' })).toContain('5 ส.ค.')
  })

  it('falls back to the original text when parsing fails', () => {
    expect(formatTrackingDateLabel('not-a-time', 'EN', { timeZone: 'UTC' })).toBe('not-a-time')
    expect(formatTrackingDateTime('not-a-time', 'EN', { timeZone: 'UTC' })).toBe('not-a-time')
  })
})
