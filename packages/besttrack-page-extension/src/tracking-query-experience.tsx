import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { formatTrackingPageMoney, type TrackingPageQueryRequest, type TrackingPageQueryResult, type TrackingPageRuntimePhase, type TrackingPageTrackingStep } from "./tracking-page-runtime";
import { safeTrackingPageUrl } from "./tracking-page-url";
import { TrackingLoading } from "./tracking-loading";
import { TrackingNotFound } from "./tracking-not-found";
import { TrackPageOrderBadges, TrackPageQueryNumber, TrackingPageAdSlot } from "./track-page-display";
import { useTrackingRuntime } from "./tracking-runtime";
import { useTrackingQueryForm } from "./tracking-query-form";
import { trackingEvents, trackingSelection, trackingSteps, trackingBlockState } from "./tracking-block-model";

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
  /** 兼容旧调用参数；空结果已统一由 TrackingNotFound 呈现，不再使用各模板的独立提示。 */
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

/**
 * Branded、Sales 共用的查询卡片，业务控制继续复用 Ready-to-go 的 useTrackingQueryForm。
 * 此层负责各模板传入的样式、键盘焦点和卡片内滚动，不重新实现校验或查询缓存。
 * 消费者输入由共用表单管理，提交时同步查询 URL，不会通过编辑器接口写入 PageDocument。
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
  const trackingTabId = useId();
  const orderTabId = useId();
  const tabPanelId = useId();
  const queryStatusId = useId();
  // 显式传入 onQuery/phase 兼容卡片单独使用；在模板中，它们就是同一公共 Runtime 的入口和状态。
  const { mode, setMode, trackingNumber, setTrackingNumber, orderNumber, setOrderNumber, email, setEmail, localError, firstInvalidField, loading, submit } = useTrackingQueryForm({ initialTrackingNumber, initialOrderNumber, initialMode, onQuery, phase });
  const cardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<QueryMode, HTMLButtonElement | null>>({ tracking: null, order: null });
  // success/empty/error 都有结果反馈；idle/loading 不保留上一笔结果区。
  // 空结果用未找到组件，错误则分别提示进度和配送不可用，与 Ready-to-go 的区块语义一致。
  const visibility = trackingBlockState({ phase });
  const terminalPhase = visibility.showProgress;

  // 卡片有独立滚动容器，因此结果出现后滚动卡片并聚焦结果，而不是滚动整页。
  useEffect(() => {
    if (!terminalPhase) return;
    const card = cardRef.current;
    const resultNode = resultRef.current;
    if (card && resultNode && typeof card.scrollTo === "function") {
      card.scrollTo({ top: Math.max(0, resultNode.offsetTop - card.offsetTop - 16), behavior: "smooth" });
    }
    resultNode?.focus({ preventScroll: true });
  }, [phase, terminalPhase]);

  // 共用表单只返回第一个非空校验失败的字段；卡片把焦点和错误描述关联到该输入框。
  useEffect(() => {
    const input = firstInvalidField === "tracking" ? trackingInputRef.current : firstInvalidField === "order" ? orderInputRef.current : firstInvalidField === "email" ? emailInputRef.current : null;
    input?.focus();
  }, [firstInvalidField, localError]);

  const setActiveMode = (nextMode: QueryMode, moveFocus = false) => {
    setMode(nextMode);
    if (moveFocus) tabRefs.current[nextMode]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentMode: QueryMode) => {
    const modes: QueryMode[] = ["tracking", "order"];
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = event.key === "ArrowRight" ? modes[(currentIndex + 1) % modes.length]
      : event.key === "ArrowLeft" ? modes[(currentIndex - 1 + modes.length) % modes.length]
        : event.key === "Home" ? modes[0]
          : event.key === "End" ? modes[modes.length - 1]
            : undefined;
    if (!nextMode) return;
    event.preventDefault();
    setActiveMode(nextMode, true);
  };

  // 输入修改只更新值，提示随共用表单的重新提交/模式切换/历史恢复清除；不另设逐字段错误状态。
  const errorFor = (field: FieldName) => firstInvalidField === field ? localError : undefined;
  const inputWithError = (field: FieldName): CSSProperties => ({ ...inputStyle, borderColor: errorFor(field) ? "#b42318" : inputStyle.borderColor ?? "#cbd5e1" });
  const message = visibility.showUnavailable ? errorMessage : undefined;
  const cardData = cardDataAttribute ? { [cardDataAttribute]: "true" } : {};
  const resultData = resultDataAttribute ? { [resultDataAttribute]: "true" } : {};

  const activeTabId = mode === "tracking" ? trackingTabId : orderTabId;
  const resultLabel = visibility.showResult ? "Tracking result" : "Tracking query status";

  // 表单保留 noValidate：email 输入类型用于输入体验，实际提交统一执行 Ready-to-go 的非空校验。
  return <div ref={cardRef} data-tracking-query-card {...cardData} aria-busy={loading || undefined} style={{ boxSizing: "border-box", minWidth: 0, maxWidth: "100%", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", scrollPaddingBlock: 16, ...cardStyle }}>
    <h1 style={{ margin: "0 0 28px", textAlign: "center", ...headingStyle }}>{heading}</h1>
    <div role="tablist" aria-label="Tracking method" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #cbd5e1", marginBottom: 18, ...tabListStyle }}>
      <button ref={(element) => { tabRefs.current.tracking = element; }} id={trackingTabId} type="button" role="tab" aria-selected={mode === "tracking"} aria-controls={tabPanelId} tabIndex={mode === "tracking" ? 0 : -1} onClick={() => setActiveMode("tracking")} onKeyDown={(event) => onTabKeyDown(event, "tracking")} style={tabStyle(mode === "tracking")}>{trackingTabLabel}</button>
      <button ref={(element) => { tabRefs.current.order = element; }} id={orderTabId} type="button" role="tab" aria-selected={mode === "order"} aria-controls={tabPanelId} tabIndex={mode === "order" ? 0 : -1} onClick={() => setActiveMode("order")} onKeyDown={(event) => onTabKeyDown(event, "order")} style={tabStyle(mode === "order")}>{orderTabLabel}</button>
    </div>
    <div id={tabPanelId} role="tabpanel" aria-labelledby={activeTabId}>
    <form noValidate onSubmit={submit} style={{ display: "grid", gap: 12, minWidth: 0, ...formStyle }}>
      {mode === "tracking" ? <div>
        <label htmlFor={trackingInputId} style={srOnly}>{trackingInputLabel}</label>
        <input ref={trackingInputRef} id={trackingInputId} aria-label={trackingInputLabel} aria-invalid={Boolean(errorFor("tracking"))} aria-describedby={errorFor("tracking") ? trackingInputId + "-error" : undefined} value={trackingNumber} onChange={(event) => { setTrackingNumber(event.target.value); }} placeholder={trackingPlaceholder} style={inputWithError("tracking")} />
        {errorFor("tracking") ? <p id={trackingInputId + "-error"} role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 13 }}>{errorFor("tracking")}</p> : null}
      </div> : <>
        <div>
          <label htmlFor={orderInputId} style={srOnly}>{orderInputLabel}</label>
          <input ref={orderInputRef} id={orderInputId} aria-label={orderInputLabel} aria-invalid={Boolean(errorFor("order"))} aria-describedby={errorFor("order") ? orderInputId + "-error" : undefined} value={orderNumber} onChange={(event) => { setOrderNumber(event.target.value); }} placeholder={orderPlaceholder} style={inputWithError("order")} />
          {errorFor("order") ? <p id={orderInputId + "-error"} role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 13 }}>{errorFor("order")}</p> : null}
        </div>
        <div>
          <label htmlFor={emailInputId} style={srOnly}>{emailInputLabel}</label>
          <input ref={emailInputRef} id={emailInputId} type="email" aria-label={emailInputLabel} aria-invalid={Boolean(errorFor("email"))} aria-describedby={errorFor("email") ? emailInputId + "-error" : undefined} value={email} onChange={(event) => { setEmail(event.target.value); }} placeholder={emailPlaceholder} style={inputWithError("email")} />
          {errorFor("email") ? <p id={emailInputId + "-error"} role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 13 }}>{errorFor("email")}</p> : null}
        </div>
      </>}
      <button type="submit" disabled={loading} style={submitStyle(loading)}>{submitLabel}</button>
    </form>
    </div>
    {message ? <p id={queryStatusId} role="alert" aria-live="assertive" style={{ margin: "16px 0 0", color: "#b42318", ...messageStyle }}>{message}</p> : null}
    {visibility.showResult ? <p id={queryStatusId} role="status" aria-live="polite" style={srOnly}>Tracking details loaded.</p> : null}
    {terminalPhase ? <div ref={resultRef} role="region" aria-label={resultLabel} aria-describedby={queryStatusId} data-tracking-query-result {...resultData} data-testid={resultTestId} tabIndex={-1} style={{ minWidth: 0, overflowWrap: "anywhere", marginTop: visibility.showResult ? 20 : 0, ...resultStyle }}>{visibility.showResult ? result : visibility.showNotFound ? <div id={queryStatusId}><TrackingNotFound /></div> : <><section aria-label="Shipment progress"><p style={{ color: "#b42318" }}>Shipment progress is temporarily unavailable.</p></section><section aria-label="Shipping Details"><p style={{ color: "#b42318" }}>Delivery details are temporarily unavailable.</p></section></>}</div> : null}
    {watermark}
    {loading ? <TrackingLoading /> : null}
  </div>;
}

// 节点数量由共用模型/接口结果决定，卡片完整展示，不再固定截取五个节点。
function TrackingProgressDetails({ steps }: { steps: TrackingPageTrackingStep[] }) {
  return <ol aria-label="Delivery progress" style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: 4, margin: "20px 0 0", padding: 0, listStyle: "none" }}>
    {steps.map((step, index) => <li key={step.id} style={{ minWidth: 0, textAlign: "center", color: step.state === "upcoming" ? "#64748b" : "#0f172a" }}>
      <span aria-label={step.label + " " + step.state} style={{ display: "grid", placeItems: "center", width: 28, height: 28, margin: "0 auto", border: "1px solid " + (step.state === "upcoming" ? "#94a3b8" : "#0f172a"), borderRadius: "50%", background: step.state === "current" ? "#0f172a" : "#fff", color: step.state === "current" ? "#fff" : "#0f172a", fontSize: 13, fontWeight: 700 }}>{step.state === "complete" || step.state === "current" ? "✓" : index + 1}</span>
      <span style={{ display: "block", marginTop: 6, overflowWrap: "anywhere", fontSize: 11, lineHeight: 1.25 }}>{step.label}</span>
      {step.date ? <span style={{ display: "block", marginTop: 3, color: "#94a3b8", fontSize: 10, lineHeight: 1.2 }}>{step.date}</span> : null}
    </li>)}
  </ol>;
}

function TrackingEvents({ result }: { result: TrackingPageQueryResult }) {
  // 有完整事件时全部展示；事件列表为空或缺失时，由共用模型尝试使用 latestEvent 摘要。
  const events = trackingEvents(result);
  if (!events.length) return <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: 14 }}>Tracking events are not available yet. Please try again later.</p>;
  return <div aria-label="Shipping events" style={{ marginTop: 16 }}>
    <ol style={{ display: "grid", gap: 14, margin: 0, padding: 0, listStyle: "none" }}>
      {events.map((event, index) => <li key={event.id} style={{ position: "relative", minWidth: 0, paddingLeft: 22, overflowWrap: "anywhere" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 4, width: 10, height: 10, borderRadius: "50%", background: event.state === "current" || index === 0 ? "#111827" : "#cbd5e1" }} />
        <strong style={{ display: "block", fontSize: 14 }}>{event.title}</strong>
        {event.detail ? <span style={{ display: "block", marginTop: 2, color: "#64748b", fontSize: 13 }}>{event.detail}</span> : null}
        {event.at ? <time style={{ display: "block", marginTop: 3, color: "#94a3b8", fontSize: 12 }}>{event.at}</time> : null}
      </li>)}
    </ol>
  </div>;
}

function TrackingOrderItemImage({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = safeTrackingPageUrl(src);
  if (!imageUrl || failed) return <span aria-label={title + " image unavailable"} style={{ display: "grid", width: 56, height: 56, placeItems: "center", borderRadius: 6, background: "#e2e8f0", color: "#64748b", fontSize: 13 }}>{title.slice(0, 1).toUpperCase()}</span>;
  return <img src={imageUrl} alt="" onError={() => setFailed(true)} style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", background: "#f1f5f9" }} />;
}

// 商品明细属于必要配送能力；成功结果缺少商品时保留标题与说明，避免误以为区块被移除。
function TrackingOrderItems({ items }: { items: NonNullable<TrackingPageQueryResult["orderItems"]> }) {
  return <section aria-label="Order items" style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 18 }}>
    <h2 style={{ margin: 0, fontSize: 16 }}>Items in your order</h2>
    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
      {!items.length ? <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Package contents are not available for this shipment.</p> : null}
      {items.map((item) => {
        const price = item.price ? formatTrackingPageMoney(item.price) : undefined;
        // Reorder 与商品标题共用这个安全链接，仅提供跳转，不会直接创建订单或执行加购。
        const href = safeTrackingPageUrl(item.href);
        return <article key={item.id} style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 12, alignItems: "center" }}>
          <TrackingOrderItemImage src={item.imageUrl} title={item.title} />
          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {href ? <a href={href} style={{ color: "inherit", fontWeight: 700, overflowWrap: "anywhere" }}>{item.title}</a> : <strong style={{ overflowWrap: "anywhere" }}>{item.title}</strong>}
            {item.description ? <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13 }}>{item.description}</p> : null}
            <p style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 0", color: "#475569", fontSize: 13 }}><span>Qty {item.quantity}</span>{price?.amount ? <span>{price.amount}{price.startsAt ? " and up" : ""}</span> : null}{price?.compareAt ? <s style={{ color: "#94a3b8" }}>{price.compareAt}</s> : null}</p>
            {href ? <a href={href} style={{ display: "inline-flex", alignItems: "center", minHeight: 32, marginTop: 6, padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 6, color: "inherit", fontSize: 13 }}>Reorder</a> : null}
          </div>
        </article>;
      })}
    </div>
  </section>;
}

/**
 * Branded、Sales 卡片中的完整结果视图：历史查询、包裹选择、进度、配送及商品共用数据规则。
 * 第一层历史最多三条，点击从 Runtime 恢复缓存；第二层取当前 result.shipments，数量大于一
 * 就允许切换，与表单当前模式无关。showShipments 仅供 Branded 把第二层放到 Hero 外部。
 * result 已包含选中包裹的字段，因此时间线、广告、承运商和商品随同一次选择更新。
 * 承运商/目的地为 null 或 undefined 时使用 Ready-to-go 的缺省说明，不把空字符串也视为缺失。
 * 广告图片缺失、无效或加载失败时，由公共广告组件隐藏该子区域。
 */
