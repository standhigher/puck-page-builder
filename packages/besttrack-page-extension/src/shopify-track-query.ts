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
  sanitizeMilestones,
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

// 沿用原接口的分页请求参数；商家未选品时默认返回店铺前 8 个产品的规则由后端负责。
// pageSize 的默认值仍为 20，不表示前端要生成、补齐或截断成固定数量的商品。
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
  // 一个旧接口 milestone 对应一个包裹；进度、完整事件、商品与预计送达一起转换，供切换时联动。
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
 * 将旧 /track/query 响应映射为三套模板共用的结果模型，非零业务 code 转为 empty。
 * 本函数只处理响应；网络重试和异常转 empty 的兼容行为由 createShopifyTrackQuery 负责。
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
  // 先规整旧接口的可空字段，再保留 mileStoneList 中所有包裹，不按查询模式截成一条。
  // 第二层是否出现取决于最终 shipments 数量；它们不占最近 3 条查询记录的名额。
  const milestones = sanitizeMilestones(data?.mileStoneList);
  const shipments = milestones.map((milestone, index) => mapMilestone(milestone, locale, index));
  // 顶层字段默认使用首包裹；成功 code 但缺少包裹时仍沿用旧接口的基础 Ordered 展示。
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
    // 旧接口广告是本次响应共用配置，因此复制到各包裹，切换后仍能读取同一广告。
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
  // 保持后端给出的商品顺序与数量；默认的店铺前 8 个产品也通过同一映射流程展示。
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
  // retries 是首次请求以外的重试次数；只有 post 抛错才重试，业务 code 由映射层处理。
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
 * 保留旧 /track/query 协议：snake_case 请求体、_t 防缓存、默认额外重试一次。
 * 业务失败和重试耗尽均返回 empty；自定义宿主 query 若抛错，则由 Runtime 转为 error。
 * 英文重查仍请求同一真实接口，不是退回 Mock；仅在显式开启且当前语言不是 EN 时启用。
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

/** 推荐独立请求；请求或映射抛错时返回空列表，不影响查单状态，也不回退到演示商品。 */
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

// 复用原 Track Page 的编号合并规则，供公共 Runtime 管理第一层最近查询；包裹列表不经过合并。
export {
  mergeDisplayValues,
  readTrackingQueryFromLocation,
  readTrackingQueryLocationState,
  scrollToTrackingResult,
  syncTrackingQueryToUrl,
  TRACKING_RESULT_SELECTOR,
  withCacheBustParam
} from "./shopify-track-page/timeline";
export { shouldHidePoweredBy } from "./shopify-track-page/poweredBy";
export { resolveInitialLocale, type Locale } from "./shopify-track-page/i18n/locales";
