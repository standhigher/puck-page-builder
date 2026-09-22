import { Puck, usePuck } from "@puckeditor/core";
import { Badge, Banner, Button, ButtonGroup, InlineStack, Select, Text, TextField } from "@shopify/polaris";
import { DragHandleIcon, LayoutSectionIcon, MenuIcon, ProductIcon, RedoIcon, UndoIcon, XIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPageDocumentPuckConfig } from "../../adapters/puck/page-document-config";
import { fromEngineData, toEngineData } from "../../adapters/puck/page-document";
import { parseProductReferences, toProductReferenceJson, validateFieldValue, validatePageDocumentWithRegistry, type ExtensionRegistry, type FieldConfig, type ValidationIssue } from "../../core/extensions";
import type { BlockNode, JsonValue, PageDocument } from "../../core/schema/page-document";
import type { ThemeTokenName, ThemeTokens } from "../../core/theme";
import { EditorProvider, useEditorContext, type EditorLoadState } from "../context/EditorContext";
import { PageStatusCard } from "../components/PageStatusCard";
import type { AssetPickerAdapter, DraftPersistenceAdapter, DraftSaveResult, EditorSession, EditorSessionAdapter, EditorSessionState, PageStatus, ProductPickerAdapter, PublishAction } from "../contracts";
import { createAdminI18n } from "../i18n/admin";
import type { PageDocumentEditorPolicy } from "../policy";
import type { Device } from "../state/types";
import { blockIdAtRelativeY, nearestBlockIdAtY } from "./drop-position";

export type PageDocumentEditorShellProps = {
  initialDocument: PageDocument;
  iframe?: boolean;
  registry?: ExtensionRegistry;
  /** Limits the add-block library; existing document blocks remain editable. */
  availableBlockTypes?: readonly string[];
  /** Enables generic Variant and token-only style editing in the inspector. */
  appearanceControls?: boolean;
  /** Host rules that supplement block-declared operation and cardinality policies. */
  policy?: PageDocumentEditorPolicy;
  /** Copy or presentation overrides for the built-in, two-step deletion dialog. */
  deleteConfirmation?: DeleteConfirmationConfig;
  /** Presentation states are explicit so host applications can provide a consistent Admin experience. */
  loadState?: EditorLoadState;
  adminLocale?: string;
  onDocumentChange?: (document: PageDocument) => void;
  /** @deprecated Prefer draftPersistence so revision and edit-session metadata are preserved. */
  onSave?: (document: PageDocument) => Promise<void> | void;
  /** @deprecated Prefer publishAction so revision and edit-session metadata are preserved. */
  onPublish?: (document: PageDocument) => Promise<void> | void;
  /** Host-owned single-editor lock. Without this adapter the package stays backwards-compatible and editable. */
  sessionAdapter?: EditorSessionAdapter;
  onSessionStateChange?: (state: EditorSessionState) => void;
  /** Host-owned draft persistence shared by the manual-save and 800ms autosave paths. */
  draftPersistence?: DraftPersistenceAdapter;
  draftRevision?: number;
  autoSave?: boolean;
  autoSaveDelayMs?: number;
  /** Host-owned atomic publish transaction. */
  publishAction?: PublishAction;
  /** Host-owned picker/uploader for shop-scoped assets. */
  assetPicker?: AssetPickerAdapter;
  /** External settings, keyed by block id (or block type for shared settings), outside document history and persistence. */
  inspectorSettings?: Record<string, {
    values: Record<string, JsonValue>;
    disabled?: boolean;
    onChange: (fieldName: string, value: JsonValue) => void;
    footer?: ReactNode;
  }>;
  /** Host-owned product picker. The shell only shows the selected snapshot and a button. */
  productPicker?: ProductPickerAdapter;
  /** Optional reusable page lifecycle summary. */
  pageStatus?: PageStatus;
  onBack?: () => void;
  onHistory?: (input: { document: PageDocument; draftRevision?: number; session?: EditorSession }) => void;
  onPreview?: (input: { document: PageDocument; draftRevision?: number; session?: EditorSession }) => Promise<void> | void;
  onAddToStore?: (input: { document: PageDocument; session?: EditorSession }) => Promise<void> | void;
};

