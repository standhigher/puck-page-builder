import { type CSSProperties, type ReactNode } from "react";
import { type BlockEditorProps, type FieldProps } from "@standhigher/puck-page-builder/runtime";
import { scrollToTrackingResult } from "./shopify-track-query";
import { useTrackingRuntime as useReadyToGoRuntime, type TrackingRecentQuery as ReadyToGoRecentQuery } from "./tracking-runtime";
import { useTrackingQueryForm } from "./tracking-query-form";
import { configuredRecommendations, recommendationItems, previewTrackingPageResult as previewReadyToGoTracking, trackingEvents as eventsFrom, trackingSteps, trackingSelection, trackingBlockState } from "./tracking-block-model";
// 保留原来的公开名称，实际与 Branded、Sales 指向同一个 Provider 和 Context。
// 宿主只需在页面外包一份 Provider，查询、进度、配送和推荐区块即可订阅同一组状态。
export { TrackingRuntimeProvider as ReadyToGoRuntimeProvider } from "./tracking-runtime";
export type { TrackingRuntimeProviderProps as ReadyToGoRuntimeProviderProps, TrackingRuntimeState as ReadyToGoRuntimeState, TrackingRecentQuery as ReadyToGoRecentQuery } from "./tracking-runtime";
import {
  contentWidth,
  PackageContents,
  pageFont,
  EstimatedDeliveryCard,
  RecommendationCards,
  SectionShell,
  ShippingTimeline,
  text,
  TrackPageOrderBadges,
  TrackPageQueryNumber,
  TrackingPageAdSlot,
  TrackingProgress
} from "./track-page-display";
import { TrackingNotFound } from "./tracking-not-found";
import { TrackingLoading } from "./tracking-loading";
import type {
  TrackingPageOrderItem,
  TrackingPageQueryResult,
  TrackingPageRecommendation,
  TrackingPageShipment,
  TrackingPageTrackingEvent,
  TrackingPageTrackingStep,
  TrackingPageWatermark
} from "./tracking-page-runtime";

/** 保留 Ready-to-go 的类型别名，避免业务逻辑抽到共用层后破坏已有宿主的导入。 */
export type ReadyToGoOrderItem = TrackingPageOrderItem;
export type ReadyToGoRecommendation = TrackingPageRecommendation;
export type ReadyToGoTrackingStep = TrackingPageTrackingStep;
export type ReadyToGoTrackingEvent = TrackingPageTrackingEvent;
export type ReadyToGoShipment = TrackingPageShipment;
export type ReadyToGoTrackingResult = TrackingPageQueryResult;
function RuntimeWatermark({ watermark }: { watermark?: TrackingPageWatermark }) { return watermark?.visible ? <small style={{ display: "block", marginTop: "auto", paddingTop: 28, textAlign: "center", fontSize: 12, lineHeight: "17px", fontStyle: "italic", color: "#b8b8b8" }}>{watermark.label || "Powered by BestTrack"}</small> : null; }

const heroStyle: CSSProperties = {
  ...pageFont,
  position: "relative",
  minHeight: 520,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  backgroundColor: "#fff",
  padding: "48px clamp(16px, 4%, 24px)",
  boxSizing: "border-box"
};
const editorHeroStyle: CSSProperties = {
  ...pageFont,
  position: "relative",
  display: "grid",
  placeItems: "center",
  backgroundColor: "#fff",
  padding: "48px clamp(16px, 4%, 24px)",
  boxSizing: "border-box"
};
const formCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "min(560px, 100%)",
  maxWidth: 560,
  minHeight: 388,
  borderRadius: "var(--pb-radius, 8px)",
  background: "var(--pb-color-surface, #fff)",
  color: "var(--pb-color-text, #0f172a)",
  padding: "clamp(20px, 7%, 40px)",
  boxSizing: "border-box",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)"
};
const editorFormCardStyle: CSSProperties = { ...formCardStyle, minHeight: 0 };
const tabStyle = (active: boolean): CSSProperties => ({
  appearance: "none",
  flex: 1,
  minWidth: 0,
  minHeight: 53,
  margin: 0,
  padding: "12px 6px",
  font: "inherit",
  fontSize: 15,
  lineHeight: "21px",
  fontWeight: active ? 500 : 400,
  background: "none",
  border: 0,
  borderBottom: active ? "2px solid #0f172a" : "2px solid transparent",
  borderRadius: 0,
  color: active ? "#0f172a" : "#94a3b8",
  cursor: "pointer",
  textAlign: "center",
  overflowWrap: "anywhere"
});
const inputStyle: CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: "var(--pb-radius, 8px)",
  border: "1px solid #111",
  background: "#fff",
  padding: 12,
  font: "inherit",
  fontSize: 14,
  lineHeight: "20px",
  color: "#334155",
  boxSizing: "border-box"
};
const hexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const defaultSubmitButtonColor = "var(--pb-color-primary, #111)";

