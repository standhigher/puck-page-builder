import { parseProductReferences } from "@standhigher/puck-page-builder/runtime";
import { resolveShopifyRecommendHref } from "./shopify-track-query";
import type { TrackingPageMoney, TrackingPageQueryResult, TrackingPageRecommendation, TrackingPageRecommendationsState, TrackingPageRuntimePhase, TrackingPageTrackingEvent, TrackingPageTrackingStep } from "./tracking-page-runtime";

/** 未提供进度节点时，按状态文本推导五个基础阶段；不为真实订单补造演示日期。 */
export function defaultProgress(status: string): TrackingPageTrackingStep[] {
  const steps: Array<Pick<TrackingPageTrackingStep, "id" | "label" | "icon">> = [
    { id: "ordered", label: "Ordered", icon: "check" },
    { id: "ready", label: "Order Ready", icon: "bag" },
    { id: "transit", label: "In Transit", icon: "truck" },
    { id: "out", label: "Out for Delivery", icon: "box" },
    { id: "delivered", label: "Delivered", icon: "check" }
  ];
  const normalized = status.toLowerCase();
  const current = normalized.includes("deliver")
    ? (normalized.includes("out for") ? 3 : 4)
    : normalized.includes("transit")
      ? 2
      : normalized.includes("ready")
        ? 1
        : 0;
  return steps.map((step, index) => ({
    ...step,
    state: index < current ? "complete" : index === current ? "current" : "upcoming"
  }));
}

/** 画布/演示数据，以及没有注入查询来源时的默认结果；不能用作 Live 请求失败的回退。 */
export function previewTrackingPageResult(trackingNumber = "BT-2048-DEMO"): TrackingPageQueryResult {
  return {
    trackingNumber,
    status: "In transit",
    carrier: "BestTrack demo carrier",
    latestEvent: "Shipment accepted at the regional hub",
    updatedAt: "Sep 17, 10:00 AM",
    destination: "Shanghai",
    estimatedDelivery: "Sep 22 - Sep 24",
    progress: defaultProgress("In transit"),
    events: [
      { id: "hub", title: "Shipment accepted at the regional hub", at: "Sep 17, 10:00 AM", state: "current" },
      { id: "info", title: "The order has been placed and confirmed.", at: "Sep 16, 3:31 PM", state: "complete" }
    ],
    orderItems: [{ id: "demo-order-item", title: "Demo shipment item", quantity: 1, description: "Product details are available in your order." }],
    // 演示结果保留该字段供画布取样；正式 Web 推荐仍通过 recommendationItems 读取独立来源。
    recommendations: [
      { id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery.", price: { amount: 900, currencyCode: "USD" } },
      { id: "delivery-alerts", title: "Delivery alerts", description: "Receive an update at every milestone.", price: { amount: 400, currencyCode: "USD" } }
    ]
  };
}

export function configuredRecommendations(products: unknown): TrackingPageRecommendation[] {
  return parseProductReferences(products).map((product) => ({
    id: product.id,
    title: product.title || product.id,
    description: "",
    imageUrl: product.imageUrl,
    // 商品引用快照保存 handle；先生成店铺商品地址，渲染卡片时仍需经过 URL 安全检查。
    href: resolveShopifyRecommendHref(undefined, product.handle),
    ...(product.price ? { price: product.price } : {})
  }));
}

/** 保留接口的完整事件列表；仅在没有事件时把已有最新摘要转成一条记录，不补虚构物流。 */
export function trackingEvents(result: TrackingPageQueryResult | undefined): TrackingPageTrackingEvent[] {
  if (result?.events?.length) return result.events;
  if (result?.latestEvent) return [{ id: "latest", title: result.latestEvent, at: result.updatedAt, state: "current" }];
  return [];
}

/** 沿用 Ready-to-go 推荐价格格式：最小货币单位除以 100，显示为 $ 0.00；不是通用多币种格式器。 */
export function formatRecommendationPrice(price?: TrackingPageMoney) {
  if (!price || !Number.isInteger(price.amount)) return "";
  return `$ ${(price.amount / 100).toFixed(2)}`;
}

export function trackingSteps(result: TrackingPageQueryResult) {
  // 空数组也视为没有可展示进度，沿用当前状态生成基础阶段；接口给出的非空节点不重新推导。
  return result.progress?.length ? result.progress : defaultProgress(result.status);
}

export function recommendationItems(products: unknown, runtime: { recommendations: TrackingPageRecommendationsState }) {
  // 商家配置的有效选品优先；否则只取独立推荐请求的成功结果，不读取查单结果 recommendations。
  // 未选品时，后端默认提供该店铺前 8 个产品；本函数消费返回列表，不自行查询店铺或截取 8 条。
  // 因此未选品本身不会导致隐藏；只有选品和独立推荐结果都没有可用商品时，最终列表才为空。
  const configured = configuredRecommendations(products);
  return configured.length ? configured : runtime.recommendations.phase === "success" ? runtime.recommendations.items : [];
}

export function trackingSelection(result: TrackingPageQueryResult, recentQueries: readonly { mode: "tracking" | "order"; value: string }[]) {
  // 第一层是最多 3 条成功查询的编号；Runtime 已保证这一组模式一致，订单模式下邮箱也一致。
  // 没有历史时才用当前结果的运单号作为单条标识。
  const identity = recentQueries.length > 0
    ? { mode: recentQueries[0].mode, values: recentQueries.map((item) => item.value).slice(0, 3) }
    : { mode: "tracking" as const, values: result.trackingNumber ? [result.trackingNumber] : [] };
  // 第二层是当前结果的全部包裹，与第一层的 3 条上限无关，也不按查询模式过滤。
  // 展示组件在数量大于 1 时提供切换；运单号缺失时依次用包裹标签和序号占位。
  const shipmentValues = (result.shipments ?? []).map((shipment, index) => shipment.trackingNumber || shipment.label || `shipment #${index + 1}`);
  return { identity, shipmentValues };
}

/**
 * 三套模板共用 Ready-to-go 的状态显隐规则：idle/loading 隐藏旧结果，empty 只展示未找到，
 * error 保留进度/配送的错误提示入口。EDD 此处只限制演示自动查询，实际渲染还需有效日期。
 */
export function trackingBlockState({ phase, autoQueryDemo = false }: { phase: TrackingPageRuntimePhase; autoQueryDemo?: boolean }) {
  return {
    showResult: phase === "success",
    showNotFound: phase === "empty",
    showUnavailable: phase === "error",
    showProgress: phase === "success" || phase === "empty" || phase === "error",
    showDelivery: phase === "success" || phase === "error",
    showEstimatedDelivery: !autoQueryDemo
  };
}
