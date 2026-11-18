import type { Data } from "@puckeditor/core";
import { AppProvider } from "@shopify/polaris";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createExtensionRegistry } from "../../puck-page-builder/src/core/extensions";
import { createPageDocument, migratePageDocument, type PageDocument } from "../../puck-page-builder/src/core/schema/page-document";
import { PageDocumentEditorShell, type PageDocumentEditorShellProps } from "../../puck-page-builder/src/editor/shell/PageDocumentEditorShell";
import type { DraftSaveInput, PublishActionInput } from "../../puck-page-builder/src/editor/contracts";
import { ReadyToGoToggleField } from "./ready-to-go";
import { bestTrackPageExtension } from "./ready-to-go-definition";

// Keep the real inspector, document history, and persistence; the canvas engine
// has layout dependencies that jsdom cannot measure.
vi.mock("@puckeditor/core", () => {
  const passthrough = ({ children, data }: { children: ReactNode; data?: Data }) => {
    if (data) puck.appState.data = data;
    return <>{children}</>;
  };
  const puck = {
    appState: { data: { root: { props: {} }, content: [] } as Data },
    dispatch: vi.fn(),
    refreshPermissions: vi.fn(),
    getSelectorForId: () => null,
    selectedItem: { props: { id: "delivery" } }
  };
  return {
    Puck: Object.assign(passthrough, { Layout: passthrough, Preview: () => null }),
    usePuck: () => puck
  };
});

const registry = createExtensionRegistry([bestTrackPageExtension]);

function deliveryDocument(showCarrier?: boolean) {
  return createPageDocument({
    pageId: "carrier-toggle",
    blocks: [{
      id: "delivery",
      type: "besttrack.ready-to-go.delivery",
      version: 1,
      props: {
        heading: "Shipping Details",
        contentsHeading: "Package Contents",
        carrierHeading: "Carrier",
        ...(showCarrier === undefined ? {} : { showCarrier })
      }
    }]
  });
}

function editor(props: Partial<PageDocumentEditorShellProps> = {}) {
  return <AppProvider i18n={{}}>
    <PageDocumentEditorShell registry={registry} iframe={false} autoSave={false} initialDocument={deliveryDocument()} {...props} />
  </AppProvider>;
}

function carrierToggle() {
  return screen.findByRole("switch", { name: "Show carrier" });
}