function submitButtonBackground(props: Record<string, unknown>, loading = false) {
  if (loading) return "#475569";
  const value = text(props, "submitButtonColor");
  return hexColor.test(value) ? value : defaultSubmitButtonColor;
}

function submitButtonStyle(props: Record<string, unknown>, loading = false): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 58,
    marginTop: 8,
    borderRadius: "var(--pb-radius, 8px)",
    background: submitButtonBackground(props, loading),
    color: "#fff",
    fontSize: 15,
    fontWeight: 600
  };
}

export function ReadyToGoTextField({ value, onChange }: FieldProps) {
  return <input aria-label="Ready-to-go text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

type ReadyToGoEditorProps = BlockEditorProps<Record<string, unknown>>;

/** 旧模板把这个演示号写进了 defaultProps，已发布文档里可能还留着。输入框留空，才能露出 placeholder。 */
const LEGACY_READY_TO_GO_DEMO_TRACKING_NUMBER = "BT-2048-DEMO";

function readyToGoTrackingNumber(source: Record<string, unknown>) {
  const value = text(source, "defaultTrackingNumber", "");
  return value === LEGACY_READY_TO_GO_DEMO_TRACKING_NUMBER ? "" : value;
}

function InlineText({ block, name, fallback }: { block: ReadyToGoEditorProps; name: string; fallback: string }) {
  const value = text(block, name, fallback);
  if (!block.selected) return <span data-ready-to-go-editor-field={name}>{value}</span>;
  return <input
    aria-label={"Canvas " + name}
    data-ready-to-go-editor-field={name}
    value={value}
    onMouseDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onChange={(event) => block.onPropsChange({ [name]: event.currentTarget.value })}
    style={{ display: "inline-block", width: "100%", minWidth: "5ch", boxSizing: "border-box", /* border: "1px dashed currentColor", */ border: "none", borderRadius: 3, padding: "2px 5px", background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", letterSpacing: "inherit", textAlign: "inherit" }}
  />;
}

/**
 * 结果区有两个独立的选择层级：第一层是最近最多三条成功查询，点击恢复缓存；
 * 第二层是当前查询结果中的包裹，点击只切换该结果内的包裹，不占用历史查询名额。
 * 第二层仅按 shipments 数量判断，订单号和运单号查询只要返回多个包裹都可以切换。
 * 此组件只渲染入口；缓存恢复、选中索引及配送字段联动均由传入的 Runtime 回调完成。
 */
function ProgressResult({
  result,
  showEstimatedDelivery = true,
  color,
  recentQueries = [],
  selectedRecentIndex = 0,
  onSelectRecent,
  selectedShipmentIndex = 0,
  onSelectShipment
}: {
  result: ReadyToGoTrackingResult;
  showEstimatedDelivery?: boolean;
  color?: string;
  recentQueries?: ReadyToGoRecentQuery[];
  selectedRecentIndex?: number;
  onSelectRecent?: (index: number) => void;
  selectedShipmentIndex?: number;
  onSelectShipment?: (index: number) => void;
}) {
  // 接口有进度节点就完整使用，只有缺失/空数组才由共用模型按状态生成默认节点。
  const steps = trackingSteps(result);
  const { identity, shipmentValues } = trackingSelection(result, recentQueries);
  return <>
    {identity.values.length > 1 && onSelectRecent
      ? <TrackPageOrderBadges values={identity.values.slice(0, 3)} selectedIndex={selectedRecentIndex} onSelect={onSelectRecent} />
      : identity.values[0]
        ? <TrackPageQueryNumber mode={identity.mode} value={identity.values[0]} />
        : null}
    {shipmentValues.length > 1 && onSelectShipment
      ? <TrackPageOrderBadges values={shipmentValues} selectedIndex={selectedShipmentIndex} onSelect={onSelectShipment} style={{ marginTop: 8 }} />
      : null}
    <h2 style={{ margin: "clamp(24px, 8%, 48px) 0 0", fontSize: 32, lineHeight: 1.25, fontWeight: 700, color: "#303030", overflowWrap: "anywhere" }}>{result.status}</h2>
    <div className="bt-progress-band">
      {showEstimatedDelivery && result.estimatedDelivery ? <EstimatedDeliveryCard dateText={result.estimatedDelivery} steps={steps.length} /> : null}
      <TrackingProgress steps={steps} color={color} />
    </div>
  </>;
}

// eventsFrom 是公共 trackingEvents 的本地别名：优先完整事件列表，其次取 latestEvent 摘要。
// 本组件只保留左右栏外观；不自行截断事件，也不按模板生成另一份物流数据。
function DeliveryResult({ heading, contentsHeading, carrierHeading, result, editing }: { heading: ReactNode; contentsHeading: ReactNode; carrierHeading: ReactNode; result: ReadyToGoTrackingResult; editing?: boolean }) {
  return <div style={{ ...contentWidth, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 500px))", gap: 40, justifyContent: "center", alignItems: "start" }}>
    <div>
      <h3 style={{ margin: 0, fontSize: 20, lineHeight: "20px", fontWeight: 700 }}>{heading}</h3>
      <ShippingTimeline events={eventsFrom(result)} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <TrackingPageAdSlot ad={result.ad} disableLink={editing} />
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>{contentsHeading}</h3>
        <PackageContents items={result.orderItems ?? []} />
      </div>
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>{carrierHeading}</h3>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{result.carrier ?? "Not available"}</p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>{result.destination ?? "Destination details are not available."}</p>
      </div>
    </div>
  </div>;
}

export function ReadyToGoQueryEditor(block: ReadyToGoEditorProps) {
  return <section aria-label="Ready-to-go query editor" style={editorHeroStyle}>
    <div role="region" aria-label="Ready-to-go tracking query" style={editorFormCardStyle}>
      <div style={{ display: "flex", width: "100%", borderBottom: "1px solid #cbd5e1" }}>
        <div style={{ ...tabStyle(true), display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
          <InlineText block={block} name="trackingTabLabel" fallback="Tracking Number" />
        </div>
        <div style={{ ...tabStyle(false), display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
          <InlineText block={block} name="orderTabLabel" fallback="Order Number" />
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <input
          aria-label="Canvas default tracking number"
          readOnly={!block.selected}
          value={readyToGoTrackingNumber(block)}
          placeholder="Tracking Number"
          onMouseDown={(event) => block.selected && event.stopPropagation()}
          onClick={(event) => block.selected && event.stopPropagation()}
          onChange={(event) => block.onPropsChange({ defaultTrackingNumber: event.currentTarget.value })}
          style={{ ...inputStyle /* , border: block.selected ? "1px dashed #111" : inputStyle.border */ }}
        />
        <div style={submitButtonStyle(block)}>
          <InlineText block={block} name="submitLabel" fallback="Track Your Order" />
        </div>
      </div>
      <p style={{ marginTop: "auto", paddingTop: 28, textAlign: "center", fontSize: 12, lineHeight: "17px", fontStyle: "italic", color: "#b8b8b8" }}>Powered by BestTrack</p>
    </div>
  </section>;
}

export function ReadyToGoProgressEditor(block: ReadyToGoEditorProps) {
  // 画布使用公共演示结果预览进度外观，但明确隐藏演示送达日期，避免把占位日期当商家配置。
  return <section aria-label="Ready-to-go progress editor" style={{ ...pageFont, background: "var(--pb-color-background, #fff)", color: "var(--pb-color-text, #0f172a)", borderBottom: "1px solid #f1f5f9" }}>
    <div style={{ ...contentWidth, textAlign: "center", width: "min(1248px, 100%)" }}>
      <ProgressResult result={previewReadyToGoTracking()} showEstimatedDelivery={false} color={text(block, "progressColor")} />
    </div>
  </section>;
}

export function ReadyToGoDeliveryEditor(block: ReadyToGoEditorProps) {
  // 管理端广告预览只在画布覆盖演示结果，editing 禁止预览跳转；Web 继续使用查询结果的广告。
  const { adPreview } = useReadyToGoRuntime();
  return <section aria-label="Ready-to-go delivery editor" style={{ ...pageFont, background: "var(--pb-color-background, #fff)", color: "var(--pb-color-text, #0f172a)", borderBottom: "1px solid #f1f5f9" }}>
    <DeliveryResult
      heading={<InlineText block={block} name="heading" fallback="Shipping Details" />}
      contentsHeading={<InlineText block={block} name="contentsHeading" fallback="Package Contents" />}
      carrierHeading={<InlineText block={block} name="carrierHeading" fallback="Carrier" />}
      editing
      result={{ ...previewReadyToGoTracking(), ad: adPreview ?? undefined }}
    />
  </section>;
}

export function ReadyToGoRecommendationsEditor(block: ReadyToGoEditorProps) {
  // 画布用演示商品展示未配置时的轮播外观；这不是 Web 查询失败时的推荐兜底。
  const selected = configuredRecommendations(block.products);
  const items = selected.length ? selected : previewReadyToGoTracking().recommendations ?? [];
  return <section aria-label="Ready-to-go recommendations editor" style={{ ...pageFont, background: "var(--pb-color-background, #fff)", color: "var(--pb-color-text, #0f172a)" }}>
    <div style={contentWidth}>
      <h3 style={{ margin: 0, textAlign: "center", fontSize: 20, lineHeight: "20px", fontWeight: 700 }}><InlineText block={block} name="heading" fallback="You may also like..." /></h3>
      <div style={{ marginTop: 24 }}><RecommendationCards items={items} /></div>
    </div>
  </section>;
}


export function ReadyToGoQueryBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  // 三套模板共用输入保留、trim 后非空校验、URL 同步和历史回填规则。
  // Ready-to-go 仅指定查询完成后的页面滚动目标，表单布局和配色仍留在本组件。
  const { mode, setMode, trackingNumber, setTrackingNumber, orderNumber, setOrderNumber, email, setEmail, localError, loading, submit } = useTrackingQueryForm({
    initialTrackingNumber: readyToGoTrackingNumber(props),
    initialOrderNumber: text(props, "defaultOrderNumber", ""),
    initialMode: text(props, "defaultQueryMode", "tracking") === "order" ? "order" : "tracking",
    onComplete: scrollToTrackingResult
  });
  const submitLabel = text(props, "submitLabel", "Track Your Order");
  const trackingTabLabel = text(props, "trackingTabLabel", "Tracking Number");
  const orderTabLabel = text(props, "orderTabLabel", "Order Number");
  return <section style={heroStyle}>
    <div role="region" aria-label="Ready-to-go tracking query" style={formCardStyle}>
      <div role="tablist" aria-label="Tracking method" style={{ display: "flex", width: "100%", borderBottom: "1px solid #cbd5e1" }}>
        <button type="button" role="tab" aria-selected={mode === "tracking"} onClick={() => setMode("tracking")} style={tabStyle(mode === "tracking")}>{trackingTabLabel}</button>
        <button type="button" role="tab" aria-selected={mode === "order"} onClick={() => setMode("order")} style={tabStyle(mode === "order")}>{orderTabLabel}</button>
      </div>
      <form onSubmit={submit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        {mode === "order" ? <>
          <label htmlFor="ready-to-go-order-number" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Order number</label>
          <input id="ready-to-go-order-number" aria-label="Order number" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="Order Number" style={inputStyle} />
          <label htmlFor="ready-to-go-email" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Email</label>
          <input id="ready-to-go-email" aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={inputStyle} />
        </> : <>
          <label htmlFor="ready-to-go-tracking-number" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Tracking number</label>
          <input id="ready-to-go-tracking-number" aria-label="Tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Tracking Number" style={inputStyle} />
        </>}
        {localError ? <p role="alert" style={{ margin: 0, textAlign: "center", fontSize: 12, color: "#f43f5e" }}>{localError}</p> : null}
        <button type="submit" disabled={loading} style={{ ...submitButtonStyle(props, loading), border: 0, font: "inherit", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>{submitLabel}</button>
        {runtime.phase === "error" ? <p role="alert" style={{ margin: 0, textAlign: "center", fontSize: 12, color: "#f43f5e" }}>{runtime.error}</p> : null}
      </form>
      <RuntimeWatermark watermark={runtime.watermark} />
      {loading ? <TrackingLoading /> : null}
    </div>
  </section>;
}

export function ReadyToGoProgressBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  // 必需区块可以暂时不输出内容：idle/loading 隐藏，empty 显示未找到，error 显示不可用。
  // 显隐与演示预览隐藏预计送达日期的规则由共用模型决定，不在模板中另设业务分支。
  const visibility = trackingBlockState(runtime);
  const result = runtime.result;
  if (!visibility.showProgress) return null;
  if (visibility.showNotFound) return <TrackingNotFound resultAnchor />;
  return <SectionShell title="Shipment progress" resultAnchor>
    <div style={{ ...contentWidth, textAlign: "center", width: "min(1248px, 100%)" }}>
      {visibility.showUnavailable ? <p style={{ margin: 0, color: "#b42318" }}>Shipment progress is temporarily unavailable.</p> : null}
      {visibility.showResult && result ? <ProgressResult
        result={result}
        showEstimatedDelivery={visibility.showEstimatedDelivery}
        color={text(props, "progressColor")}
        recentQueries={runtime.recentQueries}
        selectedRecentIndex={runtime.selectedRecentIndex}
        onSelectRecent={runtime.selectRecentQuery}
        selectedShipmentIndex={runtime.selectedShipmentIndex}
        onSelectShipment={runtime.selectShipment}
      /> : null}
    </div>
  </SectionShell>;
}

export function ReadyToGoDeliveryBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const visibility = trackingBlockState(runtime);
  if (!visibility.showDelivery) return null;
  const heading = text(props, "heading", "Shipping Details");
  const contentsHeading = text(props, "contentsHeading", "Package Contents");
  const carrierHeading = text(props, "carrierHeading", "Carrier");
  // Runtime 已将选中包裹投影到 result；与进度区读取同一份结果，避免切换后各区块不同步。
  const result = runtime.result;
  return <SectionShell title={heading}>
    {visibility.showResult && result ? <DeliveryResult heading={heading} contentsHeading={contentsHeading} carrierHeading={carrierHeading} result={result} /> : <div style={{ ...contentWidth, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 500px))", gap: 40, justifyContent: "center", alignItems: "start" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 20, lineHeight: "20px", fontWeight: 700 }}>{heading}</h3>
        {visibility.showUnavailable ? <p style={{ margin: "16px 0 0", color: "#b42318" }}>Delivery details are temporarily unavailable.</p> : null}
      </div>
    </div>}
  </SectionShell>;
}

export function ReadyToGoRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const heading = text(props, "heading", "You may also like...");
  // 商家选品优先，其次取独立推荐请求的成功结果，不从查单结果里读取 recommendations。
  // 没有商品只隐藏渲染内容；推荐区块本身仍受模板的必需区块策略保护。
  const items = recommendationItems(props.products, runtime);
  if (!items.length) return null;
  return <SectionShell title={heading} bordered={false}>
    <div style={contentWidth}>
      <h3 style={{ margin: 0, textAlign: "center", fontSize: 20, lineHeight: "20px", fontWeight: 700 }}>{heading}</h3>
      <div style={{ marginTop: 24 }}><RecommendationCards items={items} /></div>
    </div>
  </SectionShell>;
}
