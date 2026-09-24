import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type RefObject } from "react";
import { nearestBlockIdAtY } from "./drop-position";

export type CanvasLibraryDropTargetProps = {
  frameRef: RefObject<HTMLDivElement>;
  blocks: ReadonlyArray<{ id: string; label: string }>;
  label: string;
  onDrop: (beforeId?: string) => void;
  onCancel: () => void;
  adminLocale?: string;
};

type DropPreview = { beforeId?: string; markerTop: number; markerLeft: number; markerWidth: number };
type Candidate = { id: string; top: number; height: number };

function uniqueBlocks(blocks: CanvasLibraryDropTargetProps["blocks"]) {
  const seen = new Set<string>();
  return blocks.filter((block) => !seen.has(block.id) && seen.add(block.id));
}

function scrollableAncestors(start: HTMLElement) {
  const result: HTMLElement[] = [];
  let node: HTMLElement | null = start;
  while (node) {
    const style = window.getComputedStyle(node);
    if (["auto", "scroll", "overlay"].includes(style.overflowY) && node.scrollHeight > node.clientHeight) result.push(node);
    node = node.parentElement;
  }
  return result;
}

function scrollDelta(pointerY: number, rect: DOMRect, elapsedMs: number) {
  const top = Math.max(0, rect.top);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  const height = bottom - top;
  if (height <= 0 || pointerY < top || pointerY > bottom) return 0;
  const edge = Math.min(96, Math.max(36, height * 0.24));
  const speed = 900;
  if (pointerY < top + edge) return -speed * Math.min(1, (top + edge - pointerY) / edge) * elapsedMs / 1000;
  if (pointerY > bottom - edge) return speed * Math.min(1, (pointerY - (bottom - edge)) / edge) * elapsedMs / 1000;
  return 0;
}

function scrollElement(element: Element, delta: number) {
  const canScroll = delta < 0 ? element.scrollTop > 0 : element.scrollTop < element.scrollHeight - element.clientHeight;
  if (!delta || !canScroll) return false;
  if (typeof element.scrollBy === "function") element.scrollBy({ top: delta, behavior: "auto" });
  else element.scrollTop += delta;
  return true;
}

