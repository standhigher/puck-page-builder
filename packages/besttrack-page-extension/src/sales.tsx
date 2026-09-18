import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { FieldProps } from "@standhigher/puck-page-builder/runtime";
import { isEmptyTrackingPageResult, type TrackingPageQuery, type TrackingPageQueryResult, type TrackingPageRuntimePhase } from "./tracking-page-runtime";

export type SalesRuntimeState = { phase: TrackingPageRuntimePhase; result?: TrackingPageQueryResult; error?: string };
type SalesRuntime = SalesRuntimeState & { query(trackingNumber: string): Promise<void> };
const initialRuntime: SalesRuntime = { phase: "idle", async query() { return undefined; } };
const SalesRuntimeContext = createContext<SalesRuntime>(initialRuntime);
export type SalesRuntimeProviderProps = { children: ReactNode; queryTracking: TrackingPageQuery };
const cardStyle = { border: "1px solid var(--pb-color-border)", borderRadius: "var(--pb-radius)", padding: "var(--pb-spacing)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--pb-spacing)" };

/** The host injects a validated query; Sales never calls a DataSource itself. */
export function SalesRuntimeProvider({ children, queryTracking }: SalesRuntimeProviderProps) {
  const [state, setState] = useState<SalesRuntimeState>({ phase: "idle" });
  const requestId = useRef(0);
  const query = useCallback(async (trackingNumber: string) => {
    const currentRequestId = ++requestId.current;
    setState({ phase: "loading" });
    try {
      const result = await queryTracking(trackingNumber);
      if (currentRequestId !== requestId.current) return;
      setState({ phase: isEmptyTrackingPageResult(result) ? "empty" : "success", result });
    } catch (error) {
      if (currentRequestId !== requestId.current) return;
      setState({ phase: "error", error: error instanceof Error ? error.message : "tracking-query-failed" });
    }
  }, [queryTracking]);
  const value = useMemo<SalesRuntime>(() => ({ ...state, query }), [query, state]);
  return <SalesRuntimeContext.Provider value={value}>{children}</SalesRuntimeContext.Provider>;
}

function useSalesRuntime() { return useContext(SalesRuntimeContext); }
function text(props: Record<string, unknown>, key: string, fallback: string) { return typeof props[key] === "string" ? props[key] : fallback; }
function safeHref(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined; } catch { return undefined; }
}
function safeImageUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined; } catch { return undefined; }
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <section aria-label={title} style={cardStyle}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }
function resourceState(value: unknown): "ready" | "empty" | "invalid" { return typeof value !== "string" ? "invalid" : value.trim() ? "ready" : "empty"; }
function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeImageUrl(src);
  if (!safeSrc || failed) return <span aria-label={alt + " image unavailable"} style={{ display: "grid", placeItems: "center", width: 72, height: 72, flex: "0 0 auto", borderRadius: 6, background: "#f2f2f2", color: "#6b6b6b" }}>{alt.slice(0, 1).toUpperCase()}</span>;
  return <img src={safeSrc} alt={alt} onError={() => setFailed(true)} style={{ width: 72, height: 72, flex: "0 0 auto", borderRadius: 6, objectFit: "cover", background: "#f2f2f2" }} />;
}

export function SalesTextField({ value, onChange }: FieldProps) { return <input aria-label="Sales text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />; }

export function SalesAnnouncementBlock(props: Record<string, unknown>) {
  return <section aria-label="Sales announcement" style={{ ...cardStyle, background: "var(--pb-color-primary)", color: "white", textAlign: "center" }}><strong>{text(props, "message", "Free delivery on orders over $50")}</strong></section>;
}

export function SalesQueryBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const [trackingNumber, setTrackingNumber] = useState(text(props, "defaultTrackingNumber", "BT-2048-DEMO"));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void runtime.query(trackingNumber); };
  return <section aria-label="Sales tracking query" style={{ ...cardStyle, boxShadow: "0 12px 32px rgb(0 0 0 / 8%)" }}><h1 style={{ marginTop: 0 }}>{text(props, "heading", "Track an order")}</h1><form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input aria-label="Sales tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} minLength={4} maxLength={64} required style={{ flex: "1 1 220px", minHeight: 44, padding: 12, borderRadius: "var(--pb-radius)", border: "1px solid var(--pb-color-border)" }} /><button type="submit" disabled={runtime.phase === "loading"} style={{ minHeight: 44, padding: "12px 18px", border: 0, borderRadius: "var(--pb-radius)", color: "white", background: "var(--pb-color-primary)" }}>{runtime.phase === "loading" ? "Checking…" : text(props, "submitLabel", "Track order")}</button></form>{runtime.phase === "empty" ? <p role="status">We couldn’t find an order for that number.</p> : null}{runtime.phase === "error" ? <p role="alert">We couldn’t retrieve this order right now. Please try again later.</p> : null}</section>;
}

