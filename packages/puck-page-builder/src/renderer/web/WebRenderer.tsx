import type { ExtensionRegistry } from "../../core/extensions";
import type { PageDocument } from "../../core/schema/page-document";
import { mergeThemeTokens, toThemeStyle } from "../../core/theme";
import type { CSSProperties } from "react";

export type WebRendererProps = {
  document: PageDocument;
  className?: string;
  registry?: ExtensionRegistry;
};

export function WebRenderer({ document, className, registry }: WebRendererProps) {
  const template = document.templateId ? registry?.getTemplate(document.templateId) : undefined;
  const pageTheme = mergeThemeTokens(template?.theme, document.theme);
  return <main className={className ?? "pb-web-renderer"} data-page-id={document.pageId} lang={document.settings.locale} style={toThemeStyle(pageTheme) as CSSProperties}>
    {document.blocks.map((block) => {
      const definition = registry?.getBlock(block.type);
      const variant = definition?.variants?.find((item) => item.id === block.variant);
      const style = toThemeStyle(mergeThemeTokens(template?.theme, document.theme, variant?.theme, block.style)) as CSSProperties;
      if (block.type === "core.text") return <section key={block.id} data-block-id={block.id} data-block-variant={block.variant} style={style} className="pb-web-renderer__text"><p>{typeof block.props.content === "string" ? block.props.content : ""}</p></section>;
      if (block.type === "core.image") return <figure key={block.id} data-block-id={block.id} data-block-variant={block.variant} style={style} className="pb-web-renderer__image"><img src={typeof block.props.src === "string" ? block.props.src : ""} alt={typeof block.props.alt === "string" ? block.props.alt : ""} /></figure>;
      const BlockRenderer = definition?.render.web;
      if (BlockRenderer) return <section key={block.id} data-block-id={block.id} data-block-variant={block.variant} style={style}><BlockRenderer {...block.props} /></section>;
      return null;
    })}
  </main>;
}
