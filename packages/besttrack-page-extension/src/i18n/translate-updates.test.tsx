import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadyToGoDeliveryBlock, ReadyToGoDeliveryEditor, ReadyToGoProgressBlock, ReadyToGoProgressEditor, ReadyToGoQueryBlock, ReadyToGoRuntimeProvider, shouldStackProgressIdentity } from "../ready-to-go";
import { TrackingLoading } from "../tracking-loading";
import { TranslatingEventLabel } from "../track-page-display";
import { LOCALE_STORAGE_KEY, localeOptions } from "./locales";
import type { ShopifyTrackPagePost } from "../shopify/track-query";
import { TrackingRuntimeProvider, useTrackingRuntime } from "../tracking-runtime";
import type { TrackingPageQuery, TrackingPageQueryResult } from "../tracking-page-runtime";
import { TranslateUpdatesMenu } from "./translate-updates";

function resultFor(trackingNumber: string, extra: Partial<TrackingPageQueryResult> = {}): TrackingPageQueryResult {
  return {
    trackingNumber,
    status: `Status ${trackingNumber}`,
    carrier: `Carrier ${trackingNumber}`,
    events: [{ id: "event", title: `Event ${trackingNumber}`, state: "current" }],
    ...extra
  };
}

afterEach(() => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  window.history.replaceState({}, "", "/");
});

