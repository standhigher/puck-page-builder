import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackingQueryCard, TrackingQueryResultDetails } from "./tracking-query-experience";

const sharedProps = {
  onQuery: vi.fn(async () => undefined),
  heading: "Track your order",
  submitLabel: "Track",
  initialTrackingNumber: "BT-2048-DEMO",
  cardStyle: { maxHeight: 480, padding: 24, background: "#fff" }
};
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");

afterEach(() => {
  vi.restoreAllMocks();
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
});

describe("TrackingQueryCard", () => {
  it("preserves each tab's input and focuses the first invalid field", () => {
    render(<TrackingQueryCard {...sharedProps} phase="idle" />);

    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-9000" } });
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "#1000" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.test" } });
    fireEvent.click(screen.getByRole("tab", { name: "Tracking Number" }));
    expect((screen.getByLabelText("Tracking number") as HTMLInputElement).value).toBe("BT-9000");

    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "bad input" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a valid tracking number.");
    expect(document.activeElement).toBe(screen.getByLabelText("Tracking number"));
    expect(sharedProps.onQuery).not.toHaveBeenCalled();
  });

  it("submits the final discriminated request and scrolls only the query card", () => {
    const onQuery = vi.fn(async () => undefined);
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    const { rerender } = render(<TrackingQueryCard {...sharedProps} onQuery={onQuery} phase="idle" />);

    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(onQuery).toHaveBeenCalledWith({ mode: "tracking", trackingNumber: "BT-2048-DEMO" });

    rerender(<TrackingQueryCard {...sharedProps} onQuery={onQuery} phase="success" result={<p>Delivered</p>} />);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Tracking result" }));
  });

  it("uses a keyboard-operable tablist and keeps a narrow result card internally scrollable", () => {
    render(<TrackingQueryCard {...sharedProps} phase="idle" />);

    const trackingTab = screen.getByRole("tab", { name: "Tracking Number" });
    fireEvent.keyDown(trackingTab, { key: "ArrowRight" });
    const orderTab = screen.getByRole("tab", { name: "Order Number" });
    expect(orderTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(orderTab);
    expect(screen.getByRole("tabpanel", { name: "Order Number" })).not.toBeNull();

    fireEvent.keyDown(orderTab, { key: "Home" });
    expect(trackingTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(trackingTab);

    const card = document.querySelector<HTMLElement>("[data-tracking-query-card]")!;
    expect(card.style.boxSizing).toBe("border-box");
    expect(card.style.minWidth).toBe("0");
    expect(card.style.maxWidth).toBe("100%");
    expect(card.style.overflowX).toBe("hidden");
    expect(card.style.overflowY).toBe("auto");
    expect(card.style.overscrollBehavior).toBe("contain");
    expect(trackingTab.style.minHeight).toBe("44px");
  });

  it("focuses and announces empty and failed query states within the card", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    const { rerender } = render(<TrackingQueryCard {...sharedProps} phase="idle" />);

    rerender(<TrackingQueryCard {...sharedProps} phase="empty" />);
    const emptyStatus = screen.getByRole("region", { name: "Tracking query status" });
    expect(document.activeElement).toBe(emptyStatus);
    expect(emptyStatus.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("couldn't find an order");

    rerender(<TrackingQueryCard {...sharedProps} phase="error" />);
    const errorStatus = screen.getByRole("region", { name: "Tracking query status" });
    expect(document.activeElement).toBe(errorStatus);
    expect(screen.getByRole("alert").textContent).toContain("couldn't retrieve this order");
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });
});

describe("TrackingQueryResultDetails", () => {
  it("renders the full in-card result with five stages, bounded events and item prices", () => {
    render(<TrackingQueryResultDetails result={{
      trackingNumber: "BT-2048",
      orderNumber: "#2048",
      status: "In transit",
      carrier: "BestTrack Express",
      estimatedDelivery: "Sep 12",
      destination: "Austin, TX",
      transitDuration: "3 days",
      events: [
        { id: "one", title: "At local facility", state: "current" },
        { id: "two", title: "Departed regional hub" },
        { id: "three", title: "Accepted by carrier" },
        { id: "four", title: "Shipment information received" }
      ],
      orderItems: [{ id: "tote", title: "Studio tote", quantity: 2, price: { amount: 1200, compareAtAmount: 1500, currencyCode: "USD" } }]
    }} />);

    expect(screen.getByLabelText("Delivery progress").querySelectorAll("li")).toHaveLength(5);
    expect(screen.getByText("BestTrack Express")).not.toBeNull();
    expect(screen.getByText("Austin, TX")).not.toBeNull();
    expect(screen.getByText("3 days")).not.toBeNull();
    expect(screen.getByText("#2048")).not.toBeNull();
    expect(screen.getByText("$12.00")).not.toBeNull();
    expect(screen.getByText("$15.00")).not.toBeNull();
    expect(screen.getByLabelText("Studio tote image unavailable")).not.toBeNull();
    expect(screen.queryByText("Shipment information received")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show all events" }));
    expect(screen.getByText("Shipment information received")).not.toBeNull();
  });

  it("gives every result action a 44px touch target and wraps result metadata", () => {
    render(<TrackingQueryResultDetails onTrackAnother={() => undefined} result={{
      trackingNumber: "VERY-LONG-TRACKING-NUMBER-THAT-MUST-NOT-CAUSE-HORIZONTAL-OVERFLOW",
      status: "In transit",
      events: [
        { id: "one", title: "One" },
        { id: "two", title: "Two" },
        { id: "three", title: "Three" },
        { id: "four", title: "Four" }
      ]
    }} />);

    for (const name of ["Track another", "Copy", "Show all events"]) {
      const action = screen.getByRole("button", { name });
      expect(action.style.minWidth).toBe("44px");
      expect(action.style.minHeight).toBe("44px");
    }
    const details = screen.getByLabelText("Tracking result details");
    expect(details.style.minWidth).toBe("0");
    expect(details.style.overflowWrap).toBe("anywhere");
  });
});
