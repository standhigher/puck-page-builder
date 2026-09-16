import type { Config } from "@puckeditor/core";
import type { ExtensionRegistry } from "../../core/extensions";
import type { JsonValue } from "../../core/schema/page-document";

export function createPageDocumentPuckConfig(onSelect: (id: string) => void, onPropsChange: (id: string, props: Record<string, JsonValue>) => void, selectedBlockId?: string | null, registry?: ExtensionRegistry): Config {
  const extensionComponents = Object.fromEntries((registry?.blocks ?? []).flatMap((block) => {
    const BlockRenderer = block.render.web;
    if (!BlockRenderer) return [];
    return [[block.type, {
      render: (props: Record<string, unknown>) => {
        const id = typeof props.id === "string" ? props.id : `unknown-${block.type}`;
        return <section className="pb-document-canvas__extension" aria-label={`Select ${block.label} in canvas`} role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onSelect(id);
        }}><BlockRenderer {...props} /></section>;
      }
    }]];
  }));
  return {
    components: {
      Text: {
        render: (props: { id?: unknown; content?: unknown }) => {
          const id = typeof props.id === "string" ? props.id : "unknown-text";
          const content = typeof props.content === "string" ? props.content : "";
          const editable = id === selectedBlockId;
          return <section className="pb-document-canvas__text" data-page-document-block-id={id} aria-label="Select Text in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(id);
          }}><p contentEditable={editable} suppressContentEditableWarning onInput={(event) => { if (editable) onPropsChange(id, { content: event.currentTarget.textContent ?? "" }); }}>{content}</p></section>;
        }
      },
      Image: {
        render: (props: { id?: unknown; src?: unknown; alt?: unknown }) => {
          const id = typeof props.id === "string" ? props.id : "unknown-image";
          const src = typeof props.src === "string" ? props.src : "";
          const alt = typeof props.alt === "string" ? props.alt : "";
          const editable = id === selectedBlockId;
          return <figure className="pb-document-canvas__image" data-page-document-block-id={id} aria-label="Select Image in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(id);
          }}><img src={src} alt={alt} />{editable ? <input aria-label="画布图片 URL" value={src} onChange={(event) => onPropsChange(id, { src: event.currentTarget.value })} onClick={(event) => event.stopPropagation()} /> : null}</figure>;
        }
      },
      ...extensionComponents
    }
  } as Config;
}
