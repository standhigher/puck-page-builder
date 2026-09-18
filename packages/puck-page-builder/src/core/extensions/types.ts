import type { ComponentType, ReactNode } from "react";
import type { JsonValue, PageDocument, RenderTarget } from "../schema/page-document";
import type { ThemeTokens } from "../theme";

export type ExtensionTarget = RenderTarget | "all";
export type EditorActionPosition = "left" | "center" | "right";
export type UISlotName = "toolbar.left" | "toolbar.center" | "toolbar.right" | "inspector.content";

export type ValidationIssue = { path: string; message: string };

export type FieldConfig = {
  field: string;
  label?: string;
  /** Product-facing editor metadata. Custom field components remain supported. */
  control?: "text" | "textarea" | "url";
  description?: string;
  group?: string;
  required?: boolean;
};

export type FieldProps<T = unknown> = {
  value: T;
  onChange(value: T): void;
};

/**
 * Props available only to an extension's editor-canvas renderer.
 * They are separate from Web rendering so editor interaction cannot invoke a
 * host Runtime or become persisted operational data.
 */
export type BlockEditorProps<P = Record<string, unknown>> = P & {
  blockId: string;
  selected: boolean;
  onPropsChange(props: Record<string, JsonValue>): void;
};

export interface BlockDefinition<P = Record<string, unknown>> {
  type: string;
  version: number;
  label: string;
  category: string;
  targets: ExtensionTarget[];
  defaultProps: P;
  fields: Record<string, FieldConfig>;
  render: Partial<Record<RenderTarget, ComponentType<P>>> & {
    /** Optional edit-mode renderer. WebRenderer never uses this surface. */
    editor?: ComponentType<BlockEditorProps<P>>;
  };
  defaultVariant?: string;
  variants?: BlockVariantDefinition[];
  dataSources?: string[];
  validate?: (props: P) => ValidationIssue[];
}

export interface BlockVariantDefinition {
  id: string;
  label: string;
  theme?: ThemeTokens;
}

export interface FieldDefinition<T = unknown> {
  type: string;
  component: ComponentType<FieldProps<T>>;
  normalize?: (value: T) => T;
  validate?: (value: T) => ValidationIssue[];
}

export type ExtensionActionContext = {
  document: PageDocument;
  pageId: string;
  notify?(message: string): void;
};

export interface EditorAction {
  id: string;
  label: string;
  position: EditorActionPosition;
  order?: number;
  variant?: "default" | "primary" | "danger";
  hidden?: (context: ExtensionActionContext) => boolean;
  disabled?: (context: ExtensionActionContext) => boolean;
  execute(context: ExtensionActionContext): Promise<void> | void;
}

export interface RendererDefinition {
  id: string;
  target: RenderTarget;
  render(document: PageDocument): ReactNode | string;
}

/**
 * `P` defaults to `any` so an extension may contribute a narrower, validated
 * parameter type while the framework-independent registry remains generic.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DataSourceDefinition<P = any, R = unknown> {
  key: string;
  mock: (params: P) => Promise<R>;
  live: (params: P) => Promise<R>;
  validateParams?: (params: P) => ValidationIssue[];
}

export type TemplateSource = "built-in" | "marketplace" | "custom";

export interface TemplateDefinition {
  id: string;
  version: number;
  name: string;
  target: RenderTarget;
  source: TemplateSource;
  thumbnail?: string;
  create(): PageDocument;
  /** Block types that must be registered before this template can be used. */
  requiredBlocks?: string[];
  theme?: ThemeTokens;
}

export interface LifecycleHooks {
  onChange?(document: PageDocument): void;
  beforeSave?(document: PageDocument): Promise<PageDocument>;
  afterSave?(result: unknown): Promise<void>;
  beforePublish?(document: PageDocument): Promise<PageDocument>;
  afterPublish?(result: unknown): Promise<void>;
  onError?(error: Error): void;
}

export interface UISlotContribution {
  id: string;
  slot: UISlotName;
  order?: number;
  component: ComponentType;
}

export interface PageBuilderExtension {
  /** Namespaced, stable extension identifier, such as `besttrack.tracking`. */
  name: string;
  version: string;
  order?: number;
  dependsOn?: string[];
  blocks?: BlockDefinition[];
  fields?: FieldDefinition[];
  actions?: EditorAction[];
  renderers?: RendererDefinition[];
  dataSources?: DataSourceDefinition[];
  templates?: TemplateDefinition[];
  hooks?: LifecycleHooks;
  slots?: UISlotContribution[];
}

export type ExtensionRegistryOptions = {
  disabled?: string[];
};
