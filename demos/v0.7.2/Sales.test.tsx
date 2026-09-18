import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackSalesExtension, SalesRuntimeProvider, type ReadyToGoTrackingQuery, type TrackingPageQuery } from "../../packages/besttrack-page-extension/src";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

describe("V0.7.2 Sales", () => {
  it("registers sales@1.0.0 with the seven commerce blocks", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const template = registry.getTemplate("besttrack.sales");
    expect(template).toMatchObject({ source: "built-in", version: 1, theme: { "color.primary": "#dc2626" } });
    expect(template?.create().blocks.map((block) => block.type)).toEqual(["besttrack.sales.announcement", "besttrack.sales.query", "besttrack.sales.order-items", "besttrack.sales.other-tracking", "besttrack.sales.service-cards", "besttrack.sales.product-categories", "besttrack.sales.recommendations"]);
  });

  it("uses one tracking query for sales order items and product recommendations", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const query = vi.fn<ReadyToGoTrackingQuery>().mockResolvedValue({ trackingNumber: "BT-2024", status: "In transit", orderItems: [{ id: "case", title: "Travel case", quantity: 1 }], recommendations: [{ id: "cover", title: "Delivery cover", description: "A simple protection plan." }] });
    render(<SalesRuntimeProvider queryTracking={query}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith("BT-2048-DEMO"));
    expect(await screen.findByText("Travel case")).toBeVisible();
    expect(screen.getByText("Delivery cover")).toBeVisible();
  });

  it("shows controlled empty and invalid collection-resource states", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const document = registry.getTemplate("besttrack.sales")!.create();
    const categories = document.blocks.find((block) => block.type === "besttrack.sales.product-categories")!;
    categories.props = { ...categories.props, collectionId: "" };
    render(<SalesRuntimeProvider queryTracking={async () => ({ trackingNumber: "BT-1", status: "idle" })}><WebRenderer document={document} registry={registry} /></SalesRuntimeProvider>);
    expect(screen.getByText("No collection selected. Choose a collection through an authorized resource integration.")).toBeVisible();
  });

  it("renders Consumer Runtime empty results, secondary shipments, and safe product fallbacks", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const query = vi.fn<TrackingPageQuery>().mockResolvedValueOnce({ trackingNumber: "BT-empty", status: "Not found", outcome: "empty" }).mockResolvedValueOnce({ trackingNumber: "BT-main", status: "In transit", shipments: [{ id: "main", label: "Main shipment", trackingNumber: "BT-main" }, { id: "second", label: "Shipment #2", trackingNumber: "BT-second", status: "Delivered" }], orderItems: [{ id: "case", title: "Travel case", quantity: 1, imageUrl: "javascript:unsafe" }], recommendations: [{ id: "cover", title: "Delivery cover", description: "A simple protection plan.", imageUrl: "javascript:unsafe", href: "javascript:unsafe" }] });
    render(<SalesRuntimeProvider queryTracking={query}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByText("We couldn’t find an order for that number.")).toBeVisible();
    expect(screen.getByText("No order items are available for that number.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByText("Shipment #2")).toBeVisible();
    expect(screen.getByLabelText("Travel case image unavailable")).toBeVisible();
    expect(screen.getByLabelText("Delivery cover image unavailable")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Delivery cover" })).not.toBeInTheDocument();
  });

  it("does not expose a Consumer Runtime error message in the storefront", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    render(<SalesRuntimeProvider queryTracking={async () => { throw new Error("upstream credential detail"); }}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByText("We couldn’t retrieve this order right now. Please try again later.")).toBeVisible();
    expect(screen.queryByText("upstream credential detail")).not.toBeInTheDocument();
  });

});
