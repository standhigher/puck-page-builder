import { AppProvider } from "@shopify/polaris";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createContext, useContext, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageDocumentEditorShell } from "../../packages/puck-page-builder/src/editor/shell/PageDocumentEditorShell";
import { blockIdAtRelativeY, nearestBlockIdAtY } from "../../packages/puck-page-builder/src/editor/shell/drop-position";
import { bestTrackBrandedExtension } from "../../packages/besttrack-page-extension/src/branded-definition";
import { bestTrackPageExtension } from "../../packages/besttrack-page-extension/src/ready-to-go-definition";
import { bestTrackSalesExtension } from "../../packages/besttrack-page-extension/src/sales-definition";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import type { PageDocument } from "../../packages/puck-page-builder/src/core/schema/page-document";

type MockPuckState = {
  config: { components: Record<string, { render: (props: Record<string, unknown>) => JSX.Element }> };
  data: { content: { type: string; props: Record<string, unknown> }[] };
  selectedItem: { type: string; props: Record<string, unknown> } | null;
  getSelectorForId(id: string): { index: number } | undefined;
  dispatch(action: { type: string; ui?: { itemSelector?: { index: number } | null }; data?: Partial<MockPuckState["data"]> }): void;
};
const PuckContext = createContext<MockPuckState | null>(null);

// Puck's rendering engine is verified in V0.2. This keeps V0.4 interaction
// tests focused on the PageDocument editor's state and action boundaries.
vi.mock("@puckeditor/core", () => {
  const Puck = ({ children, config, data }: Omit<MockPuckState, "selectedItem" | "getSelectorForId" | "dispatch"> & { children: React.ReactNode }) => {
    const [selectedItem, setSelectedItem] = useState<MockPuckState["selectedItem"]>(null);
    const [canvasData, setCanvasData] = useState(data);
    const getSelectorForId = (id: string) => {
      const index = canvasData.content.findIndex((item) => item.props.id === id);
      return index < 0 ? undefined : { index };
    };
    const dispatch: MockPuckState["dispatch"] = (action) => {
      if (action.type === "setData" && action.data) {
        setCanvasData((current) => ({ ...current, ...action.data, content: action.data?.content ?? current.content }));
        return;
      }
      if (action.type === "setUi") {
        const index = action.ui?.itemSelector?.index;
        setSelectedItem(typeof index === "number" ? canvasData.content[index] ?? null : null);
      }
    };
    return <PuckContext.Provider value={{ config, data: canvasData, selectedItem, getSelectorForId, dispatch }}><div>{children}</div></PuckContext.Provider>;
  };
  Puck.Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  function Preview() {
    const state = useContext(PuckContext)!;
    return <>{state.data.content.map((item) => {
      const Component = state.config.components[item.type].render;
      return <Component key={String(item.props.id)} {...item.props} />;
    })}</>;
  }
  Puck.Preview = Preview;
  const usePuck = () => useContext(PuckContext)!;
  const registerOverlayPortal = (element: HTMLElement | null | undefined, options?: { disableDrag?: boolean }) => {
    if (!element || !options?.disableDrag) return undefined;
    const stopPointerDown = (event: PointerEvent) => event.stopPropagation();
    element.addEventListener("pointerdown", stopPointerDown, true);
    return () => element.removeEventListener("pointerdown", stopPointerDown, true);
  };
  return { Puck, registerOverlayPortal, usePuck };
});

const document: PageDocument = {
  schemaVersion: 1,
  pageId: "v04-demo",
  target: "web",
  theme: {},
  root: {},
  settings: { locale: "en", seoTitle: "Tracking page" },
  blocks: [
    { id: "text-1", type: "core.text", version: 1, props: { content: "First block" }, variant: "default", style: {} },
    { id: "text-2", type: "core.text", version: 1, props: { content: "Second block" }, variant: "default", style: {} }
  ]
};

function renderEditor(props: Partial<React.ComponentProps<typeof PageDocumentEditorShell>> = {}) {
  return render(<AppProvider i18n={{}}><PageDocumentEditorShell initialDocument={document} iframe={false} {...props} /></AppProvider>);
}

