const POWERED_BY_HIDDEN_STORE_DOMAINS = new Set([
  'nbstore-unlrgjwn.myshopify.com',
  'wavvveglobal.com',
])

type ShopifyWindow = Window & {
  Shopify?: {
    domain?: string
    shop?: string
  }
  __BESTRACK__?: {
    featureFlags?: {
      enableTrackingPageWatermarkRemoval?: boolean
    }
  }
}

function getUrlParam(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? ''
}

const normalizeStoreDomain = (value: string) => {
  const trimmedValue = value.trim().toLowerCase()
  if (!trimmedValue) return ''

  const host = trimmedValue
    .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
    .replace(/^\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')

  return host.replace(/^www\./, '')
}

/** Same hide rule as the original Shopify Track Page Home screen. */
export function shouldHidePoweredBy(targetWindow?: Window) {
  const runtimeWindow = targetWindow ?? (typeof window === 'undefined' ? undefined : window)
  if (!runtimeWindow) return false

  const shopifyWindow = runtimeWindow as ShopifyWindow
  if (
    shopifyWindow.__BESTRACK__?.featureFlags?.enableTrackingPageWatermarkRemoval === true
  ) {
    return true
  }

  const searchParams = new URLSearchParams(runtimeWindow.location.search)
  const hashParams = new URLSearchParams(runtimeWindow.location.hash.replace(/^#/, ''))
  const candidateDomains = [
    runtimeWindow.location.hostname,
    getUrlParam(searchParams, 'shop'),
    getUrlParam(searchParams, 'shop_domain'),
    getUrlParam(hashParams, 'shop'),
    getUrlParam(hashParams, 'shop_domain'),
    shopifyWindow.Shopify?.shop ?? '',
    shopifyWindow.Shopify?.domain ?? '',
  ]

  return candidateDomains
    .map(normalizeStoreDomain)
    .some((domain) => POWERED_BY_HIDDEN_STORE_DOMAINS.has(domain))
}
