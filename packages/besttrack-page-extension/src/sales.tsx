import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { FieldProps } from "@standhigher/puck-page-builder/runtime";
import { isEmptyTrackingPageResult, type TrackingPageQuery, type TrackingPageQueryResult, type TrackingPageRuntimePhase } from "./tracking-page-runtime";

/** Transient, consumer-safe state. The host error is deliberately never retained for display. */
export type SalesRuntimeState = { phase: TrackingPageRuntimePhase; result?: TrackingPageQueryResult };
type SalesRuntime = SalesRuntimeState & { query(trackingNumber: string): Promise<void> };
const initialRuntime: SalesRuntime = { phase: "idle", async query() { return undefined; } };
const SalesRuntimeContext = createContext<SalesRuntime>(initialRuntime);
export type SalesRuntimeProviderProps = { children: ReactNode; queryTracking: TrackingPageQuery };

const cardStyle = {
  boxSizing: "border-box" as const,
  maxWidth: "100%",
  overflowWrap: "anywhere" as const,
  border: "1px solid var(--pb-color-border)",
  borderRadius: "var(--pb-radius)",
  padding: "var(--pb-spacing)",
  background: "var(--pb-color-surface)",
  color: "var(--pb-color-text)",
  fontFamily: "var(--pb-font-family)"
};
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: "var(--pb-spacing)" };
const trackingNumberPattern = /^[A-Za-z0-9-]{4,64}$/;

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
    } catch {
      if (currentRequestId !== requestId.current) return;
      setState({ phase: "error" });
    }
  }, [queryTracking]);
  const value = useMemo<SalesRuntime>(() => ({ ...state, query }), [query, state]);
  return <SalesRuntimeContext.Provider value={value}>{children}</SalesRuntimeContext.Provider>;
}

function useSalesRuntime() { return useContext(SalesRuntimeContext); }
function text(props: object, key: string, fallback: string) {
  const value = (props as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function safeHref(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") && !value.includes("\\") && !hasControlCharacter(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}
function hasControlCharacter(value: string) { return [...value].some((character) => character.charCodeAt(0) < 32); }
function safeImageUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}
function Section({ title, children, busy = false }: { title: string; children: ReactNode; busy?: boolean }) {
  return <section aria-label={title} aria-busy={busy || undefined} style={cardStyle}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>;
}
function resourceState(value: unknown): "ready" | "empty" | "invalid" {
  return typeof value !== "string" ? "invalid" : value.trim() ? "ready" : "empty";
}
function Status({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return <p role={alert ? "alert" : "status"} aria-live={alert ? "assertive" : "polite"}>{children}</p>;
}
function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeImageUrl(src);
  if (!safeSrc || failed) return <span aria-label={`${alt} image unavailable`} role="img" style={{ display: "grid", placeItems: "center", width: 72, height: 72, flex: "0 0 auto", borderRadius: 6, background: "#f2f2f2", color: "#6b6b6b" }}>{alt.slice(0, 1).toUpperCase()}</span>;
  return <img src={safeSrc} alt={alt} onError={() => setFailed(true)} style={{ width: 72, height: 72, flex: "0 0 auto", borderRadius: 6, objectFit: "cover", background: "#f2f2f2" }} />;
}

export function SalesTextField({ value, onChange }: FieldProps) {
  return <input aria-label="Sales text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

export function SalesAnnouncementBlock(props: Record<string, unknown>) {
  return <section aria-label="Sales announcement" style={{ ...cardStyle, background: "var(--pb-color-primary)", color: "white", textAlign: "center" }}><strong>{text(props, "message", "Free delivery on orders over $50")}</strong></section>;
}

export function SalesQueryBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const inputId = useId();
  const errorId = useId();
  const [trackingNumber, setTrackingNumber] = useState(text(props, "defaultTrackingNumber", "BT-2048-DEMO"));
  const [inputError, setInputError] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTrackingNumber = trackingNumber.trim();
    if (!trackingNumberPattern.test(normalizedTrackingNumber)) {
      setInputError("Enter a tracking number using 4–64 letters, numbers, or hyphens.");
      return;
    }
    setInputError(null);
    void runtime.query(normalizedTrackingNumber);
  };
  const description = inputError ?? (runtime.phase === "empty" ? "We couldn’t find an order for that number." : runtime.phase === "error" ? "We couldn’t retrieve this order right now. Please try again later." : undefined);
  return <section aria-label="Sales tracking query" aria-busy={runtime.phase === "loading" || undefined} style={{ ...cardStyle, boxShadow: "0 12px 32px rgb(0 0 0 / 8%)" }}>
    <h1 style={{ marginTop: 0 }}>{text(props, "heading", "Track an order")}</h1>
    <form noValidate onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <label htmlFor={inputId} style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Tracking number</label>
      <input id={inputId} aria-describedby={description ? errorId : undefined} aria-invalid={Boolean(inputError) || undefined} aria-label="Sales tracking number" value={trackingNumber} onChange={(event) => { setTrackingNumber(event.target.value); if (inputError) setInputError(null); }} inputMode="text" autoComplete="off" pattern="[A-Za-z0-9-]{4,64}" minLength={4} maxLength={64} required style={{ boxSizing: "border-box", flex: "1 1 220px", minWidth: 0, minHeight: 44, padding: 12, borderRadius: "var(--pb-radius)", border: "1px solid var(--pb-color-border)" }} />
      <button type="submit" disabled={runtime.phase === "loading"} style={{ minHeight: 44, padding: "12px 18px", border: 0, borderRadius: "var(--pb-radius)", color: "white", background: "var(--pb-color-primary)" }}>{runtime.phase === "loading" ? "Checking…" : text(props, "submitLabel", "Track order")}</button>
    </form>
    {runtime.phase === "loading" ? <Status>Checking your order…</Status> : null}
    {inputError ? <p id={errorId} role="alert">{inputError}</p> : null}
    {!inputError && runtime.phase === "empty" ? <p id={errorId} role="status">We couldn’t find an order for that number.</p> : null}
    {!inputError && runtime.phase === "error" ? <p id={errorId} role="alert">We couldn’t retrieve this order right now. Please try again later.</p> : null}
  </section>;
}

export function SalesOrderItemsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Items in your order");
  const items = runtime.result?.orderItems ?? [];
  return <Section title={title} busy={runtime.phase === "loading"}>{runtime.phase === "error" ? <Status alert>Order items are temporarily unavailable.</Status> : runtime.phase === "empty" ? <Status>No order items are available for that number.</Status> : runtime.phase === "success" && items.length ? <ul style={{ display: "grid", gap: 12, marginBottom: 0, paddingLeft: 0, listStyle: "none" }}>{items.map((item) => {
    const href = safeHref(item.href);
    const itemTitle = text(item, "title", "Order item");
    const itemContent = href ? <a href={href} style={{ color: "inherit" }}>{itemTitle}</a> : itemTitle;
    return <li key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><ProductImage src={item.imageUrl} alt={itemTitle} /><span style={{ minWidth: 0 }}><strong>{itemContent}</strong><br /><small>Qty {Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1}</small>{item.description ? <><br /><small>{item.description}</small></> : null}</span></li>;
  })}</ul> : <Status>{runtime.phase === "loading" ? "Loading order items…" : "Order items appear after a successful query."}</Status>}</Section>;
}

