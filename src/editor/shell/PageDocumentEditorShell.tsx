import { Puck, usePuck } from "@puckeditor/core";
import { Badge, Banner, BlockStack, Button, ButtonGroup, InlineStack, Text, TextField } from "@shopify/polaris";
import { DragHandleIcon, LayoutSectionIcon, MenuIcon, RedoIcon, UndoIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPageDocumentPuckConfig } from "../../adapters/puck/page-document-config";
import { fromEngineData, toEngineData } from "../../adapters/puck/page-document";
import type { ExtensionRegistry } from "../../core/extensions";
import type { BlockNode, JsonValue, PageDocument } from "../../core/schema/page-document";
import { EditorProvider, useEditorContext, type EditorLoadState } from "../context/EditorContext";
import { createAdminI18n } from "../i18n/admin";
import type { Device } from "../state/types";
import { blockIdAtRelativeY, nearestBlockIdAtY } from "./drop-position";

export type PageDocumentEditorShellProps = {
  initialDocument: PageDocument;
  iframe?: boolean;
  registry?: ExtensionRegistry;
  /** Presentation states are explicit so host applications can provide a consistent Admin experience. */
  loadState?: EditorLoadState;
  adminLocale?: string;
  onDocumentChange?: (document: PageDocument) => void;
  /** Persist the current draft. The shell marks the document clean only after this resolves. */
  onSave?: (document: PageDocument) => Promise<void> | void;
  /** Publish the current document. Hosts should persist it atomically with publication. */
  onPublish?: (document: PageDocument) => Promise<void> | void;
};

const deviceLabels: Record<Exclude<Device, "full">, "desktop" | "tablet" | "mobile"> = { desktop: "desktop", tablet: "tablet", mobile: "mobile" };

function blockLabel(block: BlockNode, registry?: ExtensionRegistry) {
  return blockTypeLabel(block.type, registry);
}

function blockTypeLabel(type: string, registry?: ExtensionRegistry) {
  if (type === "core.text") return "文本";
  if (type === "core.image") return "图片";
  return registry?.getBlock(type)?.label ?? type;
}

export function PageDocumentEditorShell(props: PageDocumentEditorShellProps) {
  return <EditorProvider initialDocument={props.initialDocument} registry={props.registry} loadState={props.loadState} leaveWarning={createAdminI18n(props.adminLocale).t("leaveWarning")} onDocumentChange={props.onDocumentChange}>
    <PageDocumentEditor {...props} />
  </EditorProvider>;
}

