import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandedQueryBlock, BrandedRecommendationsBlock, BrandedRuntimeProvider } from "./branded";
import { ReadyToGoDeliveryBlock, ReadyToGoProgressBlock, ReadyToGoQueryBlock, ReadyToGoRecommendationsBlock, ReadyToGoRuntimeProvider } from "./ready-to-go";
import { SalesQueryBlock, SalesRecommendationsBlock, SalesRuntimeProvider } from "./sales";
import { TrackingRuntimeProvider, useTrackingRuntime } from "./tracking-runtime";
import type { TrackingPageQuery, TrackingPageQueryResult, TrackingPageRecommendation, TrackingPageRecommendationsQuery } from "./tracking-page-runtime";

// 同一组交互断言分别经过三套真实模板，防止某个外观层重新引入自己的业务分支。
// Ready-to-go 的结果独立于查询区块，另外两套的查询区块已包含结果，因此按布局补齐测试页面。
const templates = [
  { name: "Ready-to-go", Provider: ReadyToGoRuntimeProvider, Query: ReadyToGoQueryBlock, Recommendations: ReadyToGoRecommendationsBlock, trackingLabel: "Tracking number", separateDetails: true },
  { name: "Branded", Provider: BrandedRuntimeProvider, Query: BrandedQueryBlock, Recommendations: BrandedRecommendationsBlock, trackingLabel: "Tracking number", separateDetails: false },
  { name: "Sales", Provider: SalesRuntimeProvider, Query: SalesQueryBlock, Recommendations: SalesRecommendationsBlock, trackingLabel: "Sales tracking number", separateDetails: false }
];

// 两种来源使用不同商品标题，确保断言能发现推荐区误读查单响应的情况。
const independentProduct: TrackingPageRecommendation = { id: "independent", title: "Independent recommendation", description: "Loaded without a lookup." };
const lookupProduct: TrackingPageRecommendation = { id: "lookup", title: "Lookup-only recommendation", description: "Must not be used by recommendation blocks." };

function resultFor(trackingNumber: string, extra: Partial<TrackingPageQueryResult> = {}): TrackingPageQueryResult {
  return { trackingNumber, status: `Status ${trackingNumber}`, carrier: `Carrier ${trackingNumber}`, ...extra };
}

// 手动控制请求何时完成，用于稳定复现旧响应晚到、请求中继续输入、切换数据源等时序。
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

function submitTracking(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
}

function ReadyDetails({ enabled }: { enabled: boolean }) {
  return enabled ? <><ReadyToGoProgressBlock /><ReadyToGoDeliveryBlock /></> : null;
}

function RecommendationState() {
  return <output aria-label="Recommendation phase">{useTrackingRuntime().recommendations.phase}</output>;
}