export function SalesOrderItemsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Items in your order");
  const items = runtime.result?.orderItems ?? [];
  return <Section title={title}>{runtime.phase === "error" ? <p role="alert">Order items are temporarily unavailable.</p> : runtime.phase === "empty" ? <p>No order items are available for that number.</p> : runtime.phase === "success" && items.length ? <ul style={{ display: "grid", gap: 12, marginBottom: 0, paddingLeft: 0, listStyle: "none" }}>{items.map((item) => { const href = safeHref(item.href); const itemTitle = href ? <a href={href} style={{ color: "inherit" }}>{item.title}</a> : item.title; return <li key={item.id} style={{ display: "flex", alignItems: "center", gap: 12 }}><ProductImage src={item.imageUrl} alt={item.title} /><span><strong>{itemTitle}</strong><br /><small>Qty {item.quantity}</small>{item.description ? <><br /><small>{item.description}</small></> : null}</span></li>; })}</ul> : <p>{runtime.phase === "loading" ? "Loading order items…" : "Order items appear after a successful query."}</p>}</Section>;
}

export function SalesOtherTrackingBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Other shipments");
  const shipments = (runtime.result?.shipments ?? []).filter((shipment) => shipment.trackingNumber !== runtime.result?.trackingNumber);
  return <Section title={title}>{runtime.phase === "error" ? <p role="alert">Additional shipments are unavailable.</p> : runtime.phase === "empty" ? <p>No additional shipments are available for that number.</p> : runtime.phase === "success" && shipments.length ? <ul style={{ marginBottom: 0 }}>{shipments.map((shipment) => <li key={shipment.id}><strong>{shipment.label}</strong>{shipment.status ? " · " + shipment.status : ""}{shipment.trackingNumber ? <><br /><small>{shipment.trackingNumber}</small></> : null}</li>)}</ul> : runtime.phase === "success" ? <p>{text(props, "emptyMessage", "No other shipments are linked to this order.")}</p> : <p>Other tracking numbers appear with your order result.</p>}</Section>;
}

export function SalesServiceCardsBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop with confidence");
  return <Section title={title}><div style={gridStyle}><article><strong>{text(props, "firstTitle", "Easy returns")}</strong><p>{text(props, "firstDescription", "Simple support when plans change.")}</p></article><article><strong>{text(props, "secondTitle", "Secure delivery")}</strong><p>{text(props, "secondDescription", "Follow every milestone in one place.")}</p></article></div></Section>;
}

export function SalesProductCategoriesBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop by category");
  const collectionId = text(props, "collectionId", "");
  const state = resourceState(collectionId);
  const href = safeHref(props.collectionHref);
  return <Section title={title}>{state === "invalid" ? <p role="alert">Collection reference is invalid.</p> : state === "empty" ? <p>No collection selected. Choose a collection through an authorized resource integration.</p> : <div style={gridStyle}>{href ? <a href={href} style={{ color: "var(--pb-color-primary)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{text(props, "collectionLabel", "Featured collection")}</a> : <p role="alert">Collection link is unavailable.</p>}</div>}</Section>;
}

export function SalesRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Complete your order");
  const recommendations = runtime.result?.recommendations ?? [];
  return <Section title={title}>{runtime.phase === "error" ? <p role="alert">Recommendations are temporarily unavailable.</p> : runtime.phase === "empty" ? <p>No recommendations are available for that number.</p> : runtime.phase === "success" && recommendations.length ? <div style={gridStyle}>{recommendations.map((item) => { const href = safeHref(item.href); return <article key={item.id} style={{ borderTop: "3px solid var(--pb-color-primary)", paddingTop: 8 }}><ProductImage src={item.imageUrl} alt={item.title} /><p><strong>{href ? <a href={href} style={{ color: "inherit" }}>{item.title}</a> : item.title}</strong>{item.price ? " · " + item.price : ""}</p><p>{item.description}</p></article>; })}</div> : <p>{runtime.phase === "success" ? "No recommendations are available for this order." : "Recommended products appear with your order result."}</p>}</Section>;
}
