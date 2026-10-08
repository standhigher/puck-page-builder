import { useState, type CSSProperties, type ReactNode } from "react";
import type { BlockEditorProps, FieldProps } from "@standhigher/puck-page-builder/runtime";
import type { TrackingPageWatermark } from "./tracking-page-runtime";
import { TrackingRuntimeProvider, useTrackingRuntime, type TrackingRuntimeProviderProps, type TrackingRuntimeState } from "./tracking-runtime";
import { formatRecommendationPrice, recommendationItems, trackingSelection, trackingBlockState } from "./tracking-block-model";
import { safeTrackingPageUrl } from "./tracking-page-url";
import { TrackingQueryCard, TrackingQueryResultDetails } from "./tracking-query-experience";
import { getResolvedShopifyResource, getShopifyResourceResolutionError, isShopifyResourceReference } from "./shopify-resource-contract";

/**
 * Sales 的旧公开名称映射到共用 Runtime，避免旧接入方改名或再包一层独立状态。
 * 查询、历史记录、包裹选择和推荐沿用 Ready-to-go 规则；商品资源解析仍由宿主提供。
 */
export type SalesRuntimeState = TrackingRuntimeState;
export type SalesRuntimeProviderProps = TrackingRuntimeProviderProps;
export const SalesRuntimeProvider = TrackingRuntimeProvider;
const useSalesRuntime = useTrackingRuntime;

const contentWidth: CSSProperties = { boxSizing: "border-box", width: "min(1120px, calc(100% - 32px))", margin: "0 auto" };
const sectionStyle: CSSProperties = { ...contentWidth, marginTop: "clamp(32px, 6vw, 72px)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)" };
const panelStyle: CSSProperties = { boxSizing: "border-box", border: "1px solid var(--pb-color-border)", borderRadius: "var(--pb-radius)", padding: "clamp(20px, 3vw, 32px)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", overflowWrap: "anywhere" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "clamp(16px, 2vw, 24px)" };

