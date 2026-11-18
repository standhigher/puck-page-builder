import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { ReadyToGoDeliveryBlock, ReadyToGoDeliveryEditor, ReadyToGoProgressBlock, ReadyToGoQueryBlock, ReadyToGoRuntimeProvider } from "./ready-to-go";
import type { TrackingPageQuery, TrackingPageQueryResult } from "./tracking-page-runtime";

function resultFor(trackingNumber: string, extra: Partial<TrackingPageQueryResult> = {}): TrackingPageQueryResult {
  return {
    trackingNumber,
    status: `Status ${trackingNumber}`,
    carrier: `Carrier ${trackingNumber}`,
    destination: `Destination ${trackingNumber}`,
    events: [{ id: `${trackingNumber}-event`, title: `Event ${trackingNumber}` }],
    orderItems: [{ id: `${trackingNumber}-item`, title: `Item ${trackingNumber}`, quantity: 1 }],
    ...extra
  };
}

function renderEditor(showCarrier?: boolean) {
  return render(
    <ReadyToGoRuntimeProvider>
      <ReadyToGoDeliveryEditor
        heading="Shipping Details"
        contentsHeading="Package Contents"
        carrierHeading="Carrier"
        {...(showCarrier === undefined ? {} : { showCarrier })}
        blockId="delivery"
        selected={false}
        onPropsChange={() => undefined}
      />
    </ReadyToGoRuntimeProvider>
  );
}

describe("Ready-to-go Carrier visibility", () => {
  it.each([undefined, true])("shows the Carrier section when showCarrier is %s", (showCarrier) => {
    renderEditor(showCarrier);

    expect(screen.getByText("Carrier")).toBeVisible();
    expect(screen.getByText("4PX")).toBeVisible();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });

  it("hides only the Carrier section in the editor preview", () => {
    renderEditor(false);

    expect(screen.queryByText("Carrier")).not.toBeInTheDocument();
    expect(screen.queryByText("4PX")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Demo shipment item")).toBeVisible();
    expect(screen.getByText("Shipment accepted at the regional hub")).toBeVisible();
  });

  it("keeps the Carrier section hidden across shipment switches and shows the selected shipment when enabled", async () => {
    const query = vi.fn<TrackingPageQuery>().mockResolvedValue(resultFor("AAA", {
      shipments: [
        { id: "first", label: "AAA", trackingNumber: "AAA", status: "Status AAA", carrier: "Carrier AAA", destination: "Destination AAA", events: [{ id: "first-event", title: "Event AAA" }], orderItems: [{ id: "first-item", title: "Item AAA", quantity: 1 }] },
        { id: "second", label: "BBB", trackingNumber: "BBB", status: "Status BBB", carrier: "Carrier BBB", destination: "Destination BBB", events: [{ id: "second-event", title: "Event BBB" }], orderItems: [{ id: "second-item", title: "Item BBB", quantity: 1 }] }
      ]
    }));
    const view = render(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryBlock submitLabel="Track Your Order" />
        <ReadyToGoProgressBlock />
        <ReadyToGoDeliveryBlock showCarrier={false} />
      </ReadyToGoRuntimeProvider>
    );

    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "AAA" } });
    fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    await screen.findByText("Status AAA");

    expect(screen.queryByText("Carrier AAA")).not.toBeInTheDocument();
    expect(screen.queryByText("Destination AAA")).not.toBeInTheDocument();
    expect(screen.queryByText("Carrier")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BBB" }));
    expect(screen.queryByText("Carrier BBB")).not.toBeInTheDocument();
    expect(screen.queryByText("Destination BBB")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Item BBB")).toBeVisible();
    expect(screen.getByText("Event BBB")).toBeVisible();

    view.rerender(
      <ReadyToGoRuntimeProvider query={query}>
        <ReadyToGoQueryBlock submitLabel="Track Your Order" />
        <ReadyToGoProgressBlock />
        <ReadyToGoDeliveryBlock showCarrier />
      </ReadyToGoRuntimeProvider>
    );
    await waitFor(() => expect(screen.getByText("Carrier BBB")).toBeVisible());
    expect(screen.queryByText("Destination BBB")).not.toBeInTheDocument();
  });
});
