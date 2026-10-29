import { AppProvider } from "@shopify/polaris";
import { fireEvent, render, screen } from "@testing-library/react";
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
