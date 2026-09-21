import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { BlockEditorProps, FieldProps } from "@standhigher/puck-page-builder/runtime";
import {
  createShopifyRecommendationsQuery,
  createShopifyTrackQuery,
  readTrackingQueryLocationState,
  shouldHidePoweredBy,
  syncTrackingQueryToUrl,
  type ShopifyTrackPageTransport
} from "./shopify-track-query";
import {
  contentWidth,
  defaultProgress,
  IdleMessage,
  PackageContents,
  pageFont,
  EstimatedDeliveryCard,
  RecommendationCards,
  SectionShell,
  ShippingTimeline,
  SkeletonRow,
  text,
  TrackingPageAdSlot,
  TrackingProgress
} from "./track-page-display";
import { TrackingNotFound } from "./tracking-not-found";
import { isEmptyTrackingPageResult } from "./tracking-page-runtime";
import type {
  TrackingPageOrderItem,
  TrackingPageQuery,
  TrackingPageQueryRequest,
  TrackingPageQueryResult,
  TrackingPageRecommendation,
  TrackingPageRecommendationsQuery,
  TrackingPageRecommendationsState,
  TrackingPageShipment,
  TrackingPageTrackingEvent,
  TrackingPageTrackingStep,
  TrackingPageWatermark
} from "./tracking-page-runtime";

/** Ready-to-go names for the shared Consumer Runtime contract. */
export type ReadyToGoOrderItem = TrackingPageOrderItem;
export type ReadyToGoRecommendation = TrackingPageRecommendation;
export type ReadyToGoTrackingStep = TrackingPageTrackingStep;
export type ReadyToGoTrackingEvent = TrackingPageTrackingEvent;
export type ReadyToGoShipment = TrackingPageShipment;
export type ReadyToGoTrackingResult = TrackingPageQueryResult;
export type ReadyToGoRuntimeState = { phase: "idle" | "loading" | "success" | "empty" | "error"; result?: ReadyToGoTrackingResult; error?: string };
type ReadyToGoRuntime = ReadyToGoRuntimeState & {
  query(request: TrackingPageQueryRequest): Promise<void>;
  recommendations: TrackingPageRecommendationsState;
  autoQueryFromUrl: boolean;
  watermark?: TrackingPageWatermark;
};

const initialRuntime: ReadyToGoRuntime = {
  phase: "idle",
  recommendations: { phase: "idle", items: [] },
  autoQueryFromUrl: false,
  async query() { return undefined; }
};
const ReadyToGoRuntimeContext = createContext<ReadyToGoRuntime>(initialRuntime);
export type ReadyToGoRuntimeProviderProps = {
  children: ReactNode;
  /** The discriminated, host-authorized query boundary. */
  query?: TrackingPageQuery;
  /** Independent recommended-product loader; does not share tracking loading/error. */
  queryRecommendations?: TrackingPageRecommendationsQuery;
  /**
   * Shopify Track Page live transport. When `query` is omitted, lookups use the
   * original `/track/query` body, `_t` cache-bust, retry, and mapping rules.
   */
  transport?: ShopifyTrackPageTransport;
  /** When omitted, URL deep-link auto-query is on only for the Shopify Track Page `transport` path. */
  autoQueryFromUrl?: boolean;
  /** Host-decided display state. Omitted values follow the original powered-by hide rule. */
  watermark?: TrackingPageWatermark;
};

