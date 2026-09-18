import { registerOverlayPortal } from "@puckeditor/core";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Puck installs drag sensors around every canvas component. In edit mode this
 * portal shields real form controls from those sensors so they can receive
 * focus and keyboard input.
 */
export function CanvasExtensionBlock({ active, children, label, onSelect }: { active: boolean; children: ReactNode; label: string; onSelect: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => active ? registerOverlayPortal(editorRef.current, { disableDrag: true }) : undefined, [active]);
  return <div ref={editorRef} className="pb-document-canvas__extension" aria-label={"Select " + label + " in canvas"} role="group" tabIndex={0} onClick={onSelect} onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") onSelect();
  }}>{children}</div>;
}
