import type { BlockDefinition, DataSourceDefinition, EditorAction, ExtensionRegistryOptions, FieldDefinition, LifecycleHooks, PageBuilderExtension, RendererDefinition, TemplateDefinition, UISlotContribution, UISlotName } from "./types";
import { validateBlockPolicy } from "./validation";
import type { PageDocument } from "../schema/page-document";

export type ExtensionRegistryErrorCode = "duplicate-extension" | "duplicate-definition" | "invalid-identifier" | "invalid-target" | "invalid-block-policy" | "missing-dependency" | "missing-template-dependency" | "dependency-cycle";

export class ExtensionRegistryError extends Error {
  constructor(public readonly code: ExtensionRegistryErrorCode, message: string) {
    super(message);
    this.name = "ExtensionRegistryError";
  }
}

const namespacedIdentifier = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const slotNames = new Set<UISlotName>(["toolbar.left", "toolbar.center", "toolbar.right", "inspector.content"]);

type Registered<T> = T & { extension: string };

function compareByOrder<T extends { order?: number }>(left: T, right: T) {
  return (left.order ?? 0) - (right.order ?? 0);
}

function assertIdentifier(identifier: string, label: string) {
  if (!namespacedIdentifier.test(identifier)) throw new ExtensionRegistryError("invalid-identifier", `${label} 必须使用命名空间 ID：${identifier}`);
}

function assertTargets(targets: string[], label: string) {
  if (targets.length === 0 || targets.some((target) => target !== "web" && target !== "email" && target !== "all")) throw new ExtensionRegistryError("invalid-target", `${label} 必须声明 web、email 或 all target`);
}

function register<T extends { id?: string; type?: string; key?: string }>(items: T[], values: T[] | undefined, extension: string, registry: Map<string, Registered<T>>, kind: string) {
  for (const item of values ?? []) {
    const id = item.id ?? item.type ?? item.key;
    if (!id) throw new ExtensionRegistryError("invalid-identifier", `${kind} 缺少注册 ID`);
    assertIdentifier(id, kind);
    if (registry.has(id)) throw new ExtensionRegistryError("duplicate-definition", `${kind} ID 冲突：${id}`);
    const registered = Object.freeze({ ...item, extension }) as Registered<T>;
    registry.set(id, registered);
    items.push(registered);
  }
}

function resolveOrder(extensions: PageBuilderExtension[], disabled: Set<string>) {
  const byName = new Map<string, PageBuilderExtension>();
  for (const extension of extensions) {
    assertIdentifier(extension.name, "Extension name");
    if (byName.has(extension.name)) throw new ExtensionRegistryError("duplicate-extension", `Extension 重复：${extension.name}`);
    byName.set(extension.name, extension);
  }

  const active = extensions.filter((extension) => !disabled.has(extension.name));
  const activeNames = new Set(active.map((extension) => extension.name));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const sorted: PageBuilderExtension[] = [];

  const visit = (extension: PageBuilderExtension) => {
    if (visited.has(extension.name)) return;
    if (visiting.has(extension.name)) throw new ExtensionRegistryError("dependency-cycle", `Extension 依赖存在循环：${extension.name}`);
    visiting.add(extension.name);
    for (const dependency of extension.dependsOn ?? []) {
      if (!activeNames.has(dependency)) throw new ExtensionRegistryError("missing-dependency", `Extension ${extension.name} 缺少启用的依赖：${dependency}`);
      visit(byName.get(dependency)!);
    }
    visiting.delete(extension.name);
    visited.add(extension.name);
    sorted.push(extension);
  };

  for (const extension of [...active].sort(compareByOrder)) visit(extension);
  return sorted;
}

/** Immutable template view with explicit source and block dependency validation. */
export class TemplateRegistry {
  private constructor(private readonly templateMap: ReadonlyMap<string, Registered<TemplateDefinition>>) {}

  get templates() { return Object.freeze([...this.templateMap.values()]); }
  get(id: string) { return this.templateMap.get(id); }

  static create(templates: readonly Registered<TemplateDefinition>[], blocks: readonly BlockDefinition[]): TemplateRegistry {
    const blockTypes = new Set(blocks.map((block) => block.type));
    for (const template of templates) {
      if (template.source !== "built-in" && template.source !== "marketplace" && template.source !== "custom") throw new ExtensionRegistryError("invalid-identifier", `Template ${template.id} 必须声明 built-in、marketplace 或 custom 来源`);
      if (template.target !== "web" && template.target !== "email") throw new ExtensionRegistryError("invalid-target", `Template ${template.id} 必须声明 web 或 email target`);
      for (const type of template.requiredBlocks ?? []) {
        if (!blockTypes.has(type)) throw new ExtensionRegistryError("missing-template-dependency", `Template ${template.id} 缺少已注册区块：${type}`);
      }
    }
    return Object.freeze(new TemplateRegistry(new Map(templates.map((template) => [template.id, template])))) as TemplateRegistry;
  }
}

