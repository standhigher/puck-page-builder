import { Puck } from "@puckeditor/core";
import { Badge, Banner, BlockStack, Button, ButtonGroup, InlineStack, Modal, Text, TextField } from "@shopify/polaris";
import { DeleteIcon, DragHandleIcon, DuplicateIcon, LayoutSectionIcon, MenuIcon, PlusIcon, RedoIcon, UndoIcon } from "@shopify/polaris-icons";
import { useMemo, useState, type DragEvent } from "react";
import { createPageDocumentPuckConfig } from "../../adapters/puck/page-document-config";
import { toEngineData } from "../../adapters/puck/page-document";
import type { ExtensionRegistry } from "../../core/extensions";
import type { BlockNode, JsonValue, PageDocument } from "../../core/schema/page-document";
import { EditorProvider, useEditorContext, type EditorLoadState } from "../context/EditorContext";
import { createAdminI18n } from "../i18n/admin";
import type { Device } from "../state/types";

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
  if (block.type === "core.text") return "文本";
  if (block.type === "core.image") return "图片";
  return registry?.getBlock(block.type)?.label ?? block.type;
}

export function PageDocumentEditorShell(props: PageDocumentEditorShellProps) {
  return <EditorProvider initialDocument={props.initialDocument} registry={props.registry} loadState={props.loadState} leaveWarning={createAdminI18n(props.adminLocale).t("leaveWarning")} onDocumentChange={props.onDocumentChange}>
    <PageDocumentEditor {...props} />
  </EditorProvider>;
}

function PageDocumentEditor({ iframe = true, registry, adminLocale, onSave, onPublish }: PageDocumentEditorShellProps) {
  const editor = useEditorContext();
  const [blockView, setBlockView] = useState<"blocks" | "outline">("blocks");
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [request, setRequest] = useState<"idle" | "saving" | "publishing">("idle");
  const [notice, setNotice] = useState<"saveFailed" | "publishFailed" | "published" | null>(null);
  const i18n = createAdminI18n(adminLocale);
  const engineData = useMemo(() => toEngineData(editor.document, registry), [editor.document, registry]);
  const config = useMemo(() => createPageDocumentPuckConfig(editor.selectBlock, registry), [editor.selectBlock, registry]);

  if (editor.loadState !== "ready" && editor.loadState !== "success") return <EditorStatus state={editor.loadState} />;

  const blockTypes = ["core.text", "core.image", ...(registry?.blocks.map((block) => block.type) ?? [])];
  const onDrop = (event: DragEvent<HTMLElement>, beforeId: string) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || draggingId;
    if (id) editor.reorderBlock(id, beforeId);
    setDraggingId(null);
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

  return <Puck config={config} data={engineData} iframe={{ enabled: iframe }}>
    <Puck.Layout>
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
            <InlineStack align="space-between" blockAlign="center"><Text as="h2" variant="headingSm">{blockView === "blocks" ? i18n.t("blocks") : i18n.t("outline")}</Text><Button size="slim" icon={PlusIcon} disabled={!editor.actionState.canAdd} onClick={() => setPickerOpen(true)}>{i18n.t("addBlock")}</Button></InlineStack>
            {editor.document.blocks.length === 0 ? <Text as="p" tone="subdued">{i18n.t("empty")}</Text> : <div className="pb-block-list" data-testid={`${blockView}-view`}>
              {editor.document.blocks.map((block, index) => <article key={block.id} className={`pb-document-block-row ${block.id === editor.selectedBlockId ? "pb-document-block-row--selected" : ""} ${draggingId === block.id ? "pb-document-block-row--dragging" : ""}`} draggable={editor.actionState.canReorder} onDragStart={(event) => { event.dataTransfer.setData("text/plain", block.id); event.dataTransfer.effectAllowed = "move"; setDraggingId(block.id); }} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, block.id)}>
                <span className="pb-block-handle" aria-label={`${blockLabel(block, registry)} 拖动排序`}><DragHandleIcon /></span>
                <button type="button" className="pb-block-select" aria-pressed={block.id === editor.selectedBlockId} onClick={() => editor.selectBlock(block.id)}>
                  <Text as="span" variant="bodySm" fontWeight="semibold">{blockLabel(block, registry)}</Text>
                  <Text as="span" variant="bodySm" tone="subdued">{blockView === "blocks" ? block.id : block.type}</Text>
                </button>
                <div className="pb-block-actions" aria-label={`${blockLabel(block, registry)} 操作`}>
                  <Button accessibilityLabel={i18n.t("moveUp")} size="slim" disabled={!editor.actionState.canReorder || index === 0} onClick={() => editor.moveBlock(block.id, -1)}>{i18n.t("moveUp")}</Button>
                  <Button accessibilityLabel={i18n.t("moveDown")} size="slim" disabled={!editor.actionState.canReorder || index === editor.document.blocks.length - 1} onClick={() => editor.moveBlock(block.id, 1)}>{i18n.t("moveDown")}</Button>
                  <Button accessibilityLabel={`${i18n.t("duplicate")} ${blockLabel(block, registry)}`} icon={DuplicateIcon} variant="tertiary" disabled={!editor.actionState.canDuplicate} onClick={() => editor.duplicateBlock(block.id)} />
                  <Button accessibilityLabel={`${i18n.t("remove")} ${blockLabel(block, registry)}`} icon={DeleteIcon} variant="tertiary" tone="critical" disabled={!editor.actionState.canDelete} onClick={() => editor.deleteBlock(block.id)} />
                </div>
              </article>)}
            </div>}
          </aside>
          <main className="pb-canvas-area">
            <div className="pb-canvas-toolbar"><ButtonGroup variant="segmented">{(Object.keys(deviceLabels) as Array<keyof typeof deviceLabels>).map((device) => <Button key={device} pressed={editor.device === device} onClick={() => editor.setDevice(device)}>{i18n.t(deviceLabels[device])}</Button>)}</ButtonGroup></div>
            <div className="pb-canvas-stage"><div className={`pb-canvas-frame pb-canvas-frame--${editor.device}`} data-device={editor.device}><Puck.Preview /></div>{editor.selectedBlock ? <div className="pb-canvas-overlay" aria-label={`已选择 ${blockLabel(editor.selectedBlock, registry)}`}><span>{blockLabel(editor.selectedBlock, registry)}</span><span>Selected</span></div> : null}</div>
          </main>
          <aside className="pb-right-panel" aria-label="PageDocument 属性">
            <Text as="h2" variant="headingSm">{i18n.t("properties")}</Text>
            {editor.selectedBlock ? <DocumentInspector block={editor.selectedBlock} registry={registry} disabled={!editor.actionState.canEdit} onChange={(props) => editor.updateBlockProps(editor.selectedBlock!.id, props)} /> : <Text as="p" tone="subdued">{i18n.t("selectBlock")}</Text>}
          </aside>
        </div>
        <Modal instant open={isPickerOpen} onClose={() => setPickerOpen(false)} title={i18n.t("addBlock")} primaryAction={{ content: "关闭", onAction: () => setPickerOpen(false) }}>
          <Modal.Section><InlineStack gap="200" wrap>{blockTypes.map((type) => <Button key={type} disabled={!editor.actionState.canAdd} onClick={() => { editor.addBlock(type); setPickerOpen(false); }}>{type === "core.text" ? "文本" : type === "core.image" ? "图片" : registry?.getBlock(type)?.label ?? type}</Button>)}</InlineStack></Modal.Section>
        </Modal>
      </div>
    </Puck.Layout>
  </Puck>;
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
