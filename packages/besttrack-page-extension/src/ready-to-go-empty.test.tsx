import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadyToGoDeliveryBlock, ReadyToGoProgressBlock, ReadyToGoQueryBlock, ReadyToGoRecommendationsBlock, ReadyToGoRuntimeProvider } from "./ready-to-go";
import type { ShopifyTrackPagePost } from "./shopify-track-query";
import type { TrackingPageQuery } from "./tracking-page-runtime";

describe("Ready-to-go missing order", () => {
  it("replaces previous delivery and ad with one Shopify empty state while retaining independent recommendations", async () => {
    const query = vi.fn<TrackingPageQuery>()
      .mockResolvedValueOnce({ trackingNumber: "BT-2048", status: "Delivered", ad: { imageUrl: "https://example.test/promo.png" } })
      .mockResolvedValueOnce({ trackingNumber: "", status: "", outcome: "empty" })
      .mockResolvedValueOnce({ trackingNumber: "BT-2048", status: "Delivered" });
    const recommendations = vi.fn(async () => [{ id: "tote", title: "Travel tote", description: "For your next trip" }]);
    const { container } = render(<ReadyToGoRuntimeProvider query={query} queryRecommendations={recommendations}>
      <ReadyToGoQueryBlock submitLabel="Find" />
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
      <ReadyToGoRecommendationsBlock />
    </ReadyToGoRuntimeProvider>);
    expect(await screen.findByText("Travel tote")).toBeVisible();
    expect(screen.queryByLabelText("Shipping Details")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Shipment progress")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "#2048" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByAltText("Promotion")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Can not find order");
    expect(screen.getAllByText("Can not find order")).toHaveLength(1);
    expect(screen.queryByLabelText("Shipping Details")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Shipment progress")).not.toBeInTheDocument();
    expect(container.querySelector("[data-tracking-page-ad]")).toBeNull();
    expect(screen.getByText("Travel tote")).toBeVisible();
    expect(recommendations).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith({ mode: "order", orderNumber: "#2048", email: "buyer@example.test" });
    const illustration = screen.getByLabelText("Order not found").querySelector("img");
    expect(illustration).toHaveAttribute("src", expect.stringContaining("data:image/png;base64,"));
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText("Not available")).toBeVisible();
    expect(screen.queryByLabelText("Order not found")).not.toBeInTheDocument();
  });

  it("keeps a failed request distinct from a missing order", async () => {
    const query = vi.fn<TrackingPageQuery>().mockRejectedValue(new Error("timeout"));
    render(<ReadyToGoRuntimeProvider query={query}>
      <ReadyToGoQueryBlock submitLabel="Find" />
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
    </ReadyToGoRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again later.");
    expect(screen.queryByLabelText("Order not found")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo shipment item")).not.toBeInTheDocument();
  });

  it("uses the original Track Page input rules instead of the stricter PRD regex", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "AB", status: "Ordered" });
    render(<ReadyToGoRuntimeProvider query={query} watermark={{ visible: false }}>
      <ReadyToGoQueryBlock submitLabel="Find" defaultTrackingNumber="" />
      <ReadyToGoProgressBlock />
    </ReadyToGoRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(screen.getByText("Please enter your tracking number")).toBeVisible();
    expect(query).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "AB" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith({ mode: "tracking", trackingNumber: "AB" }));
    expect(screen.getByRole("heading", { name: "Ordered" })).toBeVisible();
  });

  it("shows the original missing-order state when the Track Page transport throws", async () => {
    const post = vi.fn().mockRejectedValue(new Error("timeout"));
    render(<ReadyToGoRuntimeProvider transport={{ post, locale: "EN", retries: 0 }} autoQueryFromUrl={false} watermark={{ visible: false }}>
      <ReadyToGoQueryBlock submitLabel="Find" />
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
    </ReadyToGoRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Can not find order");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/^\/track\/query\?_t=\d+$/), {
      order_number: "",
      email: "",
      tracking_number: "BT-2048-DEMO",
      lang: "EN"
    });
  });

  it("auto-queries the demo tracking number only when preview auto-query is enabled", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({
      trackingNumber: "BT-PREVIEW-DEMO",
      status: "In transit",
      carrier: "BestTrack demo carrier",
      estimatedDelivery: "Sep 22 - Sep 24",
      orderItems: [{ id: "demo-item", title: "Demo shipment item", quantity: 1 }]
    });
    const { rerender } = render(<ReadyToGoRuntimeProvider query={query}>
      <ReadyToGoQueryBlock submitLabel="Find" defaultTrackingNumber="BT-PREVIEW-DEMO" />
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
    </ReadyToGoRuntimeProvider>);
    expect(query).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Shipment progress")).not.toBeInTheDocument();
    rerender(<ReadyToGoRuntimeProvider query={query} autoQueryDemo>
      <ReadyToGoQueryBlock submitLabel="Find" defaultTrackingNumber="BT-PREVIEW-DEMO" />
      <ReadyToGoProgressBlock />
      <ReadyToGoDeliveryBlock />
    </ReadyToGoRuntimeProvider>);
    await waitFor(() => expect(query).toHaveBeenCalledWith({ mode: "tracking", trackingNumber: "BT-PREVIEW-DEMO" }));
    expect(await screen.findByRole("heading", { name: "In transit" })).toBeVisible();
    expect(screen.getByLabelText("Shipment progress")).toBeVisible();
    expect(screen.queryByLabelText("Est. Delivery")).not.toBeInTheDocument();
    expect(screen.queryByText("Sep 22 - Sep 24")).not.toBeInTheDocument();
    expect(screen.getByText("Demo shipment item")).toBeVisible();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("loads original /products/recommend on mount without a tracking query", async () => {
    const post = vi.fn(async (url: string) => {
      if (String(url).includes("/products/recommend")) {
        return { data: { products: [{ id: "gid://shopify/Product/1", title: "Travel tote", handle: "travel-tote" }] } };
      }
      throw new Error("unexpected tracking call");
    });
    render(<ReadyToGoRuntimeProvider transport={{ post: post as unknown as ShopifyTrackPagePost, retries: 0 }} autoQueryFromUrl={false} watermark={{ visible: false }}>
      <ReadyToGoQueryBlock submitLabel="Find" />
      <ReadyToGoRecommendationsBlock />
    </ReadyToGoRuntimeProvider>);
    expect(await screen.findByText("Travel tote")).toBeVisible();
    expect(post).toHaveBeenCalledWith("/products/recommend", { page: 1, page_size: 20 });
    expect(screen.queryByLabelText("Shipment progress")).not.toBeInTheDocument();
  });
});
