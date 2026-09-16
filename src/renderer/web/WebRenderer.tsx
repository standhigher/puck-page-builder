import type { ExtensionRegistry } from "../../core/extensions";
import type { PageDocument } from "../../core/schema/page-document";

export type WebRendererProps = {
  document: PageDocument;
  className?: string;
  registry?: ExtensionRegistry;
};

export function WebRenderer({ document, className, registry }: WebRendererProps) {
  return <main className={className ?? "pb-web-renderer"} data-page-id={document.pageId} lang={document.settings.locale}>
    {document.blocks.map((block) => {
      if (block.type === "core.text") return <section key={block.id} data-block-id={block.id} className="pb-web-renderer__text"><p>{typeof block.props.content === "string" ? block.props.content : ""}</p></section>;
      if (block.type === "core.image") return <figure key={block.id} data-block-id={block.id} className="pb-web-renderer__image"><img src={typeof block.props.src === "string" ? block.props.src : ""} alt={typeof block.props.alt === "string" ? block.props.alt : ""} /></figure>;
      const BlockRenderer = registry?.getBlock(block.type)?.render.web;
      if (BlockRenderer) return <section key={block.id} data-block-id={block.id}><BlockRenderer {...block.props} /></section>;
      return null;
    })}
  </main>;
}
