export function nearestBlockIdAtY(blocks: Array<{ id: string; top: number; height: number }>, y: number) {
  return blocks.find((block) => y < block.top + block.height / 2)?.id;
}

export function blockIdAtRelativeY(ids: string[], relativeY: number) {
  const index = Math.min(ids.length, Math.max(0, Math.round(relativeY * ids.length)));
  return ids[index];
}

/** Types already on the page keep document order; unused library types stay at the end. */
export function libraryTypesInDocumentOrder(blockTypes: readonly string[], blocks: readonly { type: string }[]) {
  const allowed = new Set(blockTypes);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const block of blocks) {
    if (!allowed.has(block.type) || seen.has(block.type)) continue;
    ordered.push(block.type);
    seen.add(block.type);
  }
  for (const type of blockTypes) {
    if (!seen.has(type)) ordered.push(type);
  }
  return ordered;
}

export function dropPlacement(clientY: number, top: number, height: number): "before" | "after" {
  if (height <= 0) return "before";
  return clientY < top + height / 2 ? "before" : "after";
}

export function beforeIdAfterPlacement(blockIds: readonly string[], targetId: string, placement: "before" | "after") {
  if (placement === "before") return targetId;
  const index = blockIds.indexOf(targetId);
  return index < 0 ? targetId : blockIds[index + 1];
}
