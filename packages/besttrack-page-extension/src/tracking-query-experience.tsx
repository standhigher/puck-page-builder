import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { formatTrackingPageMoney, isValidOrderEmail, isValidOrderNumber, isValidTrackingNumber, type TrackingPageQueryRequest, type TrackingPageQueryResult, type TrackingPageRuntimePhase, type TrackingPageTrackingStep } from "./tracking-page-runtime";
import { safeTrackingPageUrl } from "./tracking-page-url";

type QueryMode = "tracking" | "order";
type FieldName = "tracking" | "order" | "email";

export type TrackingQueryCardProps = {
  phase: TrackingPageRuntimePhase;
  onQuery(request: TrackingPageQueryRequest): Promise<void>;
  heading: string;
  submitLabel: string;
  initialTrackingNumber: string;
  initialOrderNumber?: string;
  initialMode?: QueryMode;
  trackingTabLabel?: string;
  orderTabLabel?: string;
  trackingPlaceholder?: string;
  orderPlaceholder?: string;
  emailPlaceholder?: string;
  loadingLabel?: string;
  loadingMessage?: string;
  emptyMessage?: string;
  errorMessage?: string;
  trackingInputLabel?: string;
  orderInputLabel?: string;
  emailInputLabel?: string;
  cardDataAttribute?: string;
  resultDataAttribute?: string;
  resultTestId?: string;
  result?: ReactNode;
  watermark?: ReactNode;
  cardStyle: CSSProperties;
  headingStyle?: CSSProperties;
  tabListStyle?: CSSProperties;
  tabStyle?: (active: boolean) => CSSProperties;
  formStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  submitStyle?: (loading: boolean) => CSSProperties;
  messageStyle?: CSSProperties;
  resultStyle?: CSSProperties;
};

const srOnly: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0
};

const defaultTabStyle = (active: boolean): CSSProperties => ({
  minHeight: 44,
  border: 0,
  borderBottom: active ? "2px solid currentColor" : "2px solid transparent",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  fontWeight: active ? 700 : 400,
  cursor: "pointer"
});

const defaultInputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 48,
  padding: "12px 16px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  font: "inherit"
};

const defaultSubmitStyle = (loading: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 48,
  border: 0,
  borderRadius: 8,
  background: loading ? "#64748b" : "#111827",
  color: "#fff",
  font: "inherit",
  fontWeight: 700,
  cursor: loading ? "wait" : "pointer"
});

function fieldError(field: FieldName) {
  if (field === "tracking") return "Enter a valid tracking number.";
  if (field === "order") return "Enter a valid order number.";
  return "Enter a valid email address.";
}

/**
 * Shared consumer query interaction for Branded and Sales. It keeps transient
 * query input in the browser and never writes request values into PageDocument.
 */
