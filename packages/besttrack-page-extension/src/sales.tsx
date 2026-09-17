import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { FieldProps } from "@standhigher/puck-page-builder/runtime";
import type { ReadyToGoTrackingQuery, ReadyToGoTrackingResult } from "./ready-to-go";

type SalesPhase = "idle" | "loading" | "success" | "error";
export type SalesRuntimeState = { phase: SalesPhase; result?: ReadyToGoTrackingResult; error?: string };
type SalesRuntime = SalesRuntimeState & { query(trackingNumber: string): Promise<void> };
const initialRuntime: SalesRuntime = { phase: "idle", async query() { return undefined; } };
const SalesRuntimeContext = createContext<SalesRuntime>(initialRuntime);
export type SalesRuntimeProviderProps = { children: ReactNode; queryTracking: ReadyToGoTrackingQuery };
const cardStyle = { border: "1px solid var(--pb-color-border)", borderRadius: "var(--pb-radius)", padding: "var(--pb-spacing)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--pb-spacing)" };

/** The host injects a validated query; Sales never calls a DataSource itself. */
export function SalesRuntimeProvider({ children, queryTracking }: SalesRuntimeProviderProps) {
  const [state, setState] = useState<SalesRuntimeState>({ phase: "idle" });
  const query = useCallback(async (trackingNumber: string) => {
    setState({ phase: "loading" });
    try { setState({ phase: "success", result: await queryTracking(trackingNumber) }); }
    catch (error) { setState({ phase: "error", error: error instanceof Error ? error.message : "tracking-query-failed" }); }
  }, [queryTracking]);
  const value = useMemo<SalesRuntime>(() => ({ ...state, query }), [query, state]);
  return <SalesRuntimeContext.Provider value={value}>{children}</SalesRuntimeContext.Provider>;
}

function useSalesRuntime() { return useContext(SalesRuntimeContext); }
function text(props: Record<string, unknown>, key: string, fallback: string) { return typeof props[key] === "string" ? props[key] : fallback; }
function safeHref(value: unknown) {
  if (typeof value !== "string") return "#";
  if (value.startsWith("/")) return value;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "#"; } catch { return "#"; }
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <section aria-label={title} style={cardStyle}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }
function resourceState(value: unknown): "ready" | "empty" | "invalid" { return typeof value !== "string" ? "invalid" : value.trim() ? "ready" : "empty"; }

export function SalesTextField({ value, onChange }: FieldProps) { return <input aria-label="Sales text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />; }

export function SalesAnnouncementBlock(props: Record<string, unknown>) {
  return <section aria-label="Sales announcement" style={{ ...cardStyle, background: "var(--pb-color-primary)", color: "white", textAlign: "center" }}><strong>{text(props, "message", "Free delivery on orders over $50")}</strong></section>;
}

export function SalesQueryBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const [trackingNumber, setTrackingNumber] = useState(text(props, "defaultTrackingNumber", "BT-2048-DEMO"));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void runtime.query(trackingNumber); };
  return <section aria-label="Sales tracking query" style={{ ...cardStyle, boxShadow: "0 12px 32px rgb(0 0 0 / 8%)" }}><h1 style={{ marginTop: 0 }}>{text(props, "heading", "Track an order")}</h1><form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input aria-label="Sales tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} minLength={4} maxLength={64} required style={{ flex: "1 1 220px", padding: 12, borderRadius: "var(--pb-radius)", border: "1px solid var(--pb-color-border)" }} /><button type="submit" disabled={runtime.phase === "loading"} style={{ padding: "12px 18px", border: 0, borderRadius: "var(--pb-radius)", color: "white", background: "var(--pb-color-primary)" }}>{runtime.phase === "loading" ? "Checking…" : text(props, "submitLabel", "Track order")}</button></form>{runtime.phase === "error" ? <p role="alert">We could not retrieve this order: {runtime.error}</p> : null}</section>;
}

export function SalesOrderItemsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Items in your order");
  const items = runtime.result?.orderItems ?? [];
  return <Section title={title}>{runtime.phase === "error" ? <p role="alert">Order items are temporarily unavailable.</p> : runtime.phase === "success" && items.length ? <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{items.map((item) => <li key={item.id}><strong>{item.title}</strong> · Qty {item.quantity}</li>)}</ul> : <p>{runtime.phase === "loading" ? "Loading order items…" : "Order items appear after a successful query."}</p>}</Section>;
}

export function SalesOtherTrackingBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Other shipments");
  return <Section title={title}>{runtime.phase === "error" ? <p role="alert">Additional shipments are unavailable.</p> : runtime.phase === "success" ? <p>{text(props, "emptyMessage", "No other shipments are linked to this order.")}</p> : <p>Other tracking numbers appear with your order result.</p>}</Section>;
}

export function SalesServiceCardsBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop with confidence");
  return <Section title={title}><div style={gridStyle}><article><strong>{text(props, "firstTitle", "Easy returns")}</strong><p>{text(props, "firstDescription", "Simple support when plans change.")}</p></article><article><strong>{text(props, "secondTitle", "Secure delivery")}</strong><p>{text(props, "secondDescription", "Follow every milestone in one place.")}</p></article></div></Section>;
}

export function SalesProductCategoriesBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop by category");
  const collectionId = text(props, "collectionId", "");
  const state = resourceState(collectionId);
  return <Section title={title}>{state === "invalid" ? <p role="alert">Collection reference is invalid.</p> : state === "empty" ? <p>No collection selected. Choose a collection through the authorized resource BFF.</p> : <div style={gridStyle}><a href={safeHref(props.collectionHref)} style={{ color: "var(--pb-color-primary)" }}>{text(props, "collectionLabel", "Featured collection")}</a><small>Collection reference: {collectionId}</small></div>}</Section>;
}

export function SalesRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Complete your order");
  const recommendations = runtime.result?.recommendations ?? [];
  return <Section title={title}>{runtime.phase === "error" ? <p role="alert">Recommendations are temporarily unavailable.</p> : runtime.phase === "success" && recommendations.length ? <div style={gridStyle}>{recommendations.map((item) => <article key={item.id} style={{ borderTop: "3px solid var(--pb-color-primary)", paddingTop: 8 }}><strong>{item.title}</strong><p>{item.description}</p></article>)}</div> : <p>{runtime.phase === "success" ? "No recommendations are available for this order." : "Recommended products appear with your order result."}</p>}</Section>;
}
