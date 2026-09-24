import type { ReactNode } from "react";
import { useCanvasEditing } from "./use-canvas-editing";

/**
 * Puck installs drag sensors around every canvas component. Registering the
 * selected block as an overlay portal keeps fields interactive. Editing
 * controls are protected from drag sensors while the background stays draggable.
 */
export function CanvasExtensionBlock({ active, blockId, children, label, onSelect }: { active: boolean; blockId: string; children: ReactNode; label: string; onSelect: () => void }) {
  const editorRef = useCanvasEditing<HTMLDivElement>(active);
  return <div ref={editorRef} className="pb-document-canvas__extension" data-page-document-block-id={blockId} aria-label={"Select " + label + " in canvas"} role="group" tabIndex={0} onClick={onSelect} onKeyDown={(event) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelect();
    }
  }}>{children}</div>;
}
