import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bestTrackBrandedExtension, BrandedRuntimeProvider, type ReadyToGoTrackingQuery } from "../../packages/besttrack-page-extension/src";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { WebRenderer } from "../../packages/puck-page-builder/src/renderer/web/WebRenderer";

describe("V0.7.1 Branded", () => {
  it("registers branded@1.0.0 with its six default blocks and brand theme", () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const template = registry.getTemplate("besttrack.branded");
    expect(template).toMatchObject({ source: "built-in", version: 1, theme: { "color.primary": "#7c3aed", "font.family": "Georgia, serif", radius: "18px" } });
    expect(template?.create().blocks.map((block) => block.type)).toEqual(["besttrack.branded.announcement", "besttrack.branded.query", "besttrack.branded.order-items", "besttrack.branded.recommendations", "besttrack.branded.quick-links", "besttrack.branded.blog"]);
  });

  it("reuses the tracking query and standard result model for order items and recommendations", async () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const query = vi.fn<ReadyToGoTrackingQuery>().mockResolvedValue({ trackingNumber: "BT-1000", status: "In transit", orderItems: [{ id: "tote", title: "Studio tote", quantity: 2 }], recommendations: [{ id: "cover", title: "Shipping cover", description: "Protection for a future order." }] });
    render(<BrandedRuntimeProvider queryTracking={query}><WebRenderer document={registry.getTemplate("besttrack.branded")!.create()} registry={registry} /></BrandedRuntimeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Find my order" }));
    await waitFor(() => expect(query).toHaveBeenCalledWith("BT-2048-DEMO"));
    expect(await screen.findByText("Studio tote")).toBeVisible();
    expect(screen.getByText("Shipping cover")).toBeVisible();
  });

  it("keeps configured brand content and links on the namespaced surface", () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const document = registry.getTemplate("besttrack.branded")!.create();
    document.blocks[0]!.props = { ...document.blocks[0]!.props, brandName: "Northstar", logoUrl: "https://cdn.example.test/logo.png" };
    render(<BrandedRuntimeProvider queryTracking={async () => ({ trackingNumber: "BT-2048-DEMO", status: "idle" })}><WebRenderer document={document} registry={registry} /></BrandedRuntimeProvider>);
    expect(screen.getByRole("img", { name: "Northstar" })).toHaveAttribute("src", "https://cdn.example.test/logo.png");
    expect(screen.getByLabelText("Branded announcement")).toHaveStyle({ background: "var(--pb-color-primary)" });
    expect(screen.getByRole("link", { name: "Shipping help" })).toHaveAttribute("href", "/pages/shipping");
  });
});
