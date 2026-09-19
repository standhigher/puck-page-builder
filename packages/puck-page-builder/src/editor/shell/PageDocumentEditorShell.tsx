import { Puck, usePuck } from "@puckeditor/core";
import { Badge, Banner, Button, ButtonGroup, InlineStack, Text, TextField } from "@shopify/polaris";
import { DragHandleIcon, LayoutSectionIcon, MenuIcon, RedoIcon, UndoIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPageDocumentPuckConfig } from "../../adapters/puck/page-document-config";
import { fromEngineData, toEngineData } from "../../adapters/puck/page-document";
import { validateFieldValue, type ExtensionRegistry, type FieldConfig, type ValidationIssue } from "../../core/extensions";
import type { BlockNode, JsonValue, PageDocument } from "../../core/schema/page-document";
import { EditorProvider, useEditorContext, type EditorLoadState } from "../context/EditorContext";
import { createAdminI18n } from "../i18n/admin";
import type { PageDocumentEditorPolicy } from "../policy";
import type { Device } from "../state/types";
import { blockIdAtRelativeY, nearestBlockIdAtY } from "./drop-position";

export type PageDocumentEditorShellProps = {
  initialDocument: PageDocument;
  iframe?: boolean;
  registry?: ExtensionRegistry;
  /** Host rules that supplement block-declared operation and cardinality policies. */
  policy?: PageDocumentEditorPolicy;
  /** Copy or presentation overrides for the built-in, two-step deletion dialog. */
  deleteConfirmation?: DeleteConfirmationConfig;
  /** Presentation states are explicit so host applications can provide a consistent Admin experience. */
  loadState?: EditorLoadState;
  adminLocale?: string;
  onDocumentChange?: (document: PageDocument) => void;
  /** Persist the current draft. The shell marks the document clean only after this resolves. */
  onSave?: (document: PageDocument) => Promise<void> | void;
  /** Publish the current document. Hosts should persist it atomically with publication. */
  onPublish?: (document: PageDocument) => Promise<void> | void;
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
  if (!registry) return [];
  return document.blocks.flatMap((block) => {
    const definition = registry.getBlock(block.type);
    if (!definition) return [];
    const issues = [
      ...(definition.validate?.(block.props) ?? []),
      ...Object.entries(definition.fields).flatMap(([name, field]) => validateFieldValue(field, block.props[name]).map((issue) => ({ ...issue, path: issue.path ? `${name}.${issue.path}` : name })))
    ];
    if (definition.variants?.length && !definition.variants.some((variant) => variant.id === block.variant)) {
      issues.push({ path: "variant", message: `Unsupported variant: ${block.variant}.` });
    }
    return issues.map((issue) => ({ ...issue, path: `${block.id}.${issue.path}` }));
  });
}

export function PageDocumentEditorShell(props: PageDocumentEditorShellProps) {
  return <EditorProvider initialDocument={props.initialDocument} registry={props.registry} policy={props.policy} loadState={props.loadState} leaveWarning={createAdminI18n(props.adminLocale).t("leaveWarning")} onDocumentChange={props.onDocumentChange}>
    <PageDocumentEditor {...props} />
  </EditorProvider>;
}

