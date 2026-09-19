import { createContext, useCallback, useContext, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BlockEditorProps, FieldProps } from "@standhigher/puck-page-builder/runtime";
import { formatTrackingPageMoney, isEmptyTrackingPageResult, type TrackingPageQuery, type TrackingPageQueryRequest, type TrackingPageQueryResult, type TrackingPageRuntimePhase, type TrackingPageWatermark } from "./tracking-page-runtime";
import { safeTrackingPageUrl } from "./tracking-page-url";
import { TrackingQueryCard, TrackingQueryResultDetails } from "./tracking-query-experience";

/** Transient, consumer-safe state. The host error is deliberately never retained for display. */
export type SalesRuntimeState = { phase: TrackingPageRuntimePhase; result?: TrackingPageQueryResult };
type SalesRuntime = SalesRuntimeState & { query(request: TrackingPageQueryRequest): Promise<void>; watermark?: TrackingPageWatermark };
const initialRuntime: SalesRuntime = { phase: "idle", async query() { return undefined; } };
const SalesRuntimeContext = createContext<SalesRuntime>(initialRuntime);
export type SalesRuntimeProviderProps = {
  children: ReactNode;
  /** The discriminated, host-authorized request contract. */
  query?: TrackingPageQuery;
  /** Host-decided display state; no entitlement checks happen in this package. */
  watermark?: TrackingPageWatermark;
};

const contentWidth: CSSProperties = { boxSizing: "border-box", width: "min(1120px, calc(100% - 32px))", margin: "0 auto" };
const sectionStyle: CSSProperties = { ...contentWidth, marginTop: "clamp(32px, 6vw, 72px)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)" };
const panelStyle: CSSProperties = { boxSizing: "border-box", border: "1px solid var(--pb-color-border)", borderRadius: "var(--pb-radius)", padding: "clamp(20px, 3vw, 32px)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", overflowWrap: "anywhere" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "clamp(16px, 2vw, 24px)" };

/** The host injects a validated query; Sales never calls a DataSource itself. */
export function SalesRuntimeProvider({ children, query: injectedQuery, watermark }: SalesRuntimeProviderProps) {
  const [state, setState] = useState<SalesRuntimeState>({ phase: "idle" });
  const requestId = useRef(0);
  const query = useCallback(async (request: TrackingPageQueryRequest) => {
    const currentRequestId = ++requestId.current;
    setState({ phase: "loading" });
    try {
      if (!injectedQuery) throw new Error("tracking-query-not-configured");
      const result = await injectedQuery(request);
      if (currentRequestId !== requestId.current) return;
      setState({ phase: isEmptyTrackingPageResult(result) ? "empty" : "success", result });
    } catch {
      if (currentRequestId !== requestId.current) return;
      setState({ phase: "error" });
    }
  }, [injectedQuery]);
  const value = useMemo<SalesRuntime>(() => ({ ...state, query, watermark }), [query, state, watermark]);
  return <SalesRuntimeContext.Provider value={value}>{children}</SalesRuntimeContext.Provider>;
}

