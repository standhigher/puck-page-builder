import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Keep Puck's isolated preview as tall as its content, including after deletions. */
export function AdaptiveIframe({ document, children }: { document?: Document; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const frame = document?.defaultView?.frameElement as HTMLIFrameElement | null;
    if (!content || !frame) return;

    const previousHeight = frame.style.getPropertyValue("height");
    const previousPriority = frame.style.getPropertyPriority("height");
    let animationFrame: number | undefined;
    const resize = () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        animationFrame = undefined;
        // The wrapper has natural height; document.scrollHeight includes the old
        // iframe viewport and would prevent the canvas shrinking after deletion.
        const height = `${Math.ceil(content.getBoundingClientRect().height)}px`;
        if (frame.style.height !== height) frame.style.height = height;
      });
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    observer?.observe(content);

    return () => {
      observer?.disconnect();
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      if (previousHeight) frame.style.setProperty("height", previousHeight, previousPriority);
      else frame.style.removeProperty("height");
    };
  }, [document]);

  return <div ref={contentRef} style={{ display: "flow-root", height: "auto", minHeight: 0 }}>{children}</div>;
}
