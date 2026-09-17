import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackSalesExtension, SalesRuntimeProvider, type ReadyToGoTrackingQuery } from "../../packages/besttrack-page-extension/src";
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
    expect(screen.getByText("No collection selected. Choose a collection through the authorized resource BFF.")).toBeVisible();
  });
});