export function TrackingQueryCard({
  phase,
  onQuery,
  heading,
  submitLabel,
  initialTrackingNumber,
  initialOrderNumber = "",
  initialMode = "tracking",
  trackingTabLabel = "Tracking Number",
  orderTabLabel = "Order Number",
  trackingPlaceholder = "Enter your tracking number",
  orderPlaceholder = "Enter your order number",
  emailPlaceholder = "Enter your email",
  loadingLabel = "Querying...",
  loadingMessage = "Checking your order...",
  emptyMessage = "We couldn't find an order or shipment for that number.",
  errorMessage = "We couldn't retrieve this order right now. Please try again later.",
  trackingInputLabel = "Tracking number",
  orderInputLabel = "Order number",
  emailInputLabel = "Email",
  cardDataAttribute,
  resultDataAttribute,
  resultTestId,
  result,
  watermark,
  cardStyle,
  headingStyle,
  tabListStyle,
  tabStyle = defaultTabStyle,
  formStyle,
  inputStyle = defaultInputStyle,
  submitStyle = defaultSubmitStyle,
  messageStyle,
  resultStyle
}: TrackingQueryCardProps) {
  const trackingInputId = useId();
  const orderInputId = useId();
  const emailInputId = useId();
  const [mode, setMode] = useState<QueryMode>(initialMode);
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const loading = phase === "loading";

  useEffect(() => {
    if (phase !== "success" && phase !== "empty" && phase !== "error") return;
    const card = cardRef.current;
    const resultNode = resultRef.current;
    if (!card || !resultNode || typeof card.scrollTo !== "function") return;
    card.scrollTo({ top: Math.max(0, resultNode.offsetTop - card.offsetTop - 16), behavior: "smooth" });
  }, [phase, result]);

  const focusField = (field: FieldName) => {
    const input = field === "tracking" ? trackingInputRef.current : field === "order" ? orderInputRef.current : emailInputRef.current;
    input?.focus();
  };

  const setActiveMode = (nextMode: QueryMode) => {
    setMode(nextMode);
    setErrors({});
  };

  const clearError = (field: FieldName) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Partial<Record<FieldName, string>> = {};
    const normalizedTrackingNumber = trackingNumber.trim();
    const normalizedOrderNumber = orderNumber.trim();
    const normalizedEmail = email.trim();
    if (mode === "tracking" && !isValidTrackingNumber(normalizedTrackingNumber)) nextErrors.tracking = fieldError("tracking");
    if (mode === "order" && !isValidOrderNumber(normalizedOrderNumber)) nextErrors.order = fieldError("order");
    if (mode === "order" && !isValidOrderEmail(normalizedEmail)) nextErrors.email = fieldError("email");
    const firstInvalidField = mode === "tracking" ? "tracking" : nextErrors.order ? "order" : nextErrors.email ? "email" : undefined;
    if (firstInvalidField && nextErrors[firstInvalidField]) {
      setErrors(nextErrors);
      focusField(firstInvalidField);
      return;
    }
    setErrors({});
    void onQuery(mode === "tracking"
      ? { mode, trackingNumber: normalizedTrackingNumber }
      : { mode, orderNumber: normalizedOrderNumber, email: normalizedEmail });
  };

  const errorFor = (field: FieldName) => errors[field];
  const inputWithError = (field: FieldName): CSSProperties => ({ ...inputStyle, borderColor: errorFor(field) ? "#b42318" : inputStyle.borderColor ?? "#cbd5e1" });
  const message = phase === "loading" ? loadingMessage : phase === "empty" ? emptyMessage : phase === "error" ? errorMessage : undefined;
  const cardData = cardDataAttribute ? { [cardDataAttribute]: "true" } : {};
  const resultData = resultDataAttribute ? { [resultDataAttribute]: "true" } : {};

  return <div ref={cardRef} data-tracking-query-card {...cardData} style={{ ...cardStyle, overflowY: "auto" }}>
    <h1 style={{ margin: "0 0 28px", textAlign: "center", ...headingStyle }}>{heading}</h1>
    <div role="tablist" aria-label="Tracking method" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #cbd5e1", marginBottom: 18, ...tabListStyle }}>
      <button type="button" role="tab" aria-selected={mode === "tracking"} onClick={() => setActiveMode("tracking")} style={tabStyle(mode === "tracking")}>{trackingTabLabel}</button>
      <button type="button" role="tab" aria-selected={mode === "order"} onClick={() => setActiveMode("order")} style={tabStyle(mode === "order")}>{orderTabLabel}</button>
    </div>
    <form noValidate onSubmit={submit} style={{ display: "grid", gap: 12, ...formStyle }}>
      {mode === "tracking" ? <div>
        <label htmlFor={trackingInputId} style={srOnly}>{trackingInputLabel}</label>
        <input ref={trackingInputRef} id={trackingInputId} aria-label={trackingInputLabel} aria-invalid={Boolean(errorFor("tracking"))} aria-describedby={errorFor("tracking") ? trackingInputId + "-error" : undefined} value={trackingNumber} onChange={(event) => { setTrackingNumber(event.target.value); clearError("tracking"); }} placeholder={trackingPlaceholder} style={inputWithError("tracking")} />
        {errorFor("tracking") ? <p id={trackingInputId + "-error"} role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 13 }}>{errorFor("tracking")}</p> : null}
      </div> : <>
        <div>
          <label htmlFor={orderInputId} style={srOnly}>{orderInputLabel}</label>
          <input ref={orderInputRef} id={orderInputId} aria-label={orderInputLabel} aria-invalid={Boolean(errorFor("order"))} aria-describedby={errorFor("order") ? orderInputId + "-error" : undefined} value={orderNumber} onChange={(event) => { setOrderNumber(event.target.value); clearError("order"); }} placeholder={orderPlaceholder} style={inputWithError("order")} />
          {errorFor("order") ? <p id={orderInputId + "-error"} role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 13 }}>{errorFor("order")}</p> : null}
        </div>
        <div>
          <label htmlFor={emailInputId} style={srOnly}>{emailInputLabel}</label>
          <input ref={emailInputRef} id={emailInputId} type="email" aria-label={emailInputLabel} aria-invalid={Boolean(errorFor("email"))} aria-describedby={errorFor("email") ? emailInputId + "-error" : undefined} value={email} onChange={(event) => { setEmail(event.target.value); clearError("email"); }} placeholder={emailPlaceholder} style={inputWithError("email")} />
          {errorFor("email") ? <p id={emailInputId + "-error"} role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 13 }}>{errorFor("email")}</p> : null}
        </div>
      </>}
      <button type="submit" disabled={loading} style={submitStyle(loading)}>{loading ? loadingLabel : submitLabel}</button>
    </form>
    {message ? <p role={phase === "error" ? "alert" : "status"} aria-live={phase === "error" ? "assertive" : "polite"} style={{ margin: "16px 0 0", color: phase === "error" ? "#b42318" : "#64748b", ...messageStyle }}>{message}</p> : null}
    {phase === "success" && result ? <div ref={resultRef} data-tracking-query-result {...resultData} data-testid={resultTestId} tabIndex={-1} style={{ marginTop: 20, ...resultStyle }}>{result}</div> : null}
    {(phase === "empty" || phase === "error") ? <div ref={resultRef} data-tracking-query-result {...resultData} data-testid={resultTestId} tabIndex={-1} /> : null}
    {watermark}
  </div>;
}

