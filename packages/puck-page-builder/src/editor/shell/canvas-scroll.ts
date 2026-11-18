/** Reveal a block by scrolling only this editor's canvas, never its host page or iframe ancestors. */
export function scrollCanvasBlockIntoView(blockId: string, frame?: HTMLElement | null) {
  if (!frame) return;
  const scroll = () => {
    const canvas = frame.closest<HTMLElement>(".pb-canvas-area");
    if (!canvas || canvas.clientHeight === 0) return;
    const iframe = frame.querySelector("iframe");
    const root = iframe?.contentDocument ?? frame;
    const element = root.querySelector<HTMLElement>(`[data-page-document-block-id="${CSS.escape(blockId)}"]`);
    if (!element) return;

    let blockTop = element.getBoundingClientRect().top;
    if (iframe && root !== frame) {
      const rect = iframe.getBoundingClientRect();
      const layoutHeight = iframe.offsetHeight || iframe.clientHeight;
      const scale = layoutHeight > 0 ? rect.height / layoutHeight : 1;
      blockTop = rect.top + (iframe.clientTop + blockTop) * scale;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const canvasScale = canvas.offsetHeight > 0 ? canvasRect.height / canvas.offsetHeight : 1;
    if (canvasScale <= 0) return;
    const delta = (blockTop - canvasRect.top) / canvasScale - canvas.clientTop;
    const limit = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
    canvas.scrollTop = Math.max(0, Math.min(limit, canvas.scrollTop + delta));
  };
  const view = frame.ownerDocument.defaultView;
  if (view?.requestAnimationFrame) view.requestAnimationFrame(scroll);
  else scroll();
}
