import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import {
  ReadyToGoDeliveryBlock,
  ReadyToGoDeliveryEditor,
  ReadyToGoProgressBlock,
  ReadyToGoProgressEditor,
  ReadyToGoQueryBlock,
  ReadyToGoQueryEditor,
  ReadyToGoRecommendationsBlock,
  ReadyToGoRecommendationsEditor,
  ReadyToGoRuntimeProvider
} from "./ready-to-go";
import { readyToGoContrastTextColor, readyToGoModuleStyle } from "./ready-to-go-module-style";
import { EstimatedDeliveryCard, TrackingProgress } from "./track-page-display";

describe("Ready-to-go automatic text contrast", () => {
  it.each([
    ["#000000", "#ffffff"],
    ["#333333", "#ffffff"],
    ["#0000FF", "#ffffff"],
    ["#ffffff", "#000000"],
    ["#ffff00", "#000000"],
    ["#ff0000", "#000000"],
    ["#777777", "#000000"]
  ])("chooses the more readable black or white foreground for %s", (background, foreground) => {
    expect(readyToGoContrastTextColor(background)).toBe(foreground);
  });

  it.each([undefined, null, "", "black", "#000", "#00000000", "#gggggg", 0])("leaves an invalid or missing background unchanged: %s", (background) => {
    expect(readyToGoContrastTextColor(background)).toBeUndefined();
    expect(readyToGoModuleStyle({ backgroundColor: background, textColor: "#334155" }, false)).toBeUndefined();
  });

  it.each([
    ["#000000", "#334155", "#ffffff"],
    ["#000000", "#FFFFFF", "#ffffff"],
    ["#000000", "#ffff00", "#ffffff"],
    ["#ffffff", "#334155", "#000000"],
    ["#ffffff", "#777777", "#000000"],
    ["#ffffff", "#767676", "#000000"],
    ["#000000", "invalid", "#ffffff"]
  ])("uses automatic progress text on %s regardless of the old saved font %s", (backgroundColor, textColor, expected) => {
    const props = Object.freeze({ backgroundColor, textColor });
    const style = readyToGoModuleStyle(props, false);
    expect(style).toMatchObject({ "--bt-module-text-color": expected });
    expect(style).not.toHaveProperty("--bt-module-progress-text-color");
    expect(props).toEqual({ backgroundColor, textColor });
  });

  it.each(["canvas", "storefront"] as const)("updates progress contrast after a background change on the %s without changing saved values", async (target) => {
    const onPropsChange = vi.fn();
    const saved = Object.freeze({ backgroundColor: "#ffffff", textColor: "#334155", progressColor: "#123456" });
    const progress = (backgroundColor: string) => <ReadyToGoRuntimeProvider>{target === "canvas"
      ? <ReadyToGoProgressEditor blockId="progress" selected={false} onPropsChange={onPropsChange} {...saved} backgroundColor={backgroundColor} />
      : <><ReadyToGoQueryBlock /><ReadyToGoProgressBlock {...saved} backgroundColor={backgroundColor} /></>
    }</ReadyToGoRuntimeProvider>;
    const { container, rerender } = render(progress(saved.backgroundColor));
    if (target === "storefront") {
      fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-2048-DEMO" } });
      fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    }
    const region = await screen.findByRole("region", { name: "Delivery progress" });
    const frame = region.closest<HTMLElement>("[data-module-style]")!;
    expect(frame.style.getPropertyValue("--bt-module-text-color")).toBe("#000000");

    rerender(progress("#000000"));
    expect(frame.style.getPropertyValue("--bt-module-text-color")).toBe("#ffffff");
    for (const label of container.querySelectorAll(".bt-progress__label")) {
      expect(label).toHaveStyle({ color: "var(--bt-module-text-color, #334155)" });
    }
    expect(container.querySelector(".bt-progress-result h2")).toHaveStyle({ color: "var(--bt-module-text-color, #303030)" });
    expect(container.querySelector(".bt-progress-identity__label p")).toHaveStyle({ color: "var(--bt-module-text-color, #000)" });
    expect(container.querySelector(".bt-progress__icon")).toHaveStyle({ background: "#123456" });
    expect(saved).toEqual({ backgroundColor: "#ffffff", textColor: "#334155", progressColor: "#123456" });
    expect(onPropsChange).not.toHaveBeenCalled();
  });

  it.each(["canvas", "storefront"] as const)("scopes the foreground to each module and preserves the light query card on the %s", async (target) => {
    const editorProps = { selected: false, onPropsChange: vi.fn() };
    const products = [{ id: "contrast-product", title: "Contrast product", price: "$12" }];
    const { container } = render(<ReadyToGoRuntimeProvider>{target === "canvas" ? <>
      <ReadyToGoQueryEditor {...editorProps} blockId="query" backgroundColor="#000000" />
      <ReadyToGoProgressEditor {...editorProps} blockId="progress" backgroundColor="#000000" />
      <ReadyToGoDeliveryEditor {...editorProps} blockId="delivery" backgroundColor="#ffffff" />
      <ReadyToGoRecommendationsEditor {...editorProps} blockId="recommendations" backgroundColor="#0000ff" products={products} />
    </> : <>
      <ReadyToGoQueryBlock backgroundColor="#000000" />
      <ReadyToGoProgressBlock backgroundColor="#000000" />
      <ReadyToGoDeliveryBlock backgroundColor="#ffffff" />
      <ReadyToGoRecommendationsBlock backgroundColor="#0000ff" products={products} />
    </>}</ReadyToGoRuntimeProvider>);
    if (target === "storefront") {
      fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-2048-DEMO" } });
      fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    }
    const progress = await screen.findByRole("region", { name: "Delivery progress" });
    const deliveryHeading = screen.getByRole("heading", { name: "Shipping Details" });
    const productTitle = screen.getByText("Contrast product");
    const query = screen.getByRole("region", { name: "Ready-to-go tracking query" });
    expect(container.querySelectorAll("[data-module-style]")).toHaveLength(4);
    expect(progress.closest<HTMLElement>("[data-module-style]")!.style.getPropertyValue("--bt-module-text-color")).toBe("#ffffff");
    expect(deliveryHeading.closest<HTMLElement>("[data-module-style]")!.style.getPropertyValue("--bt-module-text-color")).toBe("#000000");
    expect(productTitle.closest<HTMLElement>("[data-module-style]")!.style.getPropertyValue("--bt-module-text-color")).toBe("#ffffff");
    expect(deliveryHeading).toHaveStyle({ color: "var(--bt-module-text-color, inherit)" });
    expect(productTitle).toHaveStyle({ color: "var(--bt-module-text-color, #334155)" });
    expect(within(query).getByRole("tab", { name: "Tracking Number" })).toHaveStyle({ color: "#0f172a" });
    expect(query).toHaveStyle({ background: "var(--pb-color-surface, #fff)", color: "var(--pb-color-text, #0f172a)" });
    expect(query.querySelector("input")).toHaveStyle({ background: "#fff", color: target === "canvas" ? "#64748b" : "#334155" });
  });

  it("preserves fixed delivery-card colors inside a dark module", () => {
    render(<ReadyToGoRuntimeProvider><div style={readyToGoModuleStyle({ backgroundColor: "#000000" }, false)}>
      <EstimatedDeliveryCard dateText="November 20–22" />
    </div></ReadyToGoRuntimeProvider>);
    const card = screen.getByLabelText("Est. Delivery");
    expect(card).toHaveStyle({ backgroundColor: "#eaf4ff" });
    expect(within(card).getByText("November 20–22")).toHaveStyle({ color: "#202124" });
  });

  it("retains shared progress colors as fallbacks without a module background", () => {
    const { container } = render(<ReadyToGoRuntimeProvider><TrackingProgress
      steps={[{ id: "in-transit", label: "In Transit", state: "current" }]}
      textColor="#cc3366"
    /></ReadyToGoRuntimeProvider>);
    expect(container.querySelector("[data-module-style]")).toBeNull();
    expect(container.querySelector(".bt-progress__label")).toHaveStyle({ color: "var(--bt-module-text-color, #cc3366)" });
  });
});