function RecommendationPreview({ queryRecommendations }: { queryRecommendations?: TrackingPageRecommendationsQuery }) {
  return <TrackingRuntimeProvider queryRecommendations={queryRecommendations}>
    <RecommendationState />
    <ReadyToGoRecommendationsBlock heading="Ready suggestions" />
    <BrandedRecommendationsBlock heading="Branded suggestions" />
    <SalesRecommendationsBlock heading="Sales suggestions" />
  </TrackingRuntimeProvider>;
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe.each(templates)("$name uses the Ready-to-go foundation", ({ Provider, Query, Recommendations, trackingLabel, separateDetails }) => {
  it("trims inputs and accepts nonempty short identifiers and email values", async () => {
    // A、#1 和 buyer 故意不满足旧模板的部分格式规则，验证三套表单只共享 trim + 非空校验。
    const query = vi.fn<TrackingPageQuery>(async (request) => resultFor(request.mode === "tracking" ? request.trackingNumber : request.orderNumber));
    render(<Provider query={query}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /></Provider>);

    submitTracking(trackingLabel, "   ");
    expect(query).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();

    submitTracking(trackingLabel, "  A  ");
    await screen.findByText(/Status A/);
    expect(query).toHaveBeenLastCalledWith({ mode: "tracking", trackingNumber: "A" });
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^(?:Sales )?order number$/i }), { target: { value: "  #1  " } });
    fireEvent.change(screen.getByLabelText(/^(?:Sales order )?email$/i), { target: { value: "  buyer  " } });
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    await screen.findByText(/Status #1/);
    expect(query).toHaveBeenLastCalledWith({ mode: "order", orderNumber: "#1", email: "buyer" });
  });

  it("loads recommendations before lookup and keeps them while lookup loads or fails", async () => {
    const lookup = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>(() => lookup.promise);
    const queryRecommendations = vi.fn(async () => [independentProduct]);
    render(<Provider query={query} queryRecommendations={queryRecommendations}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /><Recommendations heading="Suggestions" /></Provider>);

    expect(await screen.findByText(independentProduct.title)).toBeInTheDocument();
    expect(query).not.toHaveBeenCalled();
    submitTracking(trackingLabel, "AAA");
    expect(screen.getByRole("button", { name: "Find parcel" })).toBeDisabled();
    expect(screen.getByText(independentProduct.title)).toBeInTheDocument();
    await act(async () => { lookup.reject(new Error("private upstream failure")); });
    expect(screen.getByText(independentProduct.title)).toBeInTheDocument();
    expect(screen.queryByText("private upstream failure")).toBeNull();
    expect(screen.queryByText("BestTrack demo carrier")).toBeNull();
    expect(queryRecommendations).toHaveBeenCalledTimes(1);
  });

  it("preserves the next input and query mode when a request finishes, then restores an explicitly selected history entry", async () => {
    // 请求完成只更新查询结果；只有点击历史记录才应回填输入，即使点击的仍是已选中的记录。
    const pending = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>().mockResolvedValueOnce(resultFor("OLD")).mockImplementationOnce(() => pending.promise);
    render(<Provider query={query}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /></Provider>);
    submitTracking(trackingLabel, "OLD");
    await screen.findByText(/Status OLD/);

    submitTracking(trackingLabel, "AAA");
    expect(screen.getByRole("button", { name: "Find parcel" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(trackingLabel), { target: { value: "BBB" } });
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^(?:Sales )?order number$/i }), { target: { value: "NEXT-ORDER" } });
    fireEvent.change(screen.getByLabelText(/^(?:Sales order )?email$/i), { target: { value: "next@example.test" } });

    await act(async () => { pending.resolve(resultFor("AAA")); });
    expect(screen.getByText(/Status AAA/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Order Number" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: /^(?:Sales )?order number$/i })).toHaveValue("NEXT-ORDER");
    expect(screen.getByLabelText(/^(?:Sales order )?email$/i)).toHaveValue("next@example.test");
    fireEvent.click(screen.getByRole("tab", { name: "Tracking Number" }));
    expect(screen.getByLabelText(trackingLabel)).toHaveValue("BBB");

    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    const selectedHistory = screen.getByRole("button", { name: "AAA" });
    expect(selectedHistory).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(selectedHistory);
    expect(screen.getByRole("tab", { name: "Tracking Number" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(trackingLabel)).toHaveValue("AAA");
    fireEvent.change(screen.getByLabelText(trackingLabel), { target: { value: "CCC" } });
    fireEvent.click(screen.getByRole("button", { name: "AAA" }));
    expect(screen.getByLabelText(trackingLabel)).toHaveValue("AAA");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("prioritizes merchant products and never sources recommendations from a lookup", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue(resultFor("AAA", { recommendations: [lookupProduct] }));
    const queryRecommendations = vi.fn(async () => [independentProduct]);
    const products = [{ id: "gid://shopify/Product/1", title: "Merchant selection", handle: "merchant-selection" }];
    const { rerender } = render(<Provider query={query} queryRecommendations={queryRecommendations}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /><Recommendations heading="Suggestions" products={products} /></Provider>);
    await waitFor(() => expect(queryRecommendations).toHaveBeenCalledOnce());
    expect(screen.getByText("Merchant selection")).toBeInTheDocument();
    expect(screen.queryByText(independentProduct.title)).toBeNull();
    submitTracking(trackingLabel, "AAA");
    await screen.findByText(/Status AAA/);
    expect(screen.queryByText(lookupProduct.title)).toBeNull();

    // 去掉商家选品后使用已加载的独立推荐，查单响应里的商品在两个阶段都不应出现。
    rerender(<Provider query={query} queryRecommendations={queryRecommendations}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /><Recommendations heading="Suggestions" /></Provider>);
    expect(screen.getByText(independentProduct.title)).toBeInTheDocument();
    expect(screen.queryByText("Merchant selection")).toBeNull();
    expect(screen.queryByText(lookupProduct.title)).toBeNull();
  });

  it("keeps the latest three successful queries, restores cached results, and resets history on mode change", async () => {
    const query = vi.fn<TrackingPageQuery>(async (request) => resultFor(request.mode === "tracking" ? request.trackingNumber : request.orderNumber));
    render(<Provider query={query}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /></Provider>);
    for (const value of ["AAA", "BBB", "CCC", "DDD"]) {
      submitTracking(trackingLabel, value);
      await screen.findByText(new RegExp(`Status ${value}`));
    }
    expect(screen.queryByRole("button", { name: "AAA" })).toBeNull();
    for (const value of ["DDD", "CCC", "BBB"]) expect(screen.getByRole("button", { name: value })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BBB" }));
    expect(screen.getByText(/Status BBB/)).toBeInTheDocument();
    expect(screen.getByText("Carrier BBB")).toBeInTheDocument();
    expect(screen.getByLabelText(trackingLabel)).toHaveValue("BBB");
    expect(query).toHaveBeenCalledTimes(4);

    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^(?:Sales )?order number$/i }), { target: { value: "ORDER-1" } });
    fireEvent.change(screen.getByLabelText(/^(?:Sales order )?email$/i), { target: { value: "buyer@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    await screen.findByText(/Status ORDER-1/);
    expect(screen.getByText("Order: ORDER-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BBB" })).toBeNull();
  });

  it("switches shipment progress, events, items, carrier, destination, estimate and ad together", async () => {
    // 两个包裹属于同一次运单号查询，点击第二层只切换已有结果，查询调用次数仍应保持为 1。
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue(resultFor("AAA", { shipments: [
      { id: "first", label: "AAA", trackingNumber: "AAA", status: "Status AAA", carrier: "First carrier", events: [{ id: "first-event", title: "First parcel event" }], orderItems: [{ id: "first-item", title: "First parcel item", quantity: 1 }] },
      { id: "second", label: "BBB", trackingNumber: "BBB", status: "Status BBB", carrier: "Second carrier", destination: "Second destination", estimatedDelivery: "Oct 12 - Oct 14", events: [{ id: "second-event", title: "Second parcel event" }], orderItems: [{ id: "second-item", title: "Second parcel item", quantity: 2 }], ad: { imageUrl: "https://example.test/promo.png", href: "https://example.test/promo", alt: "Second parcel promotion" } }
    ] }));
    render(<Provider query={query}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /></Provider>);
    submitTracking(trackingLabel, "AAA");
    await screen.findByText(/Status AAA/);
    fireEvent.click(screen.getByRole("button", { name: "BBB" }));
    for (const value of ["Second carrier", "Second destination", "Second parcel event", "Second parcel item"]) expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByText(/Oct 12 - Oct 14/)).toBeInTheDocument();
    expect(screen.getByText(/Status BBB/)).toBeInTheDocument();
    expect(screen.queryByText("First parcel event")).toBeNull();
    expect(screen.queryByText("First parcel item")).toBeNull();
    expect(screen.getByAltText("Second parcel promotion").closest("a")).toHaveAttribute("href", "https://example.test/promo");
    expect(query).toHaveBeenCalledOnce();
  });

  it("hides the estimated delivery in an automatic demo preview", async () => {
    // 响应确实含 EDD，断言其不可见才能区分预览隐藏规则与数据本身缺失。
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue(resultFor("DEMO", { estimatedDelivery: "Oct 12 - Oct 14" }));
    render(<Provider query={query} autoQueryDemo><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /></Provider>);
    await screen.findByText(/Status DEMO/);
    expect(query).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Oct 12 - Oct 14/)).toBeNull();
  });

  it("hides recommendations without an independent source and shows no demo data on an empty lookup", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ outcome: "empty", trackingNumber: "", status: "", recommendations: [lookupProduct] });
    render(<Provider query={query}><Query submitLabel="Find parcel" /><ReadyDetails enabled={separateDetails} /><Recommendations heading="Suggestions" /></Provider>);
    expect(screen.queryByText("Suggestions")).toBeNull();
    submitTracking(trackingLabel, "MISSING");
    expect(await screen.findByText("Can not find order")).toBeInTheDocument();
    expect(screen.queryByText("Suggestions")).toBeNull();
    expect(screen.queryByText("BestTrack demo carrier")).toBeNull();
    expect(screen.queryByText("Demo shipment item")).toBeNull();
    expect(screen.queryByText(lookupProduct.title)).toBeNull();
  });
});