describe("Translate updates menu", () => {
  it("lists every supported language and defaults to English", () => {
    render(<TrackingRuntimeProvider><TranslateUpdatesMenu /></TrackingRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    expect(screen.getByRole("listbox", { name: "Translate updates" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(localeOptions.length);
    expect(screen.getByRole("option", { name: "English" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "English" })).toHaveClass("bt-translate-updates__option");
    for (const option of localeOptions) {
      expect(screen.getByRole("option", { name: option.label })).toBeInTheDocument();
    }
  });

  it("sits with the tracking number in the progress editor preview", () => {
    render(<ReadyToGoProgressEditor blockId="progress" selected={false} onPropsChange={() => undefined} />);

    const progress = screen.getByLabelText("Ready-to-go progress editor");
    const translate = within(progress).getByRole("button", { name: "Translate updates" });
    expect(within(progress).getByText("Tracking: BT-2048-DEMO")).toBeInTheDocument();
    expect(progress.querySelector(".bt-progress-identity")).toBeInTheDocument();
    expect(translate.closest(".bt-progress-identity__menu")).toBeInTheDocument();
    expect(progress.querySelector("style")?.textContent).toContain("minmax(0, 1fr) auto minmax(0, 1fr)");
    expect(progress.querySelector("style")?.textContent).toContain("order: -1");
  });

  it("keeps the tracking number centered until the side columns cannot hold the language control", () => {
    expect(shouldStackProgressIdentity(280, 180, 900)).toBe(false);
    expect(shouldStackProgressIdentity(280, 180, 500)).toBe(true);
    expect(shouldStackProgressIdentity(280, 180, 0)).toBe(false);
  });

  it("does not sit next to Shipping Details in the delivery editor preview", () => {
    render(<ReadyToGoDeliveryEditor heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" blockId="delivery" selected={false} onPropsChange={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Shipping Details" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Translate updates" })).not.toBeInTheDocument();
  });

  it("keeps the right delivery column first in the wrap order", () => {
    render(<ReadyToGoDeliveryEditor heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" blockId="delivery" selected={false} onPropsChange={() => undefined} />);

    const shipping = screen.getByRole("heading", { name: "Shipping Details" });
    const contents = screen.getByRole("heading", { name: "Package Contents" });
    expect(contents.compareDocumentPosition(shipping) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(contents.closest(".bt-delivery-columns")).toHaveStyle({ flexDirection: "row-reverse" });
  });

  it("localizes Searching... with the storefront locale", () => {
    render(<TrackingRuntimeProvider>
      <SetLocaleButton />
      <TrackingLoading />
    </TrackingRuntimeProvider>);

    expect(screen.getByRole("status", { name: "Searching..." })).toHaveTextContent("Searching...");
    fireEvent.click(screen.getByRole("button", { name: "zh" }));
    expect(screen.getByRole("status", { name: "正在查询..." })).toHaveTextContent("正在查询...");
  });

  it("keeps a short Translate label for narrow viewports", () => {
    render(<TrackingRuntimeProvider><TranslateUpdatesMenu /></TrackingRuntimeProvider>);

    expect(screen.getByText("Translate updates")).toHaveClass("bt-translate-updates__full");
    expect(screen.getByText("Translate")).toHaveClass("bt-translate-updates__short");
  });

  it("persists the selected language and keeps the current shipping details visible", async () => {
    const query = vi.fn<TrackingPageQuery>(async (request) => resultFor(request.mode === "tracking" ? request.trackingNumber : request.orderNumber));
    render(<ReadyToGoRuntimeProvider query={query}>
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
      <QueryThenTranslate />
    </ReadyToGoRuntimeProvider>);

    fireEvent.click(await screen.findByLabelText("query-ready"));
    expect(await screen.findByText("Event AAA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    fireEvent.click(screen.getByRole("option", { name: "简体中文" }));

    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    expect(query).toHaveBeenLastCalledWith({ mode: "tracking", trackingNumber: "AAA" });
    expect(screen.getByText("Event AAA")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "物流详情" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "包裹内容" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "承运商" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "翻译物流" })).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ZH-HANS");
    expect(window.location.search).toContain("lang=ZH-HANS");
  });

  it("greys out the language menu until the locale refresh query returns", async () => {
    const pending = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>()
      .mockResolvedValueOnce(resultFor("AAA"))
      .mockImplementationOnce(() => pending.promise);
    render(<ReadyToGoRuntimeProvider query={query}>
      <ReadyToGoProgressBlock />
      <QueryThenTranslate />
    </ReadyToGoRuntimeProvider>);

    fireEvent.click(await screen.findByLabelText("query-ready"));
    expect(await screen.findByText("Status AAA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    fireEvent.click(screen.getByRole("option", { name: "简体中文" }));

    const trigger = screen.getByRole("button", { name: "翻译物流" });
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await act(async () => { pending.resolve(resultFor("AAA")); });
    await waitFor(() => expect(screen.getByRole("button", { name: "翻译物流" })).toBeEnabled());
  });

  it("greys out Track Your Order until the locale refresh query returns", async () => {
    const pending = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>()
      .mockResolvedValueOnce(resultFor("AAA"))
      .mockImplementationOnce(() => pending.promise);
    render(<ReadyToGoRuntimeProvider query={query}>
      <ReadyToGoQueryBlock submitLabel="Track Your Order" />
      <ReadyToGoProgressBlock />
      <QueryThenTranslate />
    </ReadyToGoRuntimeProvider>);

    fireEvent.click(await screen.findByLabelText("query-ready"));
    expect(await screen.findByText("Status AAA")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Track Your Order" });
    expect(submit).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    fireEvent.click(screen.getByRole("option", { name: "简体中文" }));

    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);
    expect(query).toHaveBeenCalledTimes(2);

    await act(async () => { pending.resolve(resultFor("AAA")); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Track Your Order" })).toBeEnabled());
  });

  it("shows Translating... with three sequential dots on shipping events until the locale refresh returns", async () => {
    const pending = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>()
      .mockResolvedValueOnce(resultFor("AAA"))
      .mockImplementationOnce(() => pending.promise);
    render(<ReadyToGoRuntimeProvider query={query}>
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
      <QueryThenTranslate />
    </ReadyToGoRuntimeProvider>);

    fireEvent.click(await screen.findByLabelText("query-ready"));
    expect(await screen.findByText("Event AAA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    fireEvent.click(screen.getByRole("option", { name: "简体中文" }));

    expect(screen.getByText("翻译中...")).toBeInTheDocument();
    expect(screen.queryByText("Event AAA")).not.toBeInTheDocument();
    expect(document.querySelector(".bt-translating")).toHaveStyle({ verticalAlign: "top" });
    expect(document.querySelectorAll(".bt-translating__dot")).toHaveLength(3);
    for (const dot of document.querySelectorAll(".bt-translating__dot")) {
      expect(dot).not.toBeEmptyDOMElement();
      expect(dot).toHaveStyle({ display: "inline-block", width: "6px", height: "6px", backgroundColor: "rgb(100, 116, 139)" });
    }

    await act(async () => { pending.resolve(resultFor("AAA")); });
    await waitFor(() => expect(screen.getByText("Event AAA")).toBeInTheDocument());
    expect(screen.queryByText("翻译中...")).not.toBeInTheDocument();
  });

  it("animates translating dots with the Web Animations API so theme CSS cannot cancel them", () => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    const previous = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate as unknown as typeof HTMLElement.prototype.animate;
    try {
      render(<TrackingRuntimeProvider><TranslatingEventLabel /></TrackingRuntimeProvider>);
      expect(animate).toHaveBeenCalledTimes(3);
    } finally {
      HTMLElement.prototype.animate = previous;
    }
  });

  it("localizes default delivery chrome in the editor canvas", () => {
    render(<TrackingRuntimeProvider>
      <ReadyToGoProgressEditor blockId="progress" selected={false} onPropsChange={() => undefined} />
      <ReadyToGoDeliveryEditor heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" blockId="delivery" selected={false} onPropsChange={() => undefined} />
    </TrackingRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    fireEvent.click(screen.getByRole("option", { name: "简体中文" }));
    expect(screen.getByRole("heading", { name: "物流详情" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "包裹内容" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "承运商" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "再次购买" })).toBeInTheDocument();
  });

  it("localizes hardcoded preview shipping events when the language changes", () => {
    render(<TrackingRuntimeProvider>
      <ReadyToGoProgressEditor blockId="progress" selected={false} onPropsChange={() => undefined} />
      <ReadyToGoDeliveryEditor heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" blockId="delivery" selected={false} onPropsChange={() => undefined} />
    </TrackingRuntimeProvider>);

    expect(screen.getByText("Shipment accepted at the regional hub")).toBeInTheDocument();
    expect(screen.getByText("The order has been placed and confirmed.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    fireEvent.click(screen.getByRole("option", { name: "Français" }));

    expect(screen.getByText("Envoi accepté au centre régional")).toBeInTheDocument();
    expect(screen.getByText("La commande a été passée et confirmée.")).toBeInTheDocument();
    expect(screen.queryByText("Shipment accepted at the regional hub")).not.toBeInTheDocument();
    expect(screen.queryByText("The order has been placed and confirmed.")).not.toBeInTheDocument();
  });

  it("keeps a merchant-edited heading when the language changes", () => {
    render(<TrackingRuntimeProvider>
      <ReadyToGoProgressEditor blockId="progress" selected={false} onPropsChange={() => undefined} />
      <ReadyToGoDeliveryEditor heading="Shipment facts" contentsHeading="Package Contents" carrierHeading="Carrier" blockId="delivery" selected={false} onPropsChange={() => undefined} />
    </TrackingRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Translate updates" }));
    fireEvent.click(screen.getByRole("option", { name: "Français" }));
    expect(screen.getByRole("heading", { name: "Shipment facts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contenu du colis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transporteur" })).toBeInTheDocument();
  });
});

describe("TrackingRuntime locale refresh", () => {
  it("re-queries the selected result in place and does not hide it while loading", async () => {
    const pending = deferred<TrackingPageQueryResult>();
    const query = vi.fn<TrackingPageQuery>()
      .mockResolvedValueOnce(resultFor("AAA"))
      .mockResolvedValueOnce(resultFor("BBB"))
      .mockImplementationOnce(() => pending.promise);
    const { result } = renderHook(useTrackingRuntime, { wrapper: ({ children }) => <TrackingRuntimeProvider query={query}>{children}</TrackingRuntimeProvider> });

    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "AAA" }); });
    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "BBB" }); });
    act(() => { result.current.selectRecentQuery(1); });
    expect(result.current.result?.trackingNumber).toBe("AAA");
    expect(result.current.locale).toBe("EN");

    act(() => { result.current.setLocale("FR"); });
    expect(result.current.locale).toBe("FR");
    expect(result.current.localeRefreshing).toBe(true);
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.trackingNumber).toBe("AAA");

    await act(async () => { pending.resolve(resultFor("AAA", { events: [{ id: "fr", title: "Colis accepté" }] })); });
    expect(result.current.localeRefreshing).toBe(false);
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.events?.[0]?.title).toBe("Colis accepté");
    expect(result.current.recentQueries.map((item) => item.value)).toEqual(["BBB", "AAA"]);
    expect(result.current.selectedRecentIndex).toBe(1);
    expect(query).toHaveBeenLastCalledWith({ mode: "tracking", trackingNumber: "AAA" });
  });

  it("sends the selected lang on the Shopify transport path", async () => {
    const post = vi.fn(async (url: string, _body?: Record<string, unknown>) => {
      if (url.includes("/products/recommend")) return { code: 0, data: { products: [] } };
      return {
        code: 0,
        data: {
          order_number: "",
          mileStoneList: [{
            tracking_number: "AAA",
            carrier: "BestTrack",
            package_items: [],
            nodeList: [{
              node: "InTransit_Other",
              description: "Accepted at the hub",
              time: "2026-09-17 10:00",
              location: "Shanghai",
              country: "CN",
              state: "Shanghai",
              city: "Shanghai",
              street: "",
              carrier: "BestTrack"
            }]
          }],
          ad_config: { image_url: "", link_url: "" },
          trace_id: "trace"
        }
      };
    });
    const { result } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider transport={{ post: post as ShopifyTrackPagePost, retries: 0 }}>{children}</TrackingRuntimeProvider>
    });

    await act(async () => { await result.current.query({ mode: "tracking", trackingNumber: "AAA" }); });
    expect(result.current.phase).toBe("success");
    act(() => { result.current.setLocale("ZH-HANS"); });
    await waitFor(() => {
      const trackCalls = post.mock.calls.filter(([url]) => String(url).includes("/track/query"));
      expect(trackCalls.at(-1)?.[1]).toMatchObject({ lang: "ZH-HANS", tracking_number: "AAA" });
    });
  });
});

function QueryThenTranslate() {
  const runtime = useTrackingRuntime();
  return <button type="button" aria-label="query-ready" onClick={() => { void runtime.query({ mode: "tracking", trackingNumber: "AAA" }); }}>query</button>;
}

function SetLocaleButton() {
  const runtime = useTrackingRuntime();
  return <button type="button" onClick={() => runtime.setLocale("ZH-HANS")}>zh</button>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => { resolve = onResolve; });
  return { promise, resolve };
}
