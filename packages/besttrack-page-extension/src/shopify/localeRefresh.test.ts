import { describe, expect, it, vi } from 'vitest'
import {
  completeLocaleRefresh,
  shouldRefreshAfterLocaleChange,
} from './localeRefresh'

const orderQuery = {
  type: 'order' as const,
  orderInput: '1001',
  contactInput: 'customer@example.com',
  trackingInput: '',
}

describe('locale refresh eligibility', () => {
  it('refreshes an already searched order when the locale changes', () => {
    expect(shouldRefreshAfterLocaleChange(orderQuery, true, false)).toBe(true)
  })

  it('does not refresh before a query has completed', () => {
    expect(shouldRefreshAfterLocaleChange(orderQuery, false, false)).toBe(false)
  })

  it('does not refresh when there is no previous query', () => {
    expect(shouldRefreshAfterLocaleChange(null, true, false)).toBe(false)
  })

  it('does not refresh a failed query result', () => {
    expect(shouldRefreshAfterLocaleChange(orderQuery, true, true)).toBe(false)
  })
})

describe('locale refresh completion', () => {
  it('scrolls to the tracking result after a successful refresh', () => {
    const setNotFound = vi.fn()
    const scrollToResult = vi.fn()

    completeLocaleRefresh(true, setNotFound, scrollToResult)

    expect(setNotFound).not.toHaveBeenCalled()
    expect(scrollToResult).toHaveBeenCalledOnce()
  })

  it('does not scroll to the tracking result after a failed refresh', () => {
    const setNotFound = vi.fn()
    const scrollToResult = vi.fn()

    completeLocaleRefresh(false, setNotFound, scrollToResult)

    expect(setNotFound).toHaveBeenCalledWith(true)
    expect(scrollToResult).not.toHaveBeenCalled()
  })
})
