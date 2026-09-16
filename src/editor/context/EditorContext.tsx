import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { ExtensionRegistry } from "../../core/extensions";
import type { BlockNode, JsonValue, PageDocument } from "../../core/schema/page-document";
import type { Device } from "../state/types";

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
type EditorHistory = Snapshot & { past: Snapshot[]; future: Snapshot[]; device: Device };
type HistoryAction =
  | { type: "select"; id: string | null }
  | { type: "device"; device: Device }
  | { type: "replace"; document: PageDocument; selectedBlockId: string | null }
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
  const current = { document: state.document, selectedBlockId: state.selectedBlockId };
  return { ...state, document: action.document, selectedBlockId: action.selectedBlockId, past: [...state.past, current], future: [] };
}

export type EditorContextValue = {
  document: PageDocument;
  selectedBlockId: string | null;
  selectedBlock: BlockNode | null;
  device: Device;
  loadState: EditorLoadState;
  isDirty: boolean;
  actionState: EditorActionState;
  selectBlock(id: string | null): void;
  setDevice(device: Device): void;
  addBlock(type: string): void;
  duplicateBlock(id: string): void;
  deleteBlock(id: string): void;
  moveBlock(id: string, direction: -1 | 1): void;
  reorderBlock(id: string, beforeId: string): void;
  updateBlockProps(id: string, props: Record<string, JsonValue>): void;
  undo(): void;
  redo(): void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

function uniqueBlockId(type: string, blocks: BlockNode[]) {
  const prefix = type.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "block";
  let index = blocks.length + 1;
  while (blocks.some((block) => block.id === `${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function defaultBlock(type: string, blocks: BlockNode[], registry?: ExtensionRegistry): BlockNode {
  if (type === "core.text") return { id: uniqueBlockId(type, blocks), type, version: 1, props: { content: "New text block" } };
  if (type === "core.image") return { id: uniqueBlockId(type, blocks), type, version: 1, props: { src: "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1200&q=80", alt: "" } };
  const definition = registry?.getBlock(type);
  if (!definition) throw new Error(`Unknown PageDocument block type: ${type}`);
  return { id: uniqueBlockId(type, blocks), type, version: definition.version, props: definition.defaultProps as Record<string, JsonValue> };
}

export function EditorProvider({ initialDocument, registry, loadState = "ready", leaveWarning = "You have unsaved changes.", onDocumentChange, children }: { initialDocument: PageDocument; registry?: ExtensionRegistry; loadState?: EditorLoadState; leaveWarning?: string; onDocumentChange?: (document: PageDocument) => void; children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, initialDocument, (document): EditorHistory => ({ document, selectedBlockId: document.blocks[0]?.id ?? null, past: [], future: [], device: "desktop" }));
  const editable = loadState === "ready" || loadState === "success";
  const selectedBlock = history.document.blocks.find((block) => block.id === history.selectedBlockId) ?? null;
  const replace = useCallback((document: PageDocument, selectedBlockId: string | null) => dispatch({ type: "replace", document, selectedBlockId }), []);

  useEffect(() => { onDocumentChange?.(history.document); }, [history.document, onDocumentChange]);
  useEffect(() => {
    if (!history.past.length || typeof window === "undefined") return;
    const confirmLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = leaveWarning; };
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [history.past.length, leaveWarning]);
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
      canAdd: editable,
      canEdit: editable && selectedBlock !== null,
      canDelete: editable && selectedBlock !== null,
      canDuplicate: editable && selectedBlock !== null,
      canReorder: editable && history.document.blocks.length > 1
    };
    return {
      document: history.document,
      selectedBlockId: history.selectedBlockId,
      selectedBlock,
      device: history.device,
      loadState,
      isDirty: history.past.length > 0,
      actionState,
      selectBlock: (id) => dispatch({ type: "select", id }),
      setDevice: (device) => dispatch({ type: "device", device }),
      addBlock: (type) => {
        if (!editable) return;
        const block = defaultBlock(type, history.document.blocks, registry);
        replace({ ...history.document, blocks: [...history.document.blocks, block] }, block.id);
      },
      duplicateBlock: (id) => {
        if (!editable) return;
        const index = history.document.blocks.findIndex((block) => block.id === id);
        const source = history.document.blocks[index];
        if (!source) return;
        const block = { ...source, id: uniqueBlockId(source.type, history.document.blocks), props: { ...source.props } };
        const blocks = [...history.document.blocks];
        blocks.splice(index + 1, 0, block);
        replace({ ...history.document, blocks }, block.id);
      },
      deleteBlock: (id) => {
        if (!editable) return;
        const index = history.document.blocks.findIndex((block) => block.id === id);
        if (index < 0) return;
        const blocks = history.document.blocks.filter((block) => block.id !== id);
        replace({ ...history.document, blocks }, blocks[index]?.id ?? blocks[index - 1]?.id ?? null);
      },
      moveBlock: (id, direction) => {
        if (!editable) return;
        const from = history.document.blocks.findIndex((block) => block.id === id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= history.document.blocks.length) return;
        const blocks = [...history.document.blocks];
        [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
        replace({ ...history.document, blocks }, id);
      },
      reorderBlock: (id, beforeId) => {
        if (!editable || id === beforeId) return;
        const source = history.document.blocks.find((block) => block.id === id);
        const withoutSource = history.document.blocks.filter((block) => block.id !== id);
        const targetIndex = withoutSource.findIndex((block) => block.id === beforeId);
        if (!source || targetIndex < 0) return;
        const blocks = [...withoutSource];
        blocks.splice(targetIndex, 0, source);
        replace({ ...history.document, blocks }, id);
      },
      updateBlockProps: (id, props) => {
        if (!editable) return;
        const blocks = history.document.blocks.map((block) => block.id === id ? { ...block, props: { ...block.props, ...props } } : block);
        replace({ ...history.document, blocks }, id);
      },
      undo: () => { if (editable) dispatch({ type: "undo" }); },
      redo: () => { if (editable) dispatch({ type: "redo" }); }
    };
  }, [editable, history, loadState, registry, replace, selectedBlock]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditorContext must be used within EditorProvider");
  return context;
}
