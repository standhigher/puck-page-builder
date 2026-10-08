/* eslint-disable react-refresh/only-export-components -- Shared runtime intentionally exports its context hook. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createShopifyRecommendationsQuery, createShopifyTrackQuery, mergeDisplayValues, shouldHidePoweredBy, type ShopifyTrackPageTransport } from "./shopify-track-query";
import { previewTrackingPageResult } from "./tracking-block-model";
import { isEmptyTrackingPageResult, type TrackingPageAd, type TrackingPageQuery, type TrackingPageQueryRequest, type TrackingPageQueryResult, type TrackingPageRecommendationsQuery, type TrackingPageRecommendationsState, type TrackingPageWatermark } from "./tracking-page-runtime";
import type { ShopifyResourceResolution } from "./shopify-resource-contract";

/** 第一层历史项：保存提交的查询身份和完整结果，恢复时无需再次请求接口。 */
export type TrackingRecentQuery = {
  mode: "tracking" | "order";
  value: string;
  email?: string;
  result: TrackingPageQueryResult;
};
/** empty 由结果显式标记；error 表示查询回调抛错，不能仅凭缺少物流节点判断未找到。 */
export type TrackingRuntimeState = { phase: "idle" | "loading" | "success" | "empty" | "error"; result?: TrackingPageQueryResult; error?: string };
export type TrackingRuntime = TrackingRuntimeState & {
  query(request: TrackingPageQueryRequest): Promise<void>;
  reset(): void;
  resourceResolution?: ShopifyResourceResolution;
  recentQueries: TrackingRecentQuery[];
  selectedRecentIndex: number;
  /** 仅显式点击历史记录时递增；与查询完成、包裹切换区分，供表单判断是否回填输入。 */
  selectionRevision: number;
  selectedShipmentIndex: number;
  selectRecentQuery: (index: number) => void;
  selectShipment: (index: number) => void;
  recommendations: TrackingPageRecommendationsState;
  autoQueryFromUrl: boolean;
  /** 仅供宿主明确开启演示自动查询；普通页面默认等待提交或已启用的 URL 深链。 */
  autoQueryDemo: boolean;
  watermark?: TrackingPageWatermark;
  /** 编辑态广告预览；正式页面的广告仍来自当前查询结果 result.ad。 */
  adPreview?: TrackingPageAd | null;
};

function recentQueryFromRequest(request: TrackingPageQueryRequest, result: TrackingPageQueryResult): TrackingRecentQuery | null {
  // 历史标签优先使用用户实际提交的编号，不能因结果投影到某个包裹而变成该包裹的运单号。
  if (request.mode === "order") {
    const value = request.orderNumber.trim() || result.orderNumber?.trim() || "";
    if (!value) return null;
    return { mode: "order", value, email: request.email.trim() || undefined, result };
  }
  const value = request.trackingNumber.trim() || result.trackingNumber.trim();
  if (!value) return null;
  return { mode: "tracking", value, result };
}

function mergeRecentQueries(previous: TrackingRecentQuery[], next: TrackingRecentQuery): TrackingRecentQuery[] {
  // 只在新查询成功时切换历史组：两种查询模式不混存，订单查询也不跨邮箱复用记录。
  // 在同一组内，新编号排在最前；重复编号更新缓存并前移，总数由 mergeDisplayValues 限制为 3。
  if (previous[0] && (previous[0].mode !== next.mode || (next.mode === "order" && previous[0].email !== next.email))) return [next];
  const values = mergeDisplayValues(previous.map((item) => item.value), [next.value]);
  const byValue = new Map(previous.map((item) => [item.value, item]));
  byValue.set(next.value, next);
  return values.flatMap((value) => {
    const item = byValue.get(value);
    return item ? [item] : [];
  });
}

function resultWithShipment(result: TrackingPageQueryResult, index: number): TrackingPageQueryResult {
  const shipment = result.shipments?.[index];
  if (!shipment) return result;
  // 把选中包裹投影到公共展示字段，进度、配送等区块始终读同一份结果。
  // 完整 shipments 与订单级字段仍保留；缺省列表/广告沿用结果级值，显式空数组不在此被替换。
  // 空列表是否生成摘要/默认进度由展示模型决定，不能在投影时混入其他包裹的列表。
  // carrier、destination 等包裹属性直接覆盖，避免切换后残留上一个包裹的信息。
  return {
    ...result,
    trackingNumber: shipment.trackingNumber || result.trackingNumber,
    status: shipment.status || result.status,
    carrier: shipment.carrier,
    latestEvent: shipment.latestEvent,
    updatedAt: shipment.updatedAt,
    destination: shipment.destination,
    estimatedDelivery: shipment.estimatedDelivery,
    progress: shipment.progress ?? result.progress,
    events: shipment.events ?? result.events,
    orderItems: shipment.orderItems ?? result.orderItems,
    ad: shipment.ad ?? result.ad
  };
}

