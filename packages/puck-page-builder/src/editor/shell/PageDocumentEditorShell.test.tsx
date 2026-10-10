import { AppProvider } from "@shopify/polaris";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createPageDocument } from "../../core/schema/page-document";
import { PageDocumentEditorShell } from "./PageDocumentEditorShell";

describe("PageDocumentEditorShell delete confirmation", () => {
  it("confirms deletion with the Shopify modal", () => {
    render(<AppProvider i18n={{}}>
      <PageDocumentEditorShell iframe={false} autoSave={false} initialDocument={createPageDocument({ pageId: "delete-modal", blocks: [{ id: "text-1", type: "core.text", version: 1, props: { content: "Hi" } }] })} />
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
