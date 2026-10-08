import { useState, type ReactNode } from "react";
import type { BlockEditorProps, FieldProps } from "@standhigher/puck-page-builder/runtime";
import type { TrackingPageQueryResult, TrackingPageRecommendation, TrackingPageWatermark } from "./tracking-page-runtime";
import { TrackingRuntimeProvider, useTrackingRuntime, type TrackingRuntimeProviderProps, type TrackingRuntimeState } from "./tracking-runtime";
import { formatRecommendationPrice, recommendationItems, trackingSelection, trackingBlockState } from "./tracking-block-model";
import { safeTrackingPageUrl } from "./tracking-page-url";
import { TrackingQueryCard, TrackingQueryResultDetails } from "./tracking-query-experience";

/**
 * 兼容旧宿主的 Branded 导入名称，实际复用 Ready-to-go 抽出的公共 Provider/Context。
 * 不再维护 Branded 自己的查询结果、包裹选择或推荐状态；页面上的区块共享同一份状态。
 */
export type BrandedRuntimeState = TrackingRuntimeState;
export type BrandedRuntimeProviderProps = TrackingRuntimeProviderProps;
export const BrandedRuntimeProvider = TrackingRuntimeProvider;
const useBrandedRuntime = useTrackingRuntime;

const contentWidth = { width: "min(1200px, 100%)", margin: "0 auto", padding: "0 clamp(16px, 4vw, 48px)", boxSizing: "border-box" as const };
const cardStyle = { background: "#fff", color: "#0a0a0a", border: "1px solid #e7e7e7", borderRadius: 10, fontFamily: "var(--pb-font-family)" };

function RuntimeWatermark({ watermark }: { watermark?: TrackingPageWatermark }) { return watermark?.visible ? <small style={{ display: "block", marginTop: 10, color: "#8a8a8a", fontSize: 8, textAlign: "right" }}>{watermark.label || "Powered by BestTrack"}</small> : null; }
function text(props: Record<string, unknown>, key: string, fallback: string) { return typeof props[key] === "string" ? props[key] : fallback; }
const safeHref = safeTrackingPageUrl;
const safeImageUrl = safeTrackingPageUrl;
function shipmentLabels(value: unknown) {
  return typeof value === "string"
    ? value.split("|").map((label, index) => ({ id: "configured-" + index, label: label.trim() })).filter((item) => item.label)
    : [];
}
function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeImageUrl(src);
  if (!safeSrc || failed) {
    return <span aria-label={alt + " image unavailable"} style={{ display: "grid", placeItems: "center", width: 72, height: 72, flex: "0 0 auto", borderRadius: 6, background: "#f2f2f2", color: "#6b6b6b", fontSize: 14 }}>{alt.slice(0, 1).toUpperCase()}</span>;
  }
  return <img src={safeSrc} alt={alt} onError={() => setFailed(true)} style={{ width: 72, height: 72, flex: "0 0 auto", borderRadius: 6, objectFit: "cover", background: "#f2f2f2" }} />;
}

/**
 * Branded 保留 Hero 上方的横向包裹栏，对应两层选择中的第二层。
 * 它只在成功结果含多个 shipments 时出现，不限制查询模式，也不计入最近三次查询。
 * 标签来自真实结果；画布的 shipmentLabels 配置只负责展示编辑占位。
 */
function ShipmentSwitcher() {
  const runtime = useBrandedRuntime();
  const shipments = trackingBlockState(runtime).showResult ? runtime.result?.shipments ?? [] : [];
  if (shipments.length < 2 || !runtime.result) return null;
  const { shipmentValues } = trackingSelection(runtime.result, runtime.recentQueries);
  return <div aria-label="Shipment switcher" style={{ ...contentWidth, minWidth: 0, minHeight: 56, display: "flex", alignItems: "center", gap: 8, overflowX: "auto", whiteSpace: "nowrap" }}>
    {shipments.map((shipment, index) => {
      const selected = runtime.selectedShipmentIndex === index;
      return <button key={shipment.id} type="button" onClick={() => runtime.selectShipment(index)} aria-pressed={selected} style={{ minWidth: 92, minHeight: 44, padding: "0 12px", border: selected ? "1px solid #1a1a1a" : "1px solid #e7e7e7", borderRadius: 4, background: "#fff", color: "#0a0a0a", fontSize: 11, fontWeight: selected ? 700 : 400, cursor: "pointer" }}>{shipmentValues[index]}</button>;
    })}
  </div>;
}