/** Mock is an explicit preview default, never a fallback for an injected live query. */
function previewReadyToGoTracking(trackingNumber = "BT-2048-DEMO"): ReadyToGoTrackingResult {
  return {
    trackingNumber,
    status: "In transit",
    carrier: "BestTrack demo carrier",
    latestEvent: "Shipment accepted at the regional hub",
    updatedAt: "Sep 17, 10:00 AM",
    destination: "Shanghai",
    estimatedDelivery: "Sep 22 - Sep 24",
    progress: defaultProgress("In transit"),
    events: [
      { id: "hub", title: "Shipment accepted at the regional hub", at: "Sep 17, 10:00 AM", state: "current" },
      { id: "info", title: "The order has been placed and confirmed.", at: "Sep 16, 3:31 PM", state: "complete" }
    ],
    orderItems: [{ id: "demo-order-item", title: "Demo shipment item", quantity: 1, description: "Product details are available in your order." }],
    recommendations: [
      { id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery.", price: { amount: 900, currencyCode: "USD" } },
      { id: "delivery-alerts", title: "Delivery alerts", description: "Receive an update at every milestone.", price: { amount: 400, currencyCode: "USD" } }
    ]
  };
}

async function queryMockReadyToGoTracking(request: TrackingPageQueryRequest): Promise<ReadyToGoTrackingResult> {
  return previewReadyToGoTracking(request.mode === "tracking" ? request.trackingNumber : request.orderNumber);
}

export function ReadyToGoRuntimeProvider({ children, query: injectedQuery, queryRecommendations, transport, autoQueryFromUrl, watermark }: ReadyToGoRuntimeProviderProps) {
  const [state, setState] = useState<ReadyToGoRuntimeState>({ phase: "idle" });
  const [recommendations, setRecommendations] = useState<TrackingPageRecommendationsState>(() => ({
    phase: queryRecommendations || (transport && !injectedQuery) ? "loading" : "idle",
    items: []
  }));
  const requestId = useRef(0);
  const resolvedQuery = useMemo(() => {
    if (injectedQuery) return injectedQuery;
    if (transport) return createShopifyTrackQuery(transport);
    return undefined;
  }, [injectedQuery, transport]);
  const resolvedRecommendations = useMemo(() => {
    if (queryRecommendations) return queryRecommendations;
    if (transport && !injectedQuery) return createShopifyRecommendationsQuery(transport.post);
    return undefined;
  }, [injectedQuery, queryRecommendations, transport]);
  const live = Boolean(resolvedQuery);

  useEffect(() => {
    if (!resolvedRecommendations) return;
    let active = true;
    void resolvedRecommendations().then((items) => {
      if (!active) return;
      setRecommendations({ phase: items.length ? "success" : "empty", items });
    }).catch(() => {
      if (!active) return;
      setRecommendations({ phase: "error", items: [] });
    });
    return () => { active = false; };
  }, [resolvedRecommendations]);

  const query = useCallback(async (request: TrackingPageQueryRequest) => {
    const currentRequestId = ++requestId.current;
    setState({ phase: "loading" });
    try {
      const result = live ? await resolvedQuery!(request) : await queryMockReadyToGoTracking(request);
      if (currentRequestId !== requestId.current) return;
      setState({ phase: isEmptyTrackingPageResult(result) ? "empty" : "success", result });
    } catch {
      if (currentRequestId !== requestId.current) return;
      setState({ phase: "error", error: "We couldn’t retrieve this order right now. Please try again later." });
    }
  }, [live, resolvedQuery]);
  const resolveAutoQuery = autoQueryFromUrl ?? Boolean(transport && !injectedQuery);
  const resolvedWatermark = useMemo(
    () => watermark ?? { visible: !shouldHidePoweredBy() },
    [watermark]
  );
  const value = useMemo<ReadyToGoRuntime>(() => ({ ...state, query, recommendations, autoQueryFromUrl: resolveAutoQuery, watermark: resolvedWatermark }), [query, recommendations, resolveAutoQuery, resolvedWatermark, state]);
  return <ReadyToGoRuntimeContext.Provider value={value}>{children}</ReadyToGoRuntimeContext.Provider>;
}

function useReadyToGoRuntime() { return useContext(ReadyToGoRuntimeContext); }
function RuntimeWatermark({ watermark }: { watermark?: TrackingPageWatermark }) { return watermark?.visible ? <small style={{ display: "block", marginTop: "auto", paddingTop: 28, textAlign: "center", fontSize: 12, lineHeight: "17px", fontStyle: "italic", color: "#b8b8b8" }}>{watermark.label || "Powered by BestTrack"}</small> : null; }

const heroStyle: CSSProperties = {
  ...pageFont,
  position: "relative",
  minHeight: 520,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  backgroundColor: "#fff",
  padding: "48px 24px",
  boxSizing: "border-box"
};
const editorHeroStyle: CSSProperties = {
  ...pageFont,
  position: "relative",
  display: "grid",
  placeItems: "center",
  backgroundColor: "#fff",
  padding: "48px 24px",
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
  padding: 40,
  boxSizing: "border-box",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)"
};
const editorFormCardStyle: CSSProperties = { ...formCardStyle, minHeight: 0 };
const tabStyle = (active: boolean): CSSProperties => ({
  appearance: "none",
  flex: 1,
  minHeight: 53,
  margin: 0,
  padding: "16px 10px",
  font: "inherit",
  fontSize: 15,
  lineHeight: "21px",
  fontWeight: active ? 500 : 400,
  background: "none",
  border: 0,
  borderBottom: active ? "2px solid #0f172a" : "2px solid transparent",
  borderRadius: 0,
  color: active ? "#0f172a" : "#94a3b8",
  cursor: "pointer"
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

export function ReadyToGoTextField({ value, onChange }: FieldProps) {
  return <input aria-label="Ready-to-go text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

type ReadyToGoEditorProps = BlockEditorProps<Record<string, unknown>>;

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

function eventsFrom(result: ReadyToGoTrackingResult | undefined): ReadyToGoTrackingEvent[] {
  if (result?.events?.length) return result.events;
  if (result?.latestEvent) return [{ id: "latest", title: result.latestEvent, at: result.updatedAt, state: "current" }];
  return [];
}

function ProgressResult({ result, showEstimatedDelivery = true }: { result: ReadyToGoTrackingResult; showEstimatedDelivery?: boolean }) {
  const steps = result.progress?.length ? result.progress : defaultProgress(result.status);
  return <>
    <p style={{ margin: 0, fontSize: 20, lineHeight: 1.4, color: "#000" }}>Tracking: {result.trackingNumber}</p>
    <h2 style={{ margin: "48px 0 0", fontSize: 32, lineHeight: "40px", fontWeight: 700, color: "#303030" }}>{result.status}</h2>
    {showEstimatedDelivery && result.estimatedDelivery ? <EstimatedDeliveryCard dateText={result.estimatedDelivery} /> : null}
    <TrackingProgress steps={steps} />
  </>;
}

function DeliveryResult({ heading, contentsHeading, carrierHeading, result, editor = false }: { heading: ReactNode; contentsHeading: ReactNode; carrierHeading: ReactNode; result: ReadyToGoTrackingResult; editor?: boolean }) {
  return <div style={{ ...contentWidth, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 500px))", gap: 40, justifyContent: "center", alignItems: "start" }}>
    <div>
      <h3 style={{ margin: 0, fontSize: 20, lineHeight: "20px", fontWeight: 700 }}>{heading}</h3>
      <ShippingTimeline events={eventsFrom(result)} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <TrackingPageAdSlot ad={result.ad} editor={editor} />
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
      <h1 style={{ margin: "0 0 24px", textAlign: "center", fontSize: 28, lineHeight: 1.15 }}>
        <InlineText block={block} name="heading" fallback="Track your order" />
      </h1>
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
          value={text(block, "defaultTrackingNumber", "BT-2048-DEMO")}
          onMouseDown={(event) => block.selected && event.stopPropagation()}
          onClick={(event) => block.selected && event.stopPropagation()}
          onChange={(event) => block.onPropsChange({ defaultTrackingNumber: event.currentTarget.value })}
          style={{ ...inputStyle /* , border: block.selected ? "1px dashed #111" : inputStyle.border */ }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 58, marginTop: 8, borderRadius: "var(--pb-radius, 8px)", background: "var(--pb-color-primary, #111)", color: "#fff", fontSize: 15, fontWeight: 600 }}>
          <InlineText block={block} name="submitLabel" fallback="Track Your Order" />
        </div>
      </div>
      <p style={{ marginTop: "auto", paddingTop: 28, textAlign: "center", fontSize: 12, lineHeight: "17px", fontStyle: "italic", color: "#b8b8b8" }}>Powered by BestTrack</p>
    </div>
  </section>;
}

export function ReadyToGoProgressEditor() {
  return <section aria-label="Ready-to-go progress editor" style={{ ...pageFont, background: "var(--pb-color-background, #fff)", color: "var(--pb-color-text, #0f172a)", borderBottom: "1px solid #f1f5f9" }}>
    <div style={{ ...contentWidth, textAlign: "center", width: "min(1248px, 100%)" }}>
      <ProgressResult result={previewReadyToGoTracking()} />
    </div>
  </section>;
}

export function ReadyToGoDeliveryEditor(block: ReadyToGoEditorProps) {
  return <section aria-label="Ready-to-go delivery editor" style={{ ...pageFont, background: "var(--pb-color-background, #fff)", color: "var(--pb-color-text, #0f172a)", borderBottom: "1px solid #f1f5f9" }}>
    <DeliveryResult
      heading={<InlineText block={block} name="heading" fallback="Shipping Details" />}
      contentsHeading={<InlineText block={block} name="contentsHeading" fallback="Package Contents" />}
      carrierHeading={<InlineText block={block} name="carrierHeading" fallback="Carrier" />}
      result={previewReadyToGoTracking()}
      editor
    />
  </section>;
}

export function ReadyToGoRecommendationsEditor(block: ReadyToGoEditorProps) {
  const preview = previewReadyToGoTracking();
  return <section aria-label="Ready-to-go recommendations editor" style={{ ...pageFont, background: "var(--pb-color-background, #fff)", color: "var(--pb-color-text, #0f172a)" }}>
    <div style={{ ...contentWidth, padding: "48px 24px" }}>
      <h3 style={{ margin: 0, textAlign: "center", fontSize: 20, lineHeight: "20px", fontWeight: 700 }}><InlineText block={block} name="heading" fallback="You may also like..." /></h3>
      <div style={{ marginTop: 24 }}><RecommendationCards items={preview.recommendations ?? []} /></div>
    </div>
  </section>;
}


export function ReadyToGoQueryBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const [locationState] = useState(() => runtime.autoQueryFromUrl ? readTrackingQueryLocationState() : undefined);
  const [mode, setMode] = useState<"tracking" | "order">(locationState?.tab ?? (text(props, "defaultQueryMode", "tracking") === "order" ? "order" : "tracking"));
  const [trackingNumber, setTrackingNumber] = useState(locationState?.trackingNumber || text(props, "defaultTrackingNumber", "BT-2048-DEMO"));
  const [orderNumber, setOrderNumber] = useState(locationState?.orderNumber || text(props, "defaultOrderNumber", ""));
  const [email, setEmail] = useState(locationState?.email ?? "");
  const [localError, setLocalError] = useState("");
  const autoQueryStarted = useRef(false);
  const heading = text(props, "heading");
  const submitLabel = text(props, "submitLabel", "Track Your Order");
  const trackingTabLabel = text(props, "trackingTabLabel", "Tracking Number");
  const orderTabLabel = text(props, "orderTabLabel", "Order Number");

  useEffect(() => {
    if (!locationState?.canAutoQuery || autoQueryStarted.current) return;
    autoQueryStarted.current = true;
    void runtime.query(locationState.tab === "tracking"
      ? { mode: "tracking", trackingNumber: locationState.trackingNumber }
      : { mode: "order", orderNumber: locationState.orderNumber, email: locationState.email });
  }, [locationState, runtime]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    if (mode === "order") {
      if (!orderNumber.trim() || !email.trim()) {
        setLocalError("Please enter your order number and email address");
        return;
      }
      syncTrackingQueryToUrl("order", orderNumber.trim(), email.trim());
      void runtime.query({ mode: "order", orderNumber: orderNumber.trim(), email: email.trim() });
      return;
    }
    if (!trackingNumber.trim()) {
      setLocalError("Please enter your tracking number");
      return;
    }
    syncTrackingQueryToUrl("tracking", trackingNumber.trim());
    void runtime.query({ mode: "tracking", trackingNumber: trackingNumber.trim() });
  };
  const loading = runtime.phase === "loading";
  return <section style={heroStyle}>
    <div role="region" aria-label="Ready-to-go tracking query" style={formCardStyle}>
      {heading ? <h1 style={{ margin: "0 0 24px", textAlign: "center", fontSize: 28, lineHeight: 1.15 }}>{heading}</h1> : null}
      <div role="tablist" aria-label="Tracking method" style={{ display: "flex", width: "100%", borderBottom: "1px solid #cbd5e1" }}>
        <button type="button" role="tab" aria-selected={mode === "tracking"} onClick={() => { setMode("tracking"); setLocalError(""); }} style={tabStyle(mode === "tracking")}>{trackingTabLabel}</button>
        <button type="button" role="tab" aria-selected={mode === "order"} onClick={() => { setMode("order"); setLocalError(""); }} style={tabStyle(mode === "order")}>{orderTabLabel}</button>
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
        {localError ? <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "#f43f5e" }}>{localError}</p> : null}
        <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 58, marginTop: 8, border: 0, borderRadius: "var(--pb-radius, 8px)", background: loading ? "#475569" : "var(--pb-color-primary, #111)", color: "#fff", font: "inherit", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>{loading ? "Tracking..." : submitLabel}</button>
        {runtime.phase === "error" ? <p role="alert" style={{ margin: 0, textAlign: "center", fontSize: 12, color: "#f43f5e" }}>{runtime.error}</p> : null}
      </form>
      <RuntimeWatermark watermark={runtime.watermark} />
    </div>
  </section>;
}