function PageDocumentEditor({ iframe = true, registry, adminLocale, onSave, onPublish }: PageDocumentEditorShellProps) {
  const editor = useEditorContext();
  const [blockView, setBlockView] = useState<"blocks" | "outline">("blocks");
  const [draggingLibraryType, setDraggingLibraryType] = useState<string | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [canvasMutationVersion, setCanvasMutationVersion] = useState(0);
  const [request, setRequest] = useState<"idle" | "saving" | "publishing">("idle");
  const [notice, setNotice] = useState<"saveFailed" | "publishFailed" | "published" | null>(null);
  const i18n = createAdminI18n(adminLocale);
  const engineData = useMemo(() => toEngineData(editor.document, registry), [editor.document, registry]);
  const { confirmCanvasSelection, selectedBlockId, updateBlockProps } = editor;
  const updateFromCanvasInput = useCallback((id: string, props: Record<string, JsonValue>) => {
    // The DOM already contains this value. Sending it back through Puck would reset
    // the contenteditable caret after every keystroke.
    setCanvasMutationVersion((version) => version + 1);
    updateBlockProps(id, props);
  }, [updateBlockProps]);
  const config = useMemo(() => createPageDocumentPuckConfig(confirmCanvasSelection, updateFromCanvasInput, selectedBlockId, registry), [confirmCanvasSelection, registry, selectedBlockId, updateFromCanvasInput]);

  if (editor.loadState !== "ready" && editor.loadState !== "success") return <EditorStatus state={editor.loadState} />;

  const blockTypes = ["core.text", "core.image", ...(registry?.blocks.map((block) => block.type) ?? [])];
  const addFromLibrary = (type: string, beforeId?: string) => {
    const id = editor.addBlock(type, beforeId);
    if (id) editor.requestCanvasSelection(id);
  };
  const getDropBeforeId = (clientY: number) => {
    const frame = canvasFrameRef.current;
    if (!frame) return undefined;
    const iframe = frame.querySelector("iframe");
    const root = iframe?.contentDocument ?? frame;
    const offsetTop = iframe?.getBoundingClientRect().top ?? 0;
    const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-page-document-block-id]"));
    const puckElements = elements.length > 0 ? elements : Array.from(root.querySelectorAll<HTMLElement>("[data-puck-dnd]"));
    // Puck may render a preview through a portal when iframe rendering is disabled.
    const blockElements = puckElements.length > 0 ? puckElements : Array.from(window.document.querySelectorAll<HTMLElement>("[data-page-document-block-id], [data-puck-dnd]"));
    const candidates = blockElements.map((element) => ({
      id: element.dataset.pageDocumentBlockId ?? element.dataset.puckDnd,
      top: element.getBoundingClientRect().top,
      height: element.getBoundingClientRect().height
    })).filter((item): item is { id: string; top: number; height: number } => typeof item.id === "string");
    const nearestId = nearestBlockIdAtY(candidates, clientY - offsetTop);
    if (nearestId || candidates.length > 0) return nearestId;
    // Puck's sandboxed iframe may not expose its document. Its relative vertical
    // position still maps to a deterministic insertion slot in the PageDocument.
    const rect = frame.getBoundingClientRect();
    if (rect.height <= 0) return undefined;
    return blockIdAtRelativeY(editor.document.blocks.map((block) => block.id), (clientY - rect.top) / rect.height);
  };
  const dropFromLibrary = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/x-page-document-block") || draggingLibraryType;
    if (type && blockTypes.includes(type)) addFromLibrary(type, getDropBeforeId(event.clientY));
    setDraggingLibraryType(null);
  };
  const save = async () => {
    if (!onSave || request !== "idle") return;
    setRequest("saving");
    setNotice(null);
    try {
      await onSave(editor.document);
      editor.markSaved();
    } catch {
      setNotice("saveFailed");
    } finally {
      setRequest("idle");
    }
  };
  const publish = async () => {
    if (!onPublish || request !== "idle") return;
    setRequest("publishing");
    setNotice(null);
    try {
      await onPublish(editor.document);
      editor.markSaved();
      setNotice("published");
    } catch {
      setNotice("publishFailed");
    } finally {
      setRequest("idle");
    }
  };

  return <Puck config={config} data={engineData} iframe={{ enabled: iframe }} onChange={(data) => editor.updateFromCanvas(fromEngineData(data, editor.document, registry))}>
    <Puck.Layout>
      <CanvasSelectionBridge data={engineData} requestedBlockId={editor.canvasSelectionRequest} onCanvasSelected={confirmCanvasSelection} canvasMutationVersion={canvasMutationVersion} />
      <div className="pb-shell pb-shell--v04" data-testid="page-document-editor" data-page-id={editor.document.pageId} data-dirty={editor.isDirty} data-editor-state={editor.loadState}>
        <header className="pb-header">
          <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
            <div className="pb-page-title"><Text as="h1" variant="headingSm">{editor.document.settings.seoTitle ?? editor.document.pageId}</Text><Text as="p" variant="bodySm" tone="subdued">PageDocument V{editor.document.schemaVersion} · {editor.document.target}</Text></div>
            <InlineStack gap="150" blockAlign="center" wrap={false}>
              <Badge tone={editor.isDirty ? "attention" : "success"}>{editor.isDirty ? i18n.t("unsaved") : i18n.t("saved")}</Badge>
              <Button disabled={!onSave || !editor.isDirty || request !== "idle"} onClick={() => void save()}>{request === "saving" ? i18n.t("saving") : i18n.t("save")}</Button>
              <Button variant="primary" disabled={!onPublish || request !== "idle"} onClick={() => void publish()}>{request === "publishing" ? i18n.t("publishing") : i18n.t("publish")}</Button>
              <Button accessibilityLabel={i18n.t("undo")} icon={UndoIcon} variant="tertiary" disabled={!editor.actionState.canUndo} onClick={editor.undo} />
              <Button accessibilityLabel={i18n.t("redo")} icon={RedoIcon} variant="tertiary" disabled={!editor.actionState.canRedo} onClick={editor.redo} />
            </InlineStack>
          </InlineStack>
        </header>
        {editor.loadState === "success" ? <Banner tone="success">{i18n.t("success")}</Banner> : null}
        {notice ? <Banner tone={notice === "published" ? "success" : "critical"}>{i18n.t(notice)}</Banner> : null}
        <div className="pb-workspace pb-workspace--document">
          <nav className="pb-tool-rail" aria-label="编辑器工具">
            <Button accessibilityLabel={i18n.t("blocks")} icon={LayoutSectionIcon} pressed={blockView === "blocks"} variant="tertiary" onClick={() => setBlockView("blocks")} />
            <Button accessibilityLabel={i18n.t("outline")} icon={MenuIcon} pressed={blockView === "outline"} variant="tertiary" onClick={() => setBlockView("outline")} />
          </nav>
          <aside className="pb-left-panel" aria-label="PageDocument 区块">
            <InlineStack align="space-between" blockAlign="center"><Text as="h2" variant="headingSm">{blockView === "blocks" ? i18n.t("blocks") : i18n.t("outline")}</Text></InlineStack>
            {blockView === "blocks" ? <div className="pb-block-list" data-testid="blocks-view" aria-label="区块类型库" role="list">
              {blockTypes.map((type) => <div key={type} className={`pb-document-block-row pb-document-block-row--library ${editor.selectedBlock?.type === type ? "pb-document-block-row--selected" : ""}`} data-block-type={type} data-selected={editor.selectedBlock?.type === type} role="listitem" draggable={editor.actionState.canAdd} aria-label={`${blockTypeLabel(type, registry)}，拖拽至画布以添加${editor.selectedBlock?.type === type ? "，当前选中类型" : ""}`} onDragStart={(event) => { event.dataTransfer.setData("application/x-page-document-block", type); event.dataTransfer.effectAllowed = "copy"; setDraggingLibraryType(type); }} onDragEnd={() => setDraggingLibraryType(null)}>
                <span className="pb-library-block-title"><Text as="span" variant="bodySm" fontWeight="semibold">{blockTypeLabel(type, registry)}</Text><span className="pb-library-block-drag-icon" aria-hidden="true"><DragHandleIcon /></span></span>
                <Text as="span" variant="bodySm" tone="subdued">{type}</Text>
              </div>)}
            </div> : editor.document.blocks.length === 0 ? <Text as="p" tone="subdued">{i18n.t("empty")}</Text> : <div className="pb-block-list" data-testid="outline-view">
              {editor.document.blocks.map((block) => <button key={block.id} type="button" className={`pb-document-block-row pb-document-block-row--library ${block.id === editor.selectedBlockId ? "pb-document-block-row--selected" : ""}`} aria-pressed={block.id === editor.selectedBlockId} onClick={() => editor.requestCanvasSelection(block.id)}>
                <Text as="span" variant="bodySm" fontWeight="semibold">{blockLabel(block, registry)}</Text>
                <Text as="span" variant="bodySm" tone="subdued">{block.id}</Text>
              </button>)}
            </div>}
          </aside>
          <main className="pb-canvas-area">
            <div className="pb-canvas-toolbar"><ButtonGroup variant="segmented">{(Object.keys(deviceLabels) as Array<keyof typeof deviceLabels>).map((device) => <Button key={device} pressed={editor.device === device} onClick={() => editor.setDevice(device)}>{i18n.t(deviceLabels[device])}</Button>)}</ButtonGroup></div>
            <div className="pb-canvas-stage"><div ref={canvasFrameRef} className={`pb-canvas-frame pb-canvas-frame--${editor.device}`} data-device={editor.device}><Puck.Preview /></div>{draggingLibraryType ? <div className="pb-canvas-drop-target" data-testid="canvas-drop-target" role="region" aria-label="区块投放区" onDragOver={(event) => event.preventDefault()} onDrop={dropFromLibrary}>松开以添加 {blockTypeLabel(draggingLibraryType, registry)}</div> : null}{editor.selectedBlock ? <div className="pb-canvas-overlay" aria-label={`已选择 ${blockLabel(editor.selectedBlock, registry)}`}><span>{blockLabel(editor.selectedBlock, registry)}</span><span>Selected</span></div> : null}</div>
          </main>
          <aside className="pb-right-panel" aria-label="PageDocument 属性">
            <Text as="h2" variant="headingSm">{i18n.t("properties")}</Text>
            {editor.selectedBlock ? <DocumentInspector block={editor.selectedBlock} registry={registry} disabled={!editor.actionState.canEdit} onChange={(props) => editor.updateBlockProps(editor.selectedBlock!.id, props)} /> : <Text as="p" tone="subdued">{i18n.t("selectBlock")}</Text>}
          </aside>
        </div>
      </div>
    </Puck.Layout>
  </Puck>;
}

