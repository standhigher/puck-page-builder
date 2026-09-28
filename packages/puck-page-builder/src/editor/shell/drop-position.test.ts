import { describe, expect, it } from "vitest";
import { beforeIdAfterPlacement, blockIdAtRelativeY, dropPlacement, libraryTypesInDocumentOrder, nearestBlockIdAtY } from "./drop-position";

describe("canvas insertion position", () => {
  const blocks = [
    { id: "heading", top: 100, height: 80 },
    { id: "tracking", top: 180, height: 600 },
    { id: "footer", top: 800, height: 120 }
  ];

  it("uses each rendered block's midpoint, including differently sized blocks", () => {
    expect(nearestBlockIdAtY(blocks, 120)).toBe("heading");
    expect(nearestBlockIdAtY(blocks, 200)).toBe("tracking");
    expect(nearestBlockIdAtY(blocks, 470)).toBe("tracking");
    expect(nearestBlockIdAtY(blocks, 490)).toBe("footer");
  });

  it("chooses the following slot exactly at a midpoint and appends below the last midpoint", () => {
    expect(nearestBlockIdAtY(blocks, 140)).toBe("tracking");
    expect(nearestBlockIdAtY(blocks, 860)).toBeUndefined();
    expect(nearestBlockIdAtY(blocks, 1200)).toBeUndefined();
  });

  it("keeps the same insertion slot after the viewport scrolls", () => {
    const scrolledBlocks = blocks.map((block) => ({ ...block, top: block.top - 400 }));
    expect(nearestBlockIdAtY(scrolledBlocks, 70)).toBe("tracking");
    expect(nearestBlockIdAtY(scrolledBlocks, 90)).toBe("footer");
    expect(nearestBlockIdAtY(scrolledBlocks, -600)).toBe("heading");
  });

  it("accepts an empty canvas as an append target", () => {
    expect(nearestBlockIdAtY([], 100)).toBeUndefined();
    expect(blockIdAtRelativeY([], 0.5)).toBeUndefined();
  });

  it("clamps the iframe fallback to the first and final insertion slots", () => {
    const ids = ["heading", "tracking", "footer"];
    expect(blockIdAtRelativeY(ids, -0.2)).toBe("heading");
    expect(blockIdAtRelativeY(ids, 0)).toBe("heading");
    expect(blockIdAtRelativeY(ids, 0.35)).toBe("tracking");
    expect(blockIdAtRelativeY(ids, 0.65)).toBe("footer");
    expect(blockIdAtRelativeY(ids, 1)).toBeUndefined();
    expect(blockIdAtRelativeY(ids, 1.2)).toBeUndefined();
  });
});

describe("library list reorder helpers", () => {
  it("keeps on-page types in document order and unused types at the end", () => {
    expect(libraryTypesInDocumentOrder(
      ["core.text", "core.image", "besttrack.ready-to-go.query", "besttrack.ready-to-go.progress"],
      [{ type: "besttrack.ready-to-go.progress" }, { type: "besttrack.ready-to-go.query" }, { type: "besttrack.ready-to-go.query" }]
    )).toEqual(["besttrack.ready-to-go.progress", "besttrack.ready-to-go.query", "core.text", "core.image"]);
  });

  it("treats the top half as before and collapsed rows as before", () => {
    expect(dropPlacement(10, 0, 40)).toBe("before");
    expect(dropPlacement(30, 0, 40)).toBe("after");
    expect(dropPlacement(0, 0, 0)).toBe("before");
  });

  it("maps after the last item to an append slot", () => {
    expect(beforeIdAfterPlacement(["a", "b", "c"], "b", "before")).toBe("b");
    expect(beforeIdAfterPlacement(["a", "b", "c"], "b", "after")).toBe("c");
    expect(beforeIdAfterPlacement(["a", "b", "c"], "c", "after")).toBeUndefined();
  });
});