export function SalesOtherTrackingBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Other shipments");
  const shipments = (runtime.result?.shipments ?? []).filter((shipment) => shipment.trackingNumber !== runtime.result?.trackingNumber);
  return <Section title={title} busy={runtime.phase === "loading"}>{runtime.phase === "error" ? <Status alert>Additional shipments are unavailable.</Status> : runtime.phase === "empty" ? <Status>No additional shipments are available for that number.</Status> : runtime.phase === "success" && shipments.length ? <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{shipments.map((shipment) => <li key={shipment.id}><strong>{text(shipment, "label", "Shipment")}</strong>{shipment.status ? ` · ${shipment.status}` : ""}{shipment.trackingNumber ? <><br /><small>{shipment.trackingNumber}</small></> : null}</li>)}</ul> : runtime.phase === "success" ? <Status>{text(props, "emptyMessage", "No other shipments are linked to this order.")}</Status> : <Status>{runtime.phase === "loading" ? "Loading other shipments…" : "Other tracking numbers appear with your order result."}</Status>}</Section>;
}

export function SalesServiceCardsBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop with confidence");
  return <Section title={title}><div style={gridStyle}><article><strong>{text(props, "firstTitle", "Easy returns")}</strong><p>{text(props, "firstDescription", "Simple support when plans change.")}</p></article><article><strong>{text(props, "secondTitle", "Secure delivery")}</strong><p>{text(props, "secondDescription", "Follow every milestone in one place.")}</p></article></div></Section>;
}

export function SalesProductCategoriesBlock(props: Record<string, unknown>) {
  const title = text(props, "heading", "Shop by category");
  const state = resourceState(props.collectionId);
  const href = safeHref(props.collectionHref);
  return <Section title={title}>{state === "invalid" ? <Status alert>Collection reference is invalid.</Status> : state === "empty" ? <Status>No collection selected. Choose a collection through an authorized resource integration.</Status> : <div style={gridStyle}>{href ? <a href={href} style={{ color: "var(--pb-color-primary)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{text(props, "collectionLabel", "Featured collection")}</a> : <Status alert>Collection link is unavailable.</Status>}</div>}</Section>;
}

export function SalesRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Complete your order");
  const recommendations = runtime.result?.recommendations ?? [];
  return <Section title={title} busy={runtime.phase === "loading"}>{runtime.phase === "error" ? <Status alert>Recommendations are temporarily unavailable.</Status> : runtime.phase === "empty" ? <Status>No recommendations are available for that number.</Status> : runtime.phase === "success" && recommendations.length ? <div style={gridStyle}>{recommendations.map((item) => {
    const href = safeHref(item.href);
    const itemTitle = text(item, "title", "Recommended product");
    return <article key={item.id} style={{ minWidth: 0, borderTop: "3px solid var(--pb-color-primary)", paddingTop: 8 }}><ProductImage src={item.imageUrl} alt={itemTitle} /><p><strong>{href ? <a href={href} style={{ color: "inherit" }}>{itemTitle}</a> : itemTitle}</strong>{item.price ? ` · ${item.price}` : ""}</p>{item.description ? <p>{item.description}</p> : null}</article>;
  })}</div> : <Status>{runtime.phase === "success" ? "No recommendations are available for this order." : runtime.phase === "loading" ? "Loading recommendations…" : "Recommended products appear with your order result."}</Status>}</Section>;
}
