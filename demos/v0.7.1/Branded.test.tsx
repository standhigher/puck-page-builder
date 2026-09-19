import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackBrandedExtension, BrandedRuntimeProvider, type ReadyToGoTrackingQuery, type TrackingPageQuery } from "../../packages/besttrack-page-extension/src";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

describe("V0.7.1 Branded", () => {
  it("registers the composite tracking experience in the five-block Branded template", () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const template = registry.getTemplate("besttrack.branded");
    expect(template).toMatchObject({ source: "built-in", version: 1, theme: { "color.primary": "#000000", "font.family": "Arial, Helvetica, sans-serif", radius: "10px" } });
    expect(template?.create().blocks.map((block) => block.type)).toEqual(["besttrack.branded.announcement", "besttrack.branded.tracking-experience", "besttrack.branded.recommendations", "besttrack.branded.quick-links", "besttrack.branded.blog"]);
  });

  it("keeps the selected shipment, result progress, details and recommendations in one tracking journey", async () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const query = vi.fn<ReadyToGoTrackingQuery>().mockResolvedValue({ trackingNumber: "BT-1000", status: "In transit", shipments: [{ id: "first", label: "Shipment #1", trackingNumber: "BT-first", orderItems: [{ id: "tote", title: "Studio tote", quantity: 2 }], recommendations: [{ id: "cover", title: "Shipping cover", description: "Protection for a future order." }], progress: [{ id: "ordered", label: "Ordered", state: "complete" }, { id: "transit", label: "In Transit", state: "current" }], events: [{ id: "hub", title: "Accepted at regional hub", at: "Sep 4, 3:51 PM", state: "current" }] }, { id: "second", label: "Shipment #2", trackingNumber: "BT-second", status: "Order Ready", orderItems: [{ id: "case", title: "Travel case", quantity: 1 }], recommendations: [], events: [{ id: "packing", title: "Package is being prepared", state: "current" }] }] });
    render(<BrandedRuntimeProvider queryTracking={query}><WebRenderer document={registry.getTemplate("besttrack.branded")!.create()} registry={registry} /></BrandedRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith("DEMO-YQTRACK9999"));
    expect(await screen.findByText("Studio tote")).toBeVisible();
    expect(screen.getByText("In transit")).toBeVisible();
    expect(screen.getByLabelText("Delivery progress")).toBeVisible();
    expect(screen.getByText("Accepted at regional hub")).toBeVisible();
    expect(screen.getByText("Shipping cover")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Shipment #2" }));
    expect(await screen.findByText("Travel case")).toBeVisible();
    expect(screen.getByText("Tracking: BT-second")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Order Ready" })).toBeVisible();
    expect(screen.getByText("Package is being prepared")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Track another order" }));
    expect(screen.getByRole("heading", { name: "Track your order" })).toBeVisible();
  });

  it("keeps configured brand content and links on the namespaced surface", () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const document = registry.getTemplate("besttrack.branded")!.create();
    document.blocks[0]!.props = { ...document.blocks[0]!.props, message: "Northstar summer sale", href: "/collections/summer" };
    render(<BrandedRuntimeProvider queryTracking={async () => ({ trackingNumber: "BT-2048-DEMO", status: "idle" })}><WebRenderer document={document} registry={registry} /></BrandedRuntimeProvider>);
    expect(screen.getByText("Northstar summer sale")).toBeVisible();
    expect(screen.getByLabelText("Branded announcement")).toHaveStyle({ background: "#252525" });
    expect(screen.getByRole("link", { name: "Northstar summer sale" })).toHaveAttribute("href", "/collections/summer");
  });

  it("renders configured query tab labels", () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const document = registry.getTemplate("besttrack.branded")!.create();
    const experience = document.blocks.find((block) => block.type === "besttrack.branded.tracking-experience")!;
    experience.props = { ...experience.props, orderTabLabel: "Order ID", trackingTabLabel: "Parcel code" };
    render(<BrandedRuntimeProvider query={async () => ({ trackingNumber: "BT-2048-DEMO", status: "idle" })}><WebRenderer document={document} registry={registry} /></BrandedRuntimeProvider>);
    expect(screen.getByRole("tab", { name: "Order ID" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Parcel code" })).toBeVisible();
  });

  it("uses the shared Consumer Runtime empty and error states without exposing host errors", async () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const emptyQuery = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-empty", status: "Not found", outcome: "empty" });
    const { rerender } = render(<BrandedRuntimeProvider queryTracking={emptyQuery}><WebRenderer document={registry.getTemplate("besttrack.branded")!.create()} registry={registry} /></BrandedRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText("We couldn’t find an order for that number.")).toBeVisible();
    expect(screen.queryByLabelText("Tracking result")).not.toBeInTheDocument();

    rerender(<BrandedRuntimeProvider queryTracking={async () => { throw new Error("upstream credential detail"); }}><WebRenderer document={registry.getTemplate("besttrack.branded")!.create()} registry={registry} /></BrandedRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText("We couldn’t retrieve this order right now. Please try again later.")).toBeVisible();
    expect(screen.queryByText("upstream credential detail")).not.toBeInTheDocument();
  });

  it("renders a controlled product fallback for invalid Consumer Runtime resource URLs", async () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-safe", status: "In transit", shipments: [{ id: "first", label: "Shipment #1", recommendations: [{ id: "cover", title: "Delivery cover", description: "A simple protection plan.", imageUrl: "javascript:unsafe", href: "javascript:unsafe" }] }] });
    render(<BrandedRuntimeProvider queryTracking={query}><WebRenderer document={registry.getTemplate("besttrack.branded")!.create()} registry={registry} /></BrandedRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByLabelText("Delivery cover image unavailable")).toBeVisible();
    expect(screen.queryByRole("link", { name: "View product" })).not.toBeInTheDocument();
  });
});
