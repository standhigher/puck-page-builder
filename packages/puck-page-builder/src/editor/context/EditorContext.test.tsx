import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createPageDocument } from "../../core/schema/page-document";
import { EditorProvider, useEditorContext } from "./EditorContext";

function DeleteProbe() {
  const editor = useEditorContext();
  return <><output data-testid="count">{editor.document.blocks.length}</output><output data-testid="pending">{editor.pendingDeleteBlock?.id ?? ""}</output><button onClick={() => editor.requestDeleteBlock("text-1")}>request</button><button onClick={editor.confirmDeleteBlock}>confirm</button></>;
}

describe("EditorProvider deletion confirmation", () => {
  it("keeps deletion pending until it is explicitly confirmed", () => {
    const document = createPageDocument({ pageId: "confirm", blocks: [{ id: "text-1", type: "core.text", version: 1, props: { content: "Keep me" } }] });
    render(<EditorProvider initialDocument={document}><DeleteProbe /></EditorProvider>);
    fireEvent.click(screen.getByText("request"));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("pending").textContent).toBe("text-1");
    fireEvent.click(screen.getByText("confirm"));
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
