import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { BlockEditorProps, FieldProps } from "@standhigher/puck-page-builder/runtime";
import {
  isEmptyTrackingPageResult,
  type TrackingPageQuery,
  type TrackingPageQueryResult,
  type TrackingPageRecommendation,
  type TrackingPageRuntimePhase,
  type TrackingPageTrackingEvent,
  type TrackingPageTrackingStep
} from "./tracking-page-runtime";

/** Branded uses the shared, display-safe Consumer Runtime result without persisting it. */
export type BrandedRuntimeState = { phase: TrackingPageRuntimePhase; result?: TrackingPageQueryResult; error?: string };
type BrandedRuntime = BrandedRuntimeState & {
  displayedResult?: TrackingPageQueryResult;
  selectedShipmentId: string | null;
  query(trackingNumber: string): Promise<void>;
  reset(): void;
  selectShipment(id: string): void;
};

const initialRuntime: BrandedRuntime = {
  phase: "idle",
  selectedShipmentId: null,
  async query() { return undefined; },
  reset() { return undefined; },
  selectShipment() { return undefined; }
};
const BrandedRuntimeContext = createContext<BrandedRuntime>(initialRuntime);
export type BrandedRuntimeProviderProps = { children: ReactNode; queryTracking: TrackingPageQuery };

const contentWidth = { width: "min(1200px, 100%)", margin: "0 auto", padding: "0 clamp(16px, 4vw, 48px)", boxSizing: "border-box" as const };
const cardStyle = { background: "#fff", color: "#0a0a0a", border: "1px solid #e7e7e7", borderRadius: 10, fontFamily: "var(--pb-font-family)" };

export function BrandedRuntimeProvider({ children, queryTracking }: BrandedRuntimeProviderProps) {
  const [state, setState] = useState<BrandedRuntimeState>({ phase: "idle" });
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const requestId = useRef(0);
  const query = useCallback(async (trackingNumber: string) => {
    const currentRequestId = ++requestId.current;
    setState({ phase: "loading" });
    try {
      const result = await queryTracking(trackingNumber);
      if (currentRequestId !== requestId.current) return;
      setSelectedShipmentId(result.shipments?.[0]?.id ?? null);
      setState({ phase: isEmptyTrackingPageResult(result) ? "empty" : "success", result });
    } catch {
      if (currentRequestId !== requestId.current) return;
      setState({ phase: "error", error: "tracking-query-failed" });
    }
  }, [queryTracking]);
  const reset = useCallback(() => {
    requestId.current += 1;
    setSelectedShipmentId(null);
    setState({ phase: "idle" });
  }, []);
  const displayedResult = useMemo(() => {
    if (!state.result) return undefined;
    const shipment = state.result.shipments?.find((item) => item.id === selectedShipmentId);
    return shipment ? { ...state.result, ...shipment } : state.result;
  }, [selectedShipmentId, state.result]);
  const selectShipment = useCallback((id: string) => {
    if (state.result?.shipments?.some((shipment) => shipment.id === id)) setSelectedShipmentId(id);
  }, [state.result]);
  const value = useMemo<BrandedRuntime>(
    () => ({ ...state, displayedResult, selectedShipmentId, query, reset, selectShipment }),
    [displayedResult, query, reset, selectedShipmentId, selectShipment, state]
  );
  return <BrandedRuntimeContext.Provider value={value}>{children}</BrandedRuntimeContext.Provider>;
}

function useBrandedRuntime() { return useContext(BrandedRuntimeContext); }
function text(props: Record<string, unknown>, key: string, fallback: string) { return typeof props[key] === "string" ? props[key] : fallback; }
function safeHref(value: unknown) {
  if (typeof value !== "string") return "#";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "#"; } catch { return "#"; }
}
function safeImageUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""; } catch { return ""; }
}
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

function ShipmentSwitcher({ shipmentLabels: configuredLabels }: { shipmentLabels?: unknown }) {
  const runtime = useBrandedRuntime();
  const configuredShipments = shipmentLabels(configuredLabels);
  const shipments = runtime.phase === "idle" || runtime.phase === "loading" ? configuredShipments : runtime.result?.shipments ?? [];
  if (!shipments.length) return null;
  return <div aria-label="Shipment switcher" style={{ ...contentWidth, minHeight: 56, display: "flex", alignItems: "center", gap: 8, overflowX: "auto", whiteSpace: "nowrap" }}>
    {shipments.map((shipment, index) => {
      const selected = (runtime.selectedShipmentId ?? shipments[0]?.id) === shipment.id;
      return <button key={shipment.id} type="button" onClick={() => runtime.selectShipment(shipment.id)} aria-pressed={selected} style={{ minWidth: 92, minHeight: 36, padding: "0 12px", border: selected ? "1px solid #1a1a1a" : "1px solid #e7e7e7", borderRadius: 4, background: "#fff", color: "#0a0a0a", fontSize: 11, fontWeight: selected ? 700 : 400, cursor: "pointer" }}>{shipment.label || "Shipment #" + (index + 1)}</button>;
    })}
  </div>;
}

