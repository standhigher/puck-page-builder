import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { FieldProps } from "@standhigher/puck-page-builder/runtime";
import { isEmptyTrackingPageResult, type TrackingPageQuery, type TrackingPageQueryResult, type TrackingPageRuntimePhase } from "./tracking-page-runtime";

/** Transient, consumer-safe state. The host error is deliberately never retained for display. */
export type SalesRuntimeState = { phase: TrackingPageRuntimePhase; result?: TrackingPageQueryResult };
type SalesRuntime = SalesRuntimeState & { query(trackingNumber: string): Promise<void> };
const initialRuntime: SalesRuntime = { phase: "idle", async query() { return undefined; } };
const SalesRuntimeContext = createContext<SalesRuntime>(initialRuntime);
export type SalesRuntimeProviderProps = { children: ReactNode; queryTracking: TrackingPageQuery };

const contentWidth: CSSProperties = { boxSizing: "border-box", width: "min(1120px, calc(100% - 32px))", margin: "0 auto" };
const sectionStyle: CSSProperties = { ...contentWidth, marginTop: "clamp(32px, 6vw, 72px)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)" };
const panelStyle: CSSProperties = { boxSizing: "border-box", border: "1px solid var(--pb-color-border)", borderRadius: "var(--pb-radius)", padding: "clamp(20px, 3vw, 32px)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", overflowWrap: "anywhere" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "clamp(16px, 2vw, 24px)" };
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
function hasControlCharacter(value: string) { return [...value].some((character) => character.charCodeAt(0) < 32); }
function safeHref(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") && !value.includes("\\") && !hasControlCharacter(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}
/** Image URLs are data, never CSS. Only HTTPS merchant assets are rendered. */
function safeImageUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}
function resourceState(value: unknown): "ready" | "empty" | "invalid" {
  return typeof value !== "string" ? "invalid" : value.trim() ? "ready" : "empty";
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

export function SalesAnnouncementBlock(props: Record<string, unknown>) {
  return <section aria-label="Sales announcement" data-sales-announcement style={{ display: "grid", minHeight: 38, placeItems: "center", boxSizing: "border-box", padding: "10px 16px", borderBottom: "1px solid var(--pb-color-border)", background: "var(--pb-color-background)", color: "var(--pb-color-text)", fontFamily: "var(--pb-font-family)", fontSize: 13, textAlign: "center" }}><strong>{text(props, "message", "Free delivery on orders over $50")}</strong></section>;
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
  return <section aria-label="Sales tracking query" aria-busy={runtime.phase === "loading" || undefined} data-sales-hero style={{ position: "relative", display: "grid", minHeight: "clamp(460px, 52vw, 620px)", placeItems: "center", boxSizing: "border-box", overflow: "hidden", padding: "clamp(28px, 6vw, 72px) 16px", background: "var(--pb-color-text)", color: "var(--pb-color-surface)", fontFamily: "var(--pb-font-family)" }}>
    <HeroAsset src={props.heroImageUrl} />
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgb(0 0 0 / 42%)" }} />
    <div data-sales-query-card style={{ position: "relative", zIndex: 1, boxSizing: "border-box", width: "min(560px, 100%)", padding: "clamp(28px, 5vw, 48px)", borderRadius: "var(--pb-radius)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", boxShadow: "0 20px 56px rgb(0 0 0 / 28%)" }}>
      <h1 style={{ margin: "0 0 28px", color: "var(--pb-color-text)", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.02, textAlign: "center" }}>{text(props, "heading", "Track an order")}</h1>
      <form noValidate onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <label htmlFor={inputId} style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Tracking number</label>
        <input id={inputId} aria-describedby={description ? errorId : undefined} aria-invalid={Boolean(inputError) || undefined} aria-label="Sales tracking number" value={trackingNumber} onChange={(event) => { setTrackingNumber(event.target.value); if (inputError) setInputError(null); }} inputMode="text" autoComplete="off" pattern="[A-Za-z0-9-]{4,64}" minLength={4} maxLength={64} required placeholder="Enter your tracking number" style={{ boxSizing: "border-box", width: "100%", minHeight: 58, padding: "12px 16px", border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.25)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)", font: "inherit", fontSize: 17 }} />
        <button type="submit" disabled={runtime.phase === "loading"} style={{ width: "100%", minHeight: 58, padding: "12px 18px", border: 0, borderRadius: "calc(var(--pb-radius) / 1.25)", background: "var(--pb-color-text)", color: "var(--pb-color-surface)", font: "inherit", fontSize: 16, fontWeight: 700, cursor: runtime.phase === "loading" ? "wait" : "pointer" }}>{runtime.phase === "loading" ? "Checking…" : text(props, "submitLabel", "Track order")}</button>
      </form>
      {runtime.phase === "loading" ? <Status>Checking your order…</Status> : null}
      {inputError ? <p id={errorId} role="alert">{inputError}</p> : null}
      {!inputError && runtime.phase === "empty" ? <p id={errorId} role="status">We couldn’t find an order for that number.</p> : null}
      {!inputError && runtime.phase === "error" ? <p id={errorId} role="alert">We couldn’t retrieve this order right now. Please try again later.</p> : null}
      <small style={{ display: "block", marginTop: 14, color: "var(--pb-color-muted)", fontSize: 11, textAlign: "right" }}>Powered by BestTrack</small>
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
  const href = safeHref(props.collectionHref);
  return <Section title={title}>{state === "invalid" ? <Status alert>Collection reference is invalid.</Status> : state === "empty" ? <Status>No collection selected. Choose a collection through an authorized resource integration.</Status> : href ? <a href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 74, boxSizing: "border-box", padding: "14px 18px", border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)", color: "var(--pb-color-text)", fontWeight: 700, textDecoration: "none" }}><span>{text(props, "collectionLabel", "Featured collection")}</span><span aria-hidden="true">→</span></a> : <Status alert>Collection link is unavailable.</Status>}</Section>;
}

export function SalesRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useSalesRuntime();
  const title = text(props, "heading", "Complete your order");
  const recommendations = runtime.result?.recommendations ?? [];
  return <Section title={title} busy={runtime.phase === "loading"}>{runtime.phase === "error" ? <Status alert>Recommendations are temporarily unavailable.</Status> : runtime.phase === "empty" ? <Status>No recommendations are available for that number.</Status> : runtime.phase === "success" && recommendations.length ? <div style={gridStyle}>{recommendations.map((item) => {
    const href = safeHref(item.href);
    const itemTitle = text(item, "title", "Recommended product");
    return <article key={item.id} style={{ display: "grid", gap: 14, minWidth: 0, padding: 18, border: "1px solid var(--pb-color-border)", borderRadius: "calc(var(--pb-radius) / 1.5)", background: "var(--pb-color-background)" }}><ProductImage src={item.imageUrl} alt={itemTitle} /><div><strong>{href ? <a href={href} style={{ color: "inherit" }}>{itemTitle}</a> : itemTitle}</strong>{item.price ? <small style={{ display: "block", marginTop: 5, color: "var(--pb-color-muted)" }}>{item.price}</small> : null}{item.description ? <p style={{ marginBottom: 0, color: "var(--pb-color-muted)" }}>{item.description}</p> : null}</div></article>;
  })}</div> : <Status>{runtime.phase === "success" ? "No recommendations are available for this order." : runtime.phase === "loading" ? "Loading recommendations…" : "Recommended products appear with your order result."}</Status>}</Section>;
}
