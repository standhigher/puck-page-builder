import type { ComponentType, ReactNode } from "react";
import type { PageDocument, RenderTarget } from "../schema/page-document";

export type ExtensionTarget = RenderTarget | "all";
export type EditorActionPosition = "left" | "center" | "right";
export type UISlotName = "toolbar.left" | "toolbar.center" | "toolbar.right" | "inspector.content";

export type ValidationIssue = { path: string; message: string };

export type FieldConfig = {
  field: string;
  label?: string;
  required?: boolean;
};

export type FieldProps<T = unknown> = {
  value: T;
  onChange(value: T): void;
};

export interface BlockDefinition<P = Record<string, unknown>> {
  type: string;
  version: number;
  label: string;
  category: string;
  targets: ExtensionTarget[];
  defaultProps: P;
  fields: Record<string, FieldConfig>;
  render: Partial<Record<RenderTarget, ComponentType<P>>>;
  dataSources?: string[];
  validate?: (props: P) => ValidationIssue[];
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

export interface DataSourceDefinition<P = unknown, R = unknown> {
  key: string;
  mock: (params: P) => Promise<R>;
  live: (params: P) => Promise<R>;
  validateParams?: (params: P) => ValidationIssue[];
}

export interface TemplateDefinition {
  id: string;
  version: number;
  name: string;
  target: RenderTarget;
  thumbnail?: string;
  create(): PageDocument;
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
