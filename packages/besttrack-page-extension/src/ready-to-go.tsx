import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { FieldProps } from "@standhigher/puck-page-builder/runtime";

export type ReadyToGoTrackingResult = { trackingNumber: string; status: string; carrier?: string; latestEvent?: string; updatedAt?: string; deliveryAddress?: string; recommendations?: Array<{ id: string; title: string; description: string }> };
export type ReadyToGoTrackingQuery = (trackingNumber: string) => Promise<ReadyToGoTrackingResult>;
export type ReadyToGoRuntimeState = { phase: "idle" | "loading" | "success" | "error"; result?: ReadyToGoTrackingResult; error?: string };
type ReadyToGoRuntime = ReadyToGoRuntimeState & { query(trackingNumber: string): Promise<void> };

const initialRuntime: ReadyToGoRuntime = { phase: "idle", async query() { return undefined; } };
const ReadyToGoRuntimeContext = createContext<ReadyToGoRuntime>(initialRuntime);
export type ReadyToGoRuntimeProviderProps = { children: ReactNode; queryTracking?: ReadyToGoTrackingQuery };

/** Mock is an explicit preview default, never a fallback for an injected live query. */
async function queryMockReadyToGoTracking(trackingNumber: string): Promise<ReadyToGoTrackingResult> {
  return {
    trackingNumber, status: "In transit", carrier: "BestTrack demo carrier", latestEvent: "Shipment accepted at the regional hub", updatedAt: "2026-09-17T10:00:00.000Z", deliveryAddress: "Demo recipient · Shanghai",
    recommendations: [{ id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery." }, { id: "delivery-alerts", title: "Delivery alerts", description: "Receive an update at every milestone." }]
  };
}

export function ReadyToGoRuntimeProvider({ children, queryTracking = queryMockReadyToGoTracking }: ReadyToGoRuntimeProviderProps) {
  const [state, setState] = useState<ReadyToGoRuntimeState>({ phase: "idle" });
  const query = useCallback(async (trackingNumber: string) => {
    setState({ phase: "loading" });
    try { setState({ phase: "success", result: await queryTracking(trackingNumber) }); }
    catch (error) { setState({ phase: "error", error: error instanceof Error ? error.message : "tracking-query-failed" }); }
  }, [queryTracking]);
  const value = useMemo<ReadyToGoRuntime>(() => ({ ...state, query }), [query, state]);
  return <ReadyToGoRuntimeContext.Provider value={value}>{children}</ReadyToGoRuntimeContext.Provider>;
}

function useReadyToGoRuntime() { return useContext(ReadyToGoRuntimeContext); }
const cardStyle = { border: "1px solid var(--pb-color-border)", borderRadius: "var(--pb-radius)", padding: "var(--pb-spacing)", background: "var(--pb-color-surface)", color: "var(--pb-color-text)" };
function ResultCard({ title, children }: { title: string; children: ReactNode }) { return <section aria-label={title} style={cardStyle}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }

export function ReadyToGoTextField({ value, onChange }: FieldProps) {
  return <input aria-label="Ready-to-go text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

export function ReadyToGoQueryBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const [trackingNumber, setTrackingNumber] = useState(typeof props.defaultTrackingNumber === "string" ? props.defaultTrackingNumber : "BT-2048-DEMO");
  const heading = typeof props.heading === "string" ? props.heading : "Track your order";
  const submitLabel = typeof props.submitLabel === "string" ? props.submitLabel : "Track package";
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void runtime.query(trackingNumber); };
  return <section aria-label="Ready-to-go tracking query" style={{ ...cardStyle, maxWidth: 720, margin: "0 auto" }}>
    <h1 style={{ marginTop: 0 }}>{heading}</h1>
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input aria-label="Tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} required minLength={4} maxLength={64} style={{ flex: "1 1 220px", padding: 10, borderRadius: "var(--pb-radius)", border: "1px solid var(--pb-color-border)" }} />
      <button type="submit" disabled={runtime.phase === "loading"} style={{ padding: "10px 16px", border: 0, borderRadius: "var(--pb-radius)", background: "var(--pb-color-primary)", color: "white" }}>{runtime.phase === "loading" ? "Tracking…" : submitLabel}</button>
    </form>
    {runtime.phase === "error" ? <p role="alert">{runtime.error}</p> : null}
  </section>;
}

export function ReadyToGoProgressBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const heading = typeof props.heading === "string" ? props.heading : "Shipment progress";
  return <ResultCard title={heading}>{runtime.phase === "success" ? <><strong>{runtime.result?.status}</strong><p>{runtime.result?.latestEvent}</p><small>{runtime.result?.updatedAt}</small></> : <p>{runtime.phase === "loading" ? "Loading shipment progress…" : "Enter a tracking number to see shipment progress."}</p>}</ResultCard>;
}

export function ReadyToGoDeliveryBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const heading = typeof props.heading === "string" ? props.heading : "Delivery information";
  return <ResultCard title={heading}>{runtime.phase === "success" ? <dl><dt>Carrier</dt><dd>{runtime.result?.carrier ?? "Not available"}</dd><dt>Delivery</dt><dd>{runtime.result?.deliveryAddress ?? "Delivery details are not available."}</dd></dl> : <p>Delivery details will appear after a successful query.</p>}</ResultCard>;
}

export function ReadyToGoRecommendationsBlock(props: Record<string, unknown>) {
  const runtime = useReadyToGoRuntime();
  const heading = typeof props.heading === "string" ? props.heading : "You may also like";
  const recommendations = runtime.result?.recommendations ?? [];
  return <ResultCard title={heading}>{runtime.phase === "success" && recommendations.length > 0 ? <ul>{recommendations.map((item) => <li key={item.id}><strong>{item.title}</strong><br /><small>{item.description}</small></li>)}</ul> : <p>{runtime.phase === "success" ? "No recommendations are available for this shipment." : "Recommendations appear with your shipment result."}</p>}</ResultCard>;
}
