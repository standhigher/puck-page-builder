import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
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
    expect(document?.blocks[0]?.props.defaultTrackingNumber).toBe("");
    expect(registry.getBlock("besttrack.ready-to-go.progress")?.fields.progressColor).toMatchObject({ control: "color", label: "Progress color" });
    expect(document?.blocks[1]?.props.progressColor).toBe("#0f172a");
  });

  it("shows the Tracking Number placeholder instead of a prefilled demo number", () => {
    renderReadyToGo();
    const input = screen.getByLabelText("Tracking number");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Tracking Number");
  });

  it("ignores a published document that still stores the old demo tracking number", () => {
    render(
      <ReadyToGoRuntimeProvider>
        <ReadyToGoQueryBlock defaultTrackingNumber="BT-2048-DEMO" />
      </ReadyToGoRuntimeProvider>
    );
    expect(screen.getByLabelText("Tracking number")).toHaveValue("");
  });

  it("shows saved tracking copy as a placeholder and submits only the user's input", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-1001", status: "In transit" });
    render(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryBlock defaultTrackingNumber="please add order" />
      </ReadyToGoRuntimeProvider>
    );
    const input = screen.getByLabelText("Tracking number");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "please add order");

    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter your tracking number");
    expect(query).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  BT-1001  " } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Track Your Order" })).toBeEnabled());
    expect(query).toHaveBeenCalledExactlyOnceWith({ mode: "tracking", trackingNumber: "BT-1001" });
  });

  it("does not submit an order placeholder even when the customer has entered an email", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-1001", status: "In transit" });
    render(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryBlock defaultOrderNumber="Enter your order number" defaultQueryMode="order" />
      </ReadyToGoRuntimeProvider>
    );
    const input = screen.getByLabelText("Order number");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Enter your order number");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter your order number and email address");
    expect(query).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "ORDER-1001" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Track Your Order" })).toBeEnabled());
    expect(query).toHaveBeenCalledExactlyOnceWith({ mode: "order", orderNumber: "ORDER-1001", email: "buyer@example.test" });
  });

  it("shows configured email copy without submitting it as the customer's email", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-1001", status: "In transit" });
    render(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryBlock defaultQueryMode="order" emailPlaceholder="Email used at checkout" />
      </ReadyToGoRuntimeProvider>
    );
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("");
    expect(email).toHaveAttribute("placeholder", "Email used at checkout");

    fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "ORDER-1001" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter your order number and email address");
    expect(query).not.toHaveBeenCalled();

    fireEvent.change(email, { target: { value: "buyer@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Track Your Order" })).toBeEnabled());
    expect(query).toHaveBeenCalledExactlyOnceWith({ mode: "order", orderNumber: "ORDER-1001", email: "buyer@example.test" });
  });

  it.each([undefined, ""])("keeps the default Email hint when emailPlaceholder is %s", (emailPlaceholder) => {
    render(<ReadyToGoQueryBlock defaultQueryMode="order" emailPlaceholder={emailPlaceholder} />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "Email");
  });

  it("uses the internal demo number in automatic preview without submitting placeholder copy", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue({ trackingNumber: "BT-2048-DEMO", status: "In transit" });
    render(
      <ReadyToGoRuntimeProvider query={query} autoQueryDemo>
        <ReadyToGoQueryBlock defaultTrackingNumber="please add order" />
      </ReadyToGoRuntimeProvider>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Track Your Order" })).toBeEnabled());
    expect(query).toHaveBeenCalledExactlyOnceWith({ mode: "tracking", trackingNumber: "BT-2048-DEMO" });
    expect(screen.getByLabelText("Tracking number")).toHaveValue("");
    expect(screen.getByLabelText("Tracking number")).toHaveAttribute("placeholder", "please add order");

    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter your tracking number");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("previews and edits placeholder copy through the existing document field", () => {
    const onPropsChange = vi.fn();
    const props = { blockId: "query", defaultTrackingNumber: "please add order", onPropsChange };
    const { rerender } = render(<ReadyToGoQueryEditor {...props} selected={false} />);
    const input = screen.getByLabelText("Canvas tracking number placeholder");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "please add order");

    rerender(<ReadyToGoQueryEditor {...props} selected />);
    expect(input).toHaveValue("please add order");
    fireEvent.change(input, { target: { value: "Enter your tracking number" } });
    expect(onPropsChange).toHaveBeenCalledExactlyOnceWith({ defaultTrackingNumber: "Enter your tracking number" });

    rerender(<ReadyToGoQueryEditor {...props} defaultTrackingNumber="Enter your tracking number" selected={false} />);
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Enter your tracking number");
  });

  it("switches canvas tabs locally and edits order copy without changing the tracking placeholder", () => {
    const query = vi.fn<TrackingPageQuery>();
    const onPropsChange = vi.fn();
    const editor = (defaultOrderNumber = "Enter your order number") => (
      <ReadyToGoRuntimeProvider query={query} autoQueryDemo>
        <ReadyToGoQueryEditor blockId="query" selected defaultQueryMode="tracking" defaultTrackingNumber="Enter your tracking number" defaultOrderNumber={defaultOrderNumber} onPropsChange={onPropsChange} />
      </ReadyToGoRuntimeProvider>
    );
    const { rerender } = render(editor());
    expect(screen.getByRole("tab", { name: "Tracking Number" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Canvas email placeholder")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    expect(screen.getByRole("tabpanel", { name: "Order Number" })).toBeVisible();
    expect(screen.getByLabelText("Canvas order number placeholder")).toHaveValue("Enter your order number");
    expect(screen.getByLabelText("Canvas email placeholder")).not.toHaveAttribute("readonly");
    expect(onPropsChange).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Canvas order number placeholder"), { target: { value: "Order ID" } });
    expect(onPropsChange).toHaveBeenCalledExactlyOnceWith({ defaultOrderNumber: "Order ID" });
    rerender(editor("Order ID"));
    fireEvent.click(screen.getByRole("tab", { name: "Tracking Number" }));
    expect(screen.getByLabelText("Canvas tracking number placeholder")).toHaveValue("Enter your tracking number");
    expect(screen.queryByLabelText("Canvas email placeholder")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    expect(screen.getByLabelText("Canvas order number placeholder")).toHaveValue("Order ID");
    expect(onPropsChange).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });

  it("opens the configured order tab on the canvas with empty preview fields", () => {
    render(<ReadyToGoQueryEditor blockId="query" selected={false} defaultQueryMode="order" defaultOrderNumber="Enter your order number" onPropsChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Order Number" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Order Number" })).toBeVisible();
    expect(screen.getByLabelText("Canvas order number placeholder")).toHaveValue("");
    expect(screen.getByLabelText("Canvas order number placeholder")).toHaveAttribute("placeholder", "Enter your order number");
    expect(screen.getByLabelText("Canvas email placeholder")).toHaveValue("");
    expect(screen.getByLabelText("Canvas email placeholder")).toHaveAttribute("placeholder", "Email");
    expect(screen.getByLabelText("Canvas email placeholder")).toHaveAttribute("readonly");
    expect(screen.queryByLabelText("Canvas tracking number placeholder")).not.toBeInTheDocument();
  });

  it("selects default canvas copy for editing and keeps an empty draft in its own tab", () => {
    const query = vi.fn<TrackingPageQuery>();
    const onPropsChange = vi.fn();
    const editor = (defaultOrderNumber?: string) => (
      <ReadyToGoRuntimeProvider query={query} autoQueryDemo>
        <ReadyToGoQueryEditor blockId="query" selected defaultQueryMode="order" defaultOrderNumber={defaultOrderNumber} onPropsChange={onPropsChange} />
      </ReadyToGoRuntimeProvider>
    );
    const { rerender } = render(editor());

    for (const [label, copy] of [["Canvas order number placeholder", "Order Number"], ["Canvas email placeholder", "Email"]] as const) {
      const input = screen.getByLabelText<HTMLInputElement>(label);
      expect(input).not.toHaveAttribute("readonly");
      expect(input).toHaveValue(copy);
      fireEvent.focus(input);
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, copy.length]);
      fireEvent.blur(input);
      expect(input).toHaveValue(copy);
    }
    expect(onPropsChange).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    const order = screen.getByLabelText("Canvas order number placeholder");
    fireEvent.focus(order);
    fireEvent.change(order, { target: { value: "" } });
    rerender(editor(""));
    expect(order).toHaveValue("");
    expect(order).toHaveAttribute("placeholder", "");

    fireEvent.click(screen.getByRole("tab", { name: "Tracking Number" }));
    expect(screen.getByLabelText("Canvas tracking number placeholder")).toHaveValue("Tracking Number");
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    expect(screen.getByLabelText("Canvas order number placeholder")).toHaveValue("Order Number");
    expect(screen.getByLabelText("Canvas email placeholder")).toHaveValue("Email");
    expect(onPropsChange).toHaveBeenCalledExactlyOnceWith({ defaultOrderNumber: "" });
    expect(query).not.toHaveBeenCalled();
  });

  it("edits and clears the canvas email placeholder without querying", () => {
    const query = vi.fn<TrackingPageQuery>();
    const onPropsChange = vi.fn();
    const editor = (selected: boolean, emailPlaceholder = "Email used at checkout") => (
      <ReadyToGoRuntimeProvider query={query} autoQueryDemo>
        <ReadyToGoQueryEditor blockId="query" defaultQueryMode="order" selected={selected} emailPlaceholder={emailPlaceholder} onPropsChange={onPropsChange} />
      </ReadyToGoRuntimeProvider>
    );
    const { rerender } = render(editor(false));
    const email = screen.getByLabelText("Canvas email placeholder");
    expect(email).toHaveValue("");
    expect(email).toHaveAttribute("readonly");
    expect(email).toHaveAttribute("placeholder", "Email used at checkout");

    rerender(editor(true));
    expect(email).not.toHaveAttribute("readonly");
    expect(email).toHaveValue("Email used at checkout");
    fireEvent.change(email, { target: { value: "Your email address" } });
    expect(onPropsChange).toHaveBeenNthCalledWith(1, { emailPlaceholder: "Your email address" });

    rerender(editor(true, "Your email address"));
    fireEvent.change(email, { target: { value: "" } });
    expect(onPropsChange).toHaveBeenNthCalledWith(2, { emailPlaceholder: "" });
    expect(email).toHaveValue("");
    expect(email).toHaveAttribute("placeholder", "");
    rerender(editor(true, ""));
    expect(email).toHaveValue("");
    expect(email).toHaveAttribute("placeholder", "");
    fireEvent.blur(email);
    expect(email).toHaveValue("Email");
    expect(onPropsChange).toHaveBeenCalledTimes(2);
    rerender(editor(false, ""));
    expect(email).toHaveValue("");
    expect(email).toHaveAttribute("placeholder", "Email");
    expect(onPropsChange).toHaveBeenCalledTimes(2);
    expect(query).not.toHaveBeenCalled();
  });

  it("supports keyboard tab switching while keeping active canvas labels editable", () => {
    const onPropsChange = vi.fn();
    render(<ReadyToGoQueryEditor blockId="query" selected onPropsChange={onPropsChange} />);
    const trackingTab = screen.getByRole("tab", { name: "Tracking Number" });
    const orderTab = screen.getByRole("tab", { name: "Order Number" });

    fireEvent.keyDown(trackingTab, { key: "ArrowRight" });
    expect(orderTab).toHaveFocus();
    expect(orderTab).toHaveAttribute("aria-selected", "true");
    const label = screen.getByLabelText("Canvas orderTabLabel");
    fireEvent.keyDown(label, { key: "ArrowLeft" });
    expect(orderTab).toHaveAttribute("aria-selected", "true");
    fireEvent.change(label, { target: { value: "Order ID" } });
    expect(onPropsChange).toHaveBeenCalledExactlyOnceWith({ orderTabLabel: "Order ID" });

    fireEvent.keyDown(orderTab, { key: "Home" });
    expect(trackingTab).toHaveFocus();
    expect(screen.getByLabelText("Canvas trackingTabLabel")).toBeVisible();
    fireEvent.keyDown(trackingTab, { key: "End" });
    expect(orderTab).toHaveFocus();
    fireEvent.keyDown(orderTab, { key: "ArrowLeft" });
    expect(trackingTab).toHaveAttribute("aria-selected", "true");
    expect(trackingTab).toHaveFocus();
    expect(onPropsChange).toHaveBeenCalledTimes(1);
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
    fireEvent.change(queryEditor.getByLabelText("Canvas submitLabel"), { target: { value: "Check delivery" } });
    fireEvent.change(queryEditor.getByLabelText("Canvas tracking number placeholder"), { target: { value: "Enter a tracking number" } });
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
    expect(screen.getByLabelText("Demo shipment item")).toBeVisible();
    expect(screen.getByText("Shipping protection")).toBeVisible();
    expect(onPropsChange).toHaveBeenCalledWith({ submitLabel: "Check delivery" });
    expect(onPropsChange).toHaveBeenCalledWith({ defaultTrackingNumber: "Enter a tracking number" });
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
    render(<ReadyToGoProgressEditor blockId="progress" selected={false} onPropsChange={vi.fn()} />);
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
    expect(screen.getByLabelText("Travel case")).toBeVisible();
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

    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-2048" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(screen.getByRole("button", { name: "Track Your Order" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Searching..." })).toHaveTextContent("Searching...");
    expect(screen.queryByLabelText("Shipment progress")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Shipping Details")).not.toBeInTheDocument();

    pending.reject(new Error("carrier-timeout"));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t retrieve this order right now. Please try again later.");
    expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    expect(await screen.findByText("Not available")).toBeVisible();
    expect(screen.getByText("Destination details are not available.")).toBeVisible();
    expect(screen.getByText("Shipping events will appear when the carrier publishes them.")).toBeVisible();
  });

  it("shows recommended prices with a dollar sign and the catalog amount", async () => {
    const queryRecommendations = vi.fn(async () => [{
      id: "tote",
      title: "Travel tote",
      description: "",
      price: { amount: 1200, currencyCode: "USD" }
    }]);
    renderReadyToGo(undefined, queryRecommendations);
    expect(await screen.findByText("$ 12.00")).toBeVisible();
  });

  it("shows configured recommendation snapshot prices in the editor", () => {
    render(
      <ReadyToGoRuntimeProvider>
        <ReadyToGoRecommendationsEditor
          heading="You may also like..."
          products={[{ id: "gid://shopify/Product/1", title: "Minimal Snowboard", price: { amount: 1200, currencyCode: "USD" } }]}
          blockId="recs"
          selected={false}
          onPropsChange={vi.fn()}
        />
      </ReadyToGoRuntimeProvider>
    );
    expect(screen.getByText("Minimal Snowboard")).toBeVisible();
    expect(screen.getByText("$ 12.00")).toBeVisible();
  });

  it("shows configured recommendation snapshot prices on the storefront", () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const document = structuredClone(registry.getTemplate("besttrack.ready-to-go")!.create());
    const recommendations = document.blocks.find((block) => block.type === "besttrack.ready-to-go.recommendations");
    expect(recommendations).toBeDefined();
    recommendations!.props = {
      ...recommendations!.props,
      products: [
        { id: "gid://shopify/Product/1", title: "Minimal Snowboard", price: { amount: 2595, currencyCode: "USD" } }
      ]
    };
    render(
      <ReadyToGoRuntimeProvider>
        <WebRenderer document={document} registry={registry} />
      </ReadyToGoRuntimeProvider>
    );
    expect(screen.getByText("Minimal Snowboard")).toBeVisible();
    expect(screen.getByText("$ 25.95")).toBeVisible();
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