export function ReadyToGoProgressBlock() {
  const runtime = useReadyToGoRuntime();
  const result = runtime.result;
  if (runtime.phase === "idle") return null;
  if (runtime.phase === "empty") return <TrackingNotFound />;
  return <SectionShell title="Shipment progress">
    <div style={{ ...contentWidth, textAlign: "center", width: "min(1248px, 100%)" }}>
      {runtime.phase === "loading" ? <div aria-label="Loading shipment progress"><IdleMessage>Loading shipment progress…</IdleMessage><SkeletonRow /></div> : null}
      {runtime.phase === "error" ? <p style={{ margin: 0, color: "#b42318" }}>Shipment progress is temporarily unavailable.</p> : null}
      {runtime.phase === "success" && result ? <ProgressResult result={result} /> : null}
    </div>
  </SectionShell>;
}

export function ReadyToGoDeliveryBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  if (runtime.phase === "idle" || runtime.phase === "empty") return null;
  const heading = text(props, "heading", "Shipping Details");
  const contentsHeading = text(props, "contentsHeading", "Package Contents");
  const carrierHeading = text(props, "carrierHeading", "Carrier");
  const result = runtime.result;
  return <SectionShell title={heading}>
    {runtime.phase === "success" && result ? <DeliveryResult heading={heading} contentsHeading={contentsHeading} carrierHeading={carrierHeading} result={result} /> : <div style={{ ...contentWidth, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 500px))", gap: 40, justifyContent: "center", alignItems: "start" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 20, lineHeight: "20px", fontWeight: 700 }}>{heading}</h3>
        {runtime.phase === "loading" ? <IdleMessage>Loading delivery details…</IdleMessage> : null}
        {runtime.phase === "error" ? <p style={{ margin: "16px 0 0", color: "#b42318" }}>Delivery details are temporarily unavailable.</p> : null}
      </div>
    </div>}
  </SectionShell>;
}

