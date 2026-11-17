import { AppProvider } from "@shopify/polaris";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPageDocument } from "../../core/schema/page-document";
import { PageDocumentEditorShell } from "./PageDocumentEditorShell";

describe("PageDocumentEditorShell delete confirmation", () => {
  it("confirms deletion with the Shopify modal", () => {
    render(<AppProvider i18n={{}}>
      <PageDocumentEditorShell adminLocale="zh-CN" iframe={false} autoSave={false} initialDocument={createPageDocument({ pageId: "delete-modal", blocks: [{ id: "text-1", type: "core.text", version: 1, props: { content: "Hi" } }] })} />
    </AppProvider>);

    const deleteButton = document.querySelector<HTMLButtonElement>('[aria-label="删除 文本"]');
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton!);

    const dialog = document.querySelector("[role='dialog']");
    expect(dialog?.className).toContain("Polaris-Modal-Dialog");
    expect(dialog?.textContent).toContain("确认删除区块？");
    expect(dialog?.textContent).toContain("确认删除");
    expect(dialog?.textContent).toContain("取消");
    expect(document.querySelector(".pb-delete-confirmation")).toBeNull();
  });
});


describe("PageDocumentEditorShell admin locale", () => {
  it("updates labels without changing the document or losing undo history", () => {
    const initialDocument = createPageDocument({ pageId: "locale-switch", settings: { locale: "en" }, blocks: [{ id: "text-1", type: "core.text", version: 1, props: { content: "Original page copy" } }] });
    const onDocumentChange = vi.fn();
    const editor = (adminLocale: string) => <AppProvider i18n={{}}><PageDocumentEditorShell adminLocale={adminLocale} iframe={false} autoSave={false} initialDocument={initialDocument} onDocumentChange={onDocumentChange} /></AppProvider>;
    const { rerender } = render(editor("en"));
    fireEvent.change(screen.getByLabelText("Text content"), { target: { value: "Merchant copy" } });
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0].props.content).toBe("Merchant copy");
    const callsBeforeLocale = onDocumentChange.mock.calls.length;
    rerender(editor("fr"));
    expect((screen.getByLabelText("Contenu du texte") as HTMLInputElement).value).toBe("Merchant copy");
    expect(onDocumentChange).toHaveBeenCalledTimes(callsBeforeLocale);
    expect(document.querySelector('[data-testid="page-document-editor"]')?.getAttribute("data-dirty")).toBe("true");
    const undo = document.querySelector<HTMLButtonElement>('button[aria-label="Annuler"]');
    expect(undo).toBeTruthy();
    expect(undo).not.toBeDisabled();
    fireEvent.click(undo!);
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0].props.content).toBe("Original page copy");
    expect(onDocumentChange.mock.lastCall?.[0].settings.locale).toBe("en");
  });

  it("uses the supplied language for load states", () => {
    render(<AppProvider i18n={{}}><PageDocumentEditorShell adminLocale="pt-PT" loadState="loading" initialDocument={createPageDocument({ pageId: "loading" })} /></AppProvider>);
    expect(screen.getByTestId("page-document-editor-state").textContent).toContain("A carregar o editor…");
  });
});

describe("PageDocumentEditorShell layout", () => {
  const initialDocument = createPageDocument({ pageId: "compact-sidebar", blocks: [
    { id: "text-1", type: "core.text", version: 1, props: { content: "Original copy" } },
    { id: "image-1", type: "core.image", version: 1, props: { src: "https://example.com/image.png", alt: "Original image" } }
  ] });

  it("keeps block selection and edits when collapsing and reopening the sidebar", async () => {
    const onDocumentChange = vi.fn();
    render(<AppProvider i18n={{}}><PageDocumentEditorShell iframe={false} autoSave={false} initialDocument={initialDocument} onDocumentChange={onDocumentChange} /></AppProvider>);

    expect(screen.queryByLabelText("Editor tools")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Text content"), { target: { value: "Merchant copy" } });
    const callsBeforeCollapse = onDocumentChange.mock.calls.length;
    fireEvent.click(screen.getByLabelText("Collapse blocks panel"));
    expect(screen.getByLabelText("Open blocks panel")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Image", { selector: "button" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Delete Image")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Image", { selector: "button" }));
    await waitFor(() => expect(screen.getByLabelText("Alternative text")).toHaveValue("Original image"));
    expect(screen.getByLabelText("Image", { selector: "button" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText("Open blocks panel"));
    expect(screen.queryByLabelText("Open blocks panel")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Collapse blocks panel")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("blocks-view")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Image")).toBeInTheDocument();
    expect(onDocumentChange).toHaveBeenCalledTimes(callsBeforeCollapse);
    expect(onDocumentChange.mock.lastCall?.[0].blocks[0].props.content).toBe("Merchant copy");
  });

  it("keeps the selection stable when the same block is clicked again", async () => {
    render(<AppProvider i18n={{}}><PageDocumentEditorShell iframe={false} autoSave={false} initialDocument={initialDocument} /></AppProvider>);
    const imageRow = document.querySelector<HTMLElement>('[data-block-type="core.image"]')!;
    fireEvent.click(imageRow);
    await waitFor(() => expect(screen.getByLabelText("Alternative text")).toHaveValue("Original image"));
    fireEvent.click(imageRow);
    fireEvent.click(imageRow);
    await waitFor(() => expect(imageRow).toHaveAttribute("data-selected", "true"));
    expect(screen.getByLabelText("Alternative text")).toHaveValue("Original image");
  });

  it("collapses the blocks panel when the viewport narrows", () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const media = {
      matches: false,
      media: "(max-width: 1180px)",
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener); },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener); },
      dispatchEvent: () => false
    };
    window.matchMedia = ((query: string) => query.includes("1180px") ? media : originalMatchMedia(query)) as typeof window.matchMedia;
    try {
      render(<AppProvider i18n={{}}><PageDocumentEditorShell iframe={false} autoSave={false} initialDocument={initialDocument} /></AppProvider>);
      expect(screen.getByLabelText("Collapse blocks panel")).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("Collapse properties panel")).toBeInTheDocument();
      act(() => {
        media.matches = true;
        listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
      });
      expect(screen.getByLabelText("Open blocks panel")).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByLabelText("Collapse properties panel")).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("reorders blocks by dragging their collapsed icons and preserves undo", () => {
    const onDocumentChange = vi.fn();
    render(<AppProvider i18n={{}}><PageDocumentEditorShell iframe={false} autoSave={false} initialDocument={initialDocument} onDocumentChange={onDocumentChange} /></AppProvider>);
    fireEvent.click(screen.getByLabelText("Collapse blocks panel"));
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    const source = screen.getByLabelText("Image", { selector: "button" });
    const target = screen.getByLabelText("Text", { selector: "button" });
    fireEvent.dragStart(source, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("application/x-page-document-block-id", "image-1");
    fireEvent.dragOver(target, { dataTransfer, clientY: 0 });
    fireEvent.drop(target, { dataTransfer, clientY: 0 });
    expect(onDocumentChange.mock.lastCall?.[0].blocks.map(({ id }: { id: string }) => id)).toEqual(["image-1", "text-1"]);
    fireEvent.click(screen.getByLabelText("Undo"));
    expect(onDocumentChange.mock.lastCall?.[0].blocks.map(({ id }: { id: string }) => id)).toEqual(["text-1", "image-1"]);
    expect(screen.getByLabelText("Open blocks panel")).toBeInTheDocument();
  });
});