describe("Ready-to-go Carrier inspector toggle", () => {
  it.each<PageDocument["blocks"][number]["props"]>([{}, { textColor: "" }])("shows the default font color without writing missing or empty settings: %j", async (props) => {
    const onDocumentChange = vi.fn<(document: PageDocument) => void>();
    const initialDocument = createPageDocument({ pageId: "font-color", blocks: [{ id: "delivery", type: "besttrack.ready-to-go.progress", version: 1, props }] });
    render(editor({ initialDocument, onDocumentChange }));
    const swatch = await screen.findByLabelText("Font color");
    const row = swatch.closest(".pb-inspector-field__color")!;
    expect(swatch).toHaveValue("#334155");
    expect(row).toHaveTextContent("#334155");
    expect(row.querySelector("button")).toBeNull();
    expect(onDocumentChange).toHaveBeenCalledTimes(1);
    expect(onDocumentChange.mock.lastCall?.[0]).toEqual(initialDocument);
    fireEvent.change(swatch, { target: { value: "#cc3366" } });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.textColor).toBe("#cc3366");
    fireEvent.click(row.querySelector<HTMLButtonElement>("button[aria-label=\"Reset to default\"]")!);
    expect(swatch).toHaveValue("#334155");
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.textColor).toBe("#334155");
    expect(row.querySelector("button")).toBeNull();
  });

  it("converts legacy px control radii for display and saves percentage edits through history and reset", async () => {
    const onDocumentChange = vi.fn<(document: PageDocument) => void>();
    const initialDocument = createPageDocument({ pageId: "radius-percent", blocks: [{ id: "delivery", type: "besttrack.ready-to-go.query", version: 1, props: { inputRadius: "8px", buttonRadius: "100px" } }] });
    render(editor({ initialDocument, onDocumentChange }));
    const input = await screen.findByRole("slider", { name: "Input radius (%)" });
    const button = screen.getByRole("slider", { name: "Button radius (%)" });
    expect(input).toHaveAttribute("aria-valuetext", "33.33%");
    expect(input).toHaveStyle({ "--pb-range-progress": "33.33%" });
    expect(button).toHaveValue("100");
    expect(button).toHaveStyle({ "--pb-range-progress": "100%" });
    expect(onDocumentChange.mock.lastCall?.[0]).toEqual(initialDocument);
    fireEvent.input(button, { target: { value: "30" } });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.buttonRadius).toBe("30%");
    expect(button).toHaveStyle({ "--pb-range-progress": "30%" });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(button).toHaveValue("100");
    expect(button).toHaveStyle({ "--pb-range-progress": "100%" });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.buttonRadius).toBe("100px");
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(button).toHaveValue("30");
    expect(button).toHaveStyle({ "--pb-range-progress": "30%" });
    fireEvent.click(button.closest(".pb-inspector-field")!.querySelector<HTMLButtonElement>("button[aria-label=\"Reset to default\"]")!);
    expect(button).toHaveAttribute("aria-valuetext", "27.59%");
    expect(button).toHaveStyle({ "--pb-range-progress": "27.59%" });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.buttonRadius).toBe("27.59%");
    fireEvent.change(input, { target: { value: "0" } });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.inputRadius).toBe("0%");
    expect(input).toHaveStyle({ "--pb-range-progress": "0%" });
  });

  it.each([undefined, false, true])("edits shadow strength with legacy hideShadow=%s through reset, history and persistence", async (hideShadow) => {
    const onDocumentChange = vi.fn<(document: PageDocument) => void>();
    const saveDraft = vi.fn<(input: DraftSaveInput) => Promise<{ revision: number }>>().mockResolvedValue({ revision: 2 });
    const publish = vi.fn<(input: PublishActionInput) => Promise<{ versionId: string }>>().mockResolvedValue({ versionId: "published-2" });
    const initialDocument = createPageDocument({
      pageId: "shadow-strength",
      blocks: [{ id: "delivery", type: "besttrack.ready-to-go.query", version: 1, props: hideShadow === undefined ? {} : { hideShadow } }]
    });
    const view = render(editor({ initialDocument, onDocumentChange, autoSave: true, autoSaveDelayMs: 1, draftRevision: 1, draftPersistence: { saveDraft }, publishAction: { publish } }));
    const slider = await screen.findByRole("slider", { name: "Shadow strength (%)" });
    expect(slider).toHaveValue(hideShadow ? "0" : "100");
    expect(slider).toHaveAttribute("aria-valuetext", hideShadow ? "0%" : "100%");
    expect(slider).toHaveStyle({ "--pb-range-progress": hideShadow ? "0%" : "100%" });
    expect(screen.queryByRole("switch", { name: "Hide shadow" })).not.toBeInTheDocument();
    expect(onDocumentChange.mock.lastCall?.[0]).toEqual(initialDocument);
    fireEvent.change(slider, { target: { value: "50" } });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.shadowStrength).toBe("50");
    expect(slider).toHaveStyle({ "--pb-range-progress": "50%" });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props).not.toHaveProperty("shadowStrength");
    expect(slider).toHaveValue(hideShadow ? "0" : "100");
    expect(slider).toHaveStyle({ "--pb-range-progress": hideShadow ? "0%" : "100%" });
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(slider).toHaveValue("50");
    expect(slider).toHaveStyle({ "--pb-range-progress": "50%" });
    fireEvent.click(slider.closest(".pb-inspector-field")!.querySelector<HTMLButtonElement>("button[aria-label=\"Reset to default\"]")!);
    expect(slider).toHaveValue("100");
    expect(slider).toHaveStyle({ "--pb-range-progress": "100%" });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.shadowStrength).toBe("100");
    fireEvent.change(slider, { target: { value: "0" } });
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(saveDraft.mock.calls[0]![0].document.blocks[0]!.props.shadowStrength).toBe("0");
    await waitFor(() => expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "false"));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    const published = publish.mock.calls[0]![0];
    expect(published.validationIssues).toEqual([]);
    const restored = migratePageDocument(JSON.parse(JSON.stringify(published.document)));
    expect(restored.success).toBe(true);
    if (!restored.success) throw new Error("Expected valid stored shadow strength.");
    view.unmount();
    render(editor({ initialDocument: restored.data }));
    expect(await screen.findByRole("slider", { name: "Shadow strength (%)" })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: "Shadow strength (%)" })).toHaveStyle({ "--pb-range-progress": "0%" });
  });

  it("writes boolean values and preserves the unset default through undo and redo", async () => {
    const onDocumentChange = vi.fn<(document: PageDocument) => void>();
    render(editor({ onDocumentChange }));

    const toggle = await carrierToggle();
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.showCarrier).toBe(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props).not.toHaveProperty("showCarrier");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.showCarrier).toBe(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0]!.props.showCarrier).toBe(true);
  });

  it("autosaves and publishes false, then restores it when the stored document is reopened", async () => {
    const saveDraft = vi.fn<(input: DraftSaveInput) => Promise<{ revision: number }>>().mockResolvedValue({ revision: 2 });
    const publish = vi.fn<(input: PublishActionInput) => Promise<{ versionId: string }>>().mockResolvedValue({ versionId: "published-2" });
    const view = render(editor({ autoSave: true, autoSaveDelayMs: 1, draftRevision: 1, draftPersistence: { saveDraft }, publishAction: { publish } }));

    const toggle = await carrierToggle();
    fireEvent.click(toggle);
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(saveDraft.mock.calls[0]![0].document.blocks[0]!.props.showCarrier).toBe(false);
    expect(saveDraft.mock.calls[0]![0].expectedRevision).toBe(1);
    await waitFor(() => expect(screen.getByTestId("page-document-editor")).toHaveAttribute("data-dirty", "false"));

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    const published = publish.mock.calls[0]![0];
    expect(published.document.blocks[0]!.props.showCarrier).toBe(false);
    expect(published.expectedRevision).toBe(2);
    expect(published.validationIssues).toEqual([]);

    const restored = migratePageDocument(JSON.parse(JSON.stringify(published.document)));
    expect(restored.success).toBe(true);
    if (!restored.success) throw new Error("Expected the stored carrier setting to remain valid.");
    view.unmount();
    render(editor({ initialDocument: restored.data }));
    const restoredToggle = await carrierToggle();
    expect(restoredToggle).toHaveAttribute("aria-checked", "false");
  });

  it("does not expose editable controls in a read-only session", async () => {
    const onDocumentChange = vi.fn<(document: PageDocument) => void>();
    render(editor({
      onDocumentChange,
      sessionAdapter: { acquire: async () => ({ state: "readonly" }) }
    }));

    await waitFor(() => expect(screen.getByTestId("page-document-editor-session-state")).toHaveAttribute("data-editor-session-state", "readonly"));
    expect(screen.queryByRole("switch", { name: "Show carrier" })).not.toBeInTheDocument();
    expect(onDocumentChange).toHaveBeenCalledTimes(1);
    expect(onDocumentChange.mock.lastCall?.[0]).toEqual(deliveryDocument());
  });

  it("renders the switch in the Carrier heading card with the help text under its label", async () => {
    render(editor());
    const toggle = await carrierToggle();
    expect(toggle.previousElementSibling).toHaveClass("pb-inspector-field__heading");
    expect(toggle.previousElementSibling).toHaveTextContent("Carrier heading");
    expect(toggle.previousElementSibling).toHaveTextContent("When off, hide the carrier.");
    expect(toggle.closest(".pb-inspector-field")).toContainElement(screen.getByLabelText("Carrier heading"));
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("disables the Carrier heading input while the carrier is hidden", async () => {
    render(editor({ initialDocument: deliveryDocument(false) }));
    const toggle = await carrierToggle();
    expect(screen.getByLabelText("Carrier heading")).toBeDisabled();
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Carrier heading")).not.toBeDisabled();
  });

  it("keeps the clickable area on the switch track instead of the whole inspector row", () => {
    const onChange = vi.fn();
    render(<ReadyToGoToggleField label="Show carrier" value onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Show carrier" });
    expect(toggle).toHaveStyle({ justifySelf: "end", width: "32px", height: "16px" });
  });

  it("disables the custom switch without emitting changes", () => {
    const onChange = vi.fn();
    render(<ReadyToGoToggleField label="Show carrier" value={false} disabled onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: "Show carrier" });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