// 未包裹 Provider 时提供稳定的 idle 上下文，查询/切换方法均不执行请求。
// 内置演示查询仅在 Provider 挂载且没有查询来源时使用，不是 Context 的默认行为。
const initialRuntime: TrackingRuntime = {
  phase: "idle",
  recentQueries: [],
  selectedRecentIndex: 0,
  selectionRevision: 0,
  selectedShipmentIndex: 0,
  selectRecentQuery() { return undefined; },
  selectShipment() { return undefined; },
  recommendations: { phase: "idle", items: [] },
  autoQueryFromUrl: false,
  autoQueryDemo: false,
  reset() { return undefined; },
  async query() { return undefined; }
};
const TrackingRuntimeContext = createContext<TrackingRuntime>(initialRuntime);
export type TrackingRuntimeProviderProps = {
  children: ReactNode;
  /** 宿主已解析的 Shopify 商品/集合资源，直接供 Sales 等区块读取；Provider 不自动解析引用。 */
  resourceResolution?: ShopifyResourceResolution;
  /** 宿主负责鉴权的查询入口；mode 区分运单号查询与订单号加邮箱查询。 */
  query?: TrackingPageQuery;
  /** 页面级推荐独立加载，不共用查单的 loading/error，也不因包裹切换而重新请求。 */
  queryRecommendations?: TrackingPageRecommendationsQuery;
  /**
   * 未注入 query 时，通过该传输层执行原 /track/query 的请求体、防缓存、重试与结果映射。
   * 推荐来源单独选择：未注入 queryRecommendations 时，即使已有 query，也会使用此处的
   * post 在挂载时请求 /products/recommend；鉴权和请求地址前缀由宿主负责。
   */
  transport?: ShopifyTrackPageTransport;
  /** 未显式指定时，仅 transport 存在且没有注入 query 的路径默认开启 URL 深链自动查询。 */
  autoQueryFromUrl?: boolean;
  /**
   * 仅演示预览使用：挂载后查询表单初始演示运单号。
   * 正式宿主不能依靠演示编号自动查询；真实深链自动查询由 autoQueryFromUrl 单独控制。
   */
  autoQueryDemo?: boolean;
  /** 优先使用宿主决定的水印显隐；未提供时沿用原 powered-by 规则。 */
  watermark?: TrackingPageWatermark;
  /** 编辑态广告预览；正式页面的广告仍来自当前查询结果 result.ad。 */
  adPreview?: TrackingPageAd | null;
};

async function queryMockTracking(request: TrackingPageQueryRequest): Promise<TrackingPageQueryResult> {
  return previewTrackingPageResult(request.mode === "tracking" ? request.trackingNumber : request.orderNumber);
}

/**
 * 三套模板共用的页面状态；历史与订单结果仅保存在本 Provider 内存中。
 * 店铺、访客授权或 Mock/Live 上下文改变时，宿主需重新挂载或更换 key；替换 query 本身不清历史。
 */