export function ReadyToGoRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const heading = text(props, "heading", "You may also like...");
  const independent = runtime.recommendations.phase !== "idle";
  if (independent) {
    if (runtime.recommendations.phase !== "success" || runtime.recommendations.items.length === 0) return null;
    return <SectionShell title={heading} bordered={false}>
      <div style={{ ...contentWidth, padding: "48px 24px" }}>
        <h3 style={{ margin: 0, textAlign: "center", fontSize: 20, lineHeight: "20px", fontWeight: 700 }}>{heading}</h3>
        <div style={{ marginTop: 24 }}><RecommendationCards items={runtime.recommendations.items} /></div>
      </div>
    </SectionShell>;
  }
  if (runtime.phase === "empty") return null;
  const recommendations = runtime.result?.recommendations ?? [];
  return <SectionShell title={heading} bordered={false}>
    <div style={{ ...contentWidth, padding: "48px 24px" }}>
      <h3 style={{ margin: 0, textAlign: "center", fontSize: 20, lineHeight: "20px", fontWeight: 700 }}>{heading}</h3>
      <div style={{ marginTop: 24 }}>
        {runtime.phase === "loading" ? <IdleMessage>Loading recommendations…</IdleMessage> : null}
        {runtime.phase === "error" ? <p style={{ margin: 0, textAlign: "center", color: "#b42318" }}>Recommendations are temporarily unavailable.</p> : null}
        {runtime.phase === "idle" ? <IdleMessage>Recommendations appear with your shipment result.</IdleMessage> : null}
        {runtime.phase === "success" && recommendations.length ? <RecommendationCards items={recommendations} /> : null}
        {runtime.phase === "success" && !recommendations.length ? <IdleMessage>No recommendations are available for this shipment.</IdleMessage> : null}
      </div>
    </div>
  </SectionShell>;
}
