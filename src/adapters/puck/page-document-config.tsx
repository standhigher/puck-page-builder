import type { Config } from "@puckeditor/core";

export function createPageDocumentPuckConfig(onSelect: (id: string) => void): Config {
  return {
    components: {
      Text: {
        render: (props: { id?: unknown; content?: unknown }) => {
          const id = typeof props.id === "string" ? props.id : "unknown-text";
          const content = typeof props.content === "string" ? props.content : "";
          return <section className="pb-document-canvas__text" aria-label="Select Text in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(id);
          }}><p>{content}</p></section>;
        }
      },
      Image: {
        render: (props: { id?: unknown; src?: unknown; alt?: unknown }) => {
          const id = typeof props.id === "string" ? props.id : "unknown-image";
          const src = typeof props.src === "string" ? props.src : "";
          const alt = typeof props.alt === "string" ? props.alt : "";
          return <figure className="pb-document-canvas__image" aria-label="Select Image in canvas" role="button" tabIndex={0} onClick={() => onSelect(id)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(id);
          }}><img src={src} alt={alt} /></figure>;
        }
      }
    }
  };
}
