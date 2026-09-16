export function nearestBlockIdAtY(blocks: Array<{ id: string; top: number; height: number }>, y: number) {
  return blocks.find((block) => y < block.top + block.height / 2)?.id;
}

export function blockIdAtRelativeY(ids: string[], relativeY: number) {
  const index = Math.min(ids.length, Math.max(0, Math.round(relativeY * ids.length)));
  return ids[index];
}