/** Bridges list-originated selection requests into Puck, then waits for Puck's selected item before updating the inspector. */
function CanvasSelectionBridge({ data, requestedBlockId, onCanvasSelected, canvasMutationVersion }: { data: ReturnType<typeof toEngineData>; requestedBlockId: string | null; onCanvasSelected: (id: string | null) => void; canvasMutationVersion: number }) {
  const puck = usePuck();
  const lastSelectedId = useRef<string | null>(null);
  const lastSyncedData = useRef<string | null>(null);
  const lastCanvasMutationVersion = useRef(0);

  const serializedData = JSON.stringify(data);
  useEffect(() => {
    if (lastSyncedData.current === serializedData) return;
    lastSyncedData.current = serializedData;
    if (canvasMutationVersion > lastCanvasMutationVersion.current) {
      lastCanvasMutationVersion.current = canvasMutationVersion;
      return;
    }
    puck.dispatch({ type: "setData", data });
  }, [canvasMutationVersion, data, puck, serializedData]);

  useEffect(() => {
    if (!requestedBlockId) return;
    const selector = puck.getSelectorForId(requestedBlockId);
    if (selector) puck.dispatch({ type: "setUi", ui: { itemSelector: selector } });
  }, [puck, requestedBlockId]);

  const selectedId = typeof puck.selectedItem?.props.id === "string" ? puck.selectedItem.props.id : null;
  useEffect(() => {
    if (selectedId && lastSelectedId.current !== selectedId) {
      lastSelectedId.current = selectedId;
      onCanvasSelected(selectedId);
    }
  }, [onCanvasSelected, selectedId]);

  return null;
}