export function TrackingRuntimeProvider({ children, query: injectedQuery, queryRecommendations, transport, autoQueryFromUrl, autoQueryDemo = false, watermark, adPreview, resourceResolution }: TrackingRuntimeProviderProps) {
  const [state, setState] = useState<TrackingRuntimeState>({ phase: "idle" });
  const [recentQueries, setRecentQueries] = useState<TrackingRecentQuery[]>([]);
  const [selectedRecentIndex, setSelectedRecentIndex] = useState(0);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [selectedShipmentIndex, setSelectedShipmentIndex] = useState(0);
  // 单调递增的版本号只使旧响应失效，不取消网络请求；成功与异常分支都必须核对版本。
  const requestId = useRef(0);
  const resolvedQuery = useMemo(() => {
    if (injectedQuery) return injectedQuery;
    if (transport) return createShopifyTrackQuery(transport);
    return undefined;
  }, [injectedQuery, transport]);
  const resolvedRecommendations = useMemo(() => {
    if (queryRecommendations) return queryRecommendations;
    if (transport) return createShopifyRecommendationsQuery(transport.post);
    return undefined;
  }, [queryRecommendations, transport]);
  // 这里表示存在宿主查询来源（宿主也可显式注入 Mock）；仅完全没有来源时使用内置演示结果。
  // 已有来源的请求失败会进入 empty/error 规则，不能自动改走内置 Mock。
  const live = Boolean(resolvedQuery);
  const [recommendationLoad, setRecommendationLoad] = useState<{
    source: TrackingPageRecommendationsQuery | undefined;
    state: TrackingPageRecommendationsState;
  }>(() => ({ source: resolvedRecommendations, state: { phase: resolvedRecommendations ? "loading" : "idle", items: [] } }));
  const recommendations = useMemo<TrackingPageRecommendationsState>(() => recommendationLoad.source === resolvedRecommendations
    ? recommendationLoad.state
    : { phase: resolvedRecommendations ? "loading" : "idle", items: [] }, [recommendationLoad, resolvedRecommendations]);
  // 回调身份变化或被移除时，当前渲染立即弃用旧来源商品，不等待 effect 才清空。
  // 例如预览从 Mock 切到 Live 时，不应短暂展示先前的演示推荐。
  if (recommendationLoad.source !== resolvedRecommendations) {
    setRecommendationLoad({ source: resolvedRecommendations, state: recommendations });
  }

  useEffect(() => {
    if (!resolvedRecommendations) return;
    // 推荐有自己的生命周期；来源变化或卸载后，旧请求的成功/失败均不能回写新来源状态。
    // effect 依赖加载函数身份，宿主应保持 queryRecommendations/transport 稳定，避免无意中重复加载。
    let active = true;
    void Promise.resolve().then(resolvedRecommendations).then((items) => {
      if (!active) return;
      setRecommendationLoad({ source: resolvedRecommendations, state: { phase: items.length ? "success" : "empty", items } });
    }).catch(() => {
      if (!active) return;
      setRecommendationLoad({ source: resolvedRecommendations, state: { phase: "error", items: [] } });
    });
    return () => { active = false; };
  }, [resolvedRecommendations]);

  const query = useCallback(async (request: TrackingPageQueryRequest) => {
    const currentRequestId = ++requestId.current;
    // loading 不携带上一笔结果，展示层据此隐藏旧进度/配送；历史缓存和独立推荐继续保留。
    setState({ phase: "loading" });
    try {
      const result = live ? await resolvedQuery!(request) : await queryMockTracking(request);
      if (currentRequestId !== requestId.current) return;
      if (isEmptyTrackingPageResult(result)) {
        // 未找到仅更新本次展示状态，不加入最近查询，也不丢弃已有成功查询缓存。
        setState({ phase: "empty", result });
        return;
      }
      const recent = recentQueryFromRequest(request, result);
      if (recent) {
        setRecentQueries((previous) => mergeRecentQueries(previous, recent));
        setSelectedRecentIndex(0);
        setSelectedShipmentIndex(0);
      }
      // 每笔成功结果默认展示首个包裹；是否有第二层切换入口由实际 shipments 数量决定。
      setState({ phase: "success", result: resultWithShipment(result, 0) });
    } catch {
      if (currentRequestId !== requestId.current) return;
      setState({ phase: "error", error: "We couldn’t retrieve this order right now. Please try again later." });
    }
  }, [live, resolvedQuery]);
  const selectRecentQuery = useCallback((index: number) => {
    const item = recentQueries[index];
    if (!item) return;
    // 直接恢复完整缓存并使在途查询失效，不重发请求，也不调整历史排序。
    requestId.current += 1;
    // 即使点击的还是同一索引，也表示要求表单恢复该历史项，因此不能只依赖索引变化。
    setSelectionRevision((revision) => revision + 1);
    setSelectedRecentIndex(index);
    setSelectedShipmentIndex(0);
    setState({ phase: "success", result: resultWithShipment(item.result, 0) });
  }, [recentQueries]);
  const selectShipment = useCallback((index: number) => {
    // 第二层属于当前查询结果，不新增第一层历史项；任一查询模式返回多个包裹都可切换。
    // 优先从未投影的历史结果取包裹，避免反复切换时把上一包裹的字段当作结果级回退值。
    const full = recentQueries[selectedRecentIndex]?.result ?? state.result;
    if (!full?.shipments?.[index]) return;
    requestId.current += 1;
    setSelectedShipmentIndex(index);
    setState({ phase: "success", result: resultWithShipment(full, index) });
  }, [recentQueries, selectedRecentIndex, state.result]);
  const reset = useCallback(() => {
    // 重置查单也使旧响应失效；表单输入由各表单管理，不随此处重置。
    // 推荐是页面级独立状态，不在此清空或重新加载。
    requestId.current += 1;
    setState({ phase: "idle" });
    setRecentQueries([]);
    setSelectedRecentIndex(0);
    setSelectedShipmentIndex(0);
  }, []);
  const resolveAutoQuery = autoQueryFromUrl ?? Boolean(transport && !injectedQuery);
  const resolvedWatermark = useMemo(
    () => watermark ?? { visible: !shouldHidePoweredBy() },
    [watermark]
  );
  const value = useMemo<TrackingRuntime>(() => ({
    ...state,
    adPreview,
    resourceResolution,
    reset,
    query,
    recentQueries,
    selectedRecentIndex,
    selectionRevision,
    selectedShipmentIndex,
    selectRecentQuery,
    selectShipment,
    recommendations,
    autoQueryFromUrl: resolveAutoQuery,
    autoQueryDemo,
    watermark: resolvedWatermark
  }), [adPreview, resourceResolution, reset, autoQueryDemo, query, recentQueries, recommendations, resolveAutoQuery, resolvedWatermark, selectRecentQuery, selectShipment, selectedRecentIndex, selectionRevision, selectedShipmentIndex, state]);
  return <TrackingRuntimeContext.Provider value={value}>{children}</TrackingRuntimeContext.Provider>;
}

export function useTrackingRuntime() { return useContext(TrackingRuntimeContext); }