function PageDocumentEditor({ iframe = true, registry, adminLocale, onSave, onPublish, deleteConfirmation }: PageDocumentEditorShellProps) {
  const editor = useEditorContext();
  const [blockView, setBlockView] = useState<"blocks" | "outline">("blocks");
  const [draggingLibraryType, setDraggingLibraryType] = useState<string | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [canvasMutationVersion, setCanvasMutationVersion] = useState(0);
  const [canvasResetVersion, setCanvasResetVersion] = useState(0);
  const [request, setRequest] = useState<"idle" | "saving" | "publishing">("idle");
  const [notice, setNotice] = useState<"saveFailed" | "publishFailed" | "published" | null>(null);
  const i18n = createAdminI18n(adminLocale);
  const engineData = useMemo(() => toEngineData(editor.document, registry), [editor.document, registry]);
  const validationIssues = useMemo(() => validateDocumentBlocks(editor.document, registry), [editor.document, registry]);
  const { confirmCanvasSelection, selectedBlockId, updateBlockProps } = editor;
  const updateFromCanvasInput = useCallback((id: string, props: Record<string, JsonValue>, preserveCanvasValue = false) => {
    // The DOM already contains this value. Sending it back through Puck would reset
    // the contenteditable caret after every keystroke.
    if (preserveCanvasValue) setCanvasMutationVersion((version) => version + 1);
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
  const cancelLibraryDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingLibraryType(null);
  };
  const save = async () => {
    if (!onSave || request !== "idle" || validationIssues.length > 0) return;
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
    if (!onPublish || request !== "idle" || validationIssues.length > 0) return;
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

  return <Puck config={config} data={engineData} iframe={{ enabled: iframe }} onChange={(data) => {
    if (!editor.updateFromCanvas(fromEngineData(data, editor.document, registry))) setCanvasResetVersion((version) => version + 1);
  }}>
    <Puck.Layout>
      <CanvasSelectionBridge data={engineData} requestedBlockId={editor.canvasSelectionRequest} onCanvasSelected={confirmCanvasSelection} canvasMutationVersion={canvasMutationVersion} canvasResetVersion={canvasResetVersion} />
      <div className="pb-shell pb-shell--v04" data-testid="page-document-editor" data-page-id={editor.document.pageId} data-dirty={editor.isDirty} data-editor-state={editor.loadState}>
        <header className="pb-header">
          <div className="pb-header-content">
            <div className="pb-page-title"><Text as="h1" variant="headingSm">{editor.document.settings.seoTitle ?? editor.document.pageId}</Text><Text as="p" variant="bodySm" tone="subdued">PageDocument V{editor.document.schemaVersion} · {editor.document.target}</Text></div>
            <div className="pb-header-device-toolbar"><ButtonGroup variant="segmented">{(Object.keys(deviceLabels) as Array<keyof typeof deviceLabels>).map((device) => <Button key={device} pressed={editor.device === device} onClick={() => editor.setDevice(device)}>{i18n.t(deviceLabels[device])}</Button>)}</ButtonGroup></div>
            <div className="pb-header-actions"><InlineStack gap="150" blockAlign="center" wrap={false}>
              <Badge tone={editor.isDirty ? "attention" : "success"}>{editor.isDirty ? i18n.t("unsaved") : i18n.t("saved")}</Badge>
              <Button disabled={!onSave || !editor.isDirty || request !== "idle" || validationIssues.length > 0} onClick={() => void save()}>{request === "saving" ? i18n.t("saving") : i18n.t("save")}</Button>
              <Button variant="primary" disabled={!onPublish || request !== "idle" || validationIssues.length > 0} onClick={() => void publish()}>{request === "publishing" ? i18n.t("publishing") : i18n.t("publish")}</Button>
              <Button accessibilityLabel={i18n.t("undo")} icon={UndoIcon} variant="tertiary" disabled={!editor.actionState.canUndo} onClick={editor.undo} />
              <Button accessibilityLabel={i18n.t("redo")} icon={RedoIcon} variant="tertiary" disabled={!editor.actionState.canRedo} onClick={editor.redo} />
            </InlineStack></div>
          </div>
        </header>
        {editor.loadState === "success" ? <Banner tone="success">{i18n.t("success")}</Banner> : null}
        {notice ? <Banner tone={notice === "published" ? "success" : "critical"}>{i18n.t(notice)}</Banner> : null}
        {validationIssues.length > 0 ? <Banner tone="critical" title="区块属性未通过校验"><ul>{validationIssues.map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.path}: {issue.message}</li>)}</ul></Banner> : null}
        <div className="pb-workspace pb-workspace--document">
          <nav className="pb-tool-rail" aria-label="编辑器工具">
            <Button accessibilityLabel={i18n.t("blocks")} icon={LayoutSectionIcon} pressed={blockView === "blocks"} variant="tertiary" onClick={() => setBlockView("blocks")} />
            <Button accessibilityLabel={i18n.t("outline")} icon={MenuIcon} pressed={blockView === "outline"} variant="tertiary" onClick={() => setBlockView("outline")} />
          </nav>
          <aside className="pb-left-panel" aria-label="PageDocument 区块">
            <InlineStack align="space-between" blockAlign="center"><Text as="h2" variant="headingSm">{blockView === "blocks" ? i18n.t("blocks") : i18n.t("outline")}</Text></InlineStack>
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
            <div className="pb-canvas-stage"><div ref={canvasFrameRef} className={`pb-canvas-frame pb-canvas-frame--${editor.device}`} data-device={editor.device}><Puck.Preview /></div>{draggingLibraryType ? <div className="pb-canvas-drop-target" data-testid="canvas-drop-target" role="region" aria-label="区块投放区" onDragOver={(event) => event.preventDefault()} onDrop={dropFromLibrary}>松开以添加 {blockTypeLabel(draggingLibraryType, registry)}</div> : null}{editor.selectedBlock ? <div className="pb-canvas-overlay" aria-label={`已选择 ${blockLabel(editor.selectedBlock, registry)}`}><span>{blockLabel(editor.selectedBlock, registry)}</span><span>Selected</span></div> : null}</div>
          </main>
          <aside className="pb-right-panel" aria-label="PageDocument 属性">
            <Text as="h2" variant="headingSm">{i18n.t("properties")}</Text>
            {editor.selectedBlock ? <><DocumentInspector block={editor.selectedBlock} registry={registry} disabled={!editor.actionState.canEdit} onChange={(props) => editor.updateBlockProps(editor.selectedBlock!.id, props)} /><InspectorActions block={editor.selectedBlock} canDuplicate={editor.actionState.canDuplicate} canDelete={editor.actionState.canDelete} canMove={editor.actionState.canReorder} canMoveUp={editor.document.blocks[0]?.id !== editor.selectedBlock.id} canMoveDown={editor.document.blocks.at(-1)?.id !== editor.selectedBlock.id} i18n={i18n} onDuplicate={() => editor.duplicateBlock(editor.selectedBlock!.id)} onDelete={() => editor.requestDeleteBlock(editor.selectedBlock!.id)} onMove={(direction) => editor.moveBlock(editor.selectedBlock!.id, direction)} /></> : <Text as="p" tone="subdued">{i18n.t("selectBlock")}</Text>}
          </aside>
        </div>
        {editor.pendingDeleteBlock ? <DeleteConfirmation block={editor.pendingDeleteBlock} config={deleteConfirmation} i18n={i18n} onCancel={editor.cancelDeleteBlock} onConfirm={editor.confirmDeleteBlock} /> : null}
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

function InspectorSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="pb-inspector-section" open={defaultOpen}>
    <summary><span>{title}</span><span aria-hidden="true">⌄</span></summary>
    <div className="pb-inspector-section__body">{children}</div>
  </details>;
}

