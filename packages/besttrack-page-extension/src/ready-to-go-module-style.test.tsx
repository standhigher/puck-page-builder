import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { createExtensionRegistry } from "../../puck-page-builder/src/core/extensions";
import { validatePageDocumentWithRegistry } from "../../puck-page-builder/src/core/extensions/document-validation";
import { createPageDocument, type JsonValue } from "../../puck-page-builder/src/core/schema/page-document";
import { ReadyToGoDeliveryEditor, ReadyToGoPixelField, ReadyToGoProgressBlock, ReadyToGoProgressEditor, ReadyToGoQueryBlock, ReadyToGoQueryEditor, ReadyToGoRuntimeProvider } from "./ready-to-go";
import { bestTrackPageExtension } from "./ready-to-go-definition";
import { readyToGoModuleStyle } from "./ready-to-go-module-style";
import { bestTrackDocumentValidationExtensions } from "./validation";

const blockTypes = ["query", "progress", "delivery", "recommendations"].map((name) => `besttrack.ready-to-go.${name}`);
const imageBlockTypes = ["besttrack.ready-to-go.delivery", "besttrack.ready-to-go.recommendations"];
const definition = (type: string) => bestTrackPageExtension.blocks!.find((block) => block.type === type)!;

function documentWith(type: string, props: Record<string, JsonValue>) {
  const block = definition(type);
  return createPageDocument({
    pageId: "module-style",
    blocks: [{ id: "block", type, version: block.version, variant: block.defaultVariant, props: { ...(block.defaultProps as Record<string, JsonValue>), ...props } }]
  });
}

const registries = {
  editor: createExtensionRegistry([bestTrackPageExtension]),
  validation: createExtensionRegistry(bestTrackDocumentValidationExtensions.slice(0, 1))
};

describe("Ready-to-go module style fields", () => {
  it.each(blockTypes)("declares the supported controls in the Style group for %s", (type) => {
    const { fields, defaultProps } = definition(type);
    expect(fields.backgroundColor).toMatchObject({ control: "color", group: "Style", label: "Module background color" });
    if (type === "besttrack.ready-to-go.progress" || type === "besttrack.ready-to-go.recommendations") {
      expect(fields).not.toHaveProperty("moduleRadius");
      expect(fields).not.toHaveProperty("verticalSpacing");
    } else if (type === "besttrack.ready-to-go.delivery") {
      expect(fields).not.toHaveProperty("moduleRadius");
      expect(fields.imageRadius).toMatchObject({ field: "besttrack.ready-to-go.pixel", group: "Style", label: "Image radius (px)" });
      expect(fields.verticalSpacing).toMatchObject({ field: "besttrack.ready-to-go.pixel", group: "Style", label: "Module vertical spacing (px)" });
    } else {
      expect(fields.moduleRadius).toMatchObject({ field: "besttrack.ready-to-go.pixel", group: "Style", label: "Module radius (px)" });
      expect(fields.verticalSpacing).toMatchObject({ field: "besttrack.ready-to-go.pixel", group: "Style", label: "Module vertical spacing (px)" });
    }
    expect(defaultProps).toMatchObject({ backgroundColor: "#ffffff" });
    if (type === "besttrack.ready-to-go.query") {
      expect(fields).not.toHaveProperty("defaultQueryMode");
      expect(defaultProps.defaultQueryMode).toBe("tracking");
      expect(defaultProps).toMatchObject({ moduleRadius: "16px", inputRadius: "33.33%", buttonRadius: "27.59%", hideShadow: false, shadowStrength: "100", verticalSpacing: "0px" });
    } else {
      expect(defaultProps).toMatchObject({ moduleRadius: "", verticalSpacing: "" });
    }
    expect("imageRadius" in fields).toBe(imageBlockTypes.includes(type));
    expect("imageRadius" in defaultProps).toBe(imageBlockTypes.includes(type));
    if (imageBlockTypes.includes(type)) expect(defaultProps).toMatchObject({ imageRadius: "8px" });
    expect("inputRadius" in fields).toBe(type === "besttrack.ready-to-go.query");
    expect("inputRadius" in defaultProps).toBe(type === "besttrack.ready-to-go.query");
    expect("shadowStrength" in fields).toBe(type === "besttrack.ready-to-go.query");
    expect(fields).not.toHaveProperty("hideShadow");
    expect("buttonRadius" in fields).toBe(type === "besttrack.ready-to-go.query");
    expect("buttonRadius" in defaultProps).toBe(type === "besttrack.ready-to-go.query");
  });

  it("shows background, progress, and font colors for shipment progress", () => {
    expect(Object.keys(definition("besttrack.ready-to-go.progress").fields)).toEqual(["backgroundColor", "progressColor", "textColor"]);
  });

  it("omits module radius from delivery information while keeping image radius and spacing", () => {
    expect(Object.keys(definition("besttrack.ready-to-go.delivery").fields)).toEqual(["heading", "contentsHeading", "carrierHeading", "adImageUrl", "adLinkUrl", "backgroundColor", "imageRadius", "verticalSpacing"]);
  });

  it("keeps only background and image radius styles for recommended products", () => {
    expect(Object.keys(definition("besttrack.ready-to-go.recommendations").fields)).toEqual(["heading", "products", "backgroundColor", "imageRadius"]);
  });

  it.each(Object.entries(registries))("accepts pixel values up to 100 with the %s registry", (_name, registry) => {
    const valid = documentWith("besttrack.ready-to-go.delivery", { backgroundColor: "#fef3c7", moduleRadius: "12", verticalSpacing: "24px", imageRadius: "" });
    expect(validatePageDocumentWithRegistry(valid, registry)).toEqual([]);

    const invalid = documentWith("besttrack.ready-to-go.delivery", { moduleRadius: "abc", verticalSpacing: "101", imageRadius: "-1" });
    expect(validatePageDocumentWithRegistry(invalid, registry).map((issue) => issue.path)).toEqual([
      "blocks[0].props.moduleRadius",
      "blocks[0].props.imageRadius",
      "blocks[0].props.verticalSpacing"
    ]);
  });

  it.each(Object.entries(registries))("rejects image radius on blocks without images with the %s registry", (_name, registry) => {
    const issues = validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { imageRadius: "8" }), registry);
    expect(issues.map((issue) => issue.path)).toEqual(["blocks[0].props.imageRadius"]);
  });

  it.each(Object.entries(registries))("validates the query control radii with the %s registry", (_name, registry) => {
    for (const name of ["inputRadius", "buttonRadius"]) {
      for (const value of ["", "0", "24px", "100", "0%", "30%", "100%", "33.33%"]) {
        expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { [name]: value }), registry)).toEqual([]);
      }
      for (const value of ["-1", "101", "abc", "-1%", "101%", "abc%", "30abc%", "30%%"]) {
        expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { [name]: value }), registry).map((issue) => issue.path)).toEqual([`blocks[0].props.${name}`]);
      }
    }
  });
});

