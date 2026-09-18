import { describe, expect, it } from "vitest";
import { canAddBlock, canApplyCanvasDocument, canDeleteBlock } from "./policy";
import { createPageDocument, type BlockNode } from "../core/schema/page-document";

const text: BlockNode = { id: "text-1", type: "core.text", version: 1, props: { content: "One" }, variant: "default", style: {} };

describe("PageDocument editor policies", () => {
  it("enforces singleton and required cardinality without special business types", () => {
    expect(canAddBlock("core.text", [text], undefined, { blocks: { "core.text": { singleton: true } } })).toBe(false);
    expect(canDeleteBlock(text, [text], undefined, { blocks: { "core.text": { required: true } } })).toBe(false);
  });

  it("rejects canvas-originated reorders when dragging is disabled", () => {
    const first = createPageDocument({ pageId: "policy", blocks: [text, { ...text, id: "text-2", props: { content: "Two" } }] });
    const reordered = { ...first, blocks: [...first.blocks].reverse() };
    expect(canApplyCanvasDocument(first, reordered, () => undefined, { operations: { allowDrag: false } })).toBe(false);
  });
});
