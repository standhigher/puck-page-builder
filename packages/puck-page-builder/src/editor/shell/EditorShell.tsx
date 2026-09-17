import { Puck } from "@puckeditor/core";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Divider,
  InlineStack,
  Modal,
  Select,
  Text,
  Tooltip
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  DeleteIcon,
  DragHandleIcon,
  DuplicateIcon,
  LayoutSectionIcon,
  MenuIcon,
  PlusIcon,
  RedoIcon,
  UndoIcon,
  ViewIcon,
  XIcon
} from "@shopify/polaris-icons";
import { useRef, useState } from "react";
import { createDemoPuckConfig, toDemoPuckData } from "../../adapters/puck/demo-preview";
import {
  initialEditorState,
  type DemoBlock,
  type Device,
  type EditorState,
  type Zoom
} from "../state/types";

export type EditorShellProps = {
  initialState?: Partial<EditorState>;
  iframe?: boolean;
};

const deviceLabels: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
  full: "Full"
};

const saveLabels: Record<EditorState["saveState"], string> = {
  clean: "无未保存变更",
  dirty: "未保存变更",
  saving: "保存中",
  saved: "已保存",
  failed: "保存失败",
  conflict: "内容冲突"
};

function IconButton({
  label,
  icon,
  onClick,
  disabled = false,
  pressed = false
}: {
  label: string;
  icon: typeof UndoIcon;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return <Tooltip content={label}>
    <Button accessibilityLabel={label} icon={icon} onClick={onClick} disabled={disabled} pressed={pressed} variant="tertiary" />
  </Tooltip>;
}

export function EditorShell({ initialState, iframe = true }: EditorShellProps) {
  const [state, setState] = useState<EditorState>({ ...initialEditorState, ...initialState });
  const [undoDepth, setUndoDepth] = useState(0);
  const nextBlockId = useRef(state.blocks.length);
  const selectedBlock = state.blocks.find((block) => block.id === state.selectedBlockId) ?? null;

  const update = (patch: Partial<EditorState>) => setState((current) => ({ ...current, ...patch }));
  const selectBlock = (id: string) => update({ selectedBlockId: id, saveState: "dirty" });
  const puckConfig = createDemoPuckConfig(selectBlock);
  const puckData = toDemoPuckData(state.blocks);

  const addBlock = (type: DemoBlock["type"]) => {
    const next = {
      Hero: { label: "欢迎区块", description: "页面标题与说明", title: "A new welcome", body: "Local demo content." },
      TrackingForm: { label: "物流查询", description: "查询表单占位", title: "Track an order", body: "Use a tracking number." },
      Text: { label: "帮助文本", description: "富文本内容占位", title: "Helpful information", body: "Local demo content." }
    }[type];
    const id = `${type.toLowerCase()}-${nextBlockId.current++}`;
    update({ blocks: [...state.blocks, { id, type, ...next }], selectedBlockId: id, saveState: "dirty", isPickerOpen: false });
  };

  const duplicateBlock = (block: DemoBlock) => {
    const id = `${block.type.toLowerCase()}-${nextBlockId.current++}`;
    const duplicate = { ...block, id, label: `${block.label} 副本` };
    const index = state.blocks.findIndex((item) => item.id === block.id);
    const blocks = [...state.blocks];
    blocks.splice(index + 1, 0, duplicate);
    update({ blocks, selectedBlockId: id, saveState: "dirty" });
  };

  const deleteBlock = (block: DemoBlock) => {
    const blocks = state.blocks.filter((item) => item.id !== block.id);
    update({ blocks, selectedBlockId: blocks[0]?.id ?? null, saveState: "dirty" });
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    const from = state.blocks.findIndex((block) => block.id === id);
    const to = from + direction;
    if (to < 0 || to >= state.blocks.length) return;
    const blocks = [...state.blocks];
    [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
    update({ blocks, saveState: "dirty" });
  };

  const savePresentationState = () => {
    update({ saveState: "saving" });
    window.setTimeout(() => update({ saveState: "saved" }), 350);
  };

  return (
    <Puck config={puckConfig} data={puckData} iframe={{ enabled: iframe }}>
      <Puck.Layout>
        <div className="pb-shell" data-testid="editor-shell" data-preview-mode={state.previewMode}>
          <header className="pb-header">
            <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <IconButton label="返回页面列表" icon={ArrowLeftIcon} />
                <div className="pb-page-title">
                  <Text as="h1" variant="headingSm">Tracking page</Text>
                  <Text as="p" variant="bodySm" tone="subdued">English (US)</Text>
                </div>
                <Badge tone={state.saveState === "failed" || state.saveState === "conflict" ? "critical" : "info"}>{saveLabels[state.saveState]}</Badge>
              </InlineStack>
              <InlineStack gap="150" blockAlign="center" wrap={false}>
                <IconButton label="撤销" icon={UndoIcon} disabled={undoDepth === 0} onClick={() => setUndoDepth((depth) => Math.max(0, depth - 1))} />
                <IconButton label="恢复" icon={RedoIcon} disabled />
                <Button onClick={savePresentationState}>保存草稿</Button>
                <Button onClick={() => update({ previewMode: "mock-preview" })} icon={ViewIcon}>预览</Button>
                <Button variant="primary" disabled>发布</Button>
              </InlineStack>
            </InlineStack>
          </header>

          <div className="pb-workspace">
            <nav className="pb-tool-rail" aria-label="编辑器工具">
              <IconButton label="区块" icon={LayoutSectionIcon} pressed={state.blockView === "blocks"} onClick={() => update({ blockView: "blocks", isLeftRailOpen: true })} />
              <IconButton label="结构" icon={MenuIcon} pressed={state.blockView === "outline"} onClick={() => update({ blockView: "outline", isLeftRailOpen: true })} />
            </nav>

            <aside className={`pb-left-panel ${state.isLeftRailOpen ? "" : "pb-panel--closed"}`} aria-label="Block navigation">
              <InlineStack align="space-between" blockAlign="center">
                <div>
                  <Text as="h2" variant="headingSm">{state.blockView === "blocks" ? "区块" : "结构"}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{state.blockView === "blocks" ? "页面区块与快捷操作" : "当前页面层级"}</Text>
                </div>
                <IconButton label="收起左侧面板" icon={XIcon} onClick={() => update({ isLeftRailOpen: false })} />
              </InlineStack>
              <BlockList view={state.blockView} blocks={state.blocks} selectedBlockId={state.selectedBlockId} onSelect={selectBlock} onMove={moveBlock} onDuplicate={duplicateBlock} onDelete={deleteBlock} />
              <Button fullWidth icon={PlusIcon} onClick={() => update({ isPickerOpen: true })}>添加模块</Button>
            </aside>

            <main className="pb-canvas-area">
              <CanvasToolbar device={state.device} zoom={state.zoom} onDevice={(device) => update({ device })} onZoom={(zoom) => update({ zoom })} />
              <div className="pb-canvas-stage">
                <div className={`pb-canvas-frame pb-canvas-frame--${state.device} pb-canvas-frame--zoom-${state.zoom}`} data-device={state.device} data-zoom={state.zoom}>
                  <Puck.Preview />
                </div>
                {selectedBlock ? <div className="pb-canvas-overlay" aria-label={`已选择 ${selectedBlock.label}`}>
                  <span>{selectedBlock.label}</span>
                  <span>Selected</span>
                </div> : null}
              </div>
              {!state.isLeftRailOpen || !state.isRightPanelOpen ? <div className="pb-collapsed-actions">
                {!state.isLeftRailOpen ? <Button onClick={() => update({ isLeftRailOpen: true })}>打开区块面板</Button> : null}
                {!state.isRightPanelOpen ? <Button onClick={() => update({ isRightPanelOpen: true })}>打开属性面板</Button> : null}
              </div> : null}
            </main>

            <aside className={`pb-right-panel ${state.isRightPanelOpen ? "" : "pb-panel--closed"}`} aria-label="Block properties">
              <InlineStack align="space-between" blockAlign="center">
                <div>
                  <Text as="h2" variant="headingSm">属性</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{selectedBlock?.label ?? "未选择区块"}</Text>
                </div>
                <IconButton label="收起属性面板" icon={XIcon} onClick={() => update({ isRightPanelOpen: false })} />
              </InlineStack>
              {selectedBlock ? <PropertyPanel block={selectedBlock} editorLocale={state.editorLocale} pageLocale={state.pageLocale} onEditorLocale={(editorLocale) => update({ editorLocale })} onPageLocale={(pageLocale) => update({ pageLocale })} /> : <Text as="p" tone="subdued">选择一个区块以查看属性。</Text>}
            </aside>
          </div>

          <Modal instant open={state.isPickerOpen} onClose={() => update({ isPickerOpen: false })} title="添加模块" primaryAction={{ content: "关闭", onAction: () => update({ isPickerOpen: false }) }}>
            <Modal.Section>
              <BlockStack gap="300">
                <Text as="p" tone="subdued">本版仅操作本地演示区块，不会写入页面数据或调用业务接口。</Text>
                <InlineStack gap="200" wrap>
                  {(["Hero", "TrackingForm", "Text"] as const).map((type) => <Button key={type} onClick={() => addBlock(type)}>{type}</Button>)}
                </InlineStack>
              </BlockStack>
            </Modal.Section>
          </Modal>
        </div>
      </Puck.Layout>
    </Puck>
  );
}

function BlockList({
  view,
  blocks,
  selectedBlockId,
  onSelect,
  onMove,
  onDuplicate,
  onDelete
}: {
  view: EditorState["blockView"];
  blocks: DemoBlock[];
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (block: DemoBlock) => void;
  onDelete: (block: DemoBlock) => void;
}) {
  return <div className={`pb-block-list pb-block-list--${view}`} data-testid={`${view}-view`}>
    {blocks.map((block, index) => <article key={block.id} className={`pb-block-row ${block.id === selectedBlockId ? "pb-block-row--selected" : ""}`}>
      <span className="pb-block-handle" aria-label={`${block.label} 拖动排序`}><DragHandleIcon /></span>
      <button type="button" className="pb-block-select" onClick={() => onSelect(block.id)} aria-pressed={block.id === selectedBlockId}>
        <Text as="span" variant="bodySm" fontWeight="semibold">{block.label}</Text>
        {view === "blocks" ? <Text as="span" variant="bodySm" tone="subdued">{block.description}</Text> : <Text as="span" variant="bodySm" tone="subdued">{block.type}</Text>}
      </button>
      <div className="pb-block-actions" aria-label={`${block.label} 操作`}>
        <Button size="slim" onClick={() => onMove(block.id, -1)} disabled={index === 0}>上移</Button>
        <Button size="slim" onClick={() => onMove(block.id, 1)} disabled={index === blocks.length - 1}>下移</Button>
        <IconButton label={`复制 ${block.label}`} icon={DuplicateIcon} onClick={() => onDuplicate(block)} />
        <IconButton label={`删除 ${block.label}`} icon={DeleteIcon} onClick={() => onDelete(block)} />
      </div>
    </article>)}
  </div>;
}

function CanvasToolbar({ device, zoom, onDevice, onZoom }: { device: Device; zoom: Zoom; onDevice: (device: Device) => void; onZoom: (zoom: Zoom) => void }) {
  return <div className="pb-canvas-toolbar">
    <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
      <ButtonGroup variant="segmented">
        {(Object.keys(deviceLabels) as Device[]).map((item) => <Button key={item} pressed={device === item} onClick={() => onDevice(item)}>{deviceLabels[item]}</Button>)}
      </ButtonGroup>
      <Select label="缩放" labelHidden value={zoom} options={[{ label: "Auto", value: "auto" }, { label: "50%", value: "50" }, { label: "70%", value: "70" }, { label: "100%", value: "100" }]} onChange={(value) => onZoom(value as Zoom)} />
    </InlineStack>
  </div>;
}

function PropertyPanel({
  block,
  editorLocale,
  pageLocale,
  onEditorLocale,
  onPageLocale
}: {
  block: DemoBlock;
  editorLocale: string;
  pageLocale: string;
  onEditorLocale: (value: string) => void;
  onPageLocale: (value: string) => void;
}) {
  const [tab, setTab] = useState(0);
  const tabs = ["内容", "样式", "高级"];

  return <BlockStack gap="300" data-testid="property-panel">
    <div className="pb-inspector-tabs" role="tablist" aria-label="属性分类">
      {tabs.map((label, index) => <button key={label} type="button" role="tab" aria-selected={tab === index} className={tab === index ? "pb-inspector-tab--selected" : ""} onClick={() => setTab(index)}>{label}</button>)}
    </div>
    {tab === 0 ? <BlockStack gap="300">
      <Badge>{block.type}</Badge>
      <Text as="p" variant="headingSm">{block.label}</Text>
      <Divider />
      <Text as="p" tone="subdued">当前选中：{block.id}</Text>
      <Text as="p">{block.description}</Text>
      <Box padding="300" background="bg-surface-secondary" borderRadius="200"><Text as="p" variant="bodySm" tone="subdued">字段编辑将在 PageDocument 版本实现；V0.1.1 仅提供真实页面预览和选择反馈。</Text></Box>
    </BlockStack> : null}
    {tab === 1 ? <BlockStack gap="300"><Text as="p" variant="bodySm" tone="subdued">样式配置将由 Block Field 与 Theme Token 提供。本版保持 Storefront 页面样式与编辑器 UI 隔离。</Text></BlockStack> : null}
    {tab === 2 ? <BlockStack gap="300">
      <Text as="p" variant="bodySm" tone="subdued">语言入口属于 Inspector，避免在主工具栏重复占位。</Text>
      <Select label="Editor Language" options={[{ label: "中文", value: "zh-CN" }, { label: "English", value: "en-US" }]} value={editorLocale} onChange={onEditorLocale} />
      <Select label="Page Locale" options={[{ label: "English (US)", value: "en-US" }, { label: "中文", value: "zh-CN" }]} value={pageLocale} onChange={onPageLocale} />
    </BlockStack> : null}
  </BlockStack>;
}
