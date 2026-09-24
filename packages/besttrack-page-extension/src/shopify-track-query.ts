import type { Locale } from "./shopify-track-page/i18n/locales";
import { resolveInitialLocale } from "./shopify-track-page/i18n/locales";
import type { ApiResponse } from "./shopify-track-page/services/types";
import type {
  AdConfig,
  PackageItem,
  TrackMilestone,
  TrackResponse
} from "./shopify-track-page/pages/home/types";
import {
  buildShippingDetailsFromMilestone,
  buildTrackingStepsFromMilestone,
  formatEstimatedDelivery,
  normalizeExternalUrl,
  shouldShowEstimatedDelivery
} from "./shopify-track-page/timeline";
import type {
  TrackingPageAd,
  TrackingPageOrderItem,
  TrackingPageQuery,
  TrackingPageQueryRequest,
  TrackingPageQueryResult,
  TrackingPageRecommendation,
  TrackingPageRecommendationsQuery,
  TrackingPageShipment,
  TrackingPageTrackingEvent,
  TrackingPageTrackingStep
} from "./tracking-page-runtime";

export const SHOPIFY_TRACK_QUERY_PATH = "/track/query";
export const SHOPIFY_RECOMMEND_PATH = "/products/recommend";

export type ShopifyTrackApiResponse<T> = ApiResponse<T>;

/** Host-owned POST. The package never stores credentials or chooses the App Proxy prefix. */
export type ShopifyTrackPagePost = <T>(url: string, body?: Record<string, unknown>) => Promise<ShopifyTrackApiResponse<T>>;

export type ShopifyTrackPageTransport = {
  post: ShopifyTrackPagePost;
  /** Static locale or the original page resolver (`?lang=` then `bestrack_locale`). */
  locale?: Locale | (() => Locale);
  /** Original locale-switch path only: retry the lookup in English after a miss or throw. */
  fallbackToEnglish?: boolean;
  retries?: number;
};

export function resolveShopifyTrackQueryLocale(locale?: Locale | (() => Locale)) {
  const resolved = typeof locale === "function" ? locale() : locale;
  return resolved ?? resolveInitialLocale();
}

/**
 * Prefix a Track Page path the way `withAppProxyPrefix` did. The host still
 * chooses the prefix (`/apps/bestrack` or the storefront basename).
 */
export function withShopifyAppProxyPrefix(path: string, prefix: string) {
  const trimmed = prefix.trim();
  const normalizedPrefix = !trimmed || trimmed === "/"
    ? ""
    : (trimmed.startsWith("/") ? trimmed : `/${trimmed}`).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedPrefix}${normalizedPath}`;
}

export type ShopifyRecommendProduct = {
  id: string;
  title: string;
  handle?: string;
  onlineStoreUrl?: string | null;
  featuredImage?: { url?: string; altText?: string | null } | null;
  price?: string;
  variants?: Array<{ price?: string }> | null;
};

const emptyResult = (): TrackingPageQueryResult => ({
  outcome: "empty",
  trackingNumber: "",
  status: ""
});

/** Append `_t=Date.now()` so storefront and App Proxy caches cannot reuse a previous lookup. */
export function withShopifyTrackCacheBust(url: string, now = Date.now()) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_t=${now}`;
}

export function buildShopifyTrackQueryPayload(request: TrackingPageQueryRequest, locale: Locale = "EN") {
  return {
    order_number: request.mode === "order" ? request.orderNumber.trim() : "",
    email: request.mode === "order" ? request.email.trim() : "",
    tracking_number: request.mode === "tracking" ? request.trackingNumber.trim() : "",
    lang: locale
  } as const;
}

export function buildShopifyRecommendPayload(page = 1, pageSize = 20) {
  return { page, page_size: pageSize } as const;
}

function toProgress(steps: ReturnType<typeof buildTrackingStepsFromMilestone>): TrackingPageTrackingStep[] {
  let lastDone = -1;
  steps.forEach((step, index) => {
    if (step.done) lastDone = index;
  });
  return steps.map((step, index) => ({
    id: step.key,
    label: step.label,
    date: step.date || undefined,
    icon: step.icon,
    state: !step.done ? "upcoming" : index === lastDone ? "current" : "complete"
  }));
}

