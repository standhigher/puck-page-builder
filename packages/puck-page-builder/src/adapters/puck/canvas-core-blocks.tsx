import { useCanvasEditing } from "./use-canvas-editing";
import type { JsonValue } from "../../core/schema/page-document";

type CanvasBlockEditorProps = {
  id: string;
  editable: boolean;
  onSelect: (id: string) => void;
  onPropsChange: (id: string, props: Record<string, JsonValue>, preserveCanvasValue?: boolean) => void;
};

export function CanvasTextBlock({ id, content, editable, onSelect, onPropsChange }: CanvasBlockEditorProps & { content: string }) {
  const ref = useCanvasEditing<HTMLElement>(editable);
  return <section ref={ref} className="pb-document-canvas__text" data-page-document-block-id={id} aria-label="Select Text in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelect(id);
    }
  }}><p contentEditable={editable} suppressContentEditableWarning onInput={(event) => { if (editable) onPropsChange(id, { content: event.currentTarget.textContent ?? "" }, true); }}>{content}</p></section>;
}

export function CanvasImageBlock({ id, src, alt, editable, onSelect, onPropsChange }: CanvasBlockEditorProps & { src: string; alt: string }) {
  const ref = useCanvasEditing<HTMLElement>(editable);
  return <figure ref={ref} className="pb-document-canvas__image" data-page-document-block-id={id} aria-label="Select Image in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelect(id);
    }
  }}><img src={src} alt={alt} />{editable ? <input aria-label="画布图片 URL" value={src} onChange={(event) => onPropsChange(id, { src: event.currentTarget.value }, true)} onClick={(event) => event.stopPropagation()} /> : null}</figure>;
}