export type DeleteConfirmationConfig = {
  title?: string;
  message?: (block: BlockNode) => ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
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

function validateDocumentBlocks(document: PageDocument, registry?: ExtensionRegistry): ValidationIssue[] {
  return registry ? validatePageDocumentWithRegistry(document, registry) : [];
}

type ManagedSession = { state: EditorSessionState; session?: EditorSession; message?: string };

function useEditorSession(adapter: EditorSessionAdapter | undefined, pageId: string): ManagedSession {
  const [managed, setManaged] = useState<ManagedSession>(() => adapter ? { state: "acquiring" } : { state: "active" });

  useEffect(() => {
    let cancelled = false;
    let session: EditorSession | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    const stopHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    };
    if (!adapter) return;
    void adapter.acquire({ pageId }).then((result) => {
      if (cancelled) return;
      if (result.state !== "active") {
        setManaged({ state: result.state, message: result.message ?? (result.state === "locked" && result.editorName ? `${result.editorName} 正在编辑` : undefined) });
        return;
      }
      session = result.session;
      setManaged({ state: "active", session });
      if (!adapter.heartbeat) return;
      const heartbeat = () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        void adapter.heartbeat?.({ pageId, session: result.session }).catch(() => {
          if (!cancelled) {
            stopHeartbeat();
            setManaged({ state: "lost", message: "编辑锁已失效，请恢复网络后重新进入编辑器。" });
          }
        });
      };
      heartbeatTimer = setInterval(heartbeat, adapter.heartbeatIntervalMs ?? 30_000);
    }).catch(() => {
      if (!cancelled) setManaged({ state: "lost", message: "无法获取编辑锁，请稍后重试。" });
    });
    return () => {
      cancelled = true;
      stopHeartbeat();
      if (session) void adapter.release?.({ pageId, session });
    };
  }, [adapter, pageId]);

  return managed;
}

export function PageDocumentEditorShell(props: PageDocumentEditorShellProps) {
  const { sessionAdapter, initialDocument, onSessionStateChange } = props;
  const managedSession = useEditorSession(sessionAdapter, initialDocument.pageId);
  useEffect(() => { onSessionStateChange?.(managedSession.state); }, [managedSession.state, onSessionStateChange]);
  return <EditorProvider initialDocument={props.initialDocument} registry={props.registry} policy={props.policy} loadState={props.loadState} sessionState={managedSession.state} session={managedSession.session} sessionMessage={managedSession.message} leaveWarning={createAdminI18n(props.adminLocale).t("leaveWarning")} onDocumentChange={props.onDocumentChange}>
    <PageDocumentEditor {...props} />
  </EditorProvider>;
}

