import { useEffect, useRef, useState, type FormEvent } from "react";
import { readTrackingQueryLocationState, syncTrackingQueryToUrl } from "./shopify-track-query";
import type { TrackingPageQueryRequest, TrackingPageRuntimePhase } from "./tracking-page-runtime";
import { useTrackingRuntime } from "./tracking-runtime";

type QueryMode = "tracking" | "order";
type FieldName = "tracking" | "order" | "email";

/** 三套模板共用 Ready-to-go 的输入与提交规则；样式、滚动容器由调用方通过界面和 onComplete 决定。 */
export function useTrackingQueryForm({ initialTrackingNumber, initialOrderNumber = "", initialMode = "tracking", onComplete, onQuery, phase }: {
  initialTrackingNumber: string;
  initialOrderNumber?: string;
  initialMode?: QueryMode;
  onComplete?: () => void;
  onQuery?: (request: TrackingPageQueryRequest) => Promise<void>;
  phase?: TrackingPageRuntimePhase;
}) {
  const runtime = useTrackingRuntime();
  // 独立查询卡片可显式传入查询函数/阶段；放在页面 Provider 下时默认订阅共用状态。
  const query = onQuery ?? runtime.query;
  const loading = (phase ?? runtime.phase) === "loading";
  // 深链仅在挂载时读取，且必须由 Runtime 开启；后续编辑输入不会被 URL 再次覆盖。
  const [locationState] = useState(() => runtime.autoQueryFromUrl ? readTrackingQueryLocationState() : undefined);
  const [mode, updateMode] = useState<QueryMode>(locationState?.tab ?? initialMode);
  const [trackingNumber, setTrackingNumber] = useState(locationState?.trackingNumber || initialTrackingNumber);
  const [orderNumber, setOrderNumber] = useState(locationState?.orderNumber || initialOrderNumber);
  const [email, setEmail] = useState(locationState?.email ?? "");
  const [localError, setLocalError] = useState("");
  const [firstInvalidField, setFirstInvalidField] = useState<FieldName>();
  const autoQueryStarted = useRef(false);
  // 演示自动查询固定使用初始编号，不能随着用户输入下一笔编号而重新触发。
  const previewDemoTrackingNumber = useRef(trackingNumber);
  const selected = runtime.recentQueries[runtime.selectedRecentIndex];
  const [lastSelectionRevision, setLastSelectionRevision] = useState(runtime.selectionRevision);

  // 只有显式点击第一层历史记录才回填输入；查询完成、切换包裹不会覆盖用户正在编辑的下一笔。
  // 用 revision 而非索引判断，保证再次点击当前历史项也能恢复；未激活模式的输入继续保留。
  if (lastSelectionRevision !== runtime.selectionRevision) {
    setLastSelectionRevision(runtime.selectionRevision);
    if (selected) {
      updateMode(selected.mode);
      setLocalError("");
      setFirstInvalidField(undefined);
      if (selected.mode === "tracking") setTrackingNumber(selected.value);
      else {
        setOrderNumber(selected.value);
        setEmail(selected.email ?? "");
      }
    }
  }

  useEffect(() => {
    if (autoQueryStarted.current) return;
    if (locationState?.canAutoQuery) {
      // 有完整可查询深链时优先执行；同一次挂载不再追加演示查询。
      autoQueryStarted.current = true;
      void query(locationState.tab === "tracking"
        ? { mode: "tracking", trackingNumber: locationState.trackingNumber }
        : { mode: "order", orderNumber: locationState.orderNumber, email: locationState.email })
        .finally(onComplete);
      return;
    }
    // 输入框不再预填演示号。预览仍要自动查一单时，空输入改查这个内部编号，不写回输入框。
    const demoTrackingNumber = previewDemoTrackingNumber.current.trim() || "BT-2048-DEMO";
    if (!runtime.autoQueryDemo) return;
    autoQueryStarted.current = true;
    // 演示路径固定查初始运单号，不触发 onComplete 滚动，避免预览一打开就自动跳离查询区。
    void query({ mode: "tracking", trackingNumber: demoTrackingNumber });
  }, [locationState, onComplete, query, runtime.autoQueryDemo]);

  const setMode = (next: QueryMode) => {
    // 切换输入模式只清除表单校验提示，保留两个模式的输入，也不改变当前已展示的查询结果。
    updateMode(next);
    setLocalError("");
    setFirstInvalidField(undefined);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLocalError("");
    setFirstInvalidField(undefined);
    // 基础交互只做 trim + 非空校验，不附加旧模板的编号/邮箱正则；服务端仍需自行校验与授权。
    // firstInvalidField 让不同模板可把焦点移到对应输入，onComplete 则在查询结算后处理结果滚动。
    if (mode === "order") {
      if (!orderNumber.trim() || !email.trim()) {
        setLocalError("Please enter your order number and email address");
        setFirstInvalidField(!orderNumber.trim() ? "order" : "email");
        return;
      }
      // 提交时同步 URL，历史恢复走 Runtime 缓存，不经过此处也不会再请求接口。
      syncTrackingQueryToUrl("order", orderNumber.trim(), email.trim());
      void query({ mode: "order", orderNumber: orderNumber.trim(), email: email.trim() }).finally(onComplete);
      return;
    }
    if (!trackingNumber.trim()) {
      setLocalError("Please enter your tracking number");
      setFirstInvalidField("tracking");
      return;
    }
    syncTrackingQueryToUrl("tracking", trackingNumber.trim());
    void query({ mode: "tracking", trackingNumber: trackingNumber.trim() }).finally(onComplete);
  };

  return { mode, setMode, trackingNumber, setTrackingNumber, orderNumber, setOrderNumber, email, setEmail, localError, firstInvalidField, loading, submit };
}
