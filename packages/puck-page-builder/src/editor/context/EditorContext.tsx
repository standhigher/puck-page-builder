import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { ExtensionRegistry } from "../../core/extensions";
import type { BlockNode, JsonValue, PageDocument } from "../../core/schema/page-document";
import type { Device } from "../state/types";
import { canAddBlock, canApplyCanvasDocument, canDeleteBlock, canDragBlock, canDuplicateBlock, type PageDocumentEditorPolicy } from "../policy";

export type EditorLoadState = "loading" | "ready" | "empty" | "error" | "disabled" | "success";

export type EditorActionState = {
  canUndo: boolean;
  canRedo: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  canReorder: boolean;
};

type Snapshot = { document: PageDocument; selectedBlockId: string | null };
type EditorHistory = Snapshot & { past: Snapshot[]; future: Snapshot[]; device: Device; savedDocument: PageDocument };
type HistoryAction =
  | { type: "select"; id: string | null }
  | { type: "device"; device: Device }
  | { type: "replace"; document: PageDocument; selectedBlockId: string | null }
  | { type: "saved" }
  | { type: "undo" }
  | { type: "redo" };

function historyReducer(state: EditorHistory, action: HistoryAction): EditorHistory {
  if (action.type === "select") return { ...state, selectedBlockId: action.id };
  if (action.type === "device") return { ...state, device: action.device };
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { ...state, ...previous, past: state.past.slice(0, -1), future: [{ document: state.document, selectedBlockId: state.selectedBlockId }, ...state.future] };
  }
  if (action.type === "redo") {
    const next = state.future[0];
    if (!next) return state;
    return { ...state, ...next, past: [...state.past, { document: state.document, selectedBlockId: state.selectedBlockId }], future: state.future.slice(1) };
  }
  if (action.type === "saved") return { ...state, savedDocument: state.document };
  const current = { document: state.document, selectedBlockId: state.selectedBlockId };
  return { ...state, document: action.document, selectedBlockId: action.selectedBlockId, past: [...state.past, current], future: [] };
}