// 背景图和卡片布局仍由 Branded 决定，查询交互与完整结果使用公共组件。
// showShipments=false 只避免卡片内重复展示包裹栏；包裹切换由上方 ShipmentSwitcher 承载。
function QueryHero(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const result = runtime.result;
  return <div style={{ position: "relative", minWidth: 0, minHeight: "clamp(520px, 44vw, 560px)", display: "grid", overflow: "hidden", background: "linear-gradient(135deg, #dedbd4, #b9b3aa)" }}>
    {!heroImageFailed && safeImageUrl(props.heroImageUrl) ? <img src={safeImageUrl(props.heroImageUrl)} alt="" onError={() => setHeroImageFailed(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.12)" }} />
    <div style={{ ...contentWidth, position: "relative", zIndex: 1, display: "grid", alignItems: "center", width: "100%", minWidth: 0, paddingTop: "clamp(24px, 5vw, 48px)", paddingBottom: "clamp(24px, 5vw, 48px)" }}>
      <TrackingQueryCard
        phase={runtime.phase}
        onQuery={runtime.query}
        heading={text(props, "heading", "Track your order")}
        submitLabel={text(props, "submitLabel", "Track")}
        initialTrackingNumber={text(props, "defaultTrackingNumber", "DEMO-YQTRACK9999")}
        initialOrderNumber={text(props, "defaultOrderNumber", "")}
        initialMode={text(props, "defaultQueryMode", "tracking") === "order" ? "order" : "tracking"}
        trackingTabLabel={text(props, "trackingTabLabel", "Tracking Number")}
        orderTabLabel={text(props, "orderTabLabel", "Order Number")}
        emptyMessage="We couldn’t find an order for that number."
        errorMessage="We couldn’t retrieve this order right now. Please try again later."
        cardDataAttribute="data-branded-query-card"
        resultDataAttribute="data-branded-query-result"
        resultTestId="branded-result"
        cardStyle={{ ...cardStyle, width: "min(560px, 100%)", maxHeight: "min(560px, calc(100dvh - 32px))", marginLeft: "auto", padding: "clamp(24px, 5vw, 48px)", boxSizing: "border-box", boxShadow: "0 16px 40px rgb(0 0 0 / 8%)" }}
        headingStyle={{ marginBottom: 36, fontSize: "clamp(28px, 3vw, 32px)", lineHeight: 1.15 }}
        tabListStyle={{ borderBottomColor: "#e7e7e7", marginBottom: 24 }}
        tabStyle={(active) => ({ minHeight: 44, border: 0, borderBottom: active ? "2px solid #0a0a0a" : "2px solid transparent", background: "transparent", font: "inherit", fontWeight: active ? 700 : 400, cursor: "pointer" })}
        formStyle={{ gap: 12 }}
        inputStyle={{ width: "100%", height: 48, padding: "0 16px", boxSizing: "border-box", border: "1px solid #e2e2e2", borderRadius: 10, font: "inherit" }}
        submitStyle={(loading) => ({ width: "100%", minHeight: 48, marginTop: 12, border: 0, borderRadius: 10, background: loading ? "#6b6b6b" : "#000", color: "#fff", font: "inherit", cursor: loading ? "wait" : "pointer" })}
        result={result ? <TrackingQueryResultDetails showShipments={false} result={result} onTrackAnother={runtime.reset} trackAnotherLabel={text(props, "trackAnotherLabel", "Track another order")} /> : null}
        resultStyle={{ padding: 16, border: "1px solid #e7e7e7", borderRadius: 8, background: "#fffdf0" }}
        watermark={<RuntimeWatermark watermark={runtime.watermark} />}
      />
    </div>
  </div>;
}

// 缺少描述时不补造商品文案；通过公共 URL 校验的商品链接才提供 Reorder，点击仅跳转该链接。
function PackageContents({ items }: { items: TrackingPageQueryResult["orderItems"] }) {
  if (!items?.length) return <p style={{ margin: 0, color: "#6b6b6b" }}>Package contents are not available for this shipment.</p>;
  return <div style={{ display: "grid", gap: 16 }}>{items.map((item) => {
    const href = safeHref(item.href);
    return <article key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, minWidth: 0 }}><ProductImage src={item.imageUrl} alt={item.title} /><div style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{item.title}</strong>{item.description ? <p style={{ margin: "5px 0", color: "#6b6b6b", fontSize: 14 }}>{item.description}</p> : null}<small style={{ color: "#6b6b6b" }}>Qty {item.quantity}</small>{href ? <a href={href} style={{ display: "inline-flex", alignItems: "center", minHeight: 32, marginLeft: 8, padding: "6px 12px", border: "1px solid #e7e7e7", borderRadius: 6, color: "inherit", fontSize: 13 }}>Reorder</a> : null}</div></article>;
  })}</div>;
}

