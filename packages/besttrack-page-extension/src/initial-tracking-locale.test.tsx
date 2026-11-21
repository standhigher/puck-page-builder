import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { StrictMode, useLayoutEffect, type FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "./i18n/locales";
import { useTrackingQueryForm } from "./tracking-query-form";
import { TrackingRuntimeProvider, useTrackingRuntime } from "./tracking-runtime";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => { resolve = onResolve; });
  return { promise, resolve };
}

const request = { mode: "tracking", trackingNumber: "AAA" } as const;

function TrackingForm() {
  const runtime = useTrackingRuntime();
  const form = useTrackingQueryForm({ initialTrackingNumber: "AAA" });
  return <>
    <form onSubmit={form.submit}>
      <input aria-label="Tracking number" value={form.trackingNumber} onChange={(event) => form.setTrackingNumber(event.target.value)} />
      <button disabled={form.submitDisabled}>Track</button>
    </form>
    <output aria-label="Query phase">{runtime.phase}</output>
    <output aria-label="Tracking result">{runtime.result?.trackingNumber}</output>
  </>;
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.removeItem("bestrack_locale");
});

describe("asynchronous initial tracking locale", () => {
  it("keeps existing providers immediately ready without a loader", () => {
    const { result } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider>{children}</TrackingRuntimeProvider>
    });
    expect(result.current.localeReady).toBe(true);
    expect(result.current.locale).toBe("EN");
  });

  it("waits before the first transport lookup while recommendations load independently", async () => {
    const pending = deferred<Locale>();
    const loadInitialLocale = vi.fn(() => pending.promise);
    const transport = { post: vi.fn().mockResolvedValue({ code: 0, data: null }) };
    const queryRecommendations = vi.fn().mockResolvedValue([{ id: "one", title: "Independent" }]);
    const { result } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} transport={transport} queryRecommendations={queryRecommendations}>{children}</TrackingRuntimeProvider>
    });
    expect(result.current.localeReady).toBe(false);
    let lookup!: Promise<void>;
    act(() => { lookup = result.current.query(request); });
    await waitFor(() => expect(result.current.recommendations.phase).toBe("success"));
    expect(transport.post).not.toHaveBeenCalled();
    await act(async () => { pending.resolve("FR"); await lookup; });
    expect(loadInitialLocale).toHaveBeenCalledOnce();
    expect(transport.post).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^\/track\/query\?_t=/), {
      tracking_number: "AAA", order_number: "", email: "", lang: "FR"
    });
    expect(result.current.localeReady).toBe(true);
    expect(result.current.locale).toBe("FR");
    expect(result.current.phase).toBe("success");
    expect(window.location.search).toBe("");
    expect(window.localStorage.getItem("bestrack_locale")).toBeNull();
  });

  it.each(["reject", "throw"])("falls back to the explicit locale after a loader %s", async (failure) => {
    window.history.replaceState({}, "", "/?lang=DE");
    const loadInitialLocale = vi.fn((): Promise<Locale> => {
      if (failure === "throw") throw new Error("unavailable");
      return Promise.reject(new Error("unavailable"));
    });
    const query = vi.fn().mockResolvedValue({ trackingNumber: "AAA", status: "Found" });
    const { result } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} query={query}>{children}</TrackingRuntimeProvider>
    });
    await act(async () => { await result.current.query(request); });
    expect(result.current.localeReady).toBe(true);
    expect(result.current.locale).toBe("DE");
    expect(result.current.phase).toBe("success");
    expect(query).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("bestrack_locale")).toBeNull();
  });

  it("falls back to English and unblocks a failed loader without an explicit choice", async () => {
    const loadInitialLocale = vi.fn().mockRejectedValue(new Error("unavailable"));
    const { result } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale}>{children}</TrackingRuntimeProvider>
    });
    await waitFor(() => expect(result.current.localeReady).toBe(true));
    expect(result.current.locale).toBe("EN");
  });

  it.each(["DE", "EN"] as const)("keeps a manual %s selection when the automatic result arrives later", async (manualLocale) => {
    const pending = deferred<Locale>();
    const loadInitialLocale = () => pending.promise;
    const transport = { post: vi.fn().mockResolvedValue({ code: 0, data: null }) };
    const queryRecommendations = async () => [];
    const { result } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} transport={transport} queryRecommendations={queryRecommendations}>{children}</TrackingRuntimeProvider>
    });
    act(() => { result.current.setLocale(manualLocale); });
    await act(async () => { pending.resolve("FR"); });
    await act(async () => { await result.current.query(request); });
    expect(result.current.locale).toBe(manualLocale);
    expect(transport.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ lang: manualLocale }));
  });

  it("aborts the previous source and prevents its waiting query and result from applying", async () => {
    const first = deferred<Locale>();
    const second = deferred<Locale>();
    const firstLoader = vi.fn<(signal: AbortSignal) => Promise<Locale>>(() => first.promise);
    const secondLoader = vi.fn<(signal: AbortSignal) => Promise<Locale>>(() => second.promise);
    let loadInitialLocale = firstLoader;
    const query = vi.fn().mockResolvedValue({ trackingNumber: "AAA", status: "Found" });
    const { result, rerender } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} query={query}>{children}</TrackingRuntimeProvider>
    });
    let oldLookup!: Promise<void>;
    act(() => { oldLookup = result.current.query(request); });
    await waitFor(() => expect(firstLoader).toHaveBeenCalledOnce());
    loadInitialLocale = secondLoader;
    rerender();
    expect(firstLoader.mock.calls[0][0].aborted).toBe(true);
    await act(async () => { second.resolve("DE"); });
    await act(async () => { first.resolve("FR"); await oldLookup; });
    expect(result.current.locale).toBe("DE");
    expect(result.current.localeReady).toBe(true);
    expect(query).not.toHaveBeenCalled();
    await act(async () => { await result.current.query(request); });
    expect(query).toHaveBeenCalledOnce();
  });

  it.each(["replace", "remove"])("allows another form submission after a pending loader is %sd", async (change) => {
    const first = deferred<Locale>();
    const second = deferred<Locale>();
    const latest = deferred<{ trackingNumber: string; status: string }>();
    const firstLoader = () => first.promise;
    const secondLoader = () => second.promise;
    const query = vi.fn(() => latest.promise);
    const page = (loader?: () => Promise<Locale>) => <TrackingRuntimeProvider loadInitialLocale={loader} query={query}><TrackingForm /></TrackingRuntimeProvider>;
    const { rerender } = render(page(firstLoader));
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(screen.getByRole("button", { name: "Track" })).toBeDisabled();
    rerender(page(change === "replace" ? secondLoader : undefined));
    expect(screen.getByLabelText("Query phase")).toHaveTextContent("idle");
    expect(screen.getByRole("button", { name: "Track" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BBB" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    await act(async () => { second.resolve("DE"); });
    await waitFor(() => expect(query).toHaveBeenCalledExactlyOnceWith({ mode: "tracking", trackingNumber: "BBB" }));
    await act(async () => { first.resolve("FR"); });
    expect(screen.getByLabelText("Query phase")).toHaveTextContent("loading");
    expect(screen.getByRole("button", { name: "Track" })).toBeDisabled();
    await act(async () => { latest.resolve({ trackingNumber: "BBB", status: "Found" }); });
    expect(screen.getByLabelText("Tracking result")).toHaveTextContent("BBB");
    expect(screen.getByRole("button", { name: "Track" })).toBeEnabled();
  });

  it("ignores an old network response after the form submits with a replacement loader", async () => {
    const second = deferred<Locale>();
    const oldResponse = deferred<{ trackingNumber: string; status: string }>();
    const newResponse = deferred<{ trackingNumber: string; status: string }>();
    const firstLoader = async (): Promise<Locale> => "FR";
    const secondLoader = () => second.promise;
    const query = vi.fn().mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    const page = (loader: () => Promise<Locale>) => <TrackingRuntimeProvider loadInitialLocale={loader} query={query}><TrackingForm /></TrackingRuntimeProvider>;
    const { rerender } = render(page(firstLoader));
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    await waitFor(() => expect(query).toHaveBeenCalledOnce());
    rerender(page(secondLoader));
    expect(screen.getByRole("button", { name: "Track" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BBB" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    await act(async () => { second.resolve("DE"); });
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    await act(async () => { oldResponse.resolve({ trackingNumber: "AAA", status: "Old" }); });
    expect(screen.getByLabelText("Query phase")).toHaveTextContent("loading");
    expect(screen.getByLabelText("Tracking result")).toBeEmptyDOMElement();
    await act(async () => { newResponse.resolve({ trackingNumber: "BBB", status: "New" }); });
    expect(screen.getByLabelText("Tracking result")).toHaveTextContent("BBB");
  });

  it("keeps a new query started before the previous loader cleanup", async () => {
    const first = deferred<Locale>();
    const second = deferred<Locale>();
    let loadInitialLocale = () => first.promise;
    const query = vi.fn().mockResolvedValue({ trackingNumber: "BBB", status: "Found" });
    const { result, rerender } = renderHook(({ submit }) => {
      const runtime = useTrackingRuntime();
      const submitQuery = runtime.query;
      useLayoutEffect(() => {
        if (submit) void submitQuery({ mode: "tracking", trackingNumber: "BBB" });
      }, [submitQuery, submit]);
      return runtime;
    }, {
      initialProps: { submit: false },
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} query={query}>{children}</TrackingRuntimeProvider>
    });
    act(() => { void result.current.query(request); });
    loadInitialLocale = () => second.promise;
    rerender({ submit: true });
    expect(result.current.phase).toBe("loading");
    await act(async () => { first.resolve("FR"); second.resolve("DE"); });
    expect(query).toHaveBeenCalledExactlyOnceWith({ mode: "tracking", trackingNumber: "BBB" });
    expect(result.current.phase).toBe("success");
  });

  it("keeps an existing successful result and history when the loader changes", async () => {
    const firstLoader = async (): Promise<Locale> => "FR";
    const secondLoader = async (): Promise<Locale> => "DE";
    let loadInitialLocale = firstLoader;
    const query = vi.fn().mockResolvedValue({ trackingNumber: "AAA", status: "Found" });
    const { result, rerender } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} query={query}>{children}</TrackingRuntimeProvider>
    });
    await act(async () => { await result.current.query(request); });
    loadInitialLocale = secondLoader;
    rerender();
    await waitFor(() => expect(result.current.localeReady).toBe(true));
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.trackingNumber).toBe("AAA");
    expect(result.current.recentQueries).toHaveLength(1);
    expect(query).toHaveBeenCalledOnce();
  });

  it("aborts initialization on unmount and never starts its waiting lookup", async () => {
    const pending = deferred<Locale>();
    const loadInitialLocale = vi.fn<(signal: AbortSignal) => Promise<Locale>>(() => pending.promise);
    const query = vi.fn();
    const { result, unmount } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} query={query}>{children}</TrackingRuntimeProvider>
    });
    let lookup!: Promise<void>;
    act(() => { lookup = result.current.query(request); });
    await waitFor(() => expect(loadInitialLocale).toHaveBeenCalledOnce());
    unmount();
    expect(loadInitialLocale.mock.calls[0][0].aborted).toBe(true);
    await act(async () => { pending.resolve("FR"); await lookup; });
    expect(query).not.toHaveBeenCalled();
  });

  it("waits again when returning to a previously completed source", async () => {
    const pending = deferred<Locale>();
    const firstLoader = vi.fn<() => Promise<Locale>>().mockResolvedValueOnce("FR").mockImplementation(() => pending.promise);
    const secondLoader = () => pending.promise;
    let loadInitialLocale: () => Promise<Locale> = firstLoader;
    const { result, rerender } = renderHook(useTrackingRuntime, {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale}>{children}</TrackingRuntimeProvider>
    });
    await waitFor(() => expect(result.current.localeReady).toBe(true));
    loadInitialLocale = secondLoader;
    rerender();
    expect(result.current.localeReady).toBe(false);
    loadInitialLocale = firstLoader;
    rerender();
    expect(result.current.localeReady).toBe(false);
    await act(async () => { pending.resolve("DE"); });
    expect(result.current.localeReady).toBe(true);
    expect(result.current.locale).toBe("DE");
  });

  it("preserves the initial deep link and runs it once after readiness in StrictMode", async () => {
    window.history.replaceState({}, "", "/?tracking_number=DEEPLINK");
    const pending = deferred<Locale>();
    const loadInitialLocale = vi.fn(() => pending.promise);
    const transport = { post: vi.fn().mockResolvedValue({ code: 0, data: null }) };
    const queryRecommendations = async () => [];
    const { result } = renderHook(() => ({ runtime: useTrackingRuntime(), form: useTrackingQueryForm({ initialTrackingNumber: "" }) }), {
      wrapper: ({ children }) => <StrictMode><TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} transport={transport} queryRecommendations={queryRecommendations}>{children}</TrackingRuntimeProvider></StrictMode>
    });
    expect(result.current.form.submitDisabled).toBe(false);
    expect(result.current.form.trackingNumber).toBe("DEEPLINK");
    expect(transport.post).not.toHaveBeenCalled();
    await act(async () => { pending.resolve("FR"); });
    await waitFor(() => expect(result.current.runtime.phase).toBe("success"));
    expect(loadInitialLocale).toHaveBeenCalledOnce();
    expect(transport.post).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({ tracking_number: "DEEPLINK", lang: "FR" }));
    expect(result.current.form.submitDisabled).toBe(false);
    expect(window.location.search).toBe("?tracking_number=DEEPLINK");
  });

  it("accepts a manual submission while initialization is pending and skips the original deep link", async () => {
    window.history.replaceState({}, "", "/?tracking_number=DEEPLINK");
    const pending = deferred<Locale>();
    const loadInitialLocale = () => pending.promise;
    const transport = { post: vi.fn().mockResolvedValue({ code: 0, data: null }) };
    const queryRecommendations = async () => [];
    const { result } = renderHook(() => ({ runtime: useTrackingRuntime(), form: useTrackingQueryForm({ initialTrackingNumber: "" }) }), {
      wrapper: ({ children }) => <TrackingRuntimeProvider loadInitialLocale={loadInitialLocale} transport={transport} queryRecommendations={queryRecommendations}>{children}</TrackingRuntimeProvider>
    });
    expect(result.current.form.submitDisabled).toBe(false);
    act(() => { result.current.form.setTrackingNumber("MANUAL"); });
    act(() => { result.current.form.submit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>); });
    expect(result.current.runtime.localeReady).toBe(false);
    expect(result.current.runtime.phase).toBe("loading");
    expect(result.current.form.submitDisabled).toBe(true);
    expect(transport.post).not.toHaveBeenCalled();
    await act(async () => { pending.resolve("FR"); });
    await waitFor(() => expect(result.current.runtime.phase).toBe("success"));
    expect(transport.post).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({ tracking_number: "MANUAL", lang: "FR" }));
  });
});