export function TrackingQueryResultDetails({ result, onTrackAnother, trackAnotherLabel = "Track another", showShipments = true }: { result: TrackingPageQueryResult; onTrackAnother?: () => void; trackAnotherLabel?: string; showShipments?: boolean }) {
  const [copied, setCopied] = useState(false);
  const runtime = useTrackingRuntime();
  // 预计送达沿用共用预览规则：autoQueryDemo 时隐藏，正式结果也必须实际包含日期才展示。
  const visibility = trackingBlockState(runtime);
  // 不要求接口恰好返回五个节点：只要节点列表非空就完整展示，缺失时才生成共用默认进度。
  const progress = trackingSteps(result);
  const { identity, shipmentValues } = trackingSelection(result, runtime.recentQueries);
  const copyTrackingNumber = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(result.trackingNumber).then(() => setCopied(true)).catch(() => undefined);
    }
  };
  return <section aria-label="Tracking result details" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    {identity.values.length > 1
      ? <TrackPageOrderBadges values={identity.values} selectedIndex={runtime.selectedRecentIndex} onSelect={runtime.selectRecentQuery} style={{ marginBottom: 16 }} />
      : identity.values[0] ? <div style={{ marginBottom: 16 }}><TrackPageQueryNumber mode={identity.mode} value={identity.values[0]} /></div> : null}
    {showShipments && shipmentValues.length > 1 ? <TrackPageOrderBadges values={shipmentValues} selectedIndex={runtime.selectedShipmentIndex} onSelect={runtime.selectShipment} style={{ marginBottom: 16 }} /> : null}
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0, flex: "1 1 180px" }}><strong style={{ fontSize: 17 }}>Your order is {result.status || "being updated"}</strong>{visibility.showEstimatedDelivery && result.estimatedDelivery ? <p style={{ margin: "5px 0 0", color: "#475569", fontSize: 14 }}>Estimated delivery: {result.estimatedDelivery}</p> : null}</div>
      {onTrackAnother ? <button type="button" onClick={onTrackAnother} style={{ minWidth: 44, minHeight: 44, flex: "0 0 auto", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#0f172a", font: "inherit", fontSize: 12, cursor: "pointer" }}>{trackAnotherLabel}</button> : null}
    </div>
    <TrackingProgressDetails steps={progress} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 10, marginTop: 22, padding: 12, borderRadius: 8, background: "#f8fafc", color: "#334155", fontSize: 13 }}>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>Carrier</strong><br />{result.carrier ?? "Not available"}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>Tracking number</strong><br /><span>{result.trackingNumber}</span> <button type="button" onClick={copyTrackingNumber} style={{ minWidth: 44, minHeight: 44, border: 0, background: "transparent", color: "#0f172a", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{copied ? "Copied" : "Copy"}</button></span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>Destination</strong><br />{result.destination ?? "Destination details are not available."}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>Transit time</strong><br />{result.transitDuration || "—"}</span>
      {result.orderNumber ? <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>Order number</strong><br />{result.orderNumber}</span> : null}
    </div>
    <section aria-label="Tracking timeline" style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 18 }}><h2 style={{ margin: 0, fontSize: 16 }}>Tracking timeline</h2><TrackingEvents result={result} /></section>
    <TrackingPageAdSlot ad={result.ad} />
    <TrackingOrderItems items={result.orderItems ?? []} />
  </section>;
}