export type EditorContextValue = {
  document: PageDocument;
  selectedBlockId: string | null;
  selectedBlock: BlockNode | null;
  pendingDeleteBlock: BlockNode | null;
  canvasSelectionRequest: string | null;
  device: Device;
  loadState: EditorLoadState;
  isDirty: boolean;
  actionState: EditorActionState;
  canAddBlock(type: string): boolean;
  canDragBlock(id: string): boolean;
  /** Request a canvas selection. The inspector changes only after Puck confirms it. */
  requestCanvasSelection(id: string): void;
  /** Called from the canvas/Puck selection event. */
  confirmCanvasSelection(id: string | null): void;
  /** Applies an edit that originated in the canvas engine. */
  updateFromCanvas(document: PageDocument): boolean;
  setDevice(device: Device): void;
  addBlock(type: string, beforeId?: string): string | null;
  duplicateBlock(id: string): void;
  requestDeleteBlock(id: string): void;
  cancelDeleteBlock(): void;
  confirmDeleteBlock(): void;
  deleteBlock(id: string): void;
  moveBlock(id: string, direction: -1 | 1): void;
  reorderBlock(id: string, beforeId: string): void;
  updateBlockProps(id: string, props: Record<string, JsonValue>): void;
  updateBlockPresentation(id: string, presentation: Pick<BlockNode, "variant" | "style">): void;
  undo(): void;
  redo(): void;
  markSaved(): void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

function uniqueBlockId(type: string, blocks: BlockNode[]) {
  const prefix = type.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "block";
  let index = blocks.length + 1;
  while (blocks.some((block) => block.id === `${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function defaultBlock(type: string, blocks: BlockNode[], registry?: ExtensionRegistry): BlockNode {
  if (type === "core.text") return { id: uniqueBlockId(type, blocks), type, version: 1, props: { content: "New text block" }, variant: "default", style: {} };
  if (type === "core.image") return { id: uniqueBlockId(type, blocks), type, version: 1, props: { src: "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1200&q=80", alt: "" }, variant: "default", style: {} };
  const definition = registry?.getBlock(type);
  if (!definition) throw new Error(`Unknown PageDocument block type: ${type}`);
  return { id: uniqueBlockId(type, blocks), type, version: definition.version, props: definition.defaultProps as Record<string, JsonValue>, variant: definition.defaultVariant ?? "default", style: {} };
}

export function EditorProvider({ initialDocument, registry, policy, loadState = "ready", leaveWarning = "You have unsaved changes.", onDocumentChange, children }: { initialDocument: PageDocument; registry?: ExtensionRegistry; policy?: PageDocumentEditorPolicy; loadState?: EditorLoadState; leaveWarning?: string; onDocumentChange?: (document: PageDocument) => void; children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, initialDocument, (document): EditorHistory => ({ document, selectedBlockId: document.blocks[0]?.id ?? null, past: [], future: [], device: "desktop", savedDocument: document }));
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);
  const [canvasSelectionRequest, setCanvasSelectionRequest] = useState<string | null>(null);
  const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);
  const editable = loadState === "ready" || loadState === "success";
  const selectedBlock = history.document.blocks.find((block) => block.id === history.selectedBlockId) ?? null;
  const pendingDeleteBlock = history.document.blocks.find((block) => block.id === pendingDeleteBlockId) ?? null;
  const replace = useCallback((document: PageDocument, selectedBlockId: string | null) => dispatch({ type: "replace", document, selectedBlockId }), []);
  // Puck keeps the active contenteditable node only while its config is referentially stable.
  // Read the current document from a ref so typing in the canvas does not rebuild that config.
  const requestCanvasSelection = useCallback((id: string) => { if (editable) setCanvasSelectionRequest(id); }, [editable]);
  const confirmCanvasSelection = useCallback((id: string | null) => {
    setCanvasSelectionRequest(null);
    dispatch({ type: "select", id });
  }, []);
  const updateFromCanvas = useCallback((document: PageDocument) => {
    const current = historyRef.current;
    if (!editable || JSON.stringify(document) === JSON.stringify(current.document)) return false;
    if (!canApplyCanvasDocument(current.document, document, (type) => registry?.getBlock(type), policy)) return false;
    replace(document, current.selectedBlockId);
    return true;
  }, [editable, policy, registry, replace]);
  const updateBlockProps = useCallback((id: string, props: Record<string, JsonValue>) => {
    if (!editable) return;
    const current = historyRef.current;
    const blocks = current.document.blocks.map((block) => block.id === id ? { ...block, props: { ...block.props, ...props } } : block);
    replace({ ...current.document, blocks }, id);
  }, [editable, replace]);
  const updateBlockPresentation = useCallback((id: string, presentation: Pick<BlockNode, "variant" | "style">) => {
    if (!editable) return;
    const current = historyRef.current;
    const blocks = current.document.blocks.map((block) => block.id === id ? { ...block, ...presentation } : block);
    replace({ ...current.document, blocks }, id);
  }, [editable, replace]);

  useEffect(() => { onDocumentChange?.(history.document); }, [history.document, onDocumentChange]);
  const isDirty = JSON.stringify(history.document) !== JSON.stringify(history.savedDocument);
  useEffect(() => {
    if (!isDirty || typeof window === "undefined") return;
    const confirmLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = leaveWarning; };
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [isDirty, leaveWarning]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const value = useMemo<EditorContextValue>(() => {
    const actionState = {
      canUndo: editable && history.past.length > 0,
      canRedo: editable && history.future.length > 0,
      canAdd: editable && ["core.text", "core.image", ...(registry?.blocks.map((block) => block.type) ?? [])].some((type) => canAddBlock(type, history.document.blocks, registry?.getBlock(type), policy)),
      canEdit: editable && selectedBlock !== null,
      canDelete: editable && canDeleteBlock(selectedBlock, history.document.blocks, registry?.getBlock(selectedBlock?.type ?? ""), policy),
      canDuplicate: editable && canDuplicateBlock(selectedBlock, history.document.blocks, registry?.getBlock(selectedBlock?.type ?? ""), policy),
      canReorder: editable && history.document.blocks.length > 1 && canDragBlock(selectedBlock, registry?.getBlock(selectedBlock?.type ?? ""), policy)
    };
    return {
      document: history.document,
      selectedBlockId: history.selectedBlockId,
      selectedBlock,
      pendingDeleteBlock,
      canvasSelectionRequest,
      device: history.device,
      loadState,
      isDirty,
      actionState,
      canAddBlock: (type) => editable && canAddBlock(type, history.document.blocks, registry?.getBlock(type), policy),
      canDragBlock: (id) => {
        const block = history.document.blocks.find((item) => item.id === id);
        return editable && canDragBlock(block, registry?.getBlock(block?.type ?? ""), policy);
      },
      requestCanvasSelection,
      confirmCanvasSelection,
      updateFromCanvas,
      setDevice: (device) => dispatch({ type: "device", device }),
      addBlock: (type, beforeId) => {
        if (!editable || !canAddBlock(type, history.document.blocks, registry?.getBlock(type), policy)) return null;
        const block = defaultBlock(type, history.document.blocks, registry);
        const blocks = [...history.document.blocks];
        const targetIndex = beforeId ? blocks.findIndex((item) => item.id === beforeId) : -1;
        if (targetIndex < 0) blocks.push(block);
        else blocks.splice(targetIndex, 0, block);
        replace({ ...history.document, blocks }, block.id);
        return block.id;
      },
      duplicateBlock: (id) => {
        if (!editable) return;
        const index = history.document.blocks.findIndex((block) => block.id === id);
        const source = history.document.blocks[index];
        if (!canDuplicateBlock(source, history.document.blocks, registry?.getBlock(source?.type ?? ""), policy)) return;
        const block = { ...source, id: uniqueBlockId(source.type, history.document.blocks), props: { ...source.props } };
        const blocks = [...history.document.blocks];
        blocks.splice(index + 1, 0, block);
        replace({ ...history.document, blocks }, block.id);
      },
      deleteBlock: (id) => {
        if (!editable) return;
        const index = history.document.blocks.findIndex((block) => block.id === id);
        const source = history.document.blocks[index];
        if (!canDeleteBlock(source, history.document.blocks, registry?.getBlock(source?.type ?? ""), policy)) return;
        const blocks = history.document.blocks.filter((block) => block.id !== id);
        replace({ ...history.document, blocks }, blocks[index]?.id ?? blocks[index - 1]?.id ?? null);
      },
      moveBlock: (id, direction) => {
        if (!editable) return;
        const from = history.document.blocks.findIndex((block) => block.id === id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= history.document.blocks.length || !canDragBlock(history.document.blocks[from], registry?.getBlock(history.document.blocks[from]?.type ?? ""), policy)) return;
        const blocks = [...history.document.blocks];
        [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
        replace({ ...history.document, blocks }, id);
      },
      reorderBlock: (id, beforeId) => {
        if (!editable || id === beforeId) return;
        const source = history.document.blocks.find((block) => block.id === id);
        const withoutSource = history.document.blocks.filter((block) => block.id !== id);
        const targetIndex = withoutSource.findIndex((block) => block.id === beforeId);
        if (!source || targetIndex < 0 || !canDragBlock(source, registry?.getBlock(source.type), policy)) return;
        const blocks = [...withoutSource];
        blocks.splice(targetIndex, 0, source);
        replace({ ...history.document, blocks }, id);
      },
      updateBlockProps,
      updateBlockPresentation,
      requestDeleteBlock: (id) => {
        const block = history.document.blocks.find((item) => item.id === id);
        if (editable && canDeleteBlock(block, history.document.blocks, registry?.getBlock(block?.type ?? ""), policy)) setPendingDeleteBlockId(id);
      },
      cancelDeleteBlock: () => setPendingDeleteBlockId(null),
      confirmDeleteBlock: () => {
        if (pendingDeleteBlockId) {
          const id = pendingDeleteBlockId;
          setPendingDeleteBlockId(null);
          const index = history.document.blocks.findIndex((block) => block.id === id);
          const source = history.document.blocks[index];
          if (!canDeleteBlock(source, history.document.blocks, registry?.getBlock(source?.type ?? ""), policy)) return;
          const blocks = history.document.blocks.filter((block) => block.id !== id);
          replace({ ...history.document, blocks }, blocks[index]?.id ?? blocks[index - 1]?.id ?? null);
        }
      },
      undo: () => { if (editable) dispatch({ type: "undo" }); },
      redo: () => { if (editable) dispatch({ type: "redo" }); },
      markSaved: () => dispatch({ type: "saved" })
    };
  }, [canvasSelectionRequest, confirmCanvasSelection, editable, history, isDirty, loadState, pendingDeleteBlock, pendingDeleteBlockId, policy, registry, replace, requestCanvasSelection, selectedBlock, updateBlockPresentation, updateBlockProps, updateFromCanvas]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditorContext must be used within EditorProvider");
  return context;
}
