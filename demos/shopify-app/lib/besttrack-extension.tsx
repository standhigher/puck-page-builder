import type { PageBuilderExtension } from "@standhigher/puck-page-builder/extensions";
import { BestTrackToolbarSlot, StatusToneField, TrackingStatusBlock } from "./besttrack-extension-components";
import { createBestTrackTrackingDataSource, type GetSessionToken } from "./besttrack-data-source";

/**
 * V0.6 configures the extension's live source with a Shopify session-token
 * supplier. The source remains unconfigured in the V0.3 Registry showcase,
 * where it is deliberately not invoked.
 */
export function createBestTrackExtension(getSessionToken?: GetSessionToken): PageBuilderExtension {
  return {
  name: "besttrack.tracking",
  version: "0.6.0",
  blocks: [{
    type: "besttrack.tracking-status",
    version: 1,
    label: "物流状态",
    category: "BestTrack",
    targets: ["web"],
    defaultProps: { heading: "Shipment update", status: "In transit" },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }, { id: "emphasis", label: "Emphasis", theme: { "color.primary": "#5c3bfe" } }],
    fields: {
      heading: { field: "core.text", label: "标题", required: true },
      status: { field: "besttrack.status-tone", label: "状态色" }
    },
    render: { web: TrackingStatusBlock }
  }],
  fields: [{ type: "besttrack.status-tone", component: StatusToneField }],
  actions: [{
    id: "besttrack.tracking.preview",
    label: "运行 BestTrack Action",
    position: "right",
    order: 20,
    execute: ({ notify }) => notify?.("BestTrack Toolbar Action 已执行")
  }],
  renderers: [{ id: "besttrack.tracking.web", target: "web", render: () => "BestTrack Web Renderer" }],
  dataSources: [createBestTrackTrackingDataSource(getSessionToken)],
  templates: [{
    id: "besttrack.tracking.ready-to-go",
    version: 1,
    name: "Ready-to-go Tracking",
    target: "web",
    source: "custom",
    requiredBlocks: ["besttrack.tracking-status"],
    theme: { "color.primary": "#005bd3" },
    create: () => ({ schemaVersion: 1, pageId: "besttrack-ready-to-go", target: "web", theme: {}, root: {}, blocks: [], settings: { locale: "en", seoTitle: "Track your order" } })
  }],
  slots: [{ id: "besttrack.tracking.toolbar-status", slot: "toolbar.right", order: 20, component: BestTrackToolbarSlot }]
  };
}

export const bestTrackExtension = createBestTrackExtension();