function useSalesRuntime() { return useContext(SalesRuntimeContext); }
function RuntimeWatermark({ watermark }: { watermark?: TrackingPageWatermark }) { return watermark?.visible ? <small style={{ display: "block", marginTop: 14, color: "var(--pb-color-muted)", fontSize: 11, textAlign: "right" }}>{watermark.label || "Powered by BestTrack"}</small> : null; }
function text(props: object, key: string, fallback: string) {
  const value = (props as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
const safeHref = safeTrackingPageUrl;
const safeImageUrl = safeTrackingPageUrl;
function resourceState(value: unknown): "ready" | "empty" | "invalid" {
  if (typeof value !== "string") return "invalid";
  if (!value.trim()) return "empty";
  return /^gid:\/\/shopify\/Collection\/\d+$/.test(value) ? "ready" : "invalid";
}
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
  return <input aria-label={`Canvas ${name}`} data-sales-editor-field={name} value={value} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => block.onPropsChange({ [name]: event.currentTarget.value })} style={{ boxSizing: "border-box", width: "100%", border: "1px dashed currentColor", borderRadius: 3, padding: "2px 5px", background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", textAlign: "inherit", ...style }} />;
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
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Shop by category" /></h2><div style={{ ...editorCardStyle, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><SalesInlineText block={block} name="collectionLabel" fallback="Featured collection" /><span aria-hidden="true">→</span></div></SalesEditorSurface>;
}

export function SalesRecommendationsEditor(block: SalesEditorProps) {
  return <SalesEditorSurface block={block}><h2 style={{ margin: "0 0 20px" }}><SalesInlineText block={block} name="heading" fallback="Complete your order" /></h2><div style={{ ...editorCardStyle, color: "#6b6b6b" }}>Recommended products appear after a successful tracking query.</div></SalesEditorSurface>;
}

export function SalesAnnouncementBlock(props: Record<string, unknown>) {
  return <section aria-label="Sales announcement" data-sales-announcement style={{ display: "grid", minHeight: 38, placeItems: "center", boxSizing: "border-box", padding: "10px 16px", borderBottom: "1px solid var(--pb-color-border)", background: "var(--pb-color-background)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)", fontSize: 13, textAlign: "center" }}><strong>{text(props, "message", "Free delivery on orders over $50")}</strong></section>;
}

export function SalesQueryBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  return <section aria-label="Sales tracking query" aria-busy={runtime.phase === "loading" || undefined} data-sales-hero style={{ position: "relative", display: "grid", minHeight: "clamp(460px, 52vw, 620px)", boxSizing: "border-box", overflow: "hidden", padding: "clamp(28px, 6vw, 72px) 16px", background: "var(--pb-color-text)", color: "var(--pb-color-surface)", fontFamily: "var(--pb-font-family)" }}>
    <HeroAsset src={props.heroImageUrl} />
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgb(0 0 0 / 42%)" }} />
    <div style={{ ...contentWidth, position: "relative", zIndex: 1, display: "grid", alignItems: "center", width: "100%" }}>
      <TrackingQueryCard
        phase={runtime.phase}
        onQuery={runtime.query}
        heading={text(props, "heading", "Track an order")}
        submitLabel={text(props, "submitLabel", "Track order")}
        initialTrackingNumber={text(props, "defaultTrackingNumber", "BT-2048-DEMO")}
        initialOrderNumber={text(props, "defaultOrderNumber", "")}
        loadingLabel="Checking..."
        loadingMessage="Checking your order…"
        emptyMessage="We couldn’t find an order for that number."
        errorMessage="We couldn’t retrieve this order right now. Please try again later."
        trackingInputLabel="Sales tracking number"
        orderInputLabel="Sales order number"
        emailInputLabel="Sales order email"
        cardDataAttribute="data-sales-query-card"
        resultDataAttribute="data-sales-query-result"
        resultTestId="sales-result"
        cardStyle={{ boxSizing: "border-box", width: "min(560px, 100%)", maxHeight: "calc(100vh - 48px)", marginLeft: "auto", padding: "clamp(28px, 5vw, 48px)", borderRadius: "var(--pb-radius)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", boxShadow: "0 20px 56px rgb(0 0 0 / 28%)" }}
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
  const items = runtime.result?.orderItems ?? [];
  return <Section title={title} busy={runtime.phase === "loading"}>{runtime.phase === "error" ? <Status alert>Order items are temporarily unavailable.</Status> : runtime.phase === "empty" ? <Status>No order items are available for that number.</Status> : runtime.phase === "success" && items.length ? <ul style={{ display: "grid", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>{items.map((item) => {
    const href = safeHref(item.href);
    const itemTitle = text(item, "title", "Order item");
    const itemContent = href ? <a href={href} style={{ color: "inherit" }}>{itemTitle}</a> : itemTitle;
    return <li key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, padding: 14, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><ProductImage src={item.imageUrl} alt={itemTitle} /><span style={{ minWidth: 0 }}><strong>{itemContent}</strong><br /><small style={{ color: "var(--pb-color-muted)" }}>Qty {Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1}</small>{item.description ? <><br /><small style={{ color: "var(--pb-color-muted)" }}>{item.description}</small></> : null}</span></li>;
  })}</ul> : <Status>{runtime.phase === "loading" ? "Loading order items…" : "Order items appear after a successful query."}</Status>}</Section>;
}

export function SalesOtherTrackingBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Other shipments");
  const shipments = (runtime.result?.shipments ?? []).filter((shipment) => shipment.trackingNumber !== runtime.result?.trackingNumber);
  return <Section title={title} busy={runtime.phase === "loading"}>{runtime.phase === "error" ? <Status alert>Additional shipments are unavailable.</Status> : runtime.phase === "empty" ? <Status>No additional shipments are available for that number.</Status> : runtime.phase === "success" && shipments.length ? <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>{shipments.map((shipment) => <li key={shipment.id} style={{ padding: 16, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><strong>{text(shipment, "label", "Shipment")}</strong>{shipment.status ? <p style={{ margin: "8px 0 0", color: "var(--pb-color-muted)" }}>{shipment.status}</p> : null}{shipment.trackingNumber ? <small style={{ display: "block", marginTop: 8, color: "var(--pb-color-muted)" }}>{shipment.trackingNumber}</small> : null}</li>)}</ul> : runtime.phase === "success" ? <Status>{text(props, "emptyMessage", "No other shipments are linked to this order.")}</Status> : <Status>{runtime.phase === "loading" ? "Loading other shipments…" : "Other tracking numbers appear with your order result."}</Status>}</Section>;
}

export function SalesServiceCardsBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop with confidence");
  return <Section title={title}><div style={gridStyle}><article style={{ padding: 20, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><strong>{text(props, "firstTitle", "Easy returns")}</strong><p style={{ marginBottom: 0, color: "var(--pb-color-muted)" }}>{text(props, "firstDescription", "Simple support when plans change.")}</p></article><article style={{ padding: 20, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><strong>{text(props, "secondTitle", "Secure delivery")}</strong><p style={{ marginBottom: 0, color: "var(--pb-color-muted)" }}>{text(props, "secondDescription", "Follow every milestone in one place.")}</p></article></div></Section>;
}

export function SalesProductCategoriesBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop by category");
  const state = resourceState(props.collectionId);
  return <Section title={title}>{state === "invalid" ? <Status alert>Collection reference is invalid.</Status> : state === "empty" ? <Status>No collection selected. Choose a collection through an authorized resource integration.</Status> : <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 74, boxSizing: "border-box", padding: "14px 18px", border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)", color: "var(--pb-color-text)", fontWeight: 700 }}><span>{text(props, "collectionLabel", "Featured collection")}</span></div>}</Section>;
}

export function SalesRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Complete your order");
  const recommendations = runtime.result?.recommendations ?? [];
  return <Section title={title} busy={runtime.phase === "loading"}>{runtime.phase === "error" ? <Status alert>Recommendations are temporarily unavailable.</Status> : runtime.phase === "empty" ? <Status>No recommendations are available for that number.</Status> : runtime.phase === "success" && recommendations.length ? <div style={gridStyle}>{recommendations.map((item) => {
    const href = safeHref(item.href);
    const itemTitle = text(item, "title", "Recommended product");
    const price = item.price ? formatTrackingPageMoney(item.price) : undefined;
    return <article key={item.id} style={{ display: "grid", gap: 14, minWidth: 0, padding: 18, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><ProductImage src={item.imageUrl} alt={itemTitle} /><div><strong>{href ? <a href={href} style={{ color: "inherit" }}>{itemTitle}</a> : itemTitle}</strong>{price?.amount ? <small style={{ display: "block", marginTop: 5, color: "var(--pb-color-muted)" }}>{price.amount}</small> : null}{item.description ? <p style={{ marginBottom: 0, color: "var(--pb-color-muted)" }}>{item.description}</p> : null}</div></article>;
  })}</div> : <Status>{runtime.phase === "success" ? "No recommendations are available for this order." : runtime.phase === "loading" ? "Loading recommendations…" : "Recommended products appear with your order result."}</Status>}</Section>;
}
