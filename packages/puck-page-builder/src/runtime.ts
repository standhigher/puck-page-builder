/**
 * Consumer-only public surface. It intentionally excludes Puck, Builder UI,
 * Polaris and Shopify App Bridge so storefront bundles can stay independent.
 */
export { WebRenderer, type WebRendererProps } from "./renderer/web/WebRenderer";
export * from "./core/extensions";
export * from "./core/schema/page-document";
export * from "./core/theme";