function QueryHero(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  const [trackingNumber, setTrackingNumber] = useState(text(props, "defaultTrackingNumber", "DEMO-YQTRACK9999"));
  const [mode, setMode] = useState<"order" | "tracking">(text(props, "defaultQueryMode", "tracking") === "order" ? "order" : "tracking");
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void runtime.query(trackingNumber); };
  return <div style={{ position: "relative", minHeight: "clamp(520px, 44vw, 560px)", display: "grid", placeItems: "center", overflow: "hidden", background: "linear-gradient(135deg, #dedbd4, #b9b3aa)" }}>
    {!heroImageFailed && safeImageUrl(props.heroImageUrl) ? <img src={safeImageUrl(props.heroImageUrl)} alt="" onError={() => setHeroImageFailed(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.12)" }} />
    <div style={{ ...cardStyle, position: "relative", zIndex: 1, width: "min(560px, calc(100% - 32px))", padding: "clamp(24px, 5vw, 48px)", boxSizing: "border-box", boxShadow: "0 16px 40px rgb(0 0 0 / 8%)" }}>
      <h1 style={{ margin: "0 0 36px", textAlign: "center", fontSize: "clamp(28px, 3vw, 32px)", lineHeight: 1.15 }}>{text(props, "heading", "Track your order")}</h1>
      <div role="tablist" aria-label="Tracking method" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e7e7e7", marginBottom: 24 }}>
        <button type="button" role="tab" aria-selected={mode === "order"} onClick={() => setMode("order")} style={{ minHeight: 40, border: 0, borderBottom: mode === "order" ? "2px solid #0a0a0a" : "2px solid transparent", background: "transparent", fontWeight: mode === "order" ? 700 : 400, cursor: "pointer" }}>Order Number</button>
        <button type="button" role="tab" aria-selected={mode === "tracking"} onClick={() => setMode("tracking")} style={{ minHeight: 40, border: 0, borderBottom: mode === "tracking" ? "2px solid #0a0a0a" : "2px solid transparent", background: "transparent", fontWeight: mode === "tracking" ? 700 : 400, cursor: "pointer" }}>Tracking Number</button>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="branded-tracking-number" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{mode === "order" ? "Order number" : "Tracking number"}</label>
        <input id="branded-tracking-number" aria-label={mode === "order" ? "Order number" : "Tracking number"} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} required minLength={4} maxLength={64} placeholder={mode === "order" ? "Enter your order number" : "Enter your tracking number"} style={{ width: "100%", height: 48, padding: "0 16px", boxSizing: "border-box", border: "1px solid #e2e2e2", borderRadius: 10, font: "inherit" }} />
        <button type="submit" disabled={runtime.phase === "loading"} style={{ width: "100%", minHeight: 48, marginTop: 24, border: 0, borderRadius: 10, background: runtime.phase === "loading" ? "#6b6b6b" : "#000", color: "#fff", font: "inherit", cursor: runtime.phase === "loading" ? "wait" : "pointer" }}>{runtime.phase === "loading" ? "Tracking…" : text(props, "submitLabel", "Track")}</button>
      </form>
      {runtime.phase === "empty" ? <p role="status" style={{ marginBottom: 0, color: "#6b6b6b" }}>We couldn’t find an order for that number.</p> : null}
      {runtime.phase === "error" ? <p role="alert" style={{ marginBottom: 0, color: "#b42318" }}>We couldn’t retrieve this order right now. Please try again later.</p> : null}
      <small style={{ display: "block", marginTop: 10, color: "#8a8a8a", fontSize: 8, textAlign: "right" }}>Powered by BestTrack</small>
    </div>
  </div>;
}

function defaultProgress(status: string): TrackingPageTrackingStep[] {
  const steps = ["Ordered", "Order Ready", "In Transit", "Out for Delivery", "Delivered"];
  const normalized = status.toLowerCase();
  const current = normalized.includes("deliver") ? (normalized.includes("out for") ? 3 : 4) : normalized.includes("transit") ? 2 : normalized.includes("ready") ? 1 : 0;
  return steps.map((label, index) => ({ id: label.toLowerCase().replaceAll(" ", "-"), label, state: index < current ? "complete" : index === current ? "current" : "upcoming" }));
}

