import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { FieldProps } from "@standhigher/puck-page-builder/runtime";
import type { ReadyToGoTrackingQuery, ReadyToGoTrackingResult } from "./ready-to-go";

const cardStyle = { border: "1px solid var(--pb-color-border)", borderRadius: "var(--pb-radius)", padding: "var(--pb-spacing)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--pb-spacing)" };
export type BrandedRuntimeState = { phase: "idle" | "loading" | "success" | "error"; result?: ReadyToGoTrackingResult; error?: string };
type BrandedRuntime = BrandedRuntimeState & { query(trackingNumber: string): Promise<void> };
const initialRuntime: BrandedRuntime = { phase: "idle", async query() { return undefined; } };
const BrandedRuntimeContext = createContext<BrandedRuntime>(initialRuntime);
export type BrandedRuntimeProviderProps = { children: ReactNode; queryTracking: ReadyToGoTrackingQuery };

/** Keeps one standard tracking result available to every Branded result block. */
export function BrandedRuntimeProvider({ children, queryTracking }: BrandedRuntimeProviderProps) {
  const [state, setState] = useState<BrandedRuntimeState>({ phase: "idle" });
  const query = useCallback(async (trackingNumber: string) => {
    setState({ phase: "loading" });
    try { setState({ phase: "success", result: await queryTracking(trackingNumber) }); }
    catch (error) { setState({ phase: "error", error: error instanceof Error ? error.message : "tracking-query-failed" }); }
  }, [queryTracking]);
  const value = useMemo<BrandedRuntime>(() => ({ ...state, query }), [query, state]);
  return <BrandedRuntimeContext.Provider value={value}>{children}</BrandedRuntimeContext.Provider>;
}

function text(props: Record<string, unknown>, key: string, fallback: string) { return typeof props[key] === "string" ? props[key] : fallback; }
function useBrandedRuntime() { return useContext(BrandedRuntimeContext); }
function safeHref(value: unknown) {
  if (typeof value !== "string") return "#";
  if (value.startsWith("/")) return value;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "#"; } catch { return "#"; }
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <section aria-label={title} style={cardStyle}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }

export function BrandedTextField({ value, onChange }: FieldProps) {
  return <input aria-label="Branded text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

export function BrandedAnnouncementBlock(props: Record<string, unknown>) {
  const logoUrl = text(props, "logoUrl", "");
  return <section aria-label="Branded announcement" style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, background: "var(--pb-color-primary)", color: "white" }}>
    {logoUrl ? <img src={logoUrl} alt={text(props, "brandName", "Brand")} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "white" }} /> : null}
    <div><strong>{text(props, "brandName", "BestTrack")}</strong><p style={{ margin: "4px 0 0" }}>{text(props, "message", "Track every order with confidence.")}</p></div>
  </section>;
}

export function BrandedQueryBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  const [trackingNumber, setTrackingNumber] = useState(text(props, "defaultTrackingNumber", "BT-2048-DEMO"));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void runtime.query(trackingNumber); };
  return <section aria-label="Branded tracking query" style={{ ...cardStyle, boxShadow: "0 16px 40px rgb(0 0 0 / 8%)" }}>
    <p style={{ margin: 0, color: "var(--pb-color-muted)" }}>{text(props, "eyebrow", "ORDER SUPPORT")}</p><h1 style={{ margin: "6px 0 16px" }}>{text(props, "heading", "Where is my order?")}</h1>
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input aria-label="Branded tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} required minLength={4} maxLength={64} style={{ flex: "1 1 220px", padding: 12, borderRadius: "var(--pb-radius)", border: "1px solid var(--pb-color-border)" }} /><button type="submit" disabled={runtime.phase === "loading"} style={{ padding: "12px 18px", border: 0, borderRadius: "var(--pb-radius)", background: "var(--pb-color-primary)", color: "white" }}>{runtime.phase === "loading" ? "Looking up…" : text(props, "submitLabel", "Find my order")}</button></form>
    {runtime.phase === "error" ? <p role="alert">{runtime.error}</p> : null}
  </section>;
}

export function BrandedOrderItemsBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  const title = text(props, "heading", "Your order");
  const items = runtime.result?.orderItems ?? [];
  return <Section title={title}>{runtime.phase === "success" && items.length ? <ul style={{ paddingLeft: 20, marginBottom: 0 }}>{items.map((item) => <li key={item.id}><strong>{item.title}</strong> · Qty {item.quantity}</li>)}</ul> : <p>{runtime.phase === "loading" ? "Loading order items…" : "Order items will appear after a successful query."}</p>}</Section>;
}

export function BrandedRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useBrandedRuntime();
  const title = text(props, "heading", "Selected for you");
  const recommendations = runtime.result?.recommendations ?? [];
  return <Section title={title}>{runtime.phase === "success" && recommendations.length ? <div style={gridStyle}>{recommendations.map((item) => <article key={item.id} style={{ borderTop: "3px solid var(--pb-color-primary)", paddingTop: 8 }}><strong>{item.title}</strong><p>{item.description}</p></article>)}</div> : <p>{runtime.phase === "success" ? "No recommendations are available for this order." : "Recommendations appear with your order result."}</p>}</Section>;
}

export function BrandedQuickLinksBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Need help?");
  return <Section title={title}><div style={gridStyle}><a href={safeHref(props.primaryHref)} style={{ color: "var(--pb-color-primary)" }}>{text(props, "primaryLabel", "Shipping help")}</a><a href={safeHref(props.secondaryHref)} style={{ color: "var(--pb-color-primary)" }}>{text(props, "secondaryLabel", "Contact us")}</a></div></Section>;
}

export function BrandedBlogBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "From our journal");
  return <Section title={title}><article><strong>{text(props, "articleTitle", "Delivery tips for every season")}</strong><p>{text(props, "excerpt", "Simple ways to make every delivery feel considered.")}</p><a href={safeHref(props.articleHref)} style={{ color: "var(--pb-color-primary)" }}>{text(props, "linkLabel", "Read the story")}</a></article></Section>;
}
