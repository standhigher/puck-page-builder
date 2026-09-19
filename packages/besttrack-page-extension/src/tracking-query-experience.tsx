import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { isValidOrderEmail, isValidOrderNumber, isValidTrackingNumber, type TrackingPageQueryRequest, type TrackingPageQueryResult, type TrackingPageRuntimePhase } from "./tracking-page-runtime";

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

/** Compact, display-safe summary used within the query card before detailed modules render. */
export function TrackingQueryResultSummary({ result }: { result: TrackingPageQueryResult }) {
  const delivery = result.estimatedDelivery || result.updatedAt;
  return <div>
    <strong>Current status: {result.status || "Tracking update"}</strong>
    {delivery ? <p style={{ margin: "6px 0 0", color: "#64748b" }}>{result.estimatedDelivery ? "Estimated delivery: " : "Updated: "}{delivery}</p> : null}
    <p style={{ margin: "6px 0 0", color: "#64748b" }}>Tracking number: {result.trackingNumber || "Not available"}</p>
    {result.carrier ? <p style={{ margin: "6px 0 0", color: "#64748b" }}>Carrier: {result.carrier}</p> : null}
    {result.latestEvent ? <p style={{ margin: "6px 0 0", color: "#64748b" }}>{result.latestEvent}</p> : null}
  </div>;
}
