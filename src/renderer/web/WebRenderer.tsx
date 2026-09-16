import type { PageDocument } from "../../core/schema/page-document";

export type WebRendererProps = {
  document: PageDocument;
  className?: string;
};

export function WebRenderer({ document, className }: WebRendererProps) {
  return <main className={className ?? "pb-web-renderer"} data-page-id={document.pageId} lang={document.settings.locale}>
    {document.blocks.map((block) => {
      if (block.type === "core.text") return <section key={block.id} data-block-id={block.id} className="pb-web-renderer__text"><p>{typeof block.props.content === "string" ? block.props.content : ""}</p></section>;
      if (block.type === "core.image") return <figure key={block.id} data-block-id={block.id} className="pb-web-renderer__image"><img src={typeof block.props.src === "string" ? block.props.src : ""} alt={typeof block.props.alt === "string" ? block.props.alt : ""} /></figure>;
      return null;
    })}
  </main>;
}
