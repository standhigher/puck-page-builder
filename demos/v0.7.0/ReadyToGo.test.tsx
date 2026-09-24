import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackPageExtension, ReadyToGoRuntimeProvider, type TrackingPageQuery, type TrackingPageRecommendationsQuery } from "../../packages/besttrack-page-extension/src";
import { ReadyToGoDeliveryEditor, ReadyToGoProgressEditor, ReadyToGoQueryBlock, ReadyToGoQueryEditor, ReadyToGoRecommendationsEditor } from "../../packages/besttrack-page-extension/src/ready-to-go";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderReadyToGo(query?: TrackingPageQuery, queryRecommendations?: TrackingPageRecommendationsQuery) {
  const registry = createExtensionRegistry([bestTrackPageExtension]);
  const document = registry.getTemplate("besttrack.ready-to-go")!.create();
  return render(
    <ReadyToGoRuntimeProvider query={query} queryRecommendations={queryRecommendations}>
      <WebRenderer document={document} registry={registry} />
    </ReadyToGoRuntimeProvider>
  );
}

describe("V0.7.0 Ready-to-go", () => {
  it("registers the built-in template with all four required blocks", () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const template = registry.getTemplate("besttrack.ready-to-go");
    const document = template?.create();
    expect(template).toMatchObject({ source: "built-in", version: 1 });
    expect(document?.blocks.map((block) => block.type)).toEqual([
      "besttrack.ready-to-go.query",
      "besttrack.ready-to-go.progress",
      "besttrack.ready-to-go.delivery",
      "besttrack.ready-to-go.recommendations"
    ]);
    for (const type of document!.blocks.map((block) => block.type)) {
      expect(registry.getBlock(type)?.render.editor).toEqual(expect.any(Function));
    }
    expect(registry.getBlock("besttrack.ready-to-go.query")?.fields.submitButtonColor).toMatchObject({ control: "color", label: "Button color" });
    expect(document?.blocks[0]?.props.submitButtonColor).toBe("#111111");
    expect(registry.getBlock("besttrack.ready-to-go.progress")?.fields.progressColor).toMatchObject({ control: "color", label: "Progress color" });
    expect(document?.blocks[1]?.props.progressColor).toBe("#0f172a");
  });

  it("applies submitButtonColor to the query submit button", () => {
    render(
      <ReadyToGoRuntimeProvider>
        <ReadyToGoQueryBlock submitLabel="Find" submitButtonColor="#005bd3" />
      </ReadyToGoRuntimeProvider>
    );
    expect(screen.getByRole("button", { name: "Find" })).toHaveStyle({ backgroundColor: "rgb(0, 91, 211)" });
  });

  it("applies progressColor to completed progress steps", () => {
    render(
      <ReadyToGoRuntimeProvider>
        <ReadyToGoProgressEditor progressColor="#005bd3" blockId="progress" selected onPropsChange={vi.fn()} />
      </ReadyToGoRuntimeProvider>
    );
    expect(screen.getByLabelText("In Transit current")).toHaveStyle({ backgroundColor: "rgb(0, 91, 211)", borderColor: "rgb(0, 91, 211)" });
  });

  it("edits Ready-to-go copy on the canvas without running a tracking query", () => {
    const query = vi.fn<TrackingPageQuery>();
    const onPropsChange = vi.fn();
    render(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryEditor
          heading="Track your order"
          submitLabel="Track Your Order"
          defaultTrackingNumber="BT-2048-DEMO"
          trackingTabLabel="Tracking Number"
          orderTabLabel="Order Number"
          blockId="query"
          selected
          onPropsChange={onPropsChange}
        />
        <ReadyToGoProgressEditor blockId="progress" selected onPropsChange={onPropsChange} />
        <ReadyToGoDeliveryEditor heading="Shipping Details" contentsHeading="Package Contents" carrierHeading="Carrier" blockId="delivery" selected onPropsChange={onPropsChange} />
        <ReadyToGoRecommendationsEditor heading="You may also like..." blockId="recs" selected onPropsChange={onPropsChange} />
      </ReadyToGoRuntimeProvider>
    );

    const queryEditor = within(screen.getByLabelText("Ready-to-go query editor"));
    fireEvent.change(queryEditor.getByLabelText("Canvas heading"), { target: { value: "Find your parcel" } });
    fireEvent.change(queryEditor.getByLabelText("Canvas submitLabel"), { target: { value: "Check delivery" } });
    fireEvent.change(queryEditor.getByLabelText("Canvas default tracking number"), { target: { value: "BT-EDIT" } });
    fireEvent.change(queryEditor.getByLabelText("Canvas trackingTabLabel"), { target: { value: "Parcel ID" } });
    fireEvent.change(within(screen.getByLabelText("Ready-to-go delivery editor")).getByLabelText("Canvas heading"), { target: { value: "Shipment facts" } });
    fireEvent.change(screen.getByLabelText("Canvas contentsHeading"), { target: { value: "Inside the box" } });
    fireEvent.change(screen.getByLabelText("Canvas carrierHeading"), { target: { value: "Courier" } });
    fireEvent.change(within(screen.getByLabelText("Ready-to-go recommendations editor")).getByLabelText("Canvas heading"), { target: { value: "Also consider" } });

    expect(query).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Track Your Order" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Canvas poweredBy")).not.toBeInTheDocument();
    expect(screen.queryByText("Shipment progress appears after a consumer tracking query.")).not.toBeInTheDocument();
    expect(screen.queryByText("Delivery details will appear after a successful query.")).not.toBeInTheDocument();
    expect(screen.queryByText("Recommendations appear with your shipment result.")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Ready-to-go progress editor")).queryByLabelText("Canvas heading")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Ready-to-go progress editor")).queryByText("Shipment progress")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Ready-to-go progress editor")).getByLabelText("Delivery progress")).toBeVisible();
    expect(within(screen.getByLabelText("Ready-to-go progress editor")).getByText("In transit")).toBeVisible();
    expect(within(screen.getByLabelText("Ready-to-go progress editor")).queryByLabelText("Est. Delivery")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Ready-to-go progress editor")).queryByText("Sep 22 - Sep 24")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Canvas estimatedDeliveryTitle")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Ready-to-go delivery editor")).getByLabelText("Shipping events")).toBeVisible();
    expect(screen.queryByText("Advertisement space")).not.toBeInTheDocument();
    expect(screen.getByText("Demo shipment item")).toBeVisible();
    expect(screen.getByText("Shipping protection")).toBeVisible();
    expect(onPropsChange).toHaveBeenCalledWith({ heading: "Find your parcel" });
    expect(onPropsChange).toHaveBeenCalledWith({ submitLabel: "Check delivery" });
    expect(onPropsChange).toHaveBeenCalledWith({ defaultTrackingNumber: "BT-EDIT" });
    expect(onPropsChange).toHaveBeenCalledWith({ trackingTabLabel: "Parcel ID" });
    expect(onPropsChange).not.toHaveBeenCalledWith({ heading: "Live progress" });
    expect(onPropsChange).not.toHaveBeenCalledWith({ estimatedDeliveryTitle: "Arrives by" });
    expect(onPropsChange).toHaveBeenCalledWith({ heading: "Shipment facts" });
    expect(onPropsChange).toHaveBeenCalledWith({ contentsHeading: "Inside the box" });
    expect(onPropsChange).toHaveBeenCalledWith({ carrierHeading: "Courier" });
    expect(onPropsChange).toHaveBeenCalledWith({ heading: "Also consider" });
  });

  it("shows configured recommendation products in preview and hides the placeholder when none are selected", () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const document = registry.getTemplate("besttrack.ready-to-go")!.create();
    const recommendations = document.blocks.find((block) => block.type === "besttrack.ready-to-go.recommendations");
    if (recommendations) recommendations.props.products = [{ id: "gid://shopify/Product/9", title: "Preview Headphones" }];
    const { rerender } = render(
      <ReadyToGoRuntimeProvider>
        <WebRenderer document={document} registry={registry} />
      </ReadyToGoRuntimeProvider>
    );
    expect(screen.getByText("Preview Headphones")).toBeVisible();
    expect(screen.queryByText("Shipping protection")).not.toBeInTheDocument();

    if (recommendations) recommendations.props.products = [];
    rerender(
      <ReadyToGoRuntimeProvider>
        <WebRenderer document={document} registry={registry} />
      </ReadyToGoRuntimeProvider>
    );
    expect(screen.queryByText("Preview Headphones")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Recommended products carousel")).not.toBeInTheDocument();
  });

  it("previews merchant-selected recommendation products on the canvas", () => {
    render(
      <ReadyToGoRecommendationsEditor
        heading="You may also like..."
        products={[{ id: "gid://shopify/Product/1", title: "Studio Wireless Headphones", imageUrl: "https://cdn.example/headphones.jpg" }]}
        blockId="recs"
        selected
        onPropsChange={vi.fn()}
      />
    );
    expect(screen.getByText("Studio Wireless Headphones")).toBeVisible();
    expect(screen.getByAltText("Studio Wireless Headphones")).toHaveAttribute("src", "https://cdn.example/headphones.jpg");
    expect(screen.queryByText("Shipping protection")).not.toBeInTheDocument();
  });

  it("lets the canvas query editor stack at content height instead of a fixed hero card", () => {
    render(
      <ReadyToGoQueryEditor
        heading="Track your order"
        submitLabel="Track Your Order"
        defaultTrackingNumber="BT-2048-DEMO"
        trackingTabLabel="Tracking Number"
        orderTabLabel="Order Number"
        blockId="query"
        selected
        onPropsChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Ready-to-go query editor")).not.toHaveStyle({ minHeight: "520px" });
    expect(screen.getByLabelText("Ready-to-go tracking query")).not.toHaveStyle({ minHeight: "388px" });
    expect(screen.getByLabelText("Canvas submitLabel").parentElement?.style.background).toBe("var(--pb-color-primary, #111)");
  });

  it("wraps progress labels inside equal columns instead of overlapping them", () => {
    render(<ReadyToGoProgressEditor />);
    const track = screen.getByLabelText("Delivery progress").querySelector(":scope > div");
    expect(track).toHaveStyle({ display: "grid" });
    expect((track as HTMLElement).style.gridTemplateColumns).toContain("minmax(0, 1fr)");
    expect(screen.getByText("Out for Delivery")).toHaveStyle({ overflowWrap: "anywhere" });
    expect(screen.getByText("Out for Delivery").parentElement).toHaveStyle({ width: "100%" });
  });

  it("uses one query result as shared RuntimeState for every result block", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({
      trackingNumber: "BT-7777",
      status: "Out for delivery",
      carrier: "BestTrack",
      latestEvent: "Courier assigned",
      destination: "Shanghai",
      estimatedDelivery: "Sep 22 - Sep 24",
      progress: [
        { id: "ordered", label: "Ordered", state: "complete" },
        { id: "ready", label: "Order Ready", state: "complete" },
        { id: "transit", label: "In Transit", state: "complete" },
        { id: "out", label: "Out for Delivery", state: "current" },
        { id: "delivered", label: "Delivered", state: "upcoming" }
      ],
      events: [{ id: "hub", title: "Courier assigned", at: "Sep 18, 4:00 PM", state: "current" }],
      orderItems: [{ id: "case", title: "Travel case", quantity: 1, description: "Protects the shipment." }]
    });

    renderReadyToGo(query);
    expect(screen.queryByText("Shipping protection")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    expect(query).toHaveBeenCalledWith({ mode: "tracking", trackingNumber: "BT-7777" });
    expect(await screen.findByRole("heading", { name: "Out for delivery" })).toBeVisible();
    expect(screen.getByLabelText("Delivery progress")).toBeVisible();
    expect(screen.getByLabelText("Delivery progress")).toHaveStyle({ width: "100%", overflow: "visible" });
    expect(screen.getByText("Courier assigned")).toBeVisible();
    expect(screen.getByText("BestTrack")).toBeVisible();
    expect(screen.getByText("Shanghai")).toBeVisible();
    expect(screen.getByText("Travel case")).toBeVisible();
    expect(screen.queryByText("Shipping protection")).not.toBeInTheDocument();
    expect(screen.getByText("Sep 22 - Sep 24")).toBeVisible();
    const estimatedDelivery = screen.getByLabelText("Est. Delivery");
    expect(estimatedDelivery).toHaveStyle({ width: "auto", backgroundColor: "#eaf4ff" });
    expect(estimatedDelivery.getAttribute("style")).toContain("max(0px, calc(50% / 5 - var(--bt-progress-icon, 44px) / 2))");
    expect(screen.getByText("Est. Delivery")).toBeVisible();
    expect(screen.getByText("Estimated time may update as tracking progresses.")).toBeVisible();
  });

  it("renders a namespaced Track Page surface with theme tokens", () => {
    renderReadyToGo();
    expect(screen.getByLabelText("Ready-to-go tracking query")).toHaveStyle({ maxWidth: "560px" });
    expect(screen.getByLabelText("Ready-to-go tracking query").parentElement).toHaveStyle({ backgroundColor: "#fff" });
    expect(screen.getByRole("tab", { name: "Tracking Number" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("main")).toHaveStyle({ "--pb-color-primary": "#111111" });
    expect(screen.queryByLabelText("Recommended products carousel")).not.toBeInTheDocument();
    expect(screen.queryByText("Shipping protection")).not.toBeInTheDocument();
  });

  it("disables submit while loading and shows a controlled query error", async () => {
    const pending = deferred<Awaited<ReturnType<TrackingPageQuery>>>();
    const query = vi.fn<TrackingPageQuery>().mockReturnValue(pending.promise);
    renderReadyToGo(query);

    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(screen.getByRole("button", { name: "Track Your Order" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "查询中..." })).toHaveTextContent("查询中...");
    expect(screen.queryByLabelText("Shipment progress")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Shipping Details")).not.toBeInTheDocument();

    pending.reject(new Error("carrier-timeout"));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t retrieve this order right now. Please try again later.");
    expect(screen.queryByText("查询中...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Track Your Order" })).toBeEnabled();
    expect(screen.getByText("Shipment progress is temporarily unavailable.")).toBeVisible();
    expect(screen.getByText("Delivery details are temporarily unavailable.")).toBeVisible();
    expect(screen.queryByText("Shipping protection")).not.toBeInTheDocument();
  });

  it("keeps delivery fields visible when some result values are missing", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({
      trackingNumber: "BT-1000",
      status: "Ordered"
    });
    renderReadyToGo(query);
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(await screen.findByText("Not available")).toBeVisible();
    expect(screen.getByText("Destination details are not available.")).toBeVisible();
    expect(screen.getByText("Shipping events will appear when the carrier publishes them.")).toBeVisible();
  });

  it("uses a placeholder when a recommendation image fails", async () => {
    const queryRecommendations = vi.fn(async () => [{
      id: "cover",
      title: "Shipping cover",
      description: "Protect the next order.",
      imageUrl: "https://example.invalid/cover.png"
    }]);
    renderReadyToGo(undefined, queryRecommendations);
    const image = await screen.findByAltText("Shipping cover");
    fireEvent.error(image);
    expect(screen.getByLabelText("Shipping cover image unavailable")).toBeVisible();
  });
});
