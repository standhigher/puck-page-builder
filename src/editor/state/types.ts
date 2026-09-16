export type BlockView = "blocks" | "outline";
export type Device = "desktop" | "tablet" | "mobile" | "full";
export type Zoom = "auto" | "50" | "70" | "100";
export type SaveState = "clean" | "dirty" | "saving" | "saved" | "failed" | "conflict";
export type PreviewMode = "editor" | "mock-preview" | "live-preview";
export type PublishState = "draft" | "publishing" | "published" | "publish-failed";

export type DemoBlock = {
  id: string;
  type: "Hero" | "TrackingForm" | "Text";
  label: string;
  description: string;
  title: string;
  body: string;
};

export type EditorState = {
  blocks: DemoBlock[];
  selectedBlockId: string | null;
  blockView: BlockView;
  device: Device;
  zoom: Zoom;
  saveState: SaveState;
  previewMode: PreviewMode;
  publishState: PublishState;
  editorLocale: string;
  pageLocale: string;
  isPickerOpen: boolean;
  isLeftRailOpen: boolean;
  isRightPanelOpen: boolean;
};

export const initialBlocks: DemoBlock[] = [
  {
    id: "hero-1",
    type: "Hero",
    label: "欢迎区块",
    description: "页面标题与说明",
    title: "Track every order with confidence",
    body: "A local V0.1 preview block rendered by Puck."
  },
  {
    id: "tracking-form-1",
    type: "TrackingForm",
    label: "物流查询",
    description: "查询表单占位",
    title: "Where is my order?",
    body: "Enter a tracking number to view its progress."
  },
  {
    id: "text-1",
    type: "Text",
    label: "帮助文本",
    description: "富文本内容占位",
    title: "Need help?",
    body: "Contact the store for order and delivery questions."
  }
];

export const initialEditorState: EditorState = {
  blocks: initialBlocks,
  selectedBlockId: initialBlocks[0].id,
  blockView: "blocks",
  device: "desktop",
  zoom: "auto",
  saveState: "clean",
  previewMode: "editor",
  publishState: "draft",
  editorLocale: "zh-CN",
  pageLocale: "en-US",
  isPickerOpen: false,
  isLeftRailOpen: true,
  isRightPanelOpen: true
};
