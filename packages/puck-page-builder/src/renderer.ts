/**
 * Server-safe renderer entry point.
 *
 * Keep this separate from the editor export so an application can render a
 * PageDocument in a React Server Component without loading Puck.
 */
export { WebRenderer, type WebRendererProps } from "../../../src/renderer/web/WebRenderer";