function InspectorTextControl({ label, value, control, disabled, onChange }: { label: string; value: unknown; control: NonNullable<FieldConfig["control"]>; disabled: boolean; onChange: (value: string) => void }) {
  const stringValue = typeof value === "string" ? value : "";
  if (control === "color") return <input aria-label={label} type="color" value={/^#[\da-f]{6}$/i.test(stringValue) ? stringValue : "#000000"} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} />;
  return <TextField label={label} labelHidden value={stringValue} onChange={onChange} autoComplete="off" disabled={disabled} multiline={control === "textarea" ? 4 : false} type={control === "url" ? "url" : "text"} />;
}

function InspectorField({ name, field, value, registry, disabled, onChange }: { name: string; field: FieldConfig; value: unknown; registry?: ExtensionRegistry; disabled: boolean; onChange: (value: JsonValue) => void }) {
  const label = field.label ?? name;
  const issues = validateFieldValue(field, value);
  const Field = registry?.getField(field.field)?.component;
  return <div className="pb-inspector-field" data-control={field.control ?? "custom"}>
    <div className="pb-inspector-field__heading"><Text as="p" variant="bodySm" fontWeight="semibold">{label}</Text>{field.description ? <Text as="p" variant="bodySm" tone="subdued">{field.description}</Text> : null}</div>
    {field.control ? <InspectorTextControl label={label} value={value} control={field.control} disabled={disabled} onChange={(next) => onChange(next)} /> : Field ? <Field value={value} onChange={onChange} /> : null}
    {issues.map((issue) => <Text key={issue.message} as="p" variant="bodySm" tone="critical">{issue.message}</Text>)}
  </div>;
}

function InspectorActions({ block, canDuplicate, canDelete, canMove, canMoveUp, canMoveDown, i18n, onDuplicate, onDelete, onMove }: { block: BlockNode; canDuplicate: boolean; canDelete: boolean; canMove: boolean; canMoveUp: boolean; canMoveDown: boolean; i18n: ReturnType<typeof createAdminI18n>; onDuplicate: () => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  return <div className="pb-inspector-actions" aria-label={`Actions for ${block.id}`}><ButtonGroup><Button disabled={!canMove || !canMoveUp} onClick={() => onMove(-1)}>{i18n.t("moveUp")}</Button><Button disabled={!canMove || !canMoveDown} onClick={() => onMove(1)}>{i18n.t("moveDown")}</Button><Button disabled={!canDuplicate} onClick={onDuplicate}>{i18n.t("duplicate")}</Button><Button disabled={!canDelete} tone="critical" onClick={onDelete}>{i18n.t("remove")}</Button></ButtonGroup></div>;
}

function DeleteConfirmation({ block, config, i18n, onCancel, onConfirm }: { block: BlockNode; config?: DeleteConfirmationConfig; i18n: ReturnType<typeof createAdminI18n>; onCancel: () => void; onConfirm: () => void }) {
  return <div className="pb-delete-confirmation-backdrop" role="presentation"><section className="pb-delete-confirmation" role="dialog" aria-modal="true" aria-labelledby="pb-delete-confirmation-title"><Text as="h2" variant="headingMd" id="pb-delete-confirmation-title">{config?.title ?? i18n.t("confirmDeleteTitle")}</Text><Text as="p" variant="bodyMd">{config?.message?.(block) ?? i18n.t("confirmDeleteMessage")}</Text><ButtonGroup><Button onClick={onCancel}>{config?.cancelLabel ?? i18n.t("cancel")}</Button><Button tone="critical" onClick={onConfirm}>{config?.confirmLabel ?? i18n.t("confirm")}</Button></ButtonGroup></section></div>;
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

function DocumentInspector({ block, registry, disabled, onChange }: { block: BlockNode; registry?: ExtensionRegistry; disabled: boolean; onChange: (props: Record<string, JsonValue>) => void }) {
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
    {block.type === "core.text" ? <InspectorSection title="Content"><InspectorField name="content" field={{ field: "", label: "文本内容", control: "textarea", description: "支持较长的正文内容。" }} value={block.props.content} registry={registry} disabled={disabled} onChange={(content) => onChange({ content })} /></InspectorSection> : null}
    {block.type === "core.image" ? <InspectorSection title="Image"><InspectorField name="src" field={{ field: "", label: "图片 URL", control: "url", description: "使用 HTTPS 图片地址。" }} value={block.props.src} registry={registry} disabled={disabled} onChange={(src) => onChange({ src })} /><InspectorField name="alt" field={{ field: "", label: "替代文本", control: "text", description: "用于无障碍阅读和图片加载失败场景。" }} value={block.props.alt} registry={registry} disabled={disabled} onChange={(alt) => onChange({ alt })} /></InspectorSection> : null}
    {Object.entries(groupedFields).map(([group, fields]) => <InspectorSection key={group} title={group} defaultOpen={group !== "Advanced"}>{fields.map(([name, field]) => <InspectorField key={name} name={name} field={field} value={block.props[name]} registry={registry} disabled={disabled} onChange={(value) => onChange({ ...block.props, [name]: value })} />)}</InspectorSection>)}
    {definition ? <p className="pb-inspector__hint">画布中带虚线边框的内容可直接编辑。</p> : null}
  </div>;
}
