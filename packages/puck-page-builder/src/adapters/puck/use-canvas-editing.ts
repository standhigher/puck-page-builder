import { registerOverlayPortal } from "@puckeditor/core";
import { useEffect, useRef } from "react";

const editingControlSelector = "input, textarea, select, button, a[href], [contenteditable]:not([contenteditable=false]), [role=textbox]";

/** Keep canvas controls interactive without disabling dragging from the block's background. */
export function useCanvasEditing<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const cleanupPortal = registerOverlayPortal(root, { disableDragOnFocus: false });
    const protectEditingControl = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const control = typeof target?.closest === "function" ? target.closest(editingControlSelector) : null;
      if (control && root.contains(control)) event.stopPropagation();
    };
    root.addEventListener("pointerdown", protectEditingControl, { capture: true });
    return () => {
      root.removeEventListener("pointerdown", protectEditingControl, { capture: true });
      cleanupPortal?.();
    };
  }, [active]);

  return ref;
}
