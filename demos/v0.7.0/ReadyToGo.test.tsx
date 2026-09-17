import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackPageExtension, ReadyToGoRuntimeProvider, type ReadyToGoTrackingQuery } from "../../packages/besttrack-page-extension/src";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

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
  });

  it("uses one query result as shared RuntimeState for every result block", async () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const document = registry.getTemplate("besttrack.ready-to-go")!.create();
    const queryTracking = vi.fn<ReadyToGoTrackingQuery>().mockResolvedValue({
      trackingNumber: "BT-7777", status: "Out for delivery", carrier: "BestTrack", latestEvent: "Courier assigned", deliveryAddress: "Shanghai", recommendations: [{ id: "cover", title: "Shipping cover", description: "Protect the next order." }]
    });

    render(<ReadyToGoRuntimeProvider queryTracking={queryTracking}><WebRenderer document={document} registry={registry} /></ReadyToGoRuntimeProvider>);
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Track package" }));

    await waitFor(() => expect(queryTracking).toHaveBeenCalledTimes(1));
    expect(queryTracking).toHaveBeenCalledWith("BT-7777");
    expect(await screen.findByText("Out for delivery")).toBeVisible();
    expect(screen.getByText("BestTrack")).toBeVisible();
    expect(screen.getByText("Shanghai")).toBeVisible();
    expect(screen.getByText("Shipping cover")).toBeVisible();
  });

  it("renders a responsive, namespaced Ready-to-go surface without global theme selectors", () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const document = registry.getTemplate("besttrack.ready-to-go")!.create();
    render(<ReadyToGoRuntimeProvider><WebRenderer document={document} registry={registry} /></ReadyToGoRuntimeProvider>);
    expect(screen.getByLabelText("Ready-to-go tracking query")).toHaveStyle({ maxWidth: "720px" });
    expect(screen.getByRole("main")).toHaveStyle({ "--pb-color-primary": "#005bd3" });
  });
});