export function CanvasLibraryDropTarget({ frameRef, blocks, label, onDrop, onCancel, adminLocale }: CanvasLibraryDropTargetProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const latestPreview = useRef<DropPreview | null>(null);
  const dragging = useRef(false);
  const completed = useRef(false);
  const pointerY = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const lastFrameTime = useRef<number | null>(null);
  const callbacks = useRef({ onDrop, onCancel });
  useEffect(() => { callbacks.current = { onDrop, onCancel }; }, [onDrop, onCancel]);
  const orderedBlocks = uniqueBlocks(blocks);
  const [preview, setPreview] = useState<DropPreview | null>(null);
  const english = adminLocale?.toLowerCase().startsWith("en") ?? false;

  const stopAutoScroll = () => {
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    lastFrameTime.current = null;
  };
  const clear = (cancel: boolean) => {
    stopAutoScroll();
    dragging.current = false;
    latestPreview.current = null;
    setPreview(null);
    if (cancel) { completed.current = true; callbacks.current.onCancel(); }
  };

  const calculatePreview = (clientY: number): DropPreview | null => {
    const target = targetRef.current;
    const frame = frameRef.current;
    if (!target || !frame) return null;
    const targetRect = target.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const iframe = frame.querySelector("iframe");
    const iframeDocument = iframe?.contentDocument;
    const root = iframeDocument ?? frame;
    const allowed = new Set(orderedBlocks.map((block) => block.id));
    const byId = new Map<string, Candidate>();
    const iframeRect = iframeDocument ? iframe?.getBoundingClientRect() : undefined;
    const scaleY = iframe && iframeRect && iframeRect.height > 0 && iframe.clientHeight > 0 ? iframeRect.height / iframe.clientHeight : 1;
    const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-page-document-block-id], [data-puck-dnd]"));
    for (const element of elements) {
      const id = element.dataset.pageDocumentBlockId ?? element.dataset.puckDnd;
      if (!id || !allowed.has(id) || byId.has(id) || element.closest('[aria-hidden="true"], [class*="DragOverlay"]')) continue;
      const rect = element.getBoundingClientRect();
      byId.set(id, { id, top: iframeRect ? iframeRect.top + rect.top * scaleY : rect.top, height: iframeRect ? rect.height * scaleY : rect.height });
    }
    const candidates = orderedBlocks.flatMap((block) => byId.get(block.id) ?? []);
    const beforeId = nearestBlockIdAtY(candidates, clientY);
    const markerCandidate = beforeId ? candidates.find((candidate) => candidate.id === beforeId) : candidates.at(-1);
    const markerViewportTop = markerCandidate ? (beforeId ? markerCandidate.top : markerCandidate.top + markerCandidate.height) : Math.min(frameRect.bottom, Math.max(frameRect.top, clientY));
    return { beforeId, markerTop: Math.max(0, markerViewportTop - targetRect.top), markerLeft: Math.max(0, frameRect.left - targetRect.left), markerWidth: frameRect.width };
  };
  const updatePreview = (clientY: number) => {
    pointerY.current = clientY;
    const next = calculatePreview(clientY);
    const previous = latestPreview.current;
    latestPreview.current = next;
    if (previous?.beforeId !== next?.beforeId || previous?.markerTop !== next?.markerTop || previous?.markerLeft !== next?.markerLeft || previous?.markerWidth !== next?.markerWidth) setPreview(next);
  };
  const autoScroll = (timestamp: number) => {
    if (!dragging.current) return;
    const elapsedMs = Math.min(64, Math.max(0, timestamp - (lastFrameTime.current ?? timestamp)));
    lastFrameTime.current = timestamp;
    const stage = targetRef.current?.parentElement;
    if (stage) {
      let scrolled = false;
      for (const ancestor of scrollableAncestors(stage)) {
        const delta = scrollDelta(pointerY.current, ancestor.getBoundingClientRect(), elapsedMs);
        if (scrollElement(ancestor, delta)) { scrolled = true; break; }
      }
      const documentScroller = document.scrollingElement;
      if (!scrolled && documentScroller) {
        const viewport = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
        scrollElement(documentScroller, scrollDelta(pointerY.current, viewport, elapsedMs));
      }
      updatePreview(pointerY.current);
    }
    animationFrame.current = window.requestAnimationFrame(autoScroll);
  };
  const startAutoScroll = () => {
    if (animationFrame.current === null) animationFrame.current = window.requestAnimationFrame(autoScroll);
  };

  useEffect(() => {
    const cancelOutside = (event: Event) => {
      if (event.type === "drop" && targetRef.current?.contains(event.target as Node)) return;
      if (!completed.current) clear(true);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !completed.current) clear(true); };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("dragend", cancelOutside, true);
    document.addEventListener("drop", cancelOutside, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("dragend", cancelOutside, true);
      document.removeEventListener("drop", cancelOutside, true);
      stopAutoScroll();
    };
  // The refs keep this listener stable while callbacks and preview state remain current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    completed.current = false;
    dragging.current = true;
    updatePreview(event.clientY);
    startAutoScroll();
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    // Leaving the canvas only clears the preview; the same library drag can re-enter.
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) clear(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const next = latestPreview.current ?? calculatePreview(event.clientY);
    completed.current = true;
    clear(false);
    callbacks.current.onDrop(next?.beforeId);
  };

  const position = preview?.beforeId ? orderedBlocks.findIndex((block) => block.id === preview.beforeId) + 1 : orderedBlocks.length + 1;
  const hint = english ? `Release to add ${label}${preview ? ` · position ${position}` : ""}` : `松开以添加 ${label}${preview ? ` · 第 ${position} 个位置` : ""}`;
  const style: CSSProperties = { position: "absolute", inset: 0, zIndex: 2 };
  const markerLabel = english ? `Position ${position}` : `第 ${position} 个位置`;
  return <div ref={targetRef} className="pb-canvas-drop-target" data-testid="canvas-drop-target" role="region" aria-label={english ? "Block drop area" : "区块投放区"} style={style} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
    <span className="pb-canvas-drop-target__hint" aria-live="polite">{hint}</span>
    {preview ? <span className="pb-canvas-drop-marker" aria-hidden="true" style={{ top: preview.markerTop, left: preview.markerLeft, width: preview.markerWidth }}><span className="pb-canvas-drop-marker__label">{markerLabel}</span></span> : null}
  </div>;
}
