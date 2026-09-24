import type { Config } from "@puckeditor/core";
import { CanvasExtensionBlock } from "./canvas-extension-block";
import type { ExtensionRegistry } from "../../core/extensions";
import type { JsonValue } from "../../core/schema/page-document";

export type PageDocumentBlockPermissions = Partial<Record<"drag" | "duplicate" | "delete" | "edit" | "insert", boolean>>;

export type ResolvePageDocumentBlockPermissions = (input: { id: string; type: string }) => PageDocumentBlockPermissions;

function withBlockPermissions<T extends Record<string, unknown>>(
  component: T,
  type: string,
  resolvePermissions?: ResolvePageDocumentBlockPermissions
): T & { resolvePermissions?: (item: { props?: Record<string, unknown> } | null) => PageDocumentBlockPermissions } {
  if (!resolvePermissions) return component as T & { resolvePermissions?: (item: { props?: Record<string, unknown> } | null) => PageDocumentBlockPermissions };
  return {
    ...component,
    // Keep actions hidden until the policy resolver has produced the current
    // per-block result. This prevents a one-frame clickable action that may be
    // rejected by the PageDocument policy after Puck emits onChange.
    permissions: { drag: false, duplicate: false, delete: false, edit: false, insert: false },
    resolvePermissions: (item) => {
      const id = typeof item?.props?.id === "string" ? item.props.id : "";
      return resolvePermissions({ id, type });
    }
  };
}

function canvasFieldFallback({ block, props, registry, onPropsChange }: { block: NonNullable<ExtensionRegistry["blocks"]>[number]; props: Record<string, unknown>; registry?: ExtensionRegistry; onPropsChange: (props: Record<string, JsonValue>) => void }) {
  const fields = Object.entries(block.fields);
  if (!fields.length) return null;
  return <div aria-label={"Edit " + block.label + " values in canvas"} onClick={(event) => event.stopPropagation()} style={{ display: "grid", gap: 8, marginTop: 12, padding: 12, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc" }}>
    {fields.map(([name, field]) => {
      const Field = registry?.getField(field.field)?.component;
      return Field ? <label key={name} style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>{field.label ?? name}<Field value={props[name]} onChange={(value) => onPropsChange({ [name]: value as JsonValue })} /></label> : null;
    })}
  </div>;
}

export function createPageDocumentPuckConfig(onSelect: (id: string) => void, onPropsChange: (id: string, props: Record<string, JsonValue>, preserveCanvasValue?: boolean) => void, selectedBlockId?: string | null, registry?: ExtensionRegistry, resolveBlockPermissions?: ResolvePageDocumentBlockPermissions): Config {
  const extensionComponents = Object.fromEntries((registry?.blocks ?? []).flatMap((block) => {
    const BlockRenderer = block.render.web;
    if (!BlockRenderer) return [];
    return [[block.type, withBlockPermissions({
      render: (props: Record<string, unknown>) => {
        const id = typeof props.id === "string" ? props.id : `unknown-${block.type}`;
        const EditorRenderer = block.render.editor;
        const active = id === selectedBlockId;
        return <CanvasExtensionBlock active={active} label={block.label} onSelect={() => onSelect(id)}>{EditorRenderer ? <EditorRenderer {...props} blockId={id} selected={active} onPropsChange={(next) => onPropsChange(id, next)} /> : <><BlockRenderer {...props} />{active ? canvasFieldFallback({ block, props, registry, onPropsChange: (next) => onPropsChange(id, next) }) : null}</>}</CanvasExtensionBlock>;
      }
    }, block.type, resolveBlockPermissions)]];
  }));
  return {
    components: {
      Text: withBlockPermissions({
        render: (props: { id?: unknown; content?: unknown }) => {
          const id = typeof props.id === "string" ? props.id : "unknown-text";
          const content = typeof props.content === "string" ? props.content : "";
          const editable = id === selectedBlockId;
          return <section className="pb-document-canvas__text" data-page-document-block-id={id} aria-label="Select Text in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(id);
          }}><p contentEditable={editable} suppressContentEditableWarning onInput={(event) => { if (editable) onPropsChange(id, { content: event.currentTarget.textContent ?? "" }, true); }}>{content}</p></section>;
        }
      }, "core.text", resolveBlockPermissions),
      Image: withBlockPermissions({
        render: (props: { id?: unknown; src?: unknown; alt?: unknown }) => {
          const id = typeof props.id === "string" ? props.id : "unknown-image";
          const src = typeof props.src === "string" ? props.src : "";
          const alt = typeof props.alt === "string" ? props.alt : "";
          const editable = id === selectedBlockId;
          return <figure className="pb-document-canvas__image" data-page-document-block-id={id} aria-label="Select Image in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(id);
          }}><img src={src} alt={alt} />{editable ? <input aria-label="画布图片 URL" value={src} onChange={(event) => onPropsChange(id, { src: event.currentTarget.value }, true)} onClick={(event) => event.stopPropagation()} /> : null}</figure>;
        }
      }, "core.image", resolveBlockPermissions),
      ...extensionComponents
    }
  } as Config;
}