describe("PageDocumentEditorShell V0.4", () => {
  it("calculates the nearest canvas insertion point from the drop position", () => {
    const blocks = [{ id: "text-1", top: 100, height: 40 }, { id: "text-2", top: 200, height: 40 }];
    expect(nearestBlockIdAtY(blocks, 50)).toBe("text-1");
    expect(nearestBlockIdAtY(blocks, 150)).toBe("text-2");
    expect(nearestBlockIdAtY(blocks, 999)).toBeUndefined();
    expect(blockIdAtRelativeY(["text-1", "text-2"], 0)).toBe("text-1");
    expect(blockIdAtRelativeY(["text-1", "text-2"], .6)).toBe("text-2");
    expect(blockIdAtRelativeY(["text-1", "text-2"], 1)).toBeUndefined();
  });

  it("uses the Blocks panel as a drag-only type library and allows repeated additions", async () => {
    const changed: PageDocument[] = [];
    renderEditor({ onDocumentChange: (next) => changed.push(next) });
    const library = screen.getByTestId("blocks-view");
    expect(library.querySelectorAll("[data-block-type]")).toHaveLength(2);
    const textType = library.querySelector('[data-block-type="core.text"]')!;
    expect(textType.querySelector(".pb-library-block-drag-hint svg")).toBeInTheDocument();
    fireEvent.click(textType);
    expect(screen.queryByTestId("canvas-drop-target")).not.toBeInTheDocument();
    expect(screen.queryByText("New text block")).not.toBeInTheDocument();
    const transfer = { setData: () => undefined, getData: () => "core.text", effectAllowed: "" };
    fireEvent.dragStart(textType, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("canvas-drop-target"), { clientY: 9999, dataTransfer: transfer });
    await waitFor(() => expect(changed.at(-1)?.blocks.map((block) => block.id)).toEqual(["text-1", "text-2", "core-text-3"]));
    fireEvent.dragStart(library.querySelector('[data-block-type="core.text"]')!, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("canvas-drop-target"), { clientY: 9999, dataTransfer: transfer });
    await waitFor(() => expect(screen.getAllByText("New text block").filter((element) => element.tagName === "P")).toHaveLength(2));
    expect(changed.at(-1)?.blocks.map((block) => block.id)).toEqual(["text-1", "text-2", "core-text-3", "core-text-4"]);
    expect(library.querySelectorAll("[data-block-type]")).toHaveLength(2);
    expect(textType).toHaveAttribute("data-selected", "true");
  });

  it("uses the icon as a drag hint only and never reorders the type library", () => {
    const changed: PageDocument[] = [];
    renderEditor({ onDocumentChange: (next) => changed.push(next) });
    const library = screen.getByTestId("blocks-view");
    const typeOrder = Array.from(library.querySelectorAll<HTMLElement>("[data-block-type]")).map((item) => item.dataset.blockType);
    const textType = library.querySelector('[data-block-type="core.text"]')!;
    const dragHint = textType.querySelector<HTMLElement>(".pb-library-block-drag-hint")!;
    expect(dragHint).toHaveAttribute("aria-hidden", "true");
    const initialChangeCount = changed.length;

    const transfer = { setData: () => undefined, getData: () => "core.text", effectAllowed: "" };
    fireEvent.dragStart(dragHint, { dataTransfer: transfer });
    fireEvent.drop(library, { dataTransfer: transfer });
    fireEvent.dragEnd(dragHint);
    expect(changed).toHaveLength(initialChangeCount);
    expect(Array.from(library.querySelectorAll<HTMLElement>("[data-block-type]")).map((item) => item.dataset.blockType)).toEqual(typeOrder);

    fireEvent.dragStart(dragHint, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("canvas-drop-target"), { clientY: 9999, dataTransfer: transfer });
    fireEvent.dragEnd(dragHint);

    expect(changed.at(-1)?.blocks.map((block) => block.id)).toEqual(["text-1", "text-2", "core-text-3"]);
    expect(Array.from(library.querySelectorAll<HTMLElement>("[data-block-type]")).map((item) => item.dataset.blockType)).toEqual(typeOrder);
  });

  it("highlights the selected canvas block type without using canvas order", async () => {
    renderEditor({ initialDocument: { ...document, blocks: [...document.blocks, { id: "image-1", type: "core.image", version: 1, props: { src: "https://example.com/image.jpg", alt: "Example" } }] } });
    fireEvent.click(screen.getByRole("button", { name: "Select Image in canvas" }));
    await waitFor(() => expect(screen.getByLabelText("图片 URL")).toBeVisible());
    const library = screen.getByTestId("blocks-view");
    expect(library.querySelector('[data-block-type="core.image"]')).toHaveAttribute("data-selected", "true");
    expect(library.querySelector('[data-block-type="core.text"]')).toHaveAttribute("data-selected", "false");
  });

  it("keeps outline navigation separate from the Blocks type library", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "结构" }));
    fireEvent.click(within(screen.getByTestId("outline-view")).getByRole("button", { name: /text-2/ }));
    await waitFor(() => expect(screen.getByLabelText("文本内容")).toHaveValue("Second block"));
    fireEvent.click(screen.getByRole("button", { name: "区块" }));
    expect(screen.getByTestId("blocks-view").querySelector('[data-block-type="core.text"]')).toHaveAttribute("data-selected", "true");
  });

  it("synchronizes selected canvas edits and Inspector edits in both directions", async () => {
    renderEditor();
    const canvasText = screen.getAllByText("First block").find((element) => element.tagName === "P");
    expect(canvasText).toBeDefined();
    expect(canvasText).toHaveAttribute("contenteditable", "true");
    canvasText!.textContent = "Changed in canvas";
    fireEvent.input(canvasText!);
    await waitFor(() => expect(screen.getByLabelText("文本内容")).toHaveValue("Changed in canvas"));

    fireEvent.change(screen.getByLabelText("文本内容"), { target: { value: "Changed in inspector" } });
    await waitFor(() => expect(screen.getAllByText("Changed in inspector").some((element) => element.tagName === "P")).toBe(true));
  });

  it("uses grouped, semantic controls for product-facing extension fields", async () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const brandedDocument = registry.getTemplate("besttrack.branded")!.create();
    renderEditor({ initialDocument: brandedDocument, registry });
    fireEvent.click(screen.getByRole("group", { name: "Select Announcement in canvas" }));
    await waitFor(() => expect(screen.getByText("Links", { exact: true })).toBeVisible());
    expect(screen.getByLabelText("Announcement").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Announcement URL")).toHaveAttribute("type", "url");
    expect(screen.getByTestId("document-inspector").querySelectorAll(".pb-inspector-section")).toHaveLength(2);
  });

  it("synchronizes Branded edit-mode values between the canvas, inspector and PageDocument", async () => {
    const registry = createExtensionRegistry([bestTrackBrandedExtension]);
    const changes: PageDocument[] = [];
    renderEditor({ initialDocument: registry.getTemplate("besttrack.branded")!.create(), registry, onDocumentChange: (next) => changes.push(next) });

    fireEvent.click(screen.getByRole("group", { name: "Select Tracking experience in canvas" }));
    const headingInput = screen.getByLabelText("Heading");
    expect(headingInput).toHaveValue("Track your order");
    expect(screen.queryByText("Powered by text", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Canvas poweredBy")).not.toBeInTheDocument();

    fireEvent.change(headingInput!, { target: { value: "Find your parcel" } });
    const editor = screen.getByTestId("page-document-editor");
    await waitFor(() => expect(editor.querySelector<HTMLInputElement>('[data-branded-editor-field="heading"]')).toHaveValue("Find your parcel"));

    const submit = editor.querySelector<HTMLInputElement>('[data-branded-editor-field="submitLabel"]');
    expect(submit).toHaveValue("Track");
    fireEvent.change(submit!, { target: { value: "Check delivery" } });

    const buttonInput = screen.getByLabelText("Button label");
    await waitFor(() => expect(buttonInput).toHaveValue("Check delivery"));
    expect(changes.at(-1)?.blocks.find((block) => block.type === "besttrack.branded.tracking-experience")?.props).toMatchObject({ heading: "Find your parcel", submitLabel: "Check delivery" });
  });

  it("synchronizes Ready-to-go edit-mode values between the canvas, inspector and PageDocument", async () => {
    const registry = createExtensionRegistry([bestTrackPageExtension]);
    const changes: PageDocument[] = [];
    renderEditor({ initialDocument: registry.getTemplate("besttrack.ready-to-go")!.create(), registry, onDocumentChange: (next) => changes.push(next) });

    fireEvent.click(screen.getByRole("group", { name: "Select Order query in canvas" }));
    const headingInput = screen.getByLabelText("Heading");
    expect(headingInput).toHaveValue("Track your order");
    expect(screen.queryByLabelText("Canvas poweredBy")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Track Your Order" })).not.toBeInTheDocument();

    fireEvent.change(headingInput, { target: { value: "Find your parcel" } });
    const editor = screen.getByTestId("page-document-editor");
    await waitFor(() => expect(editor.querySelector<HTMLInputElement>('[data-ready-to-go-editor-field="heading"]')).toHaveValue("Find your parcel"));

    const submit = editor.querySelector<HTMLInputElement>('[data-ready-to-go-editor-field="submitLabel"]');
    expect(submit).toHaveValue("Track Your Order");
    fireEvent.change(submit!, { target: { value: "Check delivery" } });

    const buttonInput = screen.getByLabelText("Button label");
    await waitFor(() => expect(buttonInput).toHaveValue("Check delivery"));
    expect(changes.at(-1)?.blocks.find((block) => block.type === "besttrack.ready-to-go.query")?.props).toMatchObject({ heading: "Find your parcel", submitLabel: "Check delivery" });
  });

  it("synchronizes Sales editor-preview text with the inspector", async () => {
    const registry = createExtensionRegistry([bestTrackSalesExtension]);
    renderEditor({ initialDocument: registry.getTemplate("besttrack.sales")!.create(), registry });

    expect(screen.queryByLabelText("Edit Announcement values in canvas")).not.toBeInTheDocument();
    const messageInput = screen.getByLabelText("Canvas message");
    expect(messageInput).toHaveValue("Free delivery on orders over $50");
    fireEvent.change(messageInput, { target: { value: "Find an order" } });

    await waitFor(() => expect(within(screen.getByTestId("document-inspector")).getByLabelText("Announcement")).toHaveValue("Find an order"));
    expect(screen.getByLabelText("Canvas message")).toHaveValue("Find an order");
  });

  it("tracks dirty history, restores properties with undo/redo, and handles editor shortcuts", () => {
    renderEditor();
    const field = screen.getByLabelText("文本内容");
    fireEvent.change(field, { target: { value: "Changed block" } });
    expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "true");
    expect(field).toHaveValue("Changed block");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByLabelText("文本内容")).toHaveValue("First block");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(screen.getByLabelText("文本内容")).toHaveValue("Changed block");
  });

  it("provides desktop, tablet, mobile preview and English Admin copy independently of page locale", () => {
    renderEditor({ adminLocale: "en" });
    const mobileButton = screen.getByRole("button", { name: "Mobile" });
    expect(mobileButton.closest(".pb-header")).not.toBeNull();
    expect(screen.getByTestId("page-document-editor").querySelector(".pb-canvas-toolbar")).toBeNull();
    fireEvent.click(mobileButton);
    expect(screen.getByTestId("page-document-editor").querySelector(".pb-canvas-frame")).toHaveAttribute("data-device", "mobile");
    expect(screen.getByTestId("blocks-view").querySelector('[data-block-type="core.text"]')).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveAttribute("aria-disabled", "true");
  });

  it.each(["loading", "empty", "error", "disabled"] as const)("renders the %s state without interactive controls", (loadState) => {
    renderEditor({ loadState });
    expect(screen.getByTestId("page-document-editor-state")).toHaveAttribute("data-editor-state", loadState);
    expect(screen.queryByTestId("page-document-editor")).not.toBeInTheDocument();
  });

  it("renders a success state and exposes document changes only through the callback", () => {
    const changed: PageDocument[] = [];
    renderEditor({ loadState: "success", onDocumentChange: (next) => changed.push(next) });
    expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-editor-state", "success");
    const textType = screen.getByTestId("blocks-view").querySelector('[data-block-type="core.text"]')!;
    const transfer = { setData: () => undefined, getData: () => "core.text", effectAllowed: "" };
    fireEvent.dragStart(textType, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("canvas-drop-target"), { dataTransfer: transfer });
    expect(changed.at(-1)?.blocks.map((block) => block.id)).toEqual(["text-1", "text-2", "core-text-3"]);
  });

  it("only clears the leave-protection snapshot after a successful V0.5 draft save", async () => {
    const save = vi.fn<React.ComponentProps<typeof PageDocumentEditorShell>["onSave"]>().mockResolvedValue(undefined);
    renderEditor({ onSave: save });
    fireEvent.change(screen.getByLabelText("文本内容"), { target: { value: "Persist me" } });
    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ pageId: "v04-demo" })));
    await waitFor(() => expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "false"));
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "true");
  });
});