function TrackingProgress({ steps }: { steps: TrackingPageTrackingStep[] }) {
  return <div aria-label="Delivery progress" style={{ overflowX: "auto", padding: "28px 0 8px" }}>
    <ol style={{ display: "grid", gridTemplateColumns: "repeat(" + steps.length + ", minmax(112px, 1fr))", minWidth: Math.max(560, steps.length * 138), padding: 0, margin: 0, listStyle: "none" }}>
      {steps.map((step, index) => <li key={step.id} style={{ position: "relative", display: "grid", justifyItems: "center", gap: 12, color: step.state === "upcoming" ? "#718096" : "#0f1d3a", textAlign: "center" }}>
        {index > 0 ? <span aria-hidden="true" style={{ position: "absolute", top: 19, right: "50%", width: "100%", height: 8, transform: "translateX(-50%)", background: step.state === "upcoming" ? "#d1d5db" : "#0f1d3a" }} /> : null}
        <span aria-label={step.label + " " + step.state} style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center", width: 40, height: 40, border: step.state === "current" ? "1px solid #0f1d3a" : "1px solid #8190a4", borderRadius: "50%", background: step.state === "complete" ? "#0f1d3a" : "#fff", color: step.state === "complete" ? "#fff" : "#0f1d3a", fontWeight: 700 }}>{step.state === "complete" ? "✓" : index + 1}</span>
        <strong style={{ fontSize: 14 }}>{step.label}</strong>
      </li>)}
    </ol>
  </div>;
}

function ShippingTimeline({ events }: { events: TrackingPageTrackingEvent[] }) {
  if (!events.length) return <p style={{ margin: 0, color: "#6b6b6b" }}>Shipping events will appear when the carrier publishes them.</p>;
  return <ol aria-label="Shipping events" style={{ display: "grid", gap: 22, margin: 0, padding: 0, listStyle: "none" }}>
    {events.map((event, index) => <li key={event.id} style={{ display: "grid", gridTemplateColumns: "22px 1fr", columnGap: 14, position: "relative" }}>
      <span aria-hidden="true" style={{ position: "relative", zIndex: 1, width: 14, height: 14, marginTop: 4, borderRadius: "50%", background: event.state === "current" || index === 0 ? "#42b765" : "#d5dfed" }} />
      {index < events.length - 1 ? <span aria-hidden="true" style={{ position: "absolute", left: 6, top: 18, bottom: -26, width: 2, background: "#e0e7f0" }} /> : null}
      <div><strong style={{ color: index === 0 ? "#cb4d34" : "#51657f" }}>{event.title}</strong>{event.detail ? <p style={{ margin: "4px 0", color: "#6b6b6b" }}>{event.detail}</p> : null}{event.at ? <small style={{ color: "#8a9ab0" }}>{event.at}</small> : null}</div>
    </li>)}
  </ol>;
}

function PackageContents({ items }: { items: TrackingPageQueryResult["orderItems"] }) {
  if (!items?.length) return <p style={{ margin: 0, color: "#6b6b6b" }}>Package contents are not available for this shipment.</p>;
  return <div style={{ display: "grid", gap: 16 }}>{items.map((item) => <article key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}><ProductImage src={item.imageUrl} alt={item.title} /><div><strong>{item.title}</strong><p style={{ margin: "5px 0", color: "#6b6b6b", fontSize: 14 }}>{item.description ?? "Product details are available in your order."}</p><small style={{ color: "#6b6b6b" }}>Qty {item.quantity}</small></div></article>)}</div>;
}

