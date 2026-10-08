// 统一的页面业务入口：三套模板读取同一个 Context。下方保留各模板的 Provider 名称作为兼容别名，
// 宿主选择任一入口在页面外装配一次即可；嵌套多个 Provider 会各自创建状态，并不会合并历史。
export { TrackingRuntimeProvider, useTrackingRuntime, type TrackingRuntimeProviderProps, type TrackingRuntimeState, type TrackingRuntime, type TrackingRecentQuery } from "./tracking-runtime";
export {
  ReadyToGoRuntimeProvider,
  type ReadyToGoRuntimeProviderProps,
  type ReadyToGoTrackingResult,
  type ReadyToGoRuntimeState,
  type ReadyToGoShipment,
  type ReadyToGoTrackingEvent,
  type ReadyToGoTrackingStep
} from "./ready-to-go";
export { bestTrackPageExtension, createReadyToGoTemplate, readyToGoTemplatePolicy } from "./ready-to-go-definition";
export { bestTrackBrandedExtension, brandedTemplatePolicy, createBrandedTemplate } from "./branded-definition";
export {
  BrandedRuntimeProvider,
  type BrandedRuntimeProviderProps,
  type BrandedRuntimeState
} from "./branded";
export { bestTrackSalesExtension, createSalesTemplate, salesTemplatePolicy } from "./sales-definition";
export { type TemplateBlockPolicy, type TemplatePolicy } from "./template-policy";
export {
  SalesRuntimeProvider,
  type SalesRuntimeProviderProps,
  type SalesRuntimeState
} from "./sales";
export {
  isEmptyTrackingPageResult,
  isValidOrderEmail,
  isValidOrderNumber,
  isValidTrackingNumber,
  formatTrackingPageMoney,
  isTrackingPageResourceReference,
  type TrackingPageOrderItem,
  type TrackingPageAd,
  type TrackingPageRecommendationsQuery,
  type TrackingPageRecommendationsState,
  type TrackingPageCollectionReference,
  type TrackingPageMediaReference,
  type TrackingPageMoney,
  type TrackingPageProductReference,
  type TrackingPageQuery,
  type TrackingPageQueryRequest,
  type TrackingPageQueryResult,
  type TrackingPageOrderQueryRequest,
  type TrackingPageRecommendation,
  type TrackingPageRuntimePhase,
  type TrackingPageResourceReference,
  type TrackingPageShipment,
  type TrackingPageTrackingEvent,
  type TrackingPageTrackingQueryRequest,
  type TrackingPageWatermark,
  type TrackingPageTrackingStep
} from "./tracking-page-runtime";
export { isSafeTrackingPageUrl, safeTrackingPageUrl, type TrackingPageUrlOptions } from "./tracking-page-url";
export {
  ShopifyCollectionResourceField,
  ShopifyProductResourceField,
  ShopifyResourcePickerProvider,
  getResolvedShopifyResource,
  getShopifyResourceResolutionError,
  isShopifyResourceReference,
  resolveShopifyResources,
  type ShopifyResolvedResource,
  type ShopifyResourceAvailability,
  type ShopifyResourceBrowser,
  type ShopifyResourceKind,
  type ShopifyResourceReference,
  type ShopifyResourceResolution,
  type ShopifyResourceResolutionError,
  type ShopifyResourceResolver,
  type ShopifyResourceSearchInput,
  type ShopifyResourceSearchPage
} from "./shopify-resources";
export {
  SHOPIFY_RECOMMEND_PATH,
  SHOPIFY_TRACK_QUERY_PATH,
  buildShopifyRecommendPayload,
  buildShopifyTrackQueryPayload,
  createShopifyRecommendationsQuery,
  createShopifyTrackQuery,
  mapShopifyRecommendationsResponse,
  mapShopifyTrackQueryResponse,
  readTrackingQueryFromLocation,
  readTrackingQueryLocationState,
  resolveInitialLocale,
  resolveShopifyTrackQueryLocale,
  shouldHidePoweredBy,
  syncTrackingQueryToUrl,
  withShopifyAppProxyPrefix,
  withShopifyTrackCacheBust,
  type Locale,
  type ShopifyTrackPageTransport
} from "./shopify-track-query";