/** Immutable compiled view of all enabled extensions. */
export class ExtensionRegistry {
  private constructor(
    public readonly extensions: readonly PageBuilderExtension[],
    private readonly blockMap: ReadonlyMap<string, Registered<BlockDefinition>>,
    private readonly fieldMap: ReadonlyMap<string, Registered<FieldDefinition>>,
    private readonly actionMap: ReadonlyMap<string, Registered<EditorAction>>,
    private readonly rendererMap: ReadonlyMap<string, Registered<RendererDefinition>>,
    private readonly dataSourceMap: ReadonlyMap<string, Registered<DataSourceDefinition>>,
    private readonly templateMap: ReadonlyMap<string, Registered<TemplateDefinition>>,
    public readonly templateRegistry: TemplateRegistry,
    private readonly slotMap: ReadonlyMap<UISlotName, readonly Registered<UISlotContribution>[]>,
    private readonly hooks: readonly LifecycleHooks[]
  ) {}

  get blocks() { return Object.freeze([...this.blockMap.values()]); }
  get fields() { return Object.freeze([...this.fieldMap.values()]); }
  get actions() { return Object.freeze([...this.actionMap.values()].sort(compareByOrder)); }
  get renderers() { return Object.freeze([...this.rendererMap.values()]); }
  get dataSources() { return Object.freeze([...this.dataSourceMap.values()]); }
  get templates() { return this.templateRegistry.templates; }
  getBlock(type: string) { return this.blockMap.get(type); }
  getField(type: string) { return this.fieldMap.get(type); }
  getAction(id: string) { return this.actionMap.get(id); }
  getRenderer(id: string) { return this.rendererMap.get(id); }
  getDataSource(key: string) { return this.dataSourceMap.get(key); }
  getTemplate(id: string) { return this.templateRegistry.get(id); }
  getSlot(slot: UISlotName) { return this.slotMap.get(slot) ?? []; }
  notifyChange(document: PageDocument) { this.hooks.forEach((hook) => hook.onChange?.(document)); }
  notifyError(error: Error) { this.hooks.forEach((hook) => hook.onError?.(error)); }

  static create(extensions: PageBuilderExtension[], options: ExtensionRegistryOptions = {}): ExtensionRegistry {
    const resolved = resolveOrder(extensions, new Set(options.disabled ?? []));
    const blocks = new Map<string, Registered<BlockDefinition>>();
    const fields = new Map<string, Registered<FieldDefinition>>();
    const actions = new Map<string, Registered<EditorAction>>();
    const renderers = new Map<string, Registered<RendererDefinition>>();
    const dataSources = new Map<string, Registered<DataSourceDefinition>>();
    const templates = new Map<string, Registered<TemplateDefinition>>();
    const blockItems: BlockDefinition[] = [];
    const fieldItems: FieldDefinition[] = [];
    const actionItems: EditorAction[] = [];
    const rendererItems: RendererDefinition[] = [];
    const dataSourceItems: DataSourceDefinition[] = [];
    const templateItems: TemplateDefinition[] = [];
    const slots = new Map<UISlotName, Registered<UISlotContribution>[]>();

    for (const extension of resolved) {
      for (const block of extension.blocks ?? []) {
        assertTargets(block.targets, `Block ${block.type}`);
        const policyIssue = validateBlockPolicy(block.policy);
        if (policyIssue) throw new ExtensionRegistryError("invalid-block-policy", `Block ${block.type} 的策略无效：${policyIssue}`);
      }
      register(blockItems, extension.blocks, extension.name, blocks, "Block");
      register(fieldItems, extension.fields, extension.name, fields, "Field");
      register(actionItems, extension.actions, extension.name, actions, "Action");
      register(rendererItems, extension.renderers, extension.name, renderers, "Renderer");
      register(dataSourceItems, extension.dataSources, extension.name, dataSources, "DataSource");
      register(templateItems, extension.templates, extension.name, templates, "Template");
      for (const slot of extension.slots ?? []) {
        assertIdentifier(slot.id, "UI Slot");
        if (!slotNames.has(slot.slot)) throw new ExtensionRegistryError("invalid-identifier", `未知 UI Slot：${slot.slot}`);
        const current = slots.get(slot.slot) ?? [];
        if (current.some((item) => item.id === slot.id)) throw new ExtensionRegistryError("duplicate-definition", `UI Slot ID 冲突：${slot.id}`);
        current.push(Object.freeze({ ...slot, extension: extension.name }));
        slots.set(slot.slot, current);
      }
    }

    const templateRegistry = TemplateRegistry.create(templateItems.map((template) => templates.get(template.id)!), blockItems);
    const sortedSlots = new Map<UISlotName, readonly Registered<UISlotContribution>[]>();
    for (const [slot, contributions] of slots) sortedSlots.set(slot, Object.freeze([...contributions].sort(compareByOrder)));
    return Object.freeze(new ExtensionRegistry(
      Object.freeze([...resolved]), blocks, fields, actions, renderers, dataSources, templates, templateRegistry, sortedSlots, Object.freeze(resolved.flatMap((extension) => extension.hooks ? [extension.hooks] : []))
    )) as ExtensionRegistry;
  }
}

export function createExtensionRegistry(extensions: PageBuilderExtension[], options?: ExtensionRegistryOptions) {
  return ExtensionRegistry.create(extensions, options);
}

export function createTemplateRegistry(templates: TemplateDefinition[], blocks: BlockDefinition[] = []) {
  const registered = templates.map((template) => Object.freeze({ ...template, extension: "standalone" }) as Registered<TemplateDefinition>);
  return TemplateRegistry.create(registered, blocks);
}