function TrackingResult({ props }: { props: Record<string, unknown> }) {
  const runtime = useBrandedRuntime();
  const result = runtime.displayedResult;
  if (!result) return null;
  const progress = result.progress?.length ? result.progress : defaultProgress(result.status);
  const events = result.events?.length ? result.events : result.latestEvent ? [{ id: "latest", title: result.latestEvent, at: result.updatedAt, state: "current" as const }] : [];
  return <section aria-label="Tracking result" style={{ background: "#fff", borderTop: "1px solid #edf0f4", color: "#101828", fontFamily: "var(--pb-font-family)", padding: "clamp(36px, 6vw, 64px) 0" }}>
    <div style={contentWidth}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", textAlign: "center" }}>
        <p style={{ flex: "1 1 360px", margin: 0, fontSize: "clamp(18px, 2vw, 28px)" }}>Tracking: {result.trackingNumber}</p>
        <button type="button" onClick={runtime.reset} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#101828", font: "inherit", cursor: "pointer" }}>{text(props, "trackAnotherLabel", "Track another order")}</button>
      </div>
      <h1 style={{ margin: "54px 0 0", fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.1, textAlign: "center" }}>{result.status}</h1>
      <TrackingProgress steps={progress} />
    </div>
    <div style={{ borderTop: "1px solid #edf0f4", marginTop: "clamp(28px, 5vw, 54px)", paddingTop: "clamp(36px, 5vw, 60px)" }}>
      <div style={{ ...contentWidth, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "clamp(36px, 8vw, 120px)" }}>
        <section aria-label="Shipping details"><h2 style={{ margin: "0 0 28px", fontSize: 28 }}>Shipping Details</h2><ShippingTimeline events={events} /></section>
        <section aria-label="Package contents"><h2 style={{ margin: "0 0 28px", fontSize: 28 }}>Package Contents</h2><PackageContents items={result.orderItems} /></section>
      </div>
    </div>
  </section>;
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
    style={{ display: "inline-block", width: "100%", minWidth: "5ch", boxSizing: "border-box", border: "1px dashed currentColor", borderRadius: 3, padding: "2px 5px", background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", letterSpacing: "inherit", textAlign: "inherit" }}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e7e7e7", marginBottom: 20, textAlign: "center" }}><span style={{ padding: 10 }}>Order Number</span><strong style={{ padding: 10, borderBottom: "2px solid #0a0a0a" }}>Tracking Number</strong></div>
        <input aria-label="Canvas default tracking number" readOnly={!block.selected} value={text(block, "defaultTrackingNumber", "DEMO-YQTRACK9999")} onMouseDown={(event) => block.selected && event.stopPropagation()} onClick={(event) => block.selected && event.stopPropagation()} onChange={(event) => block.onPropsChange({ defaultTrackingNumber: event.currentTarget.value })} style={{ width: "100%", height: 44, boxSizing: "border-box", padding: "0 12px", border: block.selected ? "1px dashed #0a0a0a" : "1px solid #e2e2e2", borderRadius: 10, background: "#fff", font: "inherit" }} />
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
  return <EditorSurface block={block}><h2 style={{ margin: 0, textAlign: "center" }}><InlineText block={block} name="heading" fallback="You might also like" /></h2><p style={{ color: "#6b6b6b", textAlign: "center" }}>Recommendations appear with the active shipment.</p></EditorSurface>;
}

export function BrandedQuickLinksEditor(block: BrandedEditorProps) {
  return <EditorSurface block={block}><h2><InlineText block={block} name="heading" fallback="Need help?" /></h2><div style={{ display: "flex", gap: 20 }}><InlineText block={block} name="primaryLabel" fallback="Shipping help" /><InlineText block={block} name="secondaryLabel" fallback="Contact us" /></div></EditorSurface>;
}

export function BrandedBlogEditor(block: BrandedEditorProps) {
  return <EditorSurface block={block}><h2><InlineText block={block} name="heading" fallback="From our journal" /></h2><article><strong><InlineText block={block} name="articleTitle" fallback="Delivery tips for every season" /></strong><p><InlineText block={block} name="excerpt" fallback="Simple ways to make every delivery feel considered." /></p><InlineText block={block} name="linkLabel" fallback="Read the story" /></article></EditorSurface>;
}

export function BrandedAnnouncementBlock(props: Record<string, unknown>) {
  const message = text(props, "message", "");
  if (!message) return null;
  return <section aria-label="Branded announcement" style={{ minHeight: 36, display: "grid", placeItems: "center", padding: "0 16px", background: "#252525", color: "#fff", fontFamily: "var(--pb-font-family)", fontSize: 12, textAlign: "center" }}><a href={safeHref(props.href)} style={{ color: "inherit", textDecoration: "none" }}>{message}</a></section>;
}

/** Complete consumer journey: pre-query hero, selected shipment and result details share one controller. */
export function BrandedTrackingExperienceBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  return <section aria-label="Branded tracking experience" style={{ background: "#fffdf0", fontFamily: "var(--pb-font-family)" }}>
    <ShipmentSwitcher shipmentLabels={props.shipmentLabels} />
    {runtime.phase === "success" ? <TrackingResult props={props} /> : <QueryHero {...props} />}
  </section>;
}