export function BrandedTextField({ value, onChange }: FieldProps) {
  return <input aria-label="Branded text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

type BrandedEditorProps = BlockEditorProps<Record<string, unknown>>;

function InlineText({ block, name, fallback }: { block: BrandedEditorProps; name: string; fallback: string }) {
  const value = text(block, name, fallback);
  if (!block.selected) return <span data-branded-editor-field={name}>{value}</span>;
  return <input
    aria-label={"Canvas " + name}
    data-branded-editor-field={name}
    value={value}
    onMouseDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onChange={(event) => block.onPropsChange({ [name]: event.currentTarget.value })}
    style={{ display: "inline-block", width: "100%", minWidth: "5ch", boxSizing: "border-box", /* border: "1px dashed currentColor", */ border: "none", borderRadius: 3, padding: "2px 5px", background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", letterSpacing: "inherit", textAlign: "inherit" }}
  />;
}

function EditorSurface({ block, children }: { block: BrandedEditorProps; children: ReactNode }) {
  return <section aria-label="Branded editor preview" style={{ ...cardStyle, outline: block.selected ? "2px solid #2563eb" : "1px dashed #cbd5e1", outlineOffset: -2, padding: 24 }}>{children}</section>;
}

export function BrandedAnnouncementEditor(block: BrandedEditorProps) {
  return <section aria-label="Branded announcement editor" style={{ minHeight: 36, display: "grid", placeItems: "center", padding: "0 16px", background: "#252525", color: "#fff", fontFamily: "var(--pb-font-family)", fontSize: 12, textAlign: "center" }}><InlineText block={block} name="message" fallback="Check out our summer sale" /></section>;
}

export function BrandedTrackingExperienceEditor(block: BrandedEditorProps) {
  const labels = shipmentLabels(block.shipmentLabels);
  return <section aria-label="Branded tracking experience editor" style={{ background: "#fffdf0", fontFamily: "var(--pb-font-family)" }}>
    <div style={{ ...contentWidth, minHeight: 56, display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>{labels.map((shipment, index) => <span key={shipment.id} style={{ minWidth: 92, padding: "9px 12px", border: index === 0 ? "1px solid #1a1a1a" : "1px solid #e7e7e7", borderRadius: 4, background: "#fff", fontSize: 11, fontWeight: index === 0 ? 700 : 400 }}>{shipment.label}</span>)}</div>
    <div style={{ minHeight: 360, display: "grid", placeItems: "center", padding: 16, background: "linear-gradient(135deg, #dedbd4, #b9b3aa)" }}>
      <EditorSurface block={block}>
        <h1 style={{ margin: "0 0 28px", textAlign: "center", fontSize: 32 }}><InlineText block={block} name="heading" fallback="Track your order" /></h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e7e7e7", marginBottom: 20, textAlign: "center" }}><span style={{ padding: 10 }}><InlineText block={block} name="orderTabLabel" fallback="Order Number" /></span><strong style={{ padding: 10, borderBottom: "2px solid #0a0a0a" }}><InlineText block={block} name="trackingTabLabel" fallback="Tracking Number" /></strong></div>
        <input aria-label="Canvas default tracking number" readOnly={!block.selected} value={text(block, "defaultTrackingNumber", "DEMO-YQTRACK9999")} onMouseDown={(event) => block.selected && event.stopPropagation()} onClick={(event) => block.selected && event.stopPropagation()} onChange={(event) => block.onPropsChange({ defaultTrackingNumber: event.currentTarget.value })} style={{ width: "100%", height: 44, boxSizing: "border-box", padding: "0 12px", /* border: block.selected ? "1px dashed #0a0a0a" : "1px solid #e2e2e2", */ border: "1px solid #e2e2e2", borderRadius: 10, background: "#fff", font: "inherit" }} />
        <div style={{ display: "grid", placeItems: "center", minHeight: 46, marginTop: 16, borderRadius: 10, background: "#000", color: "#fff", fontWeight: 700 }}><InlineText block={block} name="submitLabel" fallback="Track" /></div>
        <small style={{ display: "block", marginTop: 10, color: "#8a8a8a", fontSize: 9, textAlign: "right" }}>Powered by BestTrack</small>
      </EditorSurface>
    </div>
  </section>;
}

export function BrandedQueryEditor(block: BrandedEditorProps) {
  return <BrandedTrackingExperienceEditor {...block} />;
}

export function BrandedOrderItemsEditor(block: BrandedEditorProps) {
  return <EditorSurface block={block}><h2 style={{ margin: 0 }}><InlineText block={block} name="heading" fallback="What's Inside" /></h2><p style={{ color: "#6b6b6b" }}>Package contents appear after a consumer tracking query.</p></EditorSurface>;
}

export function BrandedRecommendationsEditor(block: BrandedEditorProps) {
  return <EditorSurface block={block}><h2 style={{ margin: 0, textAlign: "center" }}><InlineText block={block} name="heading" fallback="You might also like" /></h2><p style={{ color: "#6b6b6b", textAlign: "center" }}>Recommended products load independently of tracking queries.</p></EditorSurface>;
}

export function BrandedQuickLinksEditor(block: BrandedEditorProps) {
  return <EditorSurface block={block}><h2><InlineText block={block} name="heading" fallback="Need help?" /></h2><div style={{ display: "flex", gap: 20 }}><InlineText block={block} name="primaryLabel" fallback="Shipping help" /><InlineText block={block} name="secondaryLabel" fallback="Contact us" /></div></EditorSurface>;
}

export function BrandedBlogEditor(block: BrandedEditorProps) {
  return <EditorSurface block={block}><h2><InlineText block={block} name="heading" fallback="From our journal" /></h2><article><strong><InlineText block={block} name="articleTitle" fallback="Delivery tips for every season" /></strong><p><InlineText block={block} name="excerpt" fallback="Simple ways to make every delivery feel considered." /></p><InlineText block={block} name="linkLabel" fallback="Read the story" /></article></EditorSurface>;
}

export function BrandedAnnouncementBlock(props: Record<string, unknown>) {
  const message = text(props, "message", "");
  const href = safeHref(props.href);
  if (!message) return null;
  return <section aria-label="Branded announcement" style={{ minHeight: 36, display: "grid", placeItems: "center", padding: "0 16px", background: "#252525", color: "#fff", fontFamily: "var(--pb-font-family)", fontSize: 12, textAlign: "center" }}>{href ? <a href={href} style={{ color: "inherit", textDecoration: "none" }}>{message}</a> : message}</section>;
}

/** 查询、进度和配送合在现有 tracking-experience 区块内，布局保持不变，业务状态共用。 */
export function BrandedTrackingExperienceBlock(props: Record<string, unknown>) {
  return <section aria-label="Branded tracking experience" style={{ background: "#fffdf0", fontFamily: "var(--pb-font-family)" }}>
    <ShipmentSwitcher />
    <QueryHero {...props} />
  </section>;
}

/** Legacy editor block retained for manually composed documents; new templates use BrandedTrackingExperienceBlock. */
export function BrandedQueryBlock(props: Record<string, unknown>) {
  return <section aria-label="Branded tracking query" style={{ background: "#fffdf0", fontFamily: "var(--pb-font-family)" }}><ShipmentSwitcher /><QueryHero {...props} /></section>;
}

/** Legacy editor block retained for manually composed documents; new templates show package contents in the result. */
export function BrandedOrderItemsBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  // 兼容旧文档中的独立商品区块，同样遵循配送显隐规则，并读取当前选中包裹的商品。
  const visibility = trackingBlockState(runtime);
  if (!visibility.showDelivery) return null;
  const items = runtime.result?.orderItems ?? [];
  const title = text(props, "heading", "What's Inside");
  return <section aria-label={title} style={{ background: "#fffdf0", color: "#0a0a0a", fontFamily: "var(--pb-font-family)", padding: "clamp(28px, 4vw, 48px) 0" }}><div style={contentWidth}>
    <h2 style={{ margin: "0 0 20px", fontSize: 20 }}>{title}{visibility.showResult ? " (" + items.length + ")" : ""}</h2>
    {visibility.showResult ? <PackageContents items={items} /> : <p style={{ margin: 0, color: "#b42318" }}>Order items are temporarily unavailable.</p>}
  </div></section>;
}

function RecommendationCard({ item }: { item: TrackingPageRecommendation }) {
  const href = safeHref(item.href);
  // 推荐价格沿用 Ready-to-go 的 `$ 0.00` 格式；这是推荐专用规则，不走订单商品的币种格式器。
  const price = formatRecommendationPrice(item.price);
  return <article style={{ overflow: "hidden", borderRadius: 6, background: "#fff", boxShadow: "0 1px 2px rgb(0 0 0 / 8%)" }}><ProductImage src={item.imageUrl} alt={item.title} /><div style={{ padding: 14 }}><strong>{item.title}</strong>{price ? <p style={{ margin: "6px 0", fontWeight: 700 }}>{price}</p> : null}<p style={{ margin: "6px 0", color: "#6b6b6b", fontSize: 13 }}>{item.description}</p>{!href ? <span style={{ color: "#6b6b6b", fontSize: 13, fontWeight: 700 }}>View product</span> : <a href={href} style={{ color: "#0a0a0a", fontSize: 13, fontWeight: 700 }}>View product</a>}</div></article>;
}

export function BrandedRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  // 共用“商家选品优先、独立推荐次之”的来源规则，查单失败或包裹切换不影响推荐。
  // 空列表统一隐藏；旧文档的 hideWhenEmpty 字段保留兼容，但不再改变这条业务规则。
  const recommendations = recommendationItems(props.products, runtime);
  const title = text(props, "heading", "You might also like");
  if (!recommendations.length) return null;
  return <section aria-label={title} style={{ background: "#fffdf0", color: "#0a0a0a", fontFamily: "var(--pb-font-family)", padding: "clamp(28px, 4vw, 48px) 0" }}><div style={contentWidth}>
    <h2 style={{ margin: "0 0 24px", textAlign: "center", fontSize: 20 }}>{title}</h2>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>{recommendations.map((item) => <RecommendationCard key={item.id} item={item} />)}</div>
  </div></section>;
}

export function BrandedQuickLinksBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Need help?");
  const primaryHref = safeHref(props.primaryHref);
  const secondaryHref = safeHref(props.secondaryHref);
  return <section aria-label={title} style={{ ...cardStyle, margin: "24px auto", maxWidth: 1200, padding: 24 }}><h2>{title}</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>{primaryHref ? <a href={primaryHref} style={{ color: "#0a0a0a" }}>{text(props, "primaryLabel", "Shipping help")}</a> : <span>{text(props, "primaryLabel", "Shipping help")}</span>}{secondaryHref ? <a href={secondaryHref} style={{ color: "#0a0a0a" }}>{text(props, "secondaryLabel", "Contact us")}</a> : <span>{text(props, "secondaryLabel", "Contact us")}</span>}</div></section>;
}

export function BrandedBlogBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "From our journal");
  const href = safeHref(props.articleHref);
  return <section aria-label={title} style={{ ...cardStyle, margin: "24px auto", maxWidth: 1200, padding: 24 }}><h2>{title}</h2><article><strong>{text(props, "articleTitle", "Delivery tips for every season")}</strong><p>{text(props, "excerpt", "Simple ways to make every delivery feel considered.")}</p>{href ? <a href={href} style={{ color: "#0a0a0a" }}>{text(props, "linkLabel", "Read the story")}</a> : <span>{text(props, "linkLabel", "Read the story")}</span>}</article></section>;
}