describe("shared TrackingRuntimeProvider", () => {
  it("discards successful mock recommendations immediately when a replacement loader starts or fails", async () => {
    // 保持同一 Provider 挂载并替换来源，覆盖 Mock 切 Live 时旧商品不能滞留的边界。
    const mockSource = vi.fn(async () => [independentProduct]);
    const liveLoad = deferred<TrackingPageRecommendation[]>();
    const liveSource = vi.fn(() => liveLoad.promise);
    const { rerender } = render(<RecommendationPreview queryRecommendations={mockSource} />);
    expect(await screen.findAllByText(independentProduct.title)).toHaveLength(3);

    rerender(<RecommendationPreview queryRecommendations={liveSource} />);
    expect(screen.getByLabelText("Recommendation phase")).toHaveTextContent("loading");
    expect(screen.queryByText(independentProduct.title)).toBeNull();
    await waitFor(() => expect(liveSource).toHaveBeenCalledOnce());
    await act(async () => { liveLoad.reject(new Error("live recommendations unavailable")); });
    expect(screen.getByLabelText("Recommendation phase")).toHaveTextContent("error");
    expect(screen.queryByText(independentProduct.title)).toBeNull();
    expect(screen.queryByRole("heading", { name: /suggestions$/ })).toBeNull();
  });

  it("clears recommendations when the loader is removed and ignores its outstanding completion", async () => {
    // 分别移除已成功和仍在请求中的来源，移除后的迟到响应不得重新填回商品。
    const successfulSource = vi.fn(async () => [independentProduct]);
    const pendingLoad = deferred<TrackingPageRecommendation[]>();
    const pendingSource = vi.fn(() => pendingLoad.promise);
    const { rerender } = render(<RecommendationPreview queryRecommendations={successfulSource} />);
    expect(await screen.findAllByText(independentProduct.title)).toHaveLength(3);

    rerender(<RecommendationPreview />);
    expect(screen.getByLabelText("Recommendation phase")).toHaveTextContent("idle");
    expect(screen.queryByText(independentProduct.title)).toBeNull();
    rerender(<RecommendationPreview queryRecommendations={pendingSource} />);
    await waitFor(() => expect(pendingSource).toHaveBeenCalledOnce());
    rerender(<RecommendationPreview />);
    expect(screen.getByLabelText("Recommendation phase")).toHaveTextContent("idle");
    await act(async () => { pendingLoad.resolve([independentProduct]); });
    expect(screen.getByLabelText("Recommendation phase")).toHaveTextContent("idle");
    expect(screen.queryByText(independentProduct.title)).toBeNull();
  });

  it("keeps the current recommendation source when a superseded request finishes later", async () => {
    const oldLoad = deferred<TrackingPageRecommendation[]>();
    const oldSource = vi.fn(() => oldLoad.promise);
    const replacementProduct = { ...independentProduct, id: "replacement", title: "Current source product" };
    const currentSource = vi.fn(async () => [replacementProduct]);
    const { rerender } = render(<RecommendationPreview queryRecommendations={oldSource} />);
    await waitFor(() => expect(oldSource).toHaveBeenCalledOnce());

    rerender(<RecommendationPreview queryRecommendations={currentSource} />);
    expect(await screen.findAllByText(replacementProduct.title)).toHaveLength(3);
    await act(async () => { oldLoad.resolve([independentProduct]); });
    expect(screen.getByLabelText("Recommendation phase")).toHaveTextContent("success");
    expect(screen.getAllByText(replacementProduct.title)).toHaveLength(3);
    expect(screen.queryByText(independentProduct.title)).toBeNull();
  });

  it("drives query, progress, delivery and recommendations from different templates with one provider", async () => {
    // 故意混用不同模板的区块；若兼容 Provider 或 Hook 仍各自持有 Context，这条联动会失败。
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue(resultFor("MIX", { events: [{ id: "event", title: "Shared parcel arrived" }] }));
    render(<TrackingRuntimeProvider query={query} queryRecommendations={async () => [independentProduct]}><SalesQueryBlock submitLabel="Find parcel" /><ReadyToGoProgressBlock /><ReadyToGoDeliveryBlock /><BrandedRecommendationsBlock heading="Suggestions" /></TrackingRuntimeProvider>);
    expect(await screen.findByText(independentProduct.title)).toBeInTheDocument();
    submitTracking("Sales tracking number", "MIX");
    await waitFor(() => expect(screen.getAllByText(/Status MIX/)).toHaveLength(2));
    expect(screen.getAllByText("Shared parcel arrived")).toHaveLength(2);
    expect(query).toHaveBeenCalledOnce();
  });

  it("keeps a newly selected cached result when an older request finishes", async () => {
    // CCC 尚未完成时恢复 AAA，随后到达的 CCC 既不能覆盖当前结果，也不能加入历史。
    const pending = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>().mockResolvedValueOnce(resultFor("AAA")).mockResolvedValueOnce(resultFor("BBB")).mockImplementationOnce(() => pending.promise);
    const { result } = renderHook(useTrackingRuntime, { wrapper: ({ children }) => <TrackingRuntimeProvider query={query}>{children}</TrackingRuntimeProvider> });
    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "AAA" }); });
    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "BBB" }); });
    let pendingQuery!: Promise<void>;
    act(() => { pendingQuery = result.current.query({ mode: "tracking", trackingNumber: "CCC" }); });
    act(() => { result.current.selectRecentQuery(1); });
    await act(async () => { pending.resolve(resultFor("CCC")); await pendingQuery; });
    expect(result.current.result?.trackingNumber).toBe("AAA");
    expect(result.current.phase).toBe("success");
    expect(result.current.recentQueries.map((entry) => entry.value)).toEqual(["BBB", "AAA"]);
  });

  it("ignores out-of-order requests and keeps failures out of recent history", async () => {
    // 直接调用 Runtime 制造表单禁用状态下无法点击出的并发，验证底层也能丢弃迟到结果。
    const pending = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>().mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(resultFor("BBB")).mockResolvedValueOnce({ outcome: "empty", trackingNumber: "", status: "" }).mockRejectedValueOnce(new Error("upstream"));
    const { result } = renderHook(useTrackingRuntime, { wrapper: ({ children }) => <TrackingRuntimeProvider query={query}>{children}</TrackingRuntimeProvider> });
    let pendingQuery!: Promise<void>;
    act(() => { pendingQuery = result.current.query({ mode: "tracking", trackingNumber: "AAA" }); });
    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "BBB" }); });
    await act(async () => { pending.resolve(resultFor("AAA")); await pendingQuery; });
    expect(result.current.result?.trackingNumber).toBe("BBB");
    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "MISSING" }); });
    expect(result.current.phase).toBe("empty");
    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "ERROR" }); });
    expect(result.current.phase).toBe("error");
    expect(result.current.recentQueries.map((entry) => entry.value)).toEqual(["BBB"]);
  });

  it("separates order histories when the buyer email changes", async () => {
    // 相同订单号配不同邮箱仍属于不同查询分组，不能沿用前一邮箱的缓存记录。
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue(resultFor("ORDER"));
    const { result } = renderHook(useTrackingRuntime, { wrapper: ({ children }) => <TrackingRuntimeProvider query={query}>{children}</TrackingRuntimeProvider> });
    await act(async () => { await result.current.query({ mode: "order", orderNumber: "ORDER", email: "one@example.test" }); });
    await act(async () => { await result.current.query({ mode: "order", orderNumber: "ORDER", email: "two@example.test" }); });
    expect(result.current.recentQueries).toHaveLength(1);
    expect(result.current.recentQueries[0].email).toBe("two@example.test");
  });

  it("maps transport failures to empty while an injected query failure stays a generic error", async () => {
    // 旧接口适配器将重试失败转换为 empty；宿主回调直接抛错则由 Runtime 转成通用 error。
    // 两条入口保留各自既有语义，都不应暴露上游错误详情或返回演示查单数据。
    const transport = { post: vi.fn().mockRejectedValue(new Error("private transport failure")), retries: 0 };
    const { result, unmount } = renderHook(useTrackingRuntime, { wrapper: ({ children }) => <TrackingRuntimeProvider transport={transport}>{children}</TrackingRuntimeProvider> });
    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "AAA" }); });
    expect(result.current.phase).toBe("empty");
    expect(result.current.result?.outcome).toBe("empty");
    expect(result.current.recommendations).toEqual({ phase: "empty", items: [] });
    unmount();
    const query = vi.fn<TrackingPageQuery>().mockRejectedValue(new Error("private callback failure"));
    const injected = renderHook(useTrackingRuntime, { wrapper: ({ children }) => <TrackingRuntimeProvider query={query}>{children}</TrackingRuntimeProvider> });
    await act(async () => { await injected.result.current.query({ mode: "tracking", trackingNumber: "BBB" }); });
    expect(injected.result.current.phase).toBe("error");
    expect(injected.result.current.error).toBe("We couldn’t retrieve this order right now. Please try again later.");
    expect(injected.result.current.result).toBeUndefined();
  });
});