function toEvents(details: ReturnType<typeof buildShippingDetailsFromMilestone>): TrackingPageTrackingEvent[] {
  return details.map((detail, index) => ({
    id: `event-${index}`,
    title: detail.description,
    at: detail.time || undefined,
    state: detail.isLatest ? "current" : "complete"
  }));
}

function toOrderItems(items: PackageItem[] | undefined): TrackingPageOrderItem[] {
  return (items ?? []).map((item, index) => ({
    id: item.variant_id || item.product_id || `item-${index}`,
    title: [item.title, item.variant_title].filter(Boolean).join(" - "),
    quantity: item.quantity,
    imageUrl: item.image_url || undefined
  }));
}

function cityRegion(milestone?: TrackMilestone) {
  const records = milestone?.rawEventList?.length ? milestone.rawEventList : milestone?.nodeList ?? [];
  for (const record of records) {
    const value = [record.city, record.state, record.country].map((part) => part.trim()).filter(Boolean).join(", ");
    if (value) return value;
  }
  return undefined;
}

function mapAd(ad?: AdConfig | null): TrackingPageAd | undefined {
  const imageUrl = ad?.image_url?.trim();
  if (!ad || !imageUrl) return undefined;
  const href = ad.link_url?.trim() ? normalizeExternalUrl(ad.link_url) : undefined;
  return href ? { imageUrl, href } : { imageUrl };
}

function mapMilestone(milestone: TrackMilestone | undefined, locale: Locale, index: number): TrackingPageShipment {
  const steps = toProgress(buildTrackingStepsFromMilestone(milestone, locale));
  const events = toEvents(buildShippingDetailsFromMilestone(milestone, locale));
  const current = [...steps].reverse().find((step) => step.state !== "upcoming");
  const estimatedDelivery = shouldShowEstimatedDelivery(milestone)
    ? formatEstimatedDelivery(milestone?.estimated_delivery, locale)?.dateText
    : undefined;
  return {
    id: milestone?.tracking_number || `shipment-${index}`,
    label: `Shipment ${index + 1}`,
    trackingNumber: milestone?.tracking_number || undefined,
    status: current?.label || "Ordered",
    carrier: milestone?.carrier || undefined,
    latestEvent: events[0]?.title,
    updatedAt: events[0]?.at,
    destination: cityRegion(milestone),
    estimatedDelivery,
    progress: steps,
    events,
    orderItems: toOrderItems(milestone?.package_items),
    ad: undefined
  };
}

/**
 * Convert a legacy `/track/query` envelope into the display-safe runtime result.
 * A non-zero business `code` becomes `outcome: "empty"`. Network failures must
 * still throw so the template can keep them distinct from a missing order.
 */
export function mapShopifyTrackQueryResponse(
  response: ShopifyTrackApiResponse<TrackResponse | null | undefined>,
  request: TrackingPageQueryRequest,
  locale: Locale = "EN"
): TrackingPageQueryResult {
  if (response.code !== 0) {
    return emptyResult();
  }

  const data = response.data;
  const milestones = data?.mileStoneList ?? [];
  const shipments = milestones.map((milestone, index) => mapMilestone(milestone, locale, index));
  const primary = shipments[0] ?? mapMilestone(undefined, locale, 0);
  const trackingNumber = request.mode === "tracking"
    ? request.trackingNumber.trim()
    : primary.trackingNumber || "";
  const ad = mapAd(data?.ad_config ?? null);

  return {
    outcome: "found",
    trackingNumber,
    status: primary.status || "Ordered",
    carrier: primary.carrier,
    latestEvent: primary.latestEvent,
    updatedAt: primary.updatedAt,
    destination: primary.destination,
    orderNumber: data?.order_number || (request.mode === "order" ? request.orderNumber : undefined),
    estimatedDelivery: primary.estimatedDelivery,
    progress: primary.progress,
    events: primary.events,
    orderItems: primary.orderItems,
    ad,
    shipments: shipments.map((shipment) => ({ ...shipment, ad }))
  };
}

