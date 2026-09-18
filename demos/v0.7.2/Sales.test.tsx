import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackSalesExtension, SalesRuntimeProvider, type ReadyToGoTrackingQuery, type TrackingPageQuery, type TrackingPageQueryResult } from "../../packages/besttrack-page-extension/src";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

describe("V0.7.2 Sales", () => {
  it("registers sales@1.0.0 with the seven commerce blocks", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const template = registry.getTemplate("besttrack.sales");
    expect(template).toMatchObject({ source: "built-in", version: 1, theme: { "color.primary": "#000000" } });
    expect(template?.create().blocks.map((block) => block.type)).toEqual(["besttrack.sales.announcement", "besttrack.sales.query", "besttrack.sales.order-items", "besttrack.sales.other-tracking", "besttrack.sales.service-cards", "besttrack.sales.product-categories", "besttrack.sales.recommendations"]);
    expect(template?.create().blocks.map((block) => block.id)).toEqual(["sales-1", "sales-2", "sales-3", "sales-4", "sales-5", "sales-6", "sales-7"]);
    expect(template?.create().blocks.every((block) => block.variant === "hero")).toBe(true);
    expect(registry.getBlock("besttrack.sales.query")?.variants?.some((variant) => variant.id === "commerce")).toBe(true);
  });

  it("renders the responsive Sales Hero with a safe image and tracking-only query control", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const { container } = render(<SalesRuntimeProvider queryTracking={async () => ({ trackingNumber: "BT-2024", status: "In transit" })}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    const hero = container.querySelector<HTMLElement>("[data-sales-hero]");
    const card = container.querySelector<HTMLElement>("[data-sales-query-card]");
    const image = container.querySelector<HTMLImageElement>("[data-sales-hero-image]");
    expect(hero).toHaveStyle({ minHeight: "clamp(460px, 52vw, 620px)" });
    expect(card).toHaveStyle({ width: "min(560px, 100%)" });
    expect(image?.src).toContain("images.unsplash.com");
    expect(screen.getByPlaceholderText("Enter your tracking number")).toBeVisible();
    expect(screen.getByText("Powered by BestTrack")).toBeVisible();
    expect(screen.queryByRole("tab", { name: /order number/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Order Number")).not.toBeInTheDocument();
  });

  it("renders a token-independent Sales Hero editor preview", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const query = registry.getBlock("besttrack.sales.query")!;
    const Editor = query.render.editor!;
    const { container } = render(<Editor {...query.defaultProps} blockId="sales-2" selected onPropsChange={() => undefined} />);
    expect(container.querySelector('[aria-label="Sales Hero query editor"]')).toHaveStyle({ background: "rgb(10, 10, 10)" });
    expect(screen.getByLabelText("Canvas default tracking number")).toHaveStyle({ minHeight: "58px", background: "rgb(255, 255, 255)" });
    expect(screen.getByText("Powered by BestTrack")).toBeVisible();
  });

  it("continues to render published Sales v1 commerce variants", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const document = registry.getTemplate("besttrack.sales")!.create();
    document.blocks.forEach((block) => { block.variant = "commerce"; });
    expect(document.blocks.every((block) => registry.getBlock(block.type)?.variants?.some((variant) => variant.id === block.variant))).toBe(true);
    render(<SalesRuntimeProvider queryTracking={async () => ({ trackingNumber: "BT-2024", status: "In transit" })}><WebRenderer document={document} registry={registry} /></SalesRuntimeProvider>);
    expect(screen.getByRole("heading", { name: "Track your order" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Shop with confidence" })).toBeVisible();
  });

  it("keeps the v1 editor definitions valid by default and rejects unsafe Sales props", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const document = registry.getTemplate("besttrack.sales")!.create();
    document.blocks.forEach((block) => {
      const definition = registry.getBlock(block.type)!;
      expect(definition.variants?.some((variant) => variant.id === block.variant)).toBe(true);
      expect(definition.validate?.(block.props)).toEqual([]);
    });

    const query = registry.getBlock("besttrack.sales.query")!;
    expect(query.validate?.({ heading: "", submitLabel: "Track", defaultTrackingNumber: "customer secret" })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "props.heading" }),
      expect.objectContaining({ path: "props.defaultTrackingNumber" })
    ]));
    expect(query.validate?.({ heading: "Track", submitLabel: "Track", defaultTrackingNumber: "BT-2048", heroImageUrl: "javascript:unsafe" })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "props.heroImageUrl" })
    ]));
    const categories = registry.getBlock("besttrack.sales.product-categories")!;
    expect(categories.validate?.({ heading: "Shop", collectionId: "gid://shopify/Collection/1", collectionLabel: "Featured", collectionHref: "javascript:unsafe" })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "props.collectionHref" })
    ]));
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

  it("rejects malformed customer input before it reaches the Consumer Runtime", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const query = vi.fn<TrackingPageQuery>();
    render(<SalesRuntimeProvider queryTracking={query}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    fireEvent.change(screen.getByLabelText("Sales tracking number"), { target: { value: "not valid!" } });
    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a tracking number using 4–64 letters, numbers, or hyphens.");
    expect(query).not.toHaveBeenCalled();
  });

  it("announces loading for every result block and rejects insecure resource URLs", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    let resolveQuery: (value: TrackingPageQueryResult) => void = () => undefined;
    const query = vi.fn<TrackingPageQuery>(() => new Promise<TrackingPageQueryResult>((resolve) => { resolveQuery = resolve; }));
    const document = registry.getTemplate("besttrack.sales")!.create();
    const categories = document.blocks.find((block) => block.type === "besttrack.sales.product-categories")!;
    categories.props = { ...categories.props, collectionHref: "http://example.test/collection" };
    render(<SalesRuntimeProvider queryTracking={query}><WebRenderer document={document} registry={registry} /></SalesRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByText("Checking your order…")).toBeVisible();
    expect(screen.getByRole("region", { name: "Items in your order" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Collection link is unavailable.")).toBeVisible();

    resolveQuery({ trackingNumber: "BT-2048-DEMO", status: "In transit" });
    expect(await screen.findByText("No recommendations are available for this order.")).toBeVisible();
  });

});
