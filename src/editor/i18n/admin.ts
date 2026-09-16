export type AdminLocale = "zh-CN" | "en";

const messages = {
  "zh-CN": {
    blocks: "区块",
    outline: "结构",
    properties: "属性",
    addBlock: "添加区块",
    undo: "撤销",
    redo: "恢复",
    duplicate: "复制",
    remove: "删除",
    moveUp: "上移",
    moveDown: "下移",
    loading: "正在加载编辑器…",
    empty: "页面还没有区块",
    error: "编辑器无法加载",
    disabled: "编辑器当前不可编辑",
    success: "操作已完成",
    unsaved: "未保存变更",
    saved: "所有更改已保留在当前会话中",
    leaveWarning: "你有未保存的更改。确定要离开吗？",
    selectBlock: "选择一个区块以编辑。",
    desktop: "桌面",
    tablet: "平板",
    mobile: "手机"
  },
  en: {
    blocks: "Blocks",
    outline: "Outline",
    properties: "Properties",
    addBlock: "Add block",
    undo: "Undo",
    redo: "Redo",
    duplicate: "Duplicate",
    remove: "Delete",
    moveUp: "Move up",
    moveDown: "Move down",
    loading: "Loading editor…",
    empty: "This page has no blocks",
    error: "The editor could not load",
    disabled: "The editor is currently read-only",
    success: "Action completed",
    unsaved: "Unsaved changes",
    saved: "Changes are kept in this session",
    leaveWarning: "You have unsaved changes. Are you sure you want to leave?",
    selectBlock: "Select a block to edit it.",
    desktop: "Desktop",
    tablet: "Tablet",
    mobile: "Mobile"
  }
} as const;

export type AdminMessageKey = keyof typeof messages["zh-CN"];

/** Minimal, dependency-free Admin copy catalog. Product locale remains PageDocument.settings.locale. */
export function createAdminI18n(locale?: string) {
  const resolvedLocale: AdminLocale = locale === "en" || locale === "en-US" ? "en" : "zh-CN";
  return { locale: resolvedLocale, t: (key: AdminMessageKey) => messages[resolvedLocale][key] };
}
