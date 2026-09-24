import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackSalesExtension, SalesRuntimeProvider, type ShopifyResourceResolution, type TrackingPageQuery, type TrackingPageQueryResult } from "../../packages/besttrack-page-extension/src";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

describe("V0.8 Sales", () => {
  it("registers the eight commerce blocks, including persistent resource references", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const template = registry.getTemplate("besttrack.sales");
    expect(template).toMatchObject({ source: "built-in", version: 3, theme: { "color.primary": "#000000" } });
    expect(template?.create().blocks.map((block) => block.type)).toEqual(["besttrack.sales.announcement", "besttrack.sales.query", "besttrack.sales.order-items", "besttrack.sales.other-tracking", "besttrack.sales.service-cards", "besttrack.sales.product-categories", "besttrack.sales.featured-product", "besttrack.sales.recommendations"]);
    expect(template?.create().blocks.map((block) => block.id)).toEqual(["sales-1", "sales-2", "sales-3", "sales-4", "sales-5", "sales-6", "sales-7", "sales-8"]);
    expect(template?.create().blocks.every((block) => block.variant === "hero")).toBe(true);
    expect(registry.getBlock("besttrack.sales.query")?.variants?.some((variant) => variant.id === "commerce")).toBe(true);
  });

  it("renders the responsive Sales Hero with a safe image and dual query control", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const { container } = render(<SalesRuntimeProvider query={async () => ({ trackingNumber: "BT-2024", status: "In transit" })} watermark={{ visible: true }}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    const hero = container.querySelector<HTMLElement>("[data-sales-hero]");
    const card = container.querySelector<HTMLElement>("[data-sales-query-card]");
    const image = container.querySelector<HTMLImageElement>("[data-sales-hero-image]");
    expect(hero).toHaveStyle({ minHeight: "clamp(460px, 52vw, 620px)" });
    expect(card).toHaveStyle({ width: "min(560px, 100%)" });
    expect(card).toHaveStyle({ maxHeight: "min(560px, calc(100dvh - 32px))", overflowX: "hidden", overflowY: "auto" });
    expect(image?.src).toContain("images.unsplash.com");
    expect(screen.getByPlaceholderText("Enter your tracking number")).toBeVisible();
    expect(screen.getByText("Powered by BestTrack")).toBeVisible();
    expect(screen.getByRole("tab", { name: /order number/i })).toBeVisible();
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

  it("renders Sales commerce variants", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const document = registry.getTemplate("besttrack.sales")!.create();
    document.blocks.forEach((block) => { block.variant = "commerce"; });
    expect(document.blocks.every((block) => registry.getBlock(block.type)?.variants?.some((variant) => variant.id === block.variant))).toBe(true);
    render(<SalesRuntimeProvider query={async () => ({ trackingNumber: "BT-2024", status: "In transit" })}><WebRenderer document={document} registry={registry} /></SalesRuntimeProvider>);
    expect(screen.getByRole("heading", { name: "Track your order" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Shop with confidence" })).toBeVisible();
  });

  it("keeps editor definitions valid by default and rejects unsafe Sales props", () => {
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
    expect(categories.validate?.({ heading: "Shop", collection: { id: "collection-1", kind: "collection", title: "Featured" } })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "props.collection" })
    ]));
  });

  it("uses one tracking query for sales order items and product recommendations", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-2024", status: "In transit", orderItems: [{ id: "case", title: "Travel case", quantity: 1 }], recommendations: [{ id: "cover", title: "Delivery cover", description: "A simple protection plan." }] });
    render(<SalesRuntimeProvider query={query}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith({ mode: "tracking", trackingNumber: "BT-2048-DEMO" }));
    const result = await screen.findByTestId("sales-result");
    expect(within(result).getByText("Travel case")).toBeVisible();
    expect(screen.getByText("Delivery cover")).toBeVisible();
  });

  it("shows controlled empty and invalid collection-resource states", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const document = registry.getTemplate("besttrack.sales")!.create();
    const categories = document.blocks.find((block) => block.type === "besttrack.sales.product-categories")!;
    categories.props = { ...categories.props, collection: null };
    render(<SalesRuntimeProvider query={async () => ({ trackingNumber: "BT-1000", status: "idle" })}><WebRenderer document={document} registry={registry} /></SalesRuntimeProvider>);
    expect(screen.getByText("No collection selected. Choose a collection through an authorized resource integration.")).toBeVisible();
  });

  it("renders Consumer Runtime empty results, secondary shipments, and safe product fallbacks", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const query = vi.fn<TrackingPageQuery>().mockResolvedValueOnce({ trackingNumber: "BT-empty", status: "Not found", outcome: "empty" }).mockResolvedValueOnce({ trackingNumber: "BT-main", status: "In transit", shipments: [{ id: "main", label: "Main shipment", trackingNumber: "BT-main" }, { id: "second", label: "Shipment #2", trackingNumber: "BT-second", status: "Delivered" }], orderItems: [{ id: "case", title: "Travel case", quantity: 1, imageUrl: "javascript:unsafe" }], recommendations: [{ id: "cover", title: "Delivery cover", description: "A simple protection plan.", imageUrl: "javascript:unsafe", href: "javascript:unsafe" }] });
    render(<SalesRuntimeProvider query={query}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByText("We couldn’t find an order for that number.")).toBeVisible();
    expect(screen.getByText("No order items are available for that number.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByText("Shipment #2")).toBeVisible();
    expect(within(screen.getByTestId("sales-result")).getByLabelText("Travel case image unavailable")).toBeVisible();
    expect(screen.getByLabelText("Delivery cover image unavailable")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Delivery cover" })).not.toBeInTheDocument();
  });

  it("does not expose a Consumer Runtime error message in the storefront", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    render(<SalesRuntimeProvider query={async () => { throw new Error("upstream credential detail"); }}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByText("We couldn’t retrieve this order right now. Please try again later.")).toBeVisible();
    expect(screen.queryByText("upstream credential detail")).not.toBeInTheDocument();
  });

  it("rejects malformed customer input before it reaches the Consumer Runtime", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const query = vi.fn<TrackingPageQuery>();
    render(<SalesRuntimeProvider query={query}><WebRenderer document={registry.getTemplate("besttrack.sales")!.create()} registry={registry} /></SalesRuntimeProvider>);
    fireEvent.change(screen.getByLabelText("Sales tracking number"), { target: { value: "not valid!" } });
    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid tracking number.");
    expect(query).not.toHaveBeenCalled();
  });

  it("announces loading for every result block and rejects insecure resource URLs", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    let resolveQuery: (value: TrackingPageQueryResult) => void = () => undefined;
    const query = vi.fn<TrackingPageQuery>(() => new Promise<TrackingPageQueryResult>((resolve) => { resolveQuery = resolve; }));
    const document = registry.getTemplate("besttrack.sales")!.create();
    const categories = document.blocks.find((block) => block.type === "besttrack.sales.product-categories")!;
    categories.props = { ...categories.props, collection: { id: "collection-1", kind: "collection", title: "Broken" } };
    render(<SalesRuntimeProvider query={query}><WebRenderer document={document} registry={registry} /></SalesRuntimeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByRole("status", { name: "查询中..." })).toBeVisible();
    expect(screen.getByRole("region", { name: "Items in your order" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Collection reference is invalid.")).toBeVisible();

    resolveQuery({ trackingNumber: "BT-2048-DEMO", status: "In transit" });
    expect(await screen.findByText("No recommendations are available for this order.")).toBeVisible();
  });

  it("uses transient resolution for collection links and product availability", () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    const document = registry.getTemplate("besttrack.sales")!.create();
    const resources: ShopifyResourceResolution = {
      resources: {
        "collection:gid://shopify/Collection/1": { id: "gid://shopify/Collection/1", kind: "collection", title: "Featured collection", status: "resolved", availability: "unknown", href: "https://example.com/collections/featured" },
        "product:gid://shopify/Product/1": { id: "gid://shopify/Product/1", kind: "product", title: "Travel case", status: "resolved", availability: "sold-out", href: "https://example.com/products/travel-case" }
      },
      errors: {}
    };
    render(<SalesRuntimeProvider query={async () => ({ trackingNumber: "BT-1000", status: "idle" })} resourceResolution={resources}><WebRenderer document={document} registry={registry} /></SalesRuntimeProvider>);
    expect(screen.getByRole("link", { name: /featured collection/i })).toHaveAttribute("href", "https://example.com/collections/featured");
    expect(screen.getByText("Sold out")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Travel case" })).not.toBeInTheDocument();
  });

});
