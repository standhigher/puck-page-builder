import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createPageDocument } from "../../core/schema/page-document";
import { EditorProvider, useEditorContext } from "./EditorContext";

function DeleteProbe() {
  const editor = useEditorContext();
  return <><output data-testid="count">{editor.document.blocks.length}</output><output data-testid="pending">{editor.pendingDeleteBlock?.id ?? ""}</output><button onClick={() => editor.requestDeleteBlock("text-1")}>request</button><button onClick={editor.confirmDeleteBlock}>confirm</button></>;
}

function DuplicateProbe() {
  const editor = useEditorContext();
  return <>
    <output data-testid="duplicate-count">{editor.document.blocks.length}</output>
    <output data-testid="duplicate-ids">{editor.document.blocks.map((block) => block.id).join(",")}</output>
    <output data-testid="duplicate-content">{editor.document.blocks.map((block) => String(block.props.content ?? "")).join("|")}</output>
    <output data-testid="duplicate-selected">{editor.selectedBlockId ?? ""}</output>
    <output data-testid="can-duplicate">{String(editor.actionState.canDuplicate)}</output>
    <button onClick={() => editor.duplicateBlock("text-1")}>duplicate</button>
    <button onClick={() => editor.updateBlockProps(editor.document.blocks[1]?.id ?? "", { content: "Changed copy" })}>change-copy</button>
  </>;
}

function CanvasMutationProbe({ next }: { next: ReturnType<typeof createPageDocument> }) {
  const editor = useEditorContext();
  return <>
    <output data-testid="canvas-order">{editor.document.blocks.map((block) => block.id).join(",")}</output>
    <output data-testid="canvas-selected">{editor.selectedBlockId ?? ""}</output>
    <output data-testid="canvas-dirty">{String(editor.isDirty)}</output>
    <button onClick={() => editor.updateFromCanvas(next)}>apply-canvas</button>
  </>;
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

describe("EditorProvider duplicate action", () => {
  it("inserts a uniquely identified copy and keeps props independent", () => {
    const document = createPageDocument({ pageId: "duplicate", blocks: [{ id: "text-1", type: "core.text", version: 1, props: { content: "Original", settings: { tone: "red" } } }] });
    const changed: ReturnType<typeof createPageDocument>[] = [];
    render(<EditorProvider initialDocument={document} onDocumentChange={(next) => changed.push(next)}><DuplicateProbe /></EditorProvider>);

    fireEvent.click(screen.getByText("duplicate"));
    expect(screen.getByTestId("duplicate-count").textContent).toBe("2");
    expect(screen.getByTestId("duplicate-ids").textContent).toBe("text-1,core-text-2");
    expect(screen.getByTestId("duplicate-content").textContent).toBe("Original|Original");
    expect(screen.getByTestId("duplicate-selected").textContent).toBe("core-text-2");
    const duplicated = changed.at(-1)!;
    expect(duplicated.blocks[0]?.props).not.toBe(duplicated.blocks[1]?.props);

    fireEvent.click(screen.getByText("change-copy"));
    expect(screen.getByTestId("duplicate-content").textContent).toBe("Original|Changed copy");
  });

  it.each([
    ["singleton", { blocks: { "core.text": { singleton: true } } }],
    ["block duplicate policy", { blocks: { "core.text": { allowDuplicate: false } } }],
    ["global duplicate policy", { operations: { allowDuplicate: false } }]
  ] as const)("does not expose duplicate when %s disables it", (_name, policy) => {
    const document = createPageDocument({ pageId: "duplicate-policy", blocks: [{ id: "text-1", type: "core.text", version: 1, props: { content: "Original" } }] });
    render(<EditorProvider initialDocument={document} policy={policy}><DuplicateProbe /></EditorProvider>);

    expect(screen.getByTestId("can-duplicate").textContent).toBe("false");
    fireEvent.click(screen.getByText("duplicate"));
    expect(screen.getByTestId("duplicate-count").textContent).toBe("1");
    expect(screen.getByTestId("duplicate-ids").textContent).toBe("text-1");
  });
});

describe("EditorProvider canvas mutations", () => {
  it("applies a valid canvas reorder while keeping the selected block", () => {
    const first = createPageDocument({ pageId: "canvas-reorder", blocks: [
      { id: "text-1", type: "core.text", version: 1, props: { content: "One" } },
      { id: "text-2", type: "core.text", version: 1, props: { content: "Two" } }
    ] });
    const reordered = { ...first, blocks: [...first.blocks].reverse() };
    render(<EditorProvider initialDocument={first}><CanvasMutationProbe next={reordered} /></EditorProvider>);

    expect(screen.getByTestId("canvas-selected").textContent).toBe("text-1");
    fireEvent.click(screen.getByText("apply-canvas"));
    expect(screen.getByTestId("canvas-order").textContent).toBe("text-2,text-1");
    expect(screen.getByTestId("canvas-selected").textContent).toBe("text-1");
    expect(screen.getByTestId("canvas-dirty").textContent).toBe("true");
  });

  it("rejects a canvas reorder when the host policy disables dragging", () => {
    const first = createPageDocument({ pageId: "canvas-reorder-policy", blocks: [
      { id: "text-1", type: "core.text", version: 1, props: { content: "One" } },
      { id: "text-2", type: "core.text", version: 1, props: { content: "Two" } }
    ] });
    const reordered = { ...first, blocks: [...first.blocks].reverse() };
    render(<EditorProvider initialDocument={first} policy={{ operations: { allowDrag: false } }}><CanvasMutationProbe next={reordered} /></EditorProvider>);

    fireEvent.click(screen.getByText("apply-canvas"));
    expect(screen.getByTestId("canvas-order").textContent).toBe("text-1,text-2");
    expect(screen.getByTestId("canvas-dirty").textContent).toBe("false");
  });
});