function EditorStatus({ state }: { state: Exclude<EditorLoadState, "ready" | "success"> }) {
  const i18n = createAdminI18n();
  const tone = state === "error" ? "critical" : state === "disabled" ? "warning" : "info";
  const message = state === "loading" ? i18n.t("loading") : state === "empty" ? i18n.t("empty") : state === "error" ? i18n.t("error") : i18n.t("disabled");
  return <div className="pb-editor-status" data-testid="page-document-editor-state" data-editor-state={state}><Banner tone={tone} title={message}>{state === "disabled" ? i18n.t("disabled") : message}</Banner></div>;
}

function DocumentInspector({ block, registry, disabled, onChange }: { block: BlockNode; registry?: ExtensionRegistry; disabled: boolean; onChange: (props: Record<string, JsonValue>) => void }) {
  const definition = registry?.getBlock(block.type);
  return <BlockStack gap="300" data-testid="document-inspector">
    <Badge>{block.type}</Badge>
    <Text as="p" variant="headingSm">{blockLabel(block, registry)}</Text>
    {block.type === "core.text" ? <TextField label="文本内容" value={typeof block.props.content === "string" ? block.props.content : ""} onChange={(content) => onChange({ content })} autoComplete="off" multiline={4} disabled={disabled} /> : null}
    {block.type === "core.image" ? <><TextField label="图片 URL" value={typeof block.props.src === "string" ? block.props.src : ""} onChange={(src) => onChange({ src })} autoComplete="off" disabled={disabled} /><TextField label="替代文本" value={typeof block.props.alt === "string" ? block.props.alt : ""} onChange={(alt) => onChange({ alt })} autoComplete="off" disabled={disabled} /></> : null}
    {definition ? Object.entries(definition.fields).map(([name, field]) => {
      const Field = registry?.getField(field.field)?.component;
      return Field ? <Field key={name} value={block.props[name]} onChange={(value) => onChange({ [name]: value as JsonValue })} /> : null;
    }) : null}
  </BlockStack>;
}