/** Legacy editor block retained for manually composed documents; new templates use BrandedTrackingExperienceBlock. */
export function BrandedQueryBlock(props: Record<string, unknown>) {
  return <section aria-label="Branded tracking query" style={{ background: "#fffdf0", fontFamily: "var(--pb-font-family)" }}><ShipmentSwitcher shipmentLabels={props.shipmentLabels} /><QueryHero {...props} /></section>;
}

/** Legacy editor block retained for manually composed documents; new templates show package contents in the result. */
export function BrandedOrderItemsBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  const items = runtime.displayedResult?.orderItems ?? [];
  const title = text(props, "heading", "What's Inside");
  return <section aria-label={title} style={{ background: "#fffdf0", color: "#0a0a0a", fontFamily: "var(--pb-font-family)", padding: "clamp(28px, 4vw, 48px) 0" }}><div style={contentWidth}>
    <h2 style={{ margin: "0 0 20px", fontSize: 20 }}>{title}{runtime.phase === "success" ? " (" + items.length + ")" : ""}</h2>
    {runtime.phase === "success" ? <PackageContents items={items} /> : <p style={{ margin: 0, color: runtime.phase === "error" ? "#b42318" : "#6b6b6b" }}>{runtime.phase === "error" ? "Order items are temporarily unavailable." : "Track an order to see what is inside."}</p>}
  </div></section>;
}

function RecommendationCard({ item }: { item: TrackingPageRecommendation }) {
  const href = safeHref(item.href);
  return <article style={{ overflow: "hidden", borderRadius: 6, background: "#fff", boxShadow: "0 1px 2px rgb(0 0 0 / 8%)" }}><ProductImage src={item.imageUrl} alt={item.title} /><div style={{ padding: 14 }}><strong>{item.title}</strong>{item.price ? <p style={{ margin: "6px 0", fontWeight: 700 }}>{item.price}</p> : null}<p style={{ margin: "6px 0", color: "#6b6b6b", fontSize: 13 }}>{item.description}</p>{href === "#" ? <span style={{ color: "#6b6b6b", fontSize: 13, fontWeight: 700 }}>View product</span> : <a href={href} style={{ color: "#0a0a0a", fontSize: 13, fontWeight: 700 }}>View product</a>}</div></article>;
}

export function BrandedRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  const recommendations = runtime.displayedResult?.recommendations ?? [];
  const title = text(props, "heading", "You might also like");
  if ((runtime.phase === "success" || runtime.phase === "empty") && !recommendations.length && text(props, "hideWhenEmpty", "false") === "true") return null;
  return <section aria-label={title} style={{ background: "#fffdf0", color: "#0a0a0a", fontFamily: "var(--pb-font-family)", padding: "clamp(28px, 4vw, 48px) 0" }}><div style={contentWidth}>
    <h2 style={{ margin: "0 0 24px", textAlign: "center", fontSize: 20 }}>{title}</h2>
    {runtime.phase === "loading" ? <div aria-label="Loading recommendations" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>{[0, 1, 2].map((item) => <span key={item} style={{ display: "block", height: 220, borderRadius: 6, background: "#e7e7e7" }} />)}</div> : runtime.phase === "success" && recommendations.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>{recommendations.map((item) => <RecommendationCard key={item.id} item={item} />)}</div> : <p style={{ margin: 0, textAlign: "center", color: runtime.phase === "error" ? "#b42318" : "#6b6b6b" }}>{runtime.phase === "error" ? "Recommendations are temporarily unavailable." : runtime.phase === "empty" ? "No recommendations are available for that number." : "Recommendations will appear with your order."}</p>}
  </div></section>;
}

export function BrandedQuickLinksBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Need help?");
  return <section aria-label={title} style={{ ...cardStyle, margin: "24px auto", maxWidth: 1200, padding: 24 }}><h2>{title}</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}><a href={safeHref(props.primaryHref)} style={{ color: "#0a0a0a" }}>{text(props, "primaryLabel", "Shipping help")}</a><a href={safeHref(props.secondaryHref)} style={{ color: "#0a0a0a" }}>{text(props, "secondaryLabel", "Contact us")}</a></div></section>;
}

export function BrandedBlogBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "From our journal");
  return <section aria-label={title} style={{ ...cardStyle, margin: "24px auto", maxWidth: 1200, padding: 24 }}><h2>{title}</h2><article><strong>{text(props, "articleTitle", "Delivery tips for every season")}</strong><p>{text(props, "excerpt", "Simple ways to make every delivery feel considered.")}</p><a href={safeHref(props.articleHref)} style={{ color: "#0a0a0a" }}>{text(props, "linkLabel", "Read the story")}</a></article></section>;
}