function RuntimeWatermark({ watermark }: { watermark?: TrackingPageWatermark }) { return watermark?.visible ? <small style={{ display: "block", marginTop: 14, color: "var(--pb-color-muted)", fontSize: 11, textAlign: "right" }}>{watermark.label || "Powered by BestTrack"}</small> : null; }
function text(props: object, key: string, fallback: string) {
  const value = (props as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
const safeHref = safeTrackingPageUrl;
const safeImageUrl = safeTrackingPageUrl;
function Status({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return <p role={alert ? "alert" : "status"} aria-live={alert ? "assertive" : "polite"} style={{ margin: "16px 0 0", color: alert ? "#a61b1b" : "var(--pb-color-muted)" }}>{children}</p>;
}
function Section({ title, children, busy = false }: { title: string; children: ReactNode; busy?: boolean }) {
  return <section aria-label={title} aria-busy={busy || undefined} style={sectionStyle}><div style={panelStyle}><h2 style={{ margin: "0 0 20px", fontSize: "clamp(24px, 3vw, 34px)", lineHeight: 1.15 }}>{title}</h2>{children}</div></section>;
}
function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeImageUrl(src);
  if (!safeSrc || failed) return <span aria-label={`${alt} image unavailable`} role="img" style={{ display: "grid", placeItems: "center", width: 76, height: 76, flex: "0 0 auto", border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)", color: "var(--pb-color-muted)", fontWeight: 700 }}>{alt.slice(0, 1).toUpperCase()}</span>;
  return <img src={safeSrc} alt={alt} onError={() => setFailed(true)} style={{ width: 76, height: 76, flex: "0 0 auto", borderRadius: "calc(var(--pb-radius) / 1.5)", objectFit: "cover", background: "var(--pb-color-background)" }} />;
}
function HeroAsset({ src }: { src: unknown }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeImageUrl(src);
  if (!safeSrc || failed) return null;
  return <img data-sales-hero-image src={safeSrc} alt="" aria-hidden="true" onError={() => setFailed(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.62 }} />;
}

export function SalesTextField({ value, onChange }: FieldProps) {
  return <input aria-label="Sales text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

type SalesEditorProps = BlockEditorProps<Record<string, unknown>>;
const editorSurfaceStyle: CSSProperties = { boxSizing: "border-box", border: "1px solid #dfddd7", borderRadius: 10, padding: 24, background: "#ffffff", color: "#0a0a0a", fontFamily: "Arial, Helvetica, sans-serif" };
const editorCardStyle: CSSProperties = { boxSizing: "border-box", padding: 18, border: "1px solid #dfddd7", borderRadius: 7, background: "#f7f5f0" };

function editorText(block: SalesEditorProps, name: string, fallback: string) { return text(block, name, fallback); }
function SalesInlineText({ block, name, fallback, style }: { block: SalesEditorProps; name: string; fallback: string; style?: CSSProperties }) {
  const value = editorText(block, name, fallback);
  if (!block.selected) return <span data-sales-editor-field={name} style={style}>{value}</span>;
  return <input aria-label={`Canvas ${name}`} data-sales-editor-field={name} value={value} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => block.onPropsChange({ [name]: event.currentTarget.value })} style={{ boxSizing: "border-box", width: "100%", /* border: "1px dashed currentColor", */ border: "none", borderRadius: 3, padding: "2px 5px", background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", textAlign: "inherit", ...style }} />;
}
function SalesEditorSurface({ block, children }: { block: SalesEditorProps; children: ReactNode }) {
  return <section aria-label="Sales editor preview" style={{ ...editorSurfaceStyle, outline: block.selected ? "2px solid #2563eb" : undefined, outlineOffset: -2 }}>{children}</section>;
}

/** Canvas previews use explicit safe colours because WebRenderer Theme Tokens are scoped to consumer output. */
export function SalesAnnouncementEditor(block: SalesEditorProps) {
  return <section aria-label="Sales announcement editor" style={{ display: "grid", minHeight: 38, placeItems: "center", boxSizing: "border-box", padding: "10px 16px", borderBottom: "1px solid #dfddd7", background: "#f7f5f0", color: "#0a0a0a", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13, fontWeight: 700, textAlign: "center" }}><SalesInlineText block={block} name="message" fallback="Free delivery on orders over $50" /></section>;
}

export function SalesQueryEditor(block: SalesEditorProps) {
  const imageUrl = safeImageUrl(block.heroImageUrl);
  const trackingNumber = editorText(block, "defaultTrackingNumber", "BT-2048-DEMO");
  return <section aria-label="Sales Hero query editor" style={{ position: "relative", display: "grid", minHeight: "clamp(460px, 52vw, 620px)", placeItems: "center", boxSizing: "border-box", overflow: "hidden", padding: "clamp(28px, 6vw, 72px) 16px", background: "#0a0a0a", fontFamily: "Arial, Helvetica, sans-serif" }}>
    {imageUrl ? <img src={imageUrl} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.62 }} /> : null}
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgb(0 0 0 / 42%)" }} />
    <div style={{ position: "relative", zIndex: 1, boxSizing: "border-box", width: "min(560px, 100%)", padding: "clamp(28px, 5vw, 48px)", borderRadius: 10, background: "#ffffff", color: "#0a0a0a", boxShadow: "0 20px 56px rgb(0 0 0 / 28%)" }}>
      <h1 style={{ margin: "0 0 28px", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.02, textAlign: "center" }}><SalesInlineText block={block} name="heading" fallback="Track your order" /></h1>
      <input aria-label="Canvas default tracking number" readOnly={!block.selected} value={trackingNumber} onMouseDown={(event) => block.selected && event.stopPropagation()} onClick={(event) => block.selected && event.stopPropagation()} onChange={(event) => block.onPropsChange({ defaultTrackingNumber: event.currentTarget.value })} style={{ boxSizing: "border-box", width: "100%", minHeight: 58, padding: "12px 16px", border: "1px solid #dfddd7", borderRadius: 8, background: "#ffffff", color: "#0a0a0a", font: "inherit", fontSize: 17 }} />
      <div style={{ display: "grid", minHeight: 58, placeItems: "center", marginTop: 14, padding: "12px 18px", borderRadius: 8, background: "#0a0a0a", color: "#ffffff", fontSize: 16, fontWeight: 700 }}><SalesInlineText block={block} name="submitLabel" fallback="Track order" /></div>
      <small style={{ display: "block", marginTop: 14, color: "#6b6b6b", fontSize: 11, textAlign: "right" }}>Powered by BestTrack</small>
    </div>
  </section>;
}

export function SalesOrderItemsEditor(block: SalesEditorProps) {
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Items in your order" /></h2><article style={{ ...editorCardStyle, display: "flex", alignItems: "center", gap: 14 }}><span aria-hidden="true" style={{ width: 68, height: 68, borderRadius: 7, background: "#dfddd7" }} /><span><strong>Order item</strong><br /><small style={{ color: "#6b6b6b" }}>Items appear after a successful tracking query.</small></span></article></SalesEditorSurface>;
}

export function SalesOtherTrackingEditor(block: SalesEditorProps) {
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Other shipments" /></h2><p style={{ margin: 0, color: "#6b6b6b" }}><SalesInlineText block={block} name="emptyMessage" fallback="No other shipments are linked to this order." /></p></SalesEditorSurface>;
}

export function SalesServiceCardsEditor(block: SalesEditorProps) {
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Shop with confidence" /></h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 14 }}><article style={editorCardStyle}><strong><SalesInlineText block={block} name="firstTitle" fallback="Easy returns" /></strong><p style={{ marginBottom: 0, color: "#6b6b6b" }}><SalesInlineText block={block} name="firstDescription" fallback="Simple support when plans change." /></p></article><article style={editorCardStyle}><strong><SalesInlineText block={block} name="secondTitle" fallback="Secure delivery" /></strong><p style={{ marginBottom: 0, color: "#6b6b6b" }}><SalesInlineText block={block} name="secondDescription" fallback="Follow every milestone in one place." /></p></article></div></SalesEditorSurface>;
}

export function SalesProductCategoriesEditor(block: SalesEditorProps) {
  const collection = isShopifyResourceReference(block.collection, "collection") ? block.collection : undefined;
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Shop by category" /></h2><div style={{ ...editorCardStyle, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>{collection?.title ?? "Choose a collection in the inspector"}</span><span aria-hidden="true">→</span></div></SalesEditorSurface>;
}

export function SalesFeaturedProductEditor(block: SalesEditorProps) {
  const product = isShopifyResourceReference(block.product, "product") ? block.product : undefined;
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Featured product" /></h2><div style={{ ...editorCardStyle, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>{product?.title ?? "Choose a product in the inspector"}</span><span aria-hidden="true">→</span></div><small style={{ display: "block", marginTop: 10, color: "#6b6b6b" }}>Availability is supplied by the authorized runtime.</small></SalesEditorSurface>;
}

export function SalesRecommendationsEditor(block: SalesEditorProps) {
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Complete your order" /></h2><div style={{ ...editorCardStyle, color: "#6b6b6b" }}>Recommended products load independently of tracking queries.</div></SalesEditorSurface>;
}

export function SalesAnnouncementBlock(props: Record<string, unknown>) {
  return <section aria-label="Sales announcement" data-sales-announcement style={{ display: "grid", minHeight: 38, placeItems: "center", boxSizing: "border-box", padding: "10px 16px", borderBottom: "1px solid var(--pb-color-border)", background: "var(--pb-color-background)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)", fontSize: 13, textAlign: "center" }}><strong>{text(props, "message", "Free delivery on orders over $50")}</strong></section>;
}

export function SalesQueryBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  // Sales 只提供 Hero、卡片样式和文案；提交校验及查询状态由共用卡片和 Runtime 执行。
  return <section aria-label="Sales tracking query" aria-busy={runtime.phase === "loading" || undefined} data-sales-hero style={{ position: "relative", display: "grid", minHeight: "clamp(460px, 52vw, 620px)", boxSizing: "border-box", overflow: "hidden", padding: "clamp(28px, 6vw, 72px) 16px", background: "var(--pb-color-text)", color: "var(--pb-color-surface)", fontFamily: "var(--pb-font-family)" }}>
    <HeroAsset src={props.heroImageUrl} />
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgb(0 0 0 / 42%)" }} />
    <div style={{ ...contentWidth, position: "relative", zIndex: 1, display: "grid", alignItems: "center", width: "100%", minWidth: 0 }}>
      <TrackingQueryCard
        phase={runtime.phase}
        onQuery={runtime.query}
        heading={text(props, "heading", "Track an order")}
        submitLabel={text(props, "submitLabel", "Track order")}
        initialTrackingNumber={text(props, "defaultTrackingNumber", "BT-2048-DEMO")}
        initialOrderNumber={text(props, "defaultOrderNumber", "")}
        initialMode={text(props, "defaultQueryMode", "tracking") === "order" ? "order" : "tracking"}
        emptyMessage="We couldn’t find an order for that number."
        errorMessage="We couldn’t retrieve this order right now. Please try again later."
        trackingInputLabel="Sales tracking number"
        orderInputLabel="Sales order number"
        emailInputLabel="Sales order email"
        cardDataAttribute="data-sales-query-card"
        resultDataAttribute="data-sales-query-result"
        resultTestId="sales-result"
        cardStyle={{ boxSizing: "border-box", width: "min(560px, 100%)", maxHeight: "min(560px, calc(100dvh - 32px))", marginLeft: "auto", padding: "clamp(28px, 5vw, 48px)", borderRadius: "var(--pb-radius)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", boxShadow: "0 20px 56px rgb(0 0 0 / 28%)" }}
        headingStyle={{ color: "var(--pb-color-text)", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.02 }}
        tabListStyle={{ borderBottomColor: "var(--pb-color-border)" }}
        formStyle={{ gap: 14 }}
        inputStyle={{ boxSizing: "border-box", width: "100%", minHeight: 58, padding: "12px 16px", border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.25)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", font: "inherit", fontSize: 17 }}
        submitStyle={(loading) => ({ width: "100%", minHeight: 58, padding: "12px 18px", border: 0, borderRadius: "calc(var(--pb-radius) / 1.25)", background: loading ? "#64748b" : "var(--pb-color-text)", color: "var(--pb-color-surface)", font: "inherit", fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer" })}
        result={runtime.result ? <TrackingQueryResultDetails result={runtime.result} /> : null}
        resultStyle={{ padding: 16, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.25)", background: "var(--pb-color-background)" }}
        watermark={<RuntimeWatermark watermark={runtime.watermark} />}
      />
    </div>
  </section>;
}

export function SalesOrderItemsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Items in your order");
  // 保留独立商品区块的 Sales 布局，但显隐和数据都跟随公共配送状态。
  // 成功但没有商品时显示缺省说明，查询错误时显示不可用，不继续展示上一笔商品。
  const visibility = trackingBlockState(runtime);
  if (!visibility.showDelivery) return null;
  // 数量直接展示公共结果值，不再由 Sales 单独补成 1；Reorder 也只在商品链接安全有效时出现。
  const items = runtime.result?.orderItems ?? [];
  return <Section title={title}>{visibility.showUnavailable ? <Status alert>Order items are temporarily unavailable.</Status> : items.length ? <ul style={{ display: "grid", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>{items.map((item) => {
    const href = safeHref(item.href);
    const itemTitle = text(item, "title", "Order item");
    const itemContent = href ? <a href={href} style={{ color: "inherit" }}>{itemTitle}</a> : itemTitle;
    return <li key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, padding: 14, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><ProductImage src={item.imageUrl} alt={itemTitle} /><span style={{ minWidth: 0 }}><strong>{itemContent}</strong><br /><small style={{ color: "var(--pb-color-muted)" }}>Qty {item.quantity}</small>{item.description ? <><br /><small style={{ color: "var(--pb-color-muted)" }}>{item.description}</small></> : null}{href ? <a href={href} style={{ display: "inline-flex", alignItems: "center", minHeight: 32, marginLeft: 8, padding: "6px 12px", border: "1px solid var(--pb-color-border)", borderRadius: 6, color: "inherit", fontSize: 13 }}>Reorder</a> : null}</span></li>;
  })}</ul> : <Status>Package contents are not available for this shipment.</Status>}</Section>;
}

export function SalesOtherTrackingBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Other shipments");
  // 此处是当前查询内的全部包裹（包含选中包裹），不是最近查询历史。
  // 包裹数大于一才展示，不按订单/运单模式限制；点击复用 Runtime 的选择与结果联动。
  const shipments = runtime.result?.shipments ?? [];
  if (!trackingBlockState(runtime).showResult || shipments.length < 2 || !runtime.result) return null;
  const { shipmentValues } = trackingSelection(runtime.result, runtime.recentQueries);
  return <Section title={title}><ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>{shipments.map((shipment, index) => <li key={shipment.id} style={{ padding: 16, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><button type="button" aria-pressed={runtime.selectedShipmentIndex === index} onClick={() => runtime.selectShipment(index)} style={{ minHeight: 44, border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 700, cursor: "pointer" }}>{shipmentValues[index]}</button>{shipment.status ? <p style={{ margin: "8px 0 0", color: "var(--pb-color-muted)" }}>{shipment.status}</p> : null}</li>)}</ul></Section>;
}

export function SalesServiceCardsBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop with confidence");
  return <Section title={title}><div style={gridStyle}><article style={{ padding: 20, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><strong>{text(props, "firstTitle", "Easy returns")}</strong><p style={{ marginBottom: 0, color: "var(--pb-color-muted)" }}>{text(props, "firstDescription", "Simple support when plans change.")}</p></article><article style={{ padding: 20, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><strong>{text(props, "secondTitle", "Secure delivery")}</strong><p style={{ marginBottom: 0, color: "var(--pb-color-muted)" }}>{text(props, "secondDescription", "Follow every milestone in one place.")}</p></article></div></Section>;
}

export function SalesProductCategoriesBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop by category");
  const runtime = useSalesRuntime();
  if (props.collection !== undefined && props.collection !== null && !isShopifyResourceReference(props.collection, "collection")) return <Section title={title}><Status alert>Collection reference is invalid.</Status></Section>;
  const collection = isShopifyResourceReference(props.collection, "collection") ? props.collection : undefined;
  if (!collection) return <Section title={title}><Status>No collection selected. Choose a collection through an authorized resource integration.</Status></Section>;
  const resolved = getResolvedShopifyResource(collection, runtime.resourceResolution);
  const error = getShopifyResourceResolutionError(collection, runtime.resourceResolution);
  if (error) return <Section title={title}><Status alert>{error.code === "missing" ? "This collection is no longer available." : "Collection details are temporarily unavailable."}</Status></Section>;
  if (!resolved) return <Section title={title}><Status>Collection details are resolved by the authorized runtime.</Status></Section>;
  const content = <><span>{resolved.title}</span><span aria-hidden="true">→</span></>;
  const style: CSSProperties = { display: "flex", minHeight: 72, alignItems: "center", justifyContent: "space-between", gap: 16, padding: 18, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)", color: "inherit", fontWeight: 700, textDecoration: "none" };
  return <Section title={title}>{resolved.href ? <a href={resolved.href} style={style}>{content}</a> : <div style={style}>{content}</div>}</Section>;
}

export function SalesFeaturedProductBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Featured product");
  if (props.product !== undefined && props.product !== null && !isShopifyResourceReference(props.product, "product")) return <Section title={title}><Status alert>Product reference is invalid.</Status></Section>;
  const product = isShopifyResourceReference(props.product, "product") ? props.product : undefined;
  if (!product) return <Section title={title}><Status>No product selected. Choose a product through an authorized resource integration.</Status></Section>;
  const resolved = getResolvedShopifyResource(product, runtime.resourceResolution);
  const error = getShopifyResourceResolutionError(product, runtime.resourceResolution);
  if (error) return <Section title={title}><Status alert>{error.code === "missing" ? "This product is no longer available." : "Product details are temporarily unavailable."}</Status></Section>;
  if (!resolved) return <Section title={title}><Status>Product details and availability are resolved by the authorized runtime.</Status></Section>;
  const available = resolved.availability === "available";
  const body = <><ProductImage src={resolved.imageUrl} alt={resolved.title} /><span style={{ minWidth: 0, flex: 1 }}><strong>{resolved.title}</strong><br /><small style={{ color: "var(--pb-color-muted)" }}>{available ? "Available" : resolved.availability === "sold-out" ? "Sold out" : "Unavailable"}</small></span></>;
  const style: CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: 14, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)", color: "inherit", textDecoration: "none" };
  return <Section title={title}>{available && resolved.href ? <a href={resolved.href} style={style}>{body}</a> : <div style={style}>{body}</div>}</Section>;
}

export function SalesRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Complete your order");
  // 与另两套模板使用相同商品来源和价格规则，只保留 Sales 的网格卡片外观。
  // 推荐不依赖查单成功；商家选品为空时，等待独立推荐请求提供商品。
  const recommendations = recommendationItems(props.products, runtime);
  if (!recommendations.length) return null;
  return <Section title={title}><div style={gridStyle}>{recommendations.map((item) => {
    const href = safeHref(item.href);
    const itemTitle = text(item, "title", "Recommended product");
    const price = formatRecommendationPrice(item.price);
    return <article key={item.id} style={{ display: "grid", gap: 14, minWidth: 0, padding: 18, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><ProductImage src={item.imageUrl} alt={itemTitle} /><div><strong>{href ? <a href={href} style={{ color: "inherit" }}>{itemTitle}</a> : itemTitle}</strong>{price ? <small style={{ display: "block", marginTop: 5, color: "var(--pb-color-muted)" }}>{price}</small> : null}{item.description ? <p style={{ marginBottom: 0, color: "var(--pb-color-muted)" }}>{item.description}</p> : null}</div></article>;
  })}</div></Section>;
}
