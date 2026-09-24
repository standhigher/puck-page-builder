import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadyToGoDeliveryBlock, ReadyToGoDeliveryEditor, ReadyToGoQueryBlock, ReadyToGoRuntimeProvider } from "./ready-to-go";
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

    const ad = container.querySelector<HTMLElement>("[data-tracking-page-ad]");
    const image = ad?.querySelector("img");
    const link = ad?.closest("a");
    expect(image).not.toBeNull();
    expect(link).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.example.test/promo.png");
    expect(link?.getAttribute("href")).toBe("https://example.test/promo");
    expect(ad?.style.aspectRatio).toBe("20 / 9");
    expect(ad?.style.width).toBe("100%");
    expect(ad?.style.maxWidth).toBe("500px");
    expect(image?.style.objectFit).toBe("fill");
    expect(image?.style.position).toBe("absolute");
    expect(image?.style.inset).toBe("0");
    expect(image?.style.width).toBe("100%");
    expect(image?.style.height).toBe("100%");
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

  it("previews host ad changes without making the editor image navigate", () => {
    const editor = <ReadyToGoDeliveryEditor blockId="delivery" selected onPropsChange={vi.fn()} />;
    const { container, rerender } = render(<ReadyToGoRuntimeProvider adPreview={{ imageUrl: "https://cdn.example/promo.png", href: "https://example.com/sale" }}>{editor}</ReadyToGoRuntimeProvider>);
    expect(container.querySelector("[data-tracking-page-ad] img")).toHaveAttribute("src", "https://cdn.example/promo.png");
    expect(container.querySelector("[data-tracking-page-ad]")?.tagName).toBe("DIV");
    rerender(<ReadyToGoRuntimeProvider adPreview={null}>{editor}</ReadyToGoRuntimeProvider>);
    expect(container.querySelector("[data-tracking-page-ad]")).toBeNull();
  });

  it("hides the editor ad slot when preview data has no ad", () => {
    const { container, queryByText } = render(
      <ReadyToGoDeliveryEditor heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" blockId="delivery" selected onPropsChange={vi.fn()} />
    );
    expect(container.querySelector("[data-tracking-page-ad]")).toBeNull();
    expect(queryByText("Advertisement space")).toBeNull();
  });
});