describe("Ready-to-go module style rendering", () => {
  it.each(["storefront", "canvas"])("applies font color only to progress labels on the %s and preserves legacy defaults", async (target) => {
    const progress = (textColor?: string) => <ReadyToGoRuntimeProvider>{target === "canvas"
      ? <ReadyToGoProgressEditor blockId="progress" selected={false} onPropsChange={() => undefined} textColor={textColor} progressColor="#123456" />
      : <><ReadyToGoQueryBlock /><ReadyToGoProgressBlock textColor={textColor} progressColor="#123456" /></>
    }</ReadyToGoRuntimeProvider>;
    const { container, rerender } = render(progress());
    if (target === "storefront") {
      fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "BT-2048-DEMO" } });
      fireEvent.click(screen.getByRole("button", { name: "Track Your Order" }));
    }
    await screen.findByRole("region", { name: "Delivery progress" });
    const labels = () => container.querySelectorAll(".bt-progress__label");
    expect(labels()).toHaveLength(5);
    for (const label of labels()) expect(label).toHaveStyle({ color: "#334155" });
    rerender(progress("#cc3366"));
    for (const label of labels()) expect(label).toHaveStyle({ color: "#cc3366" });
    expect(container.querySelector(".bt-progress__icon")).toHaveStyle({ background: "#123456" });
    expect(container.querySelector(".bt-progress-result h2")).toHaveStyle({ color: "#303030" });
    rerender(progress(""));
    for (const label of labels()) expect(label).toHaveStyle({ color: "#334155" });
  });

  it.each(Object.entries(registries))("validates saved font colors with the %s registry", (_name, registry) => {
    expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.progress", { textColor: "#cc3366" }), registry)).toEqual([]);
    expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.progress", { textColor: "invalid" }), registry).map((issue) => issue.path)).toEqual(["blocks[0].props.textColor"]);
  });

  it("converts saved props to wrapper CSS and ignores invalid values", () => {
    expect(readyToGoModuleStyle({ backgroundColor: "#FEF3C7", moduleRadius: "12", verticalSpacing: "20px" }, false)).toEqual({
      backgroundColor: "#FEF3C7",
      "--pb-color-background": "#FEF3C7",
      borderRadius: "12px",
      overflow: "hidden",
      "--pb-radius": "12px",
      paddingTop: "20px",
      paddingBottom: "20px"
    });
    // Image blocks keep the module radius off --pb-radius so product images do not inherit it.
    expect(readyToGoModuleStyle({ moduleRadius: "12", imageRadius: "4" }, true)).toEqual({ borderRadius: "12px", overflow: "hidden", "--pb-image-radius": "4px" });
    expect(readyToGoModuleStyle({ backgroundColor: "red", moduleRadius: "abc", verticalSpacing: "101" }, false)).toBeUndefined();
    expect(readyToGoModuleStyle({}, false)).toBeUndefined();
  });

  it.each(["storefront", "canvas"])("applies query radius only to the Tab card on the %s", (target) => {
    const query = (moduleRadius: string) => <ReadyToGoRuntimeProvider>{target === "canvas"
      ? <ReadyToGoQueryEditor blockId="query" selected={false} onPropsChange={() => undefined} backgroundColor="#fef3c7" moduleRadius={moduleRadius} verticalSpacing="20" />
      : <ReadyToGoQueryBlock backgroundColor="#fef3c7" moduleRadius={moduleRadius} verticalSpacing="20" />
    }</ReadyToGoRuntimeProvider>;
    const { container, rerender } = render(query("20"));
    const frame = container.querySelector<HTMLElement>("[data-module-style]")!;
    expect(frame).toHaveStyle({ backgroundColor: "#fef3c7", paddingTop: "20px", paddingBottom: "20px" });
    expect(frame.style.borderRadius).toBe("");
    expect(frame.style.overflow).toBe("");
    expect(frame.style.getPropertyValue("--pb-radius")).toBe("");
    expect(frame.firstElementChild).toHaveStyle({ backgroundColor: "var(--pb-color-background, #fff)" });
    const card = screen.getByRole("region", { name: "Ready-to-go tracking query" });
    expect(card).toHaveStyle({ borderRadius: "20px" });
    expect(card.style.getPropertyValue("--pb-radius")).toBe("");
    expect(card.querySelector("input")).toHaveStyle({ borderRadius: "8px" });

    rerender(query("0"));
    expect(card).toHaveStyle({ borderRadius: "0px" });
    rerender(query(""));
    expect(card).toHaveStyle({ borderRadius: "16px" });
  });

  it.each(["storefront", "canvas"])("hides only the query card shadow on the %s", (target) => {
    const query = (hideShadow: boolean) => <ReadyToGoRuntimeProvider>{target === "canvas"
      ? <ReadyToGoQueryEditor blockId="query" selected={false} onPropsChange={() => undefined} hideShadow={hideShadow} />
      : <ReadyToGoQueryBlock hideShadow={hideShadow} />
    }</ReadyToGoRuntimeProvider>;
    const { rerender } = render(query(false));
    const card = screen.getByRole("region", { name: "Ready-to-go tracking query" });
    expect(card.style.boxShadow).not.toBe("none");
    rerender(query(true));
    expect(card).toHaveStyle({ boxShadow: "none" });
    rerender(query(false));
    expect(card.style.boxShadow).not.toBe("none");
  });

  it.each(["storefront", "canvas"])("scales shadow opacity consistently on the %s", (target) => {
    const query = (props: Record<string, unknown>) => <ReadyToGoRuntimeProvider>{target === "canvas"
      ? <ReadyToGoQueryEditor blockId="query" selected={false} onPropsChange={() => undefined} {...props} />
      : <ReadyToGoQueryBlock {...props} />
    }</ReadyToGoRuntimeProvider>;
    const { rerender } = render(query({}));
    const card = screen.getByRole("region", { name: "Ready-to-go tracking query" });
    expect(card.style.boxShadow).toBe("0 8px 24px rgba(0, 0, 0, 0.12)");
    for (const [shadowStrength, expected] of [["0", "none"], ["50", "0 8px 24px rgba(0, 0, 0, 0.06)"], ["100", "0 8px 24px rgba(0, 0, 0, 0.12)"]]) {
      rerender(query({ shadowStrength, hideShadow: true }));
      expect(card.style.boxShadow).toBe(expected);
    }
    rerender(query({ shadowStrength: "", hideShadow: true }));
    expect(card.style.boxShadow).toBe("none");
  });

  it.each(Object.entries(registries))("validates shadow strength with the %s registry", (_name, registry) => {
    for (const shadowStrength of ["", "0", "50", "50.5", "100"]) {
      expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { shadowStrength }), registry)).toEqual([]);
    }
    for (const shadowStrength of ["-1", "101", "50px", "50%", "NaN", "Infinity", "abc", 50, false]) {
      expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { shadowStrength }), registry).some((issue) => issue.path === "blocks[0].props.shadowStrength")).toBe(true);
    }
  });

  it.each(Object.entries(registries))("validates the optional shadow toggle with the %s registry", (_name, registry) => {
    expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { hideShadow: false }), registry)).toEqual([]);
    expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { hideShadow: true }), registry)).toEqual([]);
    expect(validatePageDocumentWithRegistry(documentWith("besttrack.ready-to-go.query", { hideShadow: "true" as JsonValue }), registry).map((issue) => issue.path)).toEqual(["blocks[0].props.hideShadow"]);
  });

  it("does not add a wrapper when no module style is saved", () => {
    const { container } = render(<ReadyToGoRuntimeProvider><ReadyToGoQueryBlock /></ReadyToGoRuntimeProvider>);
    expect(container.querySelector("[data-module-style]")).toBeNull();
  });

  it.each(["storefront", "canvas"])("keeps input radius independent in both query modes on the %s", (target) => {
    const query = (inputRadius: string, buttonRadius = "") => <ReadyToGoRuntimeProvider>{target === "canvas"
      ? <ReadyToGoQueryEditor blockId="query" selected={false} onPropsChange={() => undefined} moduleRadius="53" inputRadius={inputRadius} buttonRadius={buttonRadius} />
      : <ReadyToGoQueryBlock moduleRadius="53" inputRadius={inputRadius} buttonRadius={buttonRadius} />
    }</ReadyToGoRuntimeProvider>;
    const { rerender } = render(query("24"));
    const card = screen.getByRole("region", { name: "Ready-to-go tracking query" });
    expect(card).toHaveStyle({ borderRadius: "53px" });
    expect(card.querySelector("input")).toHaveStyle({ borderRadius: "24px" });
    const submit = target === "canvas" ? screen.getByText("Track Your Order").parentElement : screen.getByRole("button", { name: "Track Your Order" });
    expect(submit).toHaveStyle({ borderRadius: "8px" });
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    expect(card.querySelectorAll("input")).toHaveLength(2);
    for (const input of card.querySelectorAll("input")) expect(input).toHaveStyle({ borderRadius: "24px" });
    rerender(query("0"));
    for (const input of card.querySelectorAll("input")) expect(input).toHaveStyle({ borderRadius: "0px" });
    rerender(query(""));
    for (const input of card.querySelectorAll("input")) expect(input).toHaveStyle({ borderRadius: "8px" });
    expect(card).toHaveStyle({ borderRadius: "53px" });
    rerender(query("22", "24"));
    expect(submit).toHaveStyle({ borderRadius: "24px" });
    for (const input of card.querySelectorAll("input")) expect(input).toHaveStyle({ borderRadius: "22px" });
    expect(card).toHaveStyle({ borderRadius: "53px" });
    rerender(query("22", "0"));
    expect(submit).toHaveStyle({ borderRadius: "0px" });
    rerender(query("22"));
    expect(submit).toHaveStyle({ borderRadius: "8px" });
  });

  it.each(["storefront", "canvas"])("maps percentage control radii to visibly different curves on the %s", (target) => {
    const query = (radius: string) => <ReadyToGoRuntimeProvider>{target === "canvas"
      ? <ReadyToGoQueryEditor blockId="query" selected={false} onPropsChange={() => undefined} inputRadius={radius} buttonRadius={radius} />
      : <ReadyToGoQueryBlock inputRadius={radius} buttonRadius={radius} />
    }</ReadyToGoRuntimeProvider>;
    const { rerender } = render(query("30%"));
    const card = screen.getByRole("region", { name: "Ready-to-go tracking query" });
    const button = target === "canvas" ? screen.getByText("Track Your Order").parentElement : screen.getByRole("button", { name: "Track Your Order" });
    expect(card.querySelector("input")).toHaveStyle({ borderRadius: "7.2px" });
    expect(button).toHaveStyle({ borderRadius: "8.7px" });
    rerender(query("100%"));
    expect(card.querySelector("input")).toHaveStyle({ borderRadius: "24px" });
    expect(button).toHaveStyle({ borderRadius: "29px" });
    fireEvent.click(screen.getByRole("tab", { name: "Order Number" }));
    for (const input of card.querySelectorAll("input")) expect(input).toHaveStyle({ borderRadius: "24px" });
    rerender(query("0%"));
    for (const input of card.querySelectorAll("input")) expect(input).toHaveStyle({ borderRadius: "0px" });
    expect(button).toHaveStyle({ borderRadius: "0px" });
  });

  it("renders nothing for a hidden block instead of an empty padded wrapper", () => {
    const { container } = render(<ReadyToGoRuntimeProvider><ReadyToGoProgressBlock backgroundColor="#fef3c7" verticalSpacing="40" /></ReadyToGoRuntimeProvider>);
    expect(container).toBeEmptyDOMElement();
  });

  it("passes the image radius to delivery images and drops the section divider in the canvas", () => {
    const { container } = render(<ReadyToGoRuntimeProvider>
      <ReadyToGoDeliveryEditor blockId="delivery" selected={false} onPropsChange={() => undefined} backgroundColor="#fef3c7" imageRadius="4" />
    </ReadyToGoRuntimeProvider>);
    const frame = container.querySelector<HTMLElement>("[data-module-style]")!;
    expect(frame.style.getPropertyValue("--pb-image-radius")).toBe("4px");
    expect(frame.style.getPropertyValue("--pb-radius")).toBe("");
    expect(screen.getByLabelText("Ready-to-go delivery editor").style.borderBottom).toBe("");
  });
});