function parseRecommendPrice(value?: string) {
  if (!value) return undefined;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return undefined;
  const amount = Math.round(numeric * 100);
  if (!Number.isInteger(amount)) return undefined;
  return { amount, currencyCode: "USD" as const };
}

export function resolveShopifyRecommendHref(onlineStoreUrl?: string | null, handle?: string) {
  const trimmedUrl = onlineStoreUrl?.trim();
  if (trimmedUrl) {
    if (trimmedUrl.startsWith("/") && typeof window !== "undefined") {
      return new URL(trimmedUrl, window.location.origin).toString();
    }
    return normalizeExternalUrl(trimmedUrl) || undefined;
  }
  const trimmedHandle = handle?.trim();
  if (!trimmedHandle) return undefined;
  const relative = `/products/${trimmedHandle}`;
  if (typeof window !== "undefined") return new URL(relative, window.location.origin).toString();
  return relative;
}

export function mapShopifyRecommendationsResponse(
  response: ShopifyTrackApiResponse<{ products?: ShopifyRecommendProduct[] } | null | undefined>
): TrackingPageRecommendation[] {
  const products = response.data?.products ?? [];
  return products.map((product) => ({
    id: product.id,
    title: product.title,
    description: "",
    imageUrl: product.featuredImage?.url,
    href: resolveShopifyRecommendHref(product.onlineStoreUrl, product.handle),
    price: parseRecommendPrice(product.price || product.variants?.[0]?.price)
  }));
}

async function postWithRetry<T>(
  post: ShopifyTrackPagePost,
  url: string,
  body: Record<string, unknown>,
  retries: number
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await post<T>(withShopifyTrackCacheBust(url), body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("track query failed");
}

/**
 * Original `/track/query` lookup: snake_case body, `_t` cache-bust, one retry,
 * and `code !== 0` or exhausted throws become a missing-order result.
 */
export function createShopifyTrackQuery(transport: ShopifyTrackPageTransport): TrackingPageQuery {
  const retries = transport.retries ?? 1;
  return async (request) => {
    const locale = resolveShopifyTrackQueryLocale(transport.locale);
    const payload = buildShopifyTrackQueryPayload(request, locale);
    try {
      const response = await postWithRetry<TrackResponse>(transport.post, SHOPIFY_TRACK_QUERY_PATH, { ...payload }, retries);
      const mapped = mapShopifyTrackQueryResponse(response, request, locale);
      if (mapped.outcome !== "empty" || !transport.fallbackToEnglish || locale === "EN") return mapped;
    } catch {
      if (!transport.fallbackToEnglish || locale === "EN") return emptyResult();
    }

    try {
      const fallback = await postWithRetry<TrackResponse>(
        transport.post,
        SHOPIFY_TRACK_QUERY_PATH,
        { ...buildShopifyTrackQueryPayload(request, "EN") },
        retries
      );
      return mapShopifyTrackQueryResponse(fallback, request, "EN");
    } catch {
      return emptyResult();
    }
  };
}

export function createShopifyRecommendationsQuery(post: ShopifyTrackPagePost): TrackingPageRecommendationsQuery {
  return async () => {
    try {
      const response = await post<{ products?: ShopifyRecommendProduct[] }>(SHOPIFY_RECOMMEND_PATH, { ...buildShopifyRecommendPayload() });
      return mapShopifyRecommendationsResponse(response);
    } catch {
      return [];
    }
  };
}

export {
  readTrackingQueryFromLocation,
  readTrackingQueryLocationState,
  scrollToTrackingResult,
  syncTrackingQueryToUrl,
  TRACKING_RESULT_SELECTOR,
  withCacheBustParam
} from "./shopify-track-page/timeline";
export { shouldHidePoweredBy } from "./shopify-track-page/poweredBy";
export { resolveInitialLocale, type Locale } from "./shopify-track-page/i18n/locales";
