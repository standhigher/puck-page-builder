export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type RenderTarget = "web" | "email";

export type PageSettings = {
  locale: string;
  seoTitle?: string;
};

export type DataBinding = {
  source: string;
  params?: Record<string, JsonValue>;
};

export type BlockNode = {
  id: string;
  type: string;
  version: number;
  props: Record<string, JsonValue>;
  slots?: Record<string, BlockNode[]>;
  binding?: DataBinding;
};

export type PageDocument = {
  schemaVersion: 1;
  pageId: string;
  target: RenderTarget;
  templateId?: string;
  root: Record<string, JsonValue>;
  blocks: BlockNode[];
  settings: PageSettings;
};

export type PageDocumentIssue = {
  path: string;
  message: string;
};

export type PageDocumentValidation =
  | { success: true; data: PageDocument }
  | { success: false; issues: PageDocumentIssue[] };

export type PageDocumentMigration =
  | { success: true; data: PageDocument; migrated: boolean }
  | { success: false; issues: PageDocumentIssue[] };

const pageDocumentKeys = new Set(["schemaVersion", "pageId", "target", "templateId", "root", "blocks", "settings"]);
const blockKeys = new Set(["id", "type", "version", "props", "slots", "binding"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function normalizeBlock(value: unknown, path: string, issues: PageDocumentIssue[]): BlockNode | null {
  if (!isRecord(value)) {
    issues.push({ path, message: "必须是对象" });
    return null;
  }
  for (const key of Object.keys(value)) if (!blockKeys.has(key)) issues.push({ path: `${path}.${key}`, message: "不允许保存未知字段" });
  if (typeof value.id !== "string" || !value.id) issues.push({ path: `${path}.id`, message: "必须是非空字符串" });
  if (typeof value.type !== "string" || !value.type) issues.push({ path: `${path}.type`, message: "必须是非空字符串" });
  if (typeof value.version !== "number" || !Number.isInteger(value.version) || value.version < 1) issues.push({ path: `${path}.version`, message: "必须是大于 0 的整数" });
  if (!isRecord(value.props) || !Object.values(value.props).every(isJsonValue)) issues.push({ path: `${path}.props`, message: "必须是 JSON 对象" });
  if (value.binding !== undefined && (!isRecord(value.binding) || typeof value.binding.source !== "string" || (value.binding.params !== undefined && (!isRecord(value.binding.params) || !Object.values(value.binding.params).every(isJsonValue))))) issues.push({ path: `${path}.binding`, message: "必须包含 source，且 params 必须是 JSON 对象" });

  if (issues.some((issue) => issue.path.startsWith(path))) return null;
  const slots = normalizeSlots(value.slots, `${path}.slots`, issues);
  if (issues.some((issue) => issue.path.startsWith(path))) return null;
  return {
    id: value.id as string,
    type: value.type as string,
    version: value.version as number,
    props: value.props as Record<string, JsonValue>,
    ...(slots ? { slots } : {}),
    ...(value.binding ? { binding: value.binding as DataBinding } : {})
  };
}

function normalizeSlots(value: unknown, path: string, issues: PageDocumentIssue[]): Record<string, BlockNode[]> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issues.push({ path, message: "必须是对象" });
    return undefined;
  }
  const slots: Record<string, BlockNode[]> = {};
  for (const [slot, children] of Object.entries(value)) {
    if (!Array.isArray(children)) {
      issues.push({ path: `${path}.${slot}`, message: "必须是区块数组" });
      continue;
    }
    slots[slot] = children.map((child, index) => normalizeBlock(child, `${path}.${slot}[${index}]`, issues)).filter((child): child is BlockNode => child !== null);
  }
  return slots;
}

export function createPageDocument(input: Partial<PageDocument> & Pick<PageDocument, "pageId">): PageDocument {
  return {
    schemaVersion: 1,
    pageId: input.pageId,
    target: input.target ?? "web",
    ...(input.templateId ? { templateId: input.templateId } : {}),
    root: input.root ?? {},
    blocks: input.blocks ?? [],
    settings: { locale: input.settings?.locale ?? "en", ...(input.settings?.seoTitle ? { seoTitle: input.settings.seoTitle } : {}) }
  };
}

export function validatePageDocument(value: unknown): PageDocumentValidation {
  const issues: PageDocumentIssue[] = [];
  if (!isRecord(value)) return { success: false, issues: [{ path: "$", message: "PageDocument 必须是对象" }] };
  for (const key of Object.keys(value)) if (!pageDocumentKeys.has(key)) issues.push({ path: `$.${key}`, message: "不允许保存未知字段" });
  if (value.schemaVersion !== 1) issues.push({ path: "$.schemaVersion", message: "仅支持 schemaVersion 1" });
  if (typeof value.pageId !== "string" || !value.pageId) issues.push({ path: "$.pageId", message: "必须是非空字符串" });
  if (value.target !== "web" && value.target !== "email") issues.push({ path: "$.target", message: "必须是 web 或 email" });
  if (value.templateId !== undefined && typeof value.templateId !== "string") issues.push({ path: "$.templateId", message: "必须是字符串" });
  if (!isRecord(value.root) || !Object.values(value.root).every(isJsonValue)) issues.push({ path: "$.root", message: "必须是 JSON 对象" });
  if (!isRecord(value.settings) || typeof value.settings.locale !== "string") issues.push({ path: "$.settings.locale", message: "必须是字符串" });
  if (!Array.isArray(value.blocks)) issues.push({ path: "$.blocks", message: "必须是数组" });

  const blocks = Array.isArray(value.blocks) ? value.blocks.map((block, index) => normalizeBlock(block, `$.blocks[${index}]`, issues)).filter((block): block is BlockNode => block !== null) : [];
  const blockIds = new Set<string>();
  for (const block of blocks) {
    if (blockIds.has(block.id)) issues.push({ path: "$.blocks", message: `区块 ID 重复：${block.id}` });
    blockIds.add(block.id);
  }
  if (issues.length > 0) return { success: false, issues };

  return {
    success: true,
    data: createPageDocument({
      pageId: value.pageId as string,
      target: value.target as RenderTarget,
      ...(typeof value.templateId === "string" ? { templateId: value.templateId } : {}),
      root: value.root as Record<string, JsonValue>,
      blocks,
      settings: value.settings as PageSettings
    })
  };
}

/**
 * Accept the pre-versioned shape produced by the early Demo and normalize it
 * to the first persisted PageDocument schema. Future schema migrations belong
 * here so storage callers have one validation boundary.
 */
export function migratePageDocument(value: unknown): PageDocumentMigration {
  if (!isRecord(value)) {
    const validation = validatePageDocument(value);
    return validation.success ? { ...validation, migrated: false } : validation;
  }

  const migrated = value.schemaVersion === undefined;
  const candidate = migrated ? { ...value, schemaVersion: 1 } : value;
  const validation = validatePageDocument(candidate);
  return validation.success ? { ...validation, migrated } : validation;
}