function PageDocumentEditor({ iframe = false, registry, adminLocale, onSave, onPublish, draftPersistence, draftRevision: initialDraftRevision, autoSave = true, autoSaveDelayMs = 800, publishAction, assetPicker, inspectorSettings, productPicker, pageStatus, onBack, onHistory, onPreview, onAddToStore, deleteConfirmation, availableBlockTypes, appearanceControls = false }: PageDocumentEditorShellProps) {
  const editor = useEditorContext();
  const [blockView, setBlockView] = useState<"blocks" | "outline">("blocks");
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [draggingLibraryType, setDraggingLibraryType] = useState<string | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [canvasMutationVersion, setCanvasMutationVersion] = useState(0);
  const [canvasResetVersion, setCanvasResetVersion] = useState(0);
  const [request, setRequest] = useState<"idle" | "saving" | "publishing">("idle");
  const [notice, setNotice] = useState<"saveFailed" | "publishFailed" | "published" | null>(null);
  const [draftRevision, setDraftRevision] = useState(initialDraftRevision);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [saveState, setSaveState] = useState<"dirty" | "saving" | "saved" | "failed" | "offline">("saved");
  const [zoom, setZoom] = useState<"auto" | "50" | "70" | "100">("auto");
  const [confirmBack, setConfirmBack] = useState(false);
  const i18n = createAdminI18n(adminLocale);
  const engineData = useMemo(() => toEngineData(editor.document, registry), [editor.document, registry]);
  const validationIssues = useMemo(() => validateDocumentBlocks(editor.document, registry), [editor.document, registry]);
  const { confirmCanvasSelection, selectedBlockId, updateBlockProps, updateBlockPresentation } = editor;
  const updateFromCanvasInput = useCallback((id: string, props: Record<string, JsonValue>, preserveCanvasValue = false) => {
    // The DOM already contains this value. Sending it back through Puck would reset
    // the contenteditable caret after every keystroke.
    if (preserveCanvasValue) setCanvasMutationVersion((version) => version + 1);
    updateBlockProps(id, props);
  }, [updateBlockProps]);
  const config = useMemo(() => createPageDocumentPuckConfig(confirmCanvasSelection, updateFromCanvasInput, selectedBlockId, registry), [confirmCanvasSelection, registry, selectedBlockId, updateFromCanvasInput]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  const resolvedSaveState = !isOnline && editor.isDirty
    ? "offline"
    : saveState === "offline" && editor.isDirty
      ? "dirty"
      : saveState === "saved" && editor.isDirty
        ? "dirty"
        : saveState;

  const canPersistDraft = Boolean(draftPersistence || onSave);
  const save = useCallback(async () => {
    if (!canPersistDraft || request !== "idle" || validationIssues.length > 0) return;
    if (!isOnline) {
      setSaveState("offline");
      return;
    }
    const document = editor.document;
    setRequest("saving");
    setSaveState("saving");
    setNotice(null);
    try {
      const result: DraftSaveResult | void = draftPersistence
        ? await draftPersistence.saveDraft({ document, expectedRevision: draftRevision, session: editor.session })
        : await onSave?.(document);
      if (result?.revision !== undefined) setDraftRevision(result.revision);
      editor.markSaved(document);
      setSaveState("saved");
    } catch {
      setNotice("saveFailed");
      setSaveState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "failed");
    } finally {
      setRequest("idle");
    }
  }, [canPersistDraft, draftPersistence, draftRevision, editor, isOnline, onSave, request, validationIssues.length]);

  useEffect(() => {
    if (!autoSave || !canPersistDraft || !editor.isDirty || resolvedSaveState !== "dirty" || !isOnline || request !== "idle" || validationIssues.length > 0 || editor.sessionState !== "active") return;
    const timer = window.setTimeout(() => { void save(); }, autoSaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoSave, autoSaveDelayMs, canPersistDraft, editor.isDirty, editor.sessionState, isOnline, request, resolvedSaveState, save, validationIssues.length]);

  const publish = async () => {
    if ((!publishAction && !onPublish) || request !== "idle" || validationIssues.length > 0 || !isOnline) return;
    const document = editor.document;
    setRequest("publishing");
    setNotice(null);
    try {
      if (publishAction) await publishAction.publish({ document, expectedRevision: draftRevision, session: editor.session, validationIssues });
      else await onPublish?.(document);
      editor.markSaved(document);
      setSaveState("saved");
      setNotice("published");
    } catch {
      setNotice("publishFailed");
    } finally {
      setRequest("idle");
    }
  };

  if (editor.loadState !== "ready" && editor.loadState !== "success") return <EditorStatus state={editor.loadState} />;
  if (editor.sessionState !== "active") return <EditorSessionStatus state={editor.sessionState} message={editor.sessionMessage} />;

  const allBlockTypes = ["core.text", "core.image", ...(registry?.blocks.map((block) => block.type) ?? [])];
  const blockTypes = availableBlockTypes ? allBlockTypes.filter((type) => availableBlockTypes.includes(type)) : allBlockTypes;
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
  const cancelLibraryDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingLibraryType(null);
  };
  const saveBadgeTone = resolvedSaveState === "failed" ? "critical" : resolvedSaveState === "offline" || resolvedSaveState === "dirty" ? "attention" : "success";
  const saveBadgeLabel = resolvedSaveState === "saving" ? i18n.t("saving") : resolvedSaveState === "failed" ? i18n.t("saveFailed") : resolvedSaveState === "offline" ? i18n.t("offline") : resolvedSaveState === "dirty" ? i18n.t("unsaved") : i18n.t("saved");
  const saveButtonLabel = request === "saving" ? i18n.t("saving") : resolvedSaveState === "failed" ? i18n.t("retrySave") : i18n.t("save");
  const requestBack = () => {
    if (!onBack) return;
    if (editor.isDirty || request === "saving") setConfirmBack(true);
    else onBack();
  };
  return <Puck config={config} data={engineData} iframe={{ enabled: iframe }} onChange={(data) => {
    if (!editor.updateFromCanvas(fromEngineData(data, editor.document, registry))) setCanvasResetVersion((version) => version + 1);
  }}>
    <Puck.Layout>
      <CanvasSelectionBridge data={engineData} requestedBlockId={editor.canvasSelectionRequest} onCanvasSelected={confirmCanvasSelection} canvasMutationVersion={canvasMutationVersion} canvasResetVersion={canvasResetVersion} />
      <div className="pb-shell pb-shell--v04" data-testid="page-document-editor" data-page-id={editor.document.pageId} data-dirty={editor.isDirty} data-editor-state={editor.loadState} data-editor-session-state={editor.sessionState} data-save-state={resolvedSaveState} data-left-panel={leftRailOpen ? "open" : "closed"} data-right-panel={rightPanelOpen ? "open" : "closed"}>
        <header className="pb-header">
          <div className="pb-header-content">
            <div className="pb-header-title-group">{onBack ? <Button variant="tertiary" onClick={requestBack}>{i18n.t("back")}</Button> : null}<div className="pb-page-title"><Text as="h1" variant="headingSm">{editor.document.settings.seoTitle ?? editor.document.pageId}</Text><Text as="p" variant="bodySm" tone="subdued">PageDocument V{editor.document.schemaVersion} · {editor.document.target}</Text>{pageStatus ? <PageStatusCard status={pageStatus} sessionState={editor.sessionState} /> : null}</div></div>
            <div className="pb-header-controls">
              <div className="pb-header-device-toolbar"><ButtonGroup variant="segmented">{(Object.keys(deviceLabels) as Array<keyof typeof deviceLabels>).map((device) => <Button key={device} pressed={editor.device === device} onClick={() => editor.setDevice(device)}>{i18n.t(deviceLabels[device])}</Button>)}</ButtonGroup><div className="pb-zoom-control"><Select label={i18n.t("zoom")} labelHidden options={[{ label: i18n.t("zoomAuto"), value: "auto" }, { label: "50%", value: "50" }, { label: "70%", value: "70" }, { label: "100%", value: "100" }]} value={zoom} onChange={(value) => setZoom(value as typeof zoom)} /></div></div>
            </div>
            <div className="pb-header-actions"><InlineStack gap="150" blockAlign="center" wrap>
              <Badge tone={saveBadgeTone}>{saveBadgeLabel}</Badge>
              {onHistory ? <span data-editor-history=""><Button disabled={request !== "idle"} onClick={() => onHistory({ document: editor.document, draftRevision, session: editor.session })}>{i18n.t("history")}</Button></span> : null}
              <Button disabled={!canPersistDraft || !editor.isDirty || request !== "idle" || validationIssues.length > 0 || !isOnline} onClick={() => void save()}>{saveButtonLabel}</Button>
              {onPreview ? <Button disabled={request !== "idle" || !isOnline} onClick={() => void onPreview({ document: editor.document, draftRevision, session: editor.session })}>{i18n.t("preview")}</Button> : null}
              {onAddToStore ? <Button disabled={request !== "idle" || pageStatus?.publicationStatus === "unpublished"} onClick={() => void onAddToStore({ document: editor.document, session: editor.session })}>{i18n.t("addToStore")}</Button> : null}
              <Button variant="primary" disabled={(!publishAction && !onPublish) || request !== "idle" || validationIssues.length > 0 || !isOnline} onClick={() => void publish()}>{request === "publishing" ? i18n.t("publishing") : i18n.t("publish")}</Button>
              <Button accessibilityLabel={i18n.t("undo")} icon={UndoIcon} variant="tertiary" disabled={!editor.actionState.canUndo} onClick={editor.undo} />
              <Button accessibilityLabel={i18n.t("redo")} icon={RedoIcon} variant="tertiary" disabled={!editor.actionState.canRedo} onClick={editor.redo} />
            </InlineStack></div>
          </div>
        </header>
        {editor.loadState === "success" ? <Banner tone="success">{i18n.t("success")}</Banner> : null}
        {notice ? <Banner tone={notice === "published" ? "success" : "critical"}>{i18n.t(notice)}</Banner> : null}
        {validationIssues.length > 0 ? <Banner tone="critical" title="区块属性未通过校验"><ul>{validationIssues.map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.path}: {issue.message}</li>)}</ul></Banner> : null}
        <div className={`pb-workspace pb-workspace--document${leftRailOpen ? "" : " pb-workspace--left-closed"}${rightPanelOpen ? "" : " pb-workspace--right-closed"}`} data-left-panel={leftRailOpen ? "open" : "closed"} data-right-panel={rightPanelOpen ? "open" : "closed"}>
          <nav className="pb-tool-rail" aria-label="编辑器工具">
            <Button accessibilityLabel={i18n.t("blocks")} icon={LayoutSectionIcon} pressed={blockView === "blocks" && leftRailOpen} variant="tertiary" onClick={() => { setBlockView("blocks"); setLeftRailOpen(true); }} />
            <Button accessibilityLabel={i18n.t("outline")} icon={MenuIcon} pressed={blockView === "outline" && leftRailOpen} variant="tertiary" onClick={() => { setBlockView("outline"); setLeftRailOpen(true); }} />
          </nav>
          <aside className={`pb-left-panel${leftRailOpen ? "" : " pb-panel--closed"}`} aria-label="PageDocument 区块">
            <InlineStack align="space-between" blockAlign="center"><Text as="h2" variant="headingSm">{blockView === "blocks" ? i18n.t("blocks") : i18n.t("outline")}</Text><Button accessibilityLabel={i18n.t("collapseLeft")} icon={XIcon} variant="tertiary" onClick={() => setLeftRailOpen(false)} /></InlineStack>
            {blockView === "blocks" ? <div className="pb-block-list" data-testid="blocks-view" aria-label="区块类型库" role="list" onDrop={cancelLibraryDrop}>
              {blockTypes.map((type) => <div key={type} className={`pb-document-block-row pb-document-block-row--library ${editor.selectedBlock?.type === type ? "pb-document-block-row--selected" : ""}`} data-block-type={type} data-selected={editor.selectedBlock?.type === type} role="listitem" draggable={editor.canAddBlock(type)} aria-disabled={!editor.canAddBlock(type)} aria-label={`${blockTypeLabel(type, registry)}，拖拽至画布以添加${editor.selectedBlock?.type === type ? "，当前选中类型" : ""}`} onDragStart={(event) => { if (!editor.canAddBlock(type)) { event.preventDefault(); return; } event.dataTransfer.setData("application/x-page-document-block", type); event.dataTransfer.effectAllowed = "copy"; setDraggingLibraryType(type); }} onDragEnd={() => setDraggingLibraryType(null)}>
                <span className="pb-library-block-title"><Text as="span" variant="bodySm" fontWeight="semibold">{blockTypeLabel(type, registry)}</Text><span className="pb-library-block-drag-hint" aria-hidden="true"><DragHandleIcon /></span></span>
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
            <div className="pb-canvas-stage"><div ref={canvasFrameRef} className={`pb-canvas-frame pb-canvas-frame--${editor.device}${zoom === "auto" ? "" : ` pb-canvas-frame--zoom-${zoom}`}`} data-device={editor.device} data-zoom={zoom}><Puck.Preview /></div>{draggingLibraryType ? <div className="pb-canvas-drop-target" data-testid="canvas-drop-target" role="region" aria-label="区块投放区" onDragOver={(event) => event.preventDefault()} onDrop={dropFromLibrary}>松开以添加 {blockTypeLabel(draggingLibraryType, registry)}</div> : null}{editor.selectedBlock ? <div className="pb-canvas-overlay" aria-label={`已选择 ${blockLabel(editor.selectedBlock, registry)}`}><span>{blockLabel(editor.selectedBlock, registry)}</span><span>Selected</span></div> : null}</div>
            {!leftRailOpen || !rightPanelOpen ? <div className="pb-collapsed-actions">{!leftRailOpen ? <Button onClick={() => setLeftRailOpen(true)}>{i18n.t("expandLeft")}</Button> : null}{!rightPanelOpen ? <Button onClick={() => setRightPanelOpen(true)}>{i18n.t("expandRight")}</Button> : null}</div> : null}
          </main>
          <aside className={`pb-right-panel${rightPanelOpen ? "" : " pb-panel--closed"}`} aria-label="PageDocument 属性">
            <InlineStack align="space-between" blockAlign="center"><Text as="h2" variant="headingSm">{i18n.t("properties")}</Text><Button accessibilityLabel={i18n.t("collapseRight")} icon={XIcon} variant="tertiary" onClick={() => setRightPanelOpen(false)} /></InlineStack>
            {editor.selectedBlock ? <><DocumentInspector key={editor.selectedBlock.id} settings={inspectorSettings?.[editor.selectedBlock.id] ?? inspectorSettings?.[editor.selectedBlock.type]} pageId={editor.document.pageId} assetPicker={assetPicker} productPicker={productPicker} i18n={i18n} block={editor.selectedBlock} registry={registry} disabled={!editor.actionState.canEdit} appearanceControls={appearanceControls} onChange={(props) => editor.updateBlockProps(editor.selectedBlock!.id, props)} onPresentationChange={(presentation) => updateBlockPresentation(editor.selectedBlock!.id, presentation)} /><InspectorActions block={editor.selectedBlock} canDuplicate={editor.actionState.canDuplicate} canDelete={editor.actionState.canDelete} canMove={editor.actionState.canReorder} canMoveUp={editor.document.blocks[0]?.id !== editor.selectedBlock.id} canMoveDown={editor.document.blocks.at(-1)?.id !== editor.selectedBlock.id} i18n={i18n} onDuplicate={() => editor.duplicateBlock(editor.selectedBlock!.id)} onDelete={() => editor.requestDeleteBlock(editor.selectedBlock!.id)} onMove={(direction) => editor.moveBlock(editor.selectedBlock!.id, direction)} /></> : <Text as="p" tone="subdued">{i18n.t("selectBlock")}</Text>}
          </aside>
        </div>
        {editor.pendingDeleteBlock ? <DeleteConfirmation block={editor.pendingDeleteBlock} config={deleteConfirmation} i18n={i18n} onCancel={editor.cancelDeleteBlock} onConfirm={editor.confirmDeleteBlock} /> : null}
        {confirmBack ? <LeaveConfirmation i18n={i18n} onCancel={() => setConfirmBack(false)} onConfirm={() => { setConfirmBack(false); onBack?.(); }} /> : null}
      </div>
    </Puck.Layout>
  </Puck>;
}

/** Bridges list-originated selection requests into Puck, then waits for Puck's selected item before updating the inspector. */
function CanvasSelectionBridge({ data, requestedBlockId, onCanvasSelected, canvasMutationVersion, canvasResetVersion }: { data: ReturnType<typeof toEngineData>; requestedBlockId: string | null; onCanvasSelected: (id: string | null) => void; canvasMutationVersion: number; canvasResetVersion: number }) {
  const puck = usePuck();
  const lastSelectedId = useRef<string | null>(null);
  const lastSyncedData = useRef<string | null>(null);
  const lastCanvasMutationVersion = useRef(0);
  const lastCanvasResetVersion = useRef(0);

  const serializedData = JSON.stringify(data);
  useEffect(() => {
    const forceReset = canvasResetVersion > lastCanvasResetVersion.current;
    if (lastSyncedData.current === serializedData && !forceReset) return;
    lastSyncedData.current = serializedData;
    if (forceReset) lastCanvasResetVersion.current = canvasResetVersion;
    if (canvasMutationVersion > lastCanvasMutationVersion.current) {
      lastCanvasMutationVersion.current = canvasMutationVersion;
      return;
    }
    puck.dispatch({ type: "setData", data });
  }, [canvasMutationVersion, canvasResetVersion, data, puck, serializedData]);

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

function EditorSessionStatus({ state, message }: { state: Exclude<EditorSessionState, "active">; message?: string }) {
  const i18n = createAdminI18n();
  const tone = state === "locked" ? "warning" : state === "readonly" ? "info" : "critical";
  const title = state === "acquiring" ? i18n.t("acquiringLock") : state === "locked" ? i18n.t("locked") : state === "readonly" ? i18n.t("readonly") : i18n.t("lockLost");
  return <div className="pb-editor-status" data-testid="page-document-editor-session-state" data-editor-session-state={state}><Banner tone={tone} title={title}>{message ?? title}</Banner></div>;
}

function InspectorSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="pb-inspector-section" open={defaultOpen}>
    <summary><span>{title}</span><span aria-hidden="true">⌄</span></summary>
    <div className="pb-inspector-section__body">{children}</div>
  </details>;
}

function InspectorTextControl({ label, value, control, disabled, onChange }: { label: string; value: unknown; control: Exclude<NonNullable<FieldConfig["control"]>, "products" | "asset">; disabled: boolean; onChange: (value: string) => void }) {
  const stringValue = typeof value === "string" ? value : "";
  if (control === "color") return <input aria-label={label} type="color" value={/^#[\da-f]{6}$/i.test(stringValue) ? stringValue : "#000000"} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} />;
  return <TextField label={label} labelHidden value={stringValue} onChange={onChange} autoComplete="off" disabled={disabled} multiline={control === "textarea" ? 4 : false} type={control === "url" ? "url" : "text"} />;
}

function InspectorAssetControl({ value, disabled, picker, pageId, blockId, i18n, onChange }: { value: unknown; disabled: boolean; picker?: AssetPickerAdapter; pageId: string; blockId: string; i18n: ReturnType<typeof createAdminI18n>; onChange: (value: JsonValue) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = !disabled; return () => { active.current = false; }; }, [disabled]);
  const url = typeof value === "string" && validateFieldValue({ field: "", control: "asset" }, value).length === 0 ? value : "";
  return <div className="pb-asset-picker" data-testid="asset-picker">
    {url ? <img src={url} alt="" className="pb-asset-picker__preview" /> : <Text as="p" variant="bodySm" tone="subdued">{i18n.t("emptyAsset")}</Text>}
    {url ? <Button fullWidth variant="tertiary" disabled={disabled || busy} onClick={() => onChange("")}>{i18n.t("removeAsset")}</Button> : null}
    <Button fullWidth disabled={disabled || busy || !picker} onClick={() => void (async () => {
      if (!picker) return;
      setBusy(true);
      setError(null);
      try {
        const asset = await picker.selectAsset({ pageId, blockId, current: { url } });
        if (asset && active.current) {
          if (validateFieldValue({ field: "", control: "asset", required: true }, asset.url).length) throw new Error("Invalid image URL");
          onChange(asset.url);
        }
      } catch {
        setError(i18n.t("selectAssetFailed"));
      } finally {
        setBusy(false);
      }
    })()}>{busy ? i18n.t("selectingAsset") : i18n.t("selectAsset")}</Button>
    {error ? <Text as="p" variant="bodySm" tone="critical">{error}</Text> : null}
  </div>;
}

function InspectorProductsControl({ value, disabled, picker, pageId, blockId, i18n, onChange }: { value: unknown; disabled: boolean; picker?: ProductPickerAdapter; pageId: string; blockId: string; i18n: ReturnType<typeof createAdminI18n>; onChange: (value: JsonValue) => void }) {
  const products = parseProductReferences(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = products.slice(0, 4);
  return <div className="pb-product-picker" data-testid="product-picker">
    <div className="pb-product-picker__summary">
      {preview.length ? <span className="pb-product-picker__thumbs" aria-hidden="true">{preview.map((product, index) => <span key={product.id} className="pb-product-picker__thumb" style={{ zIndex: preview.length - index }}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="pb-product-picker__thumb-fallback" />}</span>)}</span> : null}
      <Text as="p" variant="bodySm">{products.length ? `${products.length} ${i18n.t("productCountSuffix")}` : i18n.t("emptyProducts")}</Text>
    </div>
    <Button fullWidth icon={ProductIcon} variant="secondary" disabled={disabled || busy || !picker} onClick={() => void (async () => {
      if (!picker) return;
      setBusy(true);
      setError(null);
      try {
        const next = await picker.selectProducts({ pageId, blockId, current: products, multiple: true });
        if (next) onChange(parseProductReferences(next).map(toProductReferenceJson));
      } catch {
        setError(i18n.t("selectProductsFailed"));
      } finally {
        setBusy(false);
      }
    })()}>{busy ? i18n.t("selectingProducts") : i18n.t("selectProducts")}</Button>
    {error ? <Text as="p" variant="bodySm" tone="critical">{error}</Text> : null}
  </div>;
}

function InspectorField({ name, field, value, registry, disabled, assetPicker, productPicker, pageId, blockId, i18n, onChange }: { name: string; field: FieldConfig; value: unknown; registry?: ExtensionRegistry; disabled: boolean; assetPicker?: AssetPickerAdapter; productPicker?: ProductPickerAdapter; pageId: string; blockId: string; i18n: ReturnType<typeof createAdminI18n>; onChange: (value: JsonValue) => void }) {
  const label = field.label ?? name;
  const issues = validateFieldValue(field, value);
  const Field = registry?.getField(field.field)?.component;
  return <div className="pb-inspector-field" data-control={field.control ?? "custom"}>
    <div className="pb-inspector-field__heading"><Text as="p" variant="bodySm" fontWeight="semibold">{label}</Text>{field.description ? <Text as="p" variant="bodySm" tone="subdued">{field.description}</Text> : null}</div>
    {field.control === "products" ? <InspectorProductsControl value={value} disabled={disabled} picker={productPicker} pageId={pageId} blockId={blockId} i18n={i18n} onChange={onChange} /> : field.control === "asset" ? <InspectorAssetControl value={value} disabled={disabled} picker={assetPicker} pageId={pageId} blockId={blockId} i18n={i18n} onChange={onChange} /> : field.control ? <InspectorTextControl label={label} value={value} control={field.control} disabled={disabled} onChange={(next) => onChange(next)} /> : Field ? <Field value={value} onChange={onChange} /> : null}
    {issues.map((issue) => <Text key={issue.message} as="p" variant="bodySm" tone="critical">{issue.message}</Text>)}
  </div>;
}

function InspectorActions({ block, canDuplicate, canDelete, canMove, canMoveUp, canMoveDown, i18n, onDuplicate, onDelete, onMove }: { block: BlockNode; canDuplicate: boolean; canDelete: boolean; canMove: boolean; canMoveUp: boolean; canMoveDown: boolean; i18n: ReturnType<typeof createAdminI18n>; onDuplicate: () => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  return <div className="pb-inspector-actions" aria-label={`Actions for ${block.id}`}><ButtonGroup><Button disabled={!canMove || !canMoveUp} onClick={() => onMove(-1)}>{i18n.t("moveUp")}</Button><Button disabled={!canMove || !canMoveDown} onClick={() => onMove(1)}>{i18n.t("moveDown")}</Button><Button disabled={!canDuplicate} onClick={onDuplicate}>{i18n.t("duplicate")}</Button><Button disabled={!canDelete} tone="critical" onClick={onDelete}>{i18n.t("remove")}</Button></ButtonGroup></div>;
}

function DeleteConfirmation({ block, config, i18n, onCancel, onConfirm }: { block: BlockNode; config?: DeleteConfirmationConfig; i18n: ReturnType<typeof createAdminI18n>; onCancel: () => void; onConfirm: () => void }) {
  return <div className="pb-delete-confirmation-backdrop" role="presentation"><section className="pb-delete-confirmation" role="dialog" aria-modal="true" aria-labelledby="pb-delete-confirmation-title"><Text as="h2" variant="headingMd" id="pb-delete-confirmation-title">{config?.title ?? i18n.t("confirmDeleteTitle")}</Text><Text as="p" variant="bodyMd">{config?.message?.(block) ?? i18n.t("confirmDeleteMessage")}</Text><ButtonGroup><Button onClick={onCancel}>{config?.cancelLabel ?? i18n.t("cancel")}</Button><Button tone="critical" onClick={onConfirm}>{config?.confirmLabel ?? i18n.t("confirm")}</Button></ButtonGroup></section></div>;
}

function LeaveConfirmation({ i18n, onCancel, onConfirm }: { i18n: ReturnType<typeof createAdminI18n>; onCancel: () => void; onConfirm: () => void }) {
  return <div className="pb-delete-confirmation-backdrop" role="presentation"><section className="pb-delete-confirmation" role="dialog" aria-modal="true" aria-labelledby="pb-leave-confirmation-title"><Text as="h2" variant="headingMd" id="pb-leave-confirmation-title">{i18n.t("confirmLeaveTitle")}</Text><Text as="p" variant="bodyMd">{i18n.t("leaveWarning")}</Text><ButtonGroup><Button onClick={onCancel}>{i18n.t("cancel")}</Button><Button tone="critical" onClick={onConfirm}>{i18n.t("leave")}</Button></ButtonGroup></section></div>;
}

function inspectorFieldConfig(name: string, field: FieldConfig): FieldConfig {
  const key = name.toLowerCase();
  const group = /(?:href|url)/.test(key) ? "Links" : /(?:default|shipment|query|hide)/.test(key) ? "Tracking settings" : /(?:id|variant|theme)/.test(key) ? "Advanced" : "Content";
  const description = field.description ?? (field.control === "textarea"
    ? "适合较长或多行的展示文案。"
    : field.control === "url"
      ? "使用站内相对路径或 HTTPS 地址。"
      : key.includes("shipment")
        ? "多个包裹标签使用 | 分隔。"
        : key.includes("default")
          ? "仅用于编辑器和空状态预览。"
          : undefined);
  return { ...field, group: field.group ?? group, description };
}

const appearanceTokens: Array<[ThemeTokenName, string]> = [["color.primary", "主色"], ["color.surface", "表面色"], ["radius", "圆角"], ["spacing", "间距"]];

function DocumentInspector({ settings, pageId, assetPicker, productPicker, i18n, block, registry, disabled, appearanceControls, onChange, onPresentationChange }: { settings?: NonNullable<PageDocumentEditorShellProps["inspectorSettings"]>[string]; pageId: string; assetPicker?: AssetPickerAdapter; productPicker?: ProductPickerAdapter; i18n: ReturnType<typeof createAdminI18n>; block: BlockNode; registry?: ExtensionRegistry; disabled: boolean; appearanceControls: boolean; onChange: (props: Record<string, JsonValue>) => void; onPresentationChange: (presentation: Pick<BlockNode, "variant" | "style">) => void }) {
  const [assetError, setAssetError] = useState<string | null>(null);
  const [selectingAsset, setSelectingAsset] = useState(false);
  const definition = registry?.getBlock(block.type);
  const groupedFields = definition ? Object.entries(definition.fields).reduce<Record<string, Array<[string, FieldConfig]>>>((groups, entry) => {
    const [name, field] = entry;
    const configuredField = inspectorFieldConfig(name, field);
    const group = configuredField.group ?? "Content";
    (groups[group] ??= []).push([name, configuredField]);
    return groups;
  }, {}) : {};
  return <div className="pb-inspector" data-testid="document-inspector">
    <header className="pb-inspector__header"><Badge>{block.type}</Badge><div><Text as="p" variant="headingSm">{blockLabel(block, registry)}</Text><Text as="p" variant="bodySm" tone="subdued">{definition?.category ?? "Core block"}</Text></div></header>
    {block.type === "core.text" ? <InspectorSection title="Content"><InspectorField name="content" field={{ field: "", label: "文本内容", control: "textarea", description: "支持较长的正文内容。" }} value={block.props.content} registry={registry} disabled={disabled} productPicker={productPicker} pageId={pageId} blockId={block.id} i18n={i18n} onChange={(content) => onChange({ content })} /></InspectorSection> : null}
    {block.type === "core.image" ? <InspectorSection title="Image"><InspectorField name="src" field={{ field: "", label: "图片 URL", control: "url", description: "使用 HTTPS 图片地址。" }} value={block.props.src} registry={registry} disabled={disabled} productPicker={productPicker} pageId={pageId} blockId={block.id} i18n={i18n} onChange={(src) => onChange({ src })} /><InspectorField name="alt" field={{ field: "", label: "替代文本", control: "text", description: "用于无障碍阅读和图片加载失败场景。" }} value={block.props.alt} registry={registry} disabled={disabled} productPicker={productPicker} pageId={pageId} blockId={block.id} i18n={i18n} onChange={(alt) => onChange({ alt })} />{assetPicker ? <><Button disabled={disabled || selectingAsset} onClick={() => void (async () => {
      setSelectingAsset(true);
      setAssetError(null);
      try {
        const asset = await assetPicker.selectAsset({ pageId, blockId: block.id, current: { id: typeof block.props.assetId === "string" ? block.props.assetId : undefined, url: typeof block.props.src === "string" ? block.props.src : undefined, alt: typeof block.props.alt === "string" ? block.props.alt : undefined } });
        if (asset) onChange({ ...block.props, assetId: asset.id, src: asset.url, alt: asset.alt ?? (typeof block.props.alt === "string" ? block.props.alt : "") });
      } catch {
        setAssetError("无法选择素材，请重试。");
      } finally {
        setSelectingAsset(false);
      }
    })()}>{selectingAsset ? "正在选择素材…" : "选择素材"}</Button>{assetError ? <Text as="p" variant="bodySm" tone="critical">{assetError}</Text> : null}</> : null}</InspectorSection> : null}
    {Object.entries(groupedFields).map(([group, fields]) => <InspectorSection key={group} title={group} defaultOpen={group !== "Advanced"}>{fields.map(([name, field]) => <InspectorField key={name} name={name} field={field} value={field.persist === false ? settings?.values[name] : block.props[name]} registry={registry} disabled={disabled || (field.persist === false && (!settings || Boolean(settings.disabled)))} assetPicker={assetPicker} productPicker={productPicker} pageId={pageId} blockId={block.id} i18n={i18n} onChange={(value) => field.persist === false ? settings?.onChange(name, value) : onChange({ [name]: value })} />)}</InspectorSection>)}
    {Object.values(definition?.fields ?? {}).some((field) => field.persist === false) ? settings?.footer : null}
    {appearanceControls && definition?.variants?.length ? <InspectorSection title="外观"><Select label="样式变体" options={definition.variants.map((variant) => ({ label: variant.label, value: variant.id }))} value={block.variant} disabled={disabled} onChange={(variant) => onPresentationChange({ variant, style: block.style })} /></InspectorSection> : null}
    {appearanceControls && definition ? <InspectorSection title="样式覆盖" defaultOpen={false}>{appearanceTokens.map(([token, label]) => <TextField key={token} label={label} value={block.style[token] ?? ""} placeholder="继承页面或模板设置" autoComplete="off" disabled={disabled} onChange={(value) => {
      const style: ThemeTokens = { ...block.style };
      if (value.trim()) style[token] = value;
      else delete style[token];
      onPresentationChange({ variant: block.variant, style });
    }} />)}</InspectorSection> : null}
    {/* {definition ? <p className="pb-inspector__hint">画布中带虚线边框的内容可直接编辑。</p> : null} */}
  </div>;
}