describe("ReadyToGoPixelField", () => {
  it("draws its own label row with the current value and a 0-100 slider", () => {
    const onChange = vi.fn();
    render(<ReadyToGoPixelField label="Module radius (px)" value="12" resetLabel="恢复默认" onChange={onChange} />);
    expect(screen.getByText("Module radius (px)")).toBeInTheDocument();
    expect(screen.getByText("12px")).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "Module radius (px)" });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "100");
    expect(slider).toHaveAttribute("step", "1");
    expect(slider).toHaveValue("12");
    expect(slider).toHaveAttribute("aria-valuetext", "12px");
    expect(slider).toHaveStyle({ "--pb-range-progress": "12%" });

    fireEvent.change(slider, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
    expect(onChange.mock.calls).toEqual([["30"], [""]]);
  });

  it("shows an empty value as inheriting the template, without a reset button", () => {
    render(<ReadyToGoPixelField label="Module radius (px)" value="" onChange={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Module radius (px)" })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: "Module radius (px)" })).toHaveStyle({ "--pb-range-progress": "0%" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps saved decimal and px values readable and falls back to an English reset label", () => {
    const view = render(<ReadyToGoPixelField label="Module vertical spacing (px)" value="24px" onChange={vi.fn()} />);
    expect(screen.getByText("24px")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveStyle({ "--pb-range-progress": "24%" });
    expect(screen.getByRole("button", { name: "Reset to default" })).toBeInTheDocument();
    view.rerender(<ReadyToGoPixelField label="Module vertical spacing (px)" value="16.5" onChange={vi.fn()} />);
    expect(screen.getByText("16.5px")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveStyle({ "--pb-range-progress": "16.5%" });
  });

  it.each(["16px", "8px", "0px"])("shows and resets to the block default %s", (defaultValue) => {
    const onChange = vi.fn();
    const field = (value: unknown) => <ReadyToGoPixelField label="Radius" value={value} defaultValue={defaultValue} onChange={onChange} />;
    const view = render(field("24"));
    expect(screen.getByText("24px")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(onChange).toHaveBeenCalledWith(defaultValue);
    for (const value of ["", undefined, defaultValue]) {
      view.rerender(field(value));
      expect(screen.getByText(defaultValue)).toBeInTheDocument();
      expect(screen.getByRole("slider")).toHaveValue(String(Number.parseFloat(defaultValue)));
      expect(screen.getByRole("slider")).toHaveStyle({ "--pb-range-progress": `${Number.parseFloat(defaultValue)}%` });
      expect(screen.queryByRole("button")).toBeNull();
    }
    view.rerender(field("0"));
    expect(screen.getByRole("slider")).toHaveValue("0");
  });

  it("disables the slider and hides reset in read-only sessions", () => {
    render(<ReadyToGoPixelField label="Module radius (px)" value="12" disabled onChange={vi.fn()} />);
    expect(screen.getByRole("slider", { name: "Module radius (px)" })).toBeDisabled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is registered as a field that draws its own label", () => {
    expect(bestTrackPageExtension.fields?.find((field) => field.type === "besttrack.ready-to-go.pixel")).toMatchObject({ rendersLabel: true });
  });
});