function defaultProgress(status: string): TrackingPageTrackingStep[] {
  const steps: Array<Pick<TrackingPageTrackingStep, "id" | "label" | "icon">> = [
    { id: "ordered", label: "Ordered", icon: "check" },
    { id: "ready", label: "Order Ready", icon: "bag" },
    { id: "transit", label: "In Transit", icon: "truck" },
    { id: "out", label: "Out for Delivery", icon: "box" },
    { id: "delivered", label: "Delivered", icon: "check" }
  ];
  const normalized = status.toLowerCase();
  const current = normalized.includes("deliver") ? (normalized.includes("out for") ? 3 : 4) : normalized.includes("transit") ? 2 : normalized.includes("ready") ? 1 : 0;
  return steps.map((step, index) => ({ ...step, state: index < current ? "complete" : index === current ? "current" : "upcoming" }));
}

function TrackingProgressDetails({ steps }: { steps: TrackingPageTrackingStep[] }) {
  return <ol aria-label="Delivery progress" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4, margin: "20px 0 0", padding: 0, listStyle: "none" }}>
    {steps.slice(0, 5).map((step, index) => <li key={step.id} style={{ minWidth: 0, textAlign: "center", color: step.state === "upcoming" ? "#64748b" : "#0f172a" }}>
      <span aria-label={step.label + " " + step.state} style={{ display: "grid", placeItems: "center", width: 28, height: 28, margin: "0 auto", border: "1px solid " + (step.state === "upcoming" ? "#94a3b8" : "#0f172a"), borderRadius: "50%", background: step.state === "current" ? "#0f172a" : "#fff", color: step.state === "current" ? "#fff" : "#0f172a", fontSize: 13, fontWeight: 700 }}>{step.state === "complete" || step.state === "current" ? "✓" : index + 1}</span>
      <span style={{ display: "block", marginTop: 6, overflowWrap: "anywhere", fontSize: 11, lineHeight: 1.25 }}>{step.label}</span>
      {step.date ? <span style={{ display: "block", marginTop: 3, color: "#94a3b8", fontSize: 10, lineHeight: 1.2 }}>{step.date}</span> : null}
    </li>)}
  </ol>;
}

