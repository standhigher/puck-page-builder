import { describe, expect, it } from "vitest";
import { canAddBlock, canApplyCanvasDocument, canDeleteBlock, canDuplicateBlock } from "./policy";
import { createPageDocument, type BlockNode } from "../core/schema/page-document";

const text: BlockNode = { id: "text-1", type: "core.text", version: 1, props: { content: "One" }, variant: "default", style: {} };

describe("PageDocument editor policies", () => {
  it("enforces singleton and required cardinality without special business types", () => {
    expect(canAddBlock("core.text", [text], undefined, { blocks: { "core.text": { singleton: true } } })).toBe(false);
    expect(canDeleteBlock(text, [text], undefined, { blocks: { "core.text": { required: true } } })).toBe(false);
  });

  it("blocks duplicate when the block or host policy disables it", () => {
    expect(canDuplicateBlock(text, [text], undefined, { blocks: { "core.text": { allowDuplicate: false } } })).toBe(false);
    expect(canDuplicateBlock(text, [text], undefined, { operations: { allowDuplicate: false } })).toBe(false);
  });

  it("rejects canvas-originated reorders when dragging is disabled", () => {
    const first = createPageDocument({ pageId: "policy", blocks: [text, { ...text, id: "text-2", props: { content: "Two" } }] });
    const reordered = { ...first, blocks: [...first.blocks].reverse() };
    expect(canApplyCanvasDocument(first, reordered, () => undefined, { operations: { allowDrag: false } })).toBe(false);
  });

  it("rejects canvas-originated duplicates that violate cardinality policy", () => {
    const previous = createPageDocument({ pageId: "duplicate-policy", blocks: [text] });
    const duplicated = { ...previous, blocks: [text, { ...text, id: "text-2" }] };
    expect(canApplyCanvasDocument(previous, duplicated, () => ({ policy: { singleton: true } }), undefined)).toBe(false);
    expect(canApplyCanvasDocument(previous, duplicated, () => undefined, undefined)).toBe(true);
  });
});
