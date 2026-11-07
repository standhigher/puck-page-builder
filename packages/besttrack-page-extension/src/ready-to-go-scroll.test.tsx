import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadyToGoProgressBlock, ReadyToGoQueryBlock } from "./ready-to-go";
import { TrackingRuntimeProvider } from "./tracking-runtime";
import type { TrackingPageQuery, TrackingPageQueryResult } from "./tracking-page-runtime";

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

const outcomes = [
  { name: "success", query: async () => ({ trackingNumber: "TEST", status: "In transit" }), message: "In transit" },
  { name: "not found", query: async () => ({ outcome: "empty" as const, trackingNumber: "", status: "" }), message: "Can not find order" },
  { name: "error", query: async () => { throw new Error("upstream failure"); }, message: "Shipment progress is temporarily unavailable." }
];

function page(query: TrackingPageQuery, autoQueryFromUrl = false, autoQueryDemo = false) {
  return render(<TrackingRuntimeProvider query={query} autoQueryFromUrl={autoQueryFromUrl} autoQueryDemo={autoQueryDemo}>
    <ReadyToGoQueryBlock submitLabel="Find parcel" />
    <ReadyToGoProgressBlock />
  </TrackingRuntimeProvider>);
}

function expectResultScroll() {
  expect(document.querySelector("[data-tracking-result]")).not.toBeNull();
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(frames).toHaveLength(1);
  act(() => { frames.shift()!(0); });
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: "smooth" });
}

describe("Ready-to-go completed query scrolling", () => {
  it.each(outcomes)("scrolls to the mounted $name result after a manual lookup", async ({ query, message }) => {
    page(query);
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "TEST" } });
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    await screen.findByText(message);
    expectResultScroll();
  });

  it.each(outcomes)("scrolls to the mounted $name result after a URL lookup", async ({ query, message }) => {
    window.history.replaceState({}, "", "/#tracking_number=TEST");
    page(query, true);
    await screen.findByText(message);
    expectResultScroll();
  });

  it("also scrolls after an order-number and email lookup", async () => {
    page(outcomes[0].query);
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "ORDER" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    await screen.findByText("In transit");
    expectResultScroll();
  });

  it("does not schedule scrolling for invalid input or an unfinished request", async () => {
    let resolve!: (result: TrackingPageQueryResult) => void;
    const query = vi.fn<TrackingPageQuery>(() => new Promise((done) => { resolve = done; }));
    page(query);
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    expect(query).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "TEST" } });
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    expect(screen.getByRole("button", { name: "Find parcel" })).toBeDisabled();
    expect(frames).toHaveLength(0);
    await act(async () => { resolve(await outcomes[0].query()); });
    expectResultScroll();
  });

  it("keeps an automatic demo preview at its initial position", async () => {
    page(outcomes[0].query, false, true);
    await screen.findByText("In transit");
    expect(frames).toHaveLength(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("cancels the previous result's queued frame when another lookup starts", async () => {
    let resolve!: (result: TrackingPageQueryResult) => void;
    const query = vi.fn<TrackingPageQuery>()
      .mockResolvedValueOnce({ trackingNumber: "FIRST", status: "First result" })
      .mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    page(query);
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "FIRST" } });
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    await screen.findByText("First result");
    expect(frames).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "SECOND" } });
    fireEvent.click(screen.getByRole("button", { name: "Find parcel" }));
    act(() => { frames.shift()!(0); });
    expect(frames).toHaveLength(0);
    expect(window.scrollTo).not.toHaveBeenCalled();

    await act(async () => { resolve({ trackingNumber: "SECOND", status: "Second result" }); });
    expectResultScroll();
  });
});