function TrackingEvents({ result }: { result: TrackingPageQueryResult }) {
  const [expanded, setExpanded] = useState(false);
  const events = result.events ?? (result.latestEvent ? [{ id: "latest", title: result.latestEvent, at: result.updatedAt, state: "current" as const }] : []);
  if (!events.length) return <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 14 }}>Tracking events are not available yet. Please try again later.</p>;
  const visibleEvents = events.slice(0, expanded ? 50 : 3);
  return <div aria-label="Shipping events" style={{ marginTop: 16 }}>
    <ol style={{ display: "grid", gap: 14, margin: 0, padding: 0, listStyle: "none" }}>
      {visibleEvents.map((event, index) => <li key={event.id} style={{ position: "relative", paddingLeft: 22 }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 4, width: 10, height: 10, borderRadius: "50%", background: event.state === "current" || index === 0 ? "#111827" : "#cbd5e1" }} />
        <strong style={{ display: "block", fontSize: 14 }}>{event.title}</strong>
        {event.detail ? <span style={{ display: "block", marginTop: 2, color: "#64748b", fontSize: 13 }}>{event.detail}</span> : null}
        {event.at ? <time style={{ display: "block", marginTop: 3, color: "#94a3b8", fontSize: 12 }}>{event.at}</time> : null}
      </li>)}
    </ol>
    {events.length > 3 ? <button type="button" onClick={() => setExpanded((current) => !current)} style={{ minHeight: 44, marginTop: 14, padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#0f172a", font: "inherit", fontSize: 13, cursor: "pointer" }}>{expanded ? "Show recent events" : "Show all events"}</button> : null}
  </div>;
}

function TrackingOrderItemImage({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = safeTrackingPageUrl(src);
  if (!imageUrl || failed) return <span aria-label={title + " image unavailable"} style={{ display: "grid", width: 56, height: 56, placeItems: "center", borderRadius: 6, background: "#e2e8f0", color: "#64748b", fontSize: 13 }}>{title.slice(0, 1).toUpperCase()}</span>;
  return <img src={imageUrl} alt="" onError={() => setFailed(true)} style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", background: "#f1f5f9" }} />;
}

function TrackingOrderItems({ items }: { items: NonNullable<TrackingPageQueryResult["orderItems"]> }) {
  if (!items.length) return null;
  return <section aria-label="Order items" style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 18 }}>
    <h2 style={{ margin: 0, fontSize: 16 }}>Items in your order</h2>
    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
      {items.map((item) => {
        const price = item.price ? formatTrackingPageMoney(item.price) : undefined;
        const href = safeTrackingPageUrl(item.href);
        return <article key={item.id} style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 12, alignItems: "center" }}>
          <TrackingOrderItemImage src={item.imageUrl} title={item.title} />
          <div style={{ minWidth: 0 }}>
            {href ? <a href={href} style={{ color: "inherit", fontWeight: 700, overflowWrap: "anywhere" }}>{item.title}</a> : <strong style={{ overflowWrap: "anywhere" }}>{item.title}</strong>}
            {item.description ? <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13 }}>{item.description}</p> : null}
            <p style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 0", color: "#475569", fontSize: 13 }}><span>Qty {item.quantity}</span>{price?.amount ? <span>{price.amount}{price.startsAt ? " and up" : ""}</span> : null}{price?.compareAt ? <s style={{ color: "#94a3b8" }}>{price.compareAt}</s> : null}</p>
          </div>
        </article>;
      })}
    </div>
  </section>;
}

/** Complete, display-safe tracking result for Branded and Sales query cards. */
export function TrackingQueryResultDetails({ result, onTrackAnother, trackAnotherLabel = "Track another" }: { result: TrackingPageQueryResult; onTrackAnother?: () => void; trackAnotherLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const progress = result.progress?.length === 5 ? result.progress : defaultProgress(result.status);
  const copyTrackingNumber = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(result.trackingNumber).then(() => setCopied(true)).catch(() => undefined);
    }
  };
  return <section aria-label="Tracking result details">
    <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
      <div><strong style={{ fontSize: 17 }}>Your order is {result.status || "being updated"}</strong>{result.estimatedDelivery ? <p style={{ margin: "5px 0 0", color: "#475569", fontSize: 14 }}>Estimated delivery: {result.estimatedDelivery}</p> : null}</div>
      {onTrackAnother ? <button type="button" onClick={onTrackAnother} style={{ minHeight: 44, flex: "0 0 auto", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#0f172a", font: "inherit", fontSize: 12, cursor: "pointer" }}>{trackAnotherLabel}</button> : null}
    </div>
    <TrackingProgressDetails steps={progress} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 22, padding: 12, borderRadius: 8, background: "#f8fafc", color: "#334155", fontSize: 13 }}>
      <span><strong>Carrier</strong><br />{result.carrier || "—"}</span>
      <span><strong>Tracking number</strong><br />{result.trackingNumber} <button type="button" onClick={copyTrackingNumber} style={{ minHeight: 44, border: 0, background: "transparent", color: "#0f172a", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{copied ? "Copied" : "Copy"}</button></span>
      <span><strong>Destination</strong><br />{result.destination || "—"}</span>
      <span><strong>Transit time</strong><br />{result.transitDuration || "—"}</span>
      {result.orderNumber ? <span><strong>Order number</strong><br />{result.orderNumber}</span> : null}
    </div>
    <section aria-label="Tracking timeline" style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 18 }}><h2 style={{ margin: 0, fontSize: 16 }}>Tracking timeline</h2><TrackingEvents result={result} /></section>
    <TrackingOrderItems items={result.orderItems ?? []} />
  </section>;
}
