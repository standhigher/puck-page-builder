import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadyToGoDeliveryBlock, ReadyToGoQueryBlock, ReadyToGoRuntimeProvider } from "./ready-to-go";
import type { TrackingPageQuery } from "./tracking-page-runtime";

describe("Ready-to-go dynamic promotion slot", () => {
  it("renders an API-provided ad after a successful query", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({
      trackingNumber: "BT-2048",
      status: "In transit",
      ad: { imageUrl: "https://cdn.example.test/promo.png", href: "https://example.test/promo" }
    });
    const { container, getByRole } = render(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryBlock heading="Track" submitLabel="Find" />
        <ReadyToGoDeliveryBlock heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" />
      </ReadyToGoRuntimeProvider>
    );

    fireEvent.click(getByRole("button", { name: "Find" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith({ mode: "tracking", trackingNumber: "BT-2048-DEMO" }));

    const ad = container.querySelector("[data-tracking-page-ad]");
    const image = ad?.querySelector("img");
    const link = ad?.closest("a");
    expect(image).not.toBeNull();
    expect(link).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.example.test/promo.png");
    expect(link?.getAttribute("href")).toBe("https://example.test/promo");
  });

  it("keeps the live ad slot collapsed when the response has no ad", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-2048", status: "Delivered" });
    const { container, getByRole } = render(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryBlock heading="Track" submitLabel="Find" />
        <ReadyToGoDeliveryBlock heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" />
      </ReadyToGoRuntimeProvider>
    );

    fireEvent.click(getByRole("button", { name: "Find" }));
    await waitFor(() => expect(query).toHaveBeenCalled());
    expect(container.querySelector("[data-tracking-page-ad]")).toBeNull();
  });
});
