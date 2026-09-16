import { Puck } from "@puckeditor/core";
import { Badge, BlockStack, Button, ButtonGroup, InlineStack, Modal, Select, Text, TextField } from "@shopify/polaris";
import { ArrowLeftIcon, ImageIcon, LayoutSectionIcon, MenuIcon, ViewIcon } from "@shopify/polaris-icons";
import { useEffect, useMemo, useState } from "react";
import { createPageDocumentPuckConfig } from "../../adapters/puck/page-document-config";
import { toEngineData } from "../../adapters/puck/page-document";
import type { ExtensionRegistry } from "../../core/extensions";
import type { BlockNode, JsonValue, PageDocument } from "../../core/schema/page-document";
import type { Device, Zoom } from "../state/types";

export type PageDocumentEditorShellProps = {
  initialDocument: PageDocument;
  iframe?: boolean;
  registry?: ExtensionRegistry;
  loadDocument?: (fallback: PageDocument) => PageDocument;
  onDocumentChange?: (document: PageDocument) => void;
};

const deviceLabels: Record<Device, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile", full: "Full" };

function blockLabel(block: BlockNode) {
  return block.type === "core.text" ? "文本" : block.type === "core.image" ? "图片" : block.type;
}

export function PageDocumentEditorShell({ initialDocument, iframe = true, registry, loadDocument, onDocumentChange }: PageDocumentEditorShellProps) {
  const [document, setDocument] = useState(() => loadDocument?.(initialDocument) ?? initialDocument);
  const [selectedBlockId, setSelectedBlockId] = useState(initialDocument.blocks[0]?.id ?? null);
  const [blockView, setBlockView] = useState<"blocks" | "outline">("blocks");
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState<Zoom>("auto");
  const [isDocumentOpen, setDocumentOpen] = useState(false);
  const selectedBlock = document.blocks.find((block) => block.id === selectedBlockId) ?? null;
  const engineData = useMemo(() => toEngineData(document, registry), [document, registry]);
  const config = useMemo(() => createPageDocumentPuckConfig((id) => setSelectedBlockId(id), registry), [registry]);

  useEffect(() => onDocumentChange?.(document), [document, onDocumentChange]);

  const updateBlockProps = (id: string, props: Record<string, JsonValue>) => {
    setDocument((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? { ...block, props: { ...block.props, ...props } } : block) }));
  };

  return <Puck config={config} data={engineData} iframe={{ enabled: iframe }}>
    <Puck.Layout>
      <div className="pb-shell" data-testid="page-document-editor" data-page-id={document.pageId}>
        <header className="pb-header">
          <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <Button accessibilityLabel="返回页面列表" icon={ArrowLeftIcon} variant="tertiary" />
              <div className="pb-page-title"><Text as="h1" variant="headingSm">{document.settings.seoTitle ?? document.pageId}</Text><Text as="p" variant="bodySm" tone="subdued">PageDocument V{document.schemaVersion} · {document.target}</Text></div>
              <Badge tone="info">本地文档</Badge>
            </InlineStack>
            <InlineStack gap="150" blockAlign="center" wrap={false}>
              <Button icon={ViewIcon} url="/page-builder/preview">Web Renderer</Button>
              <Button onClick={() => setDocumentOpen(true)}>导出 PageDocument</Button>
              <Button variant="primary" disabled>保存草稿</Button>
            </InlineStack>
          </InlineStack>
        </header>
        <div className="pb-workspace pb-workspace--document">
          <nav className="pb-tool-rail" aria-label="编辑器工具">
            <Button accessibilityLabel="区块" icon={LayoutSectionIcon} pressed={blockView === "blocks"} variant="tertiary" onClick={() => setBlockView("blocks")} />
            <Button accessibilityLabel="结构" icon={MenuIcon} pressed={blockView === "outline"} variant="tertiary" onClick={() => setBlockView("outline")} />
          </nav>
          <aside className="pb-left-panel" aria-label="PageDocument 区块">
            <Text as="h2" variant="headingSm">{blockView === "blocks" ? "区块" : "结构"}</Text>
            <Text as="p" variant="bodySm" tone="subdued">同一 PageDocument 文档视图</Text>
            <div className="pb-block-list" data-testid={`${blockView}-view`}>
              {document.blocks.map((block) => <button key={block.id} type="button" className={`pb-document-block ${block.id === selectedBlockId ? "pb-document-block--selected" : ""}`} aria-pressed={block.id === selectedBlockId} onClick={() => setSelectedBlockId(block.id)}>
                {block.type === "core.image" ? <ImageIcon /> : <LayoutSectionIcon />}<span>{blockLabel(block)}</span><small>{block.id}</small>
              </button>)}
            </div>
          </aside>
          <main className="pb-canvas-area">
            <div className="pb-canvas-toolbar"><InlineStack align="space-between" blockAlign="center" gap="200" wrap><ButtonGroup variant="segmented">{(Object.keys(deviceLabels) as Device[]).map((item) => <Button key={item} pressed={device === item} onClick={() => setDevice(item)}>{deviceLabels[item]}</Button>)}</ButtonGroup><Select label="缩放" labelHidden value={zoom} options={[{ label: "Auto", value: "auto" }, { label: "70%", value: "70" }, { label: "100%", value: "100" }]} onChange={(value) => setZoom(value as Zoom)} /></InlineStack></div>
            <div className="pb-canvas-stage"><div className={`pb-canvas-frame pb-canvas-frame--${device} pb-canvas-frame--zoom-${zoom}`} data-device={device} data-zoom={zoom}><Puck.Preview /></div>{selectedBlock ? <div className="pb-canvas-overlay" aria-label={`已选择 ${blockLabel(selectedBlock)}`}><span>{blockLabel(selectedBlock)}</span><span>Selected</span></div> : null}</div>
          </main>
          <aside className="pb-right-panel" aria-label="PageDocument 属性">
            <Text as="h2" variant="headingSm">属性</Text>
            {selectedBlock ? <DocumentInspector block={selectedBlock} onChange={(props) => updateBlockProps(selectedBlock.id, props)} /> : <Text as="p" tone="subdued">选择一个区块以编辑。</Text>}
          </aside>
        </div>
        <Modal instant open={isDocumentOpen} onClose={() => setDocumentOpen(false)} title="导出 PageDocument" primaryAction={{ content: "关闭", onAction: () => setDocumentOpen(false) }}>
          <Modal.Section><pre className="pb-document-export">{JSON.stringify(document, null, 2)}</pre></Modal.Section>
        </Modal>
      </div>
    </Puck.Layout>
  </Puck>;
}

function DocumentInspector({ block, onChange }: { block: BlockNode; onChange: (props: Record<string, JsonValue>) => void }) {
  return <BlockStack gap="300" data-testid="document-inspector">
    <Badge>{block.type}</Badge>
    <Text as="p" variant="headingSm">{blockLabel(block)}</Text>
    {block.type === "core.text" ? <TextField label="文本内容" value={typeof block.props.content === "string" ? block.props.content : ""} onChange={(content) => onChange({ content })} autoComplete="off" multiline={4} /> : null}
    {block.type === "core.image" ? <>
      <TextField label="图片 URL" value={typeof block.props.src === "string" ? block.props.src : ""} onChange={(src) => onChange({ src })} autoComplete="off" />
      <TextField label="替代文本" value={typeof block.props.alt === "string" ? block.props.alt : ""} onChange={(alt) => onChange({ alt })} autoComplete="off" />
    </> : null}
  </BlockStack>;
}
