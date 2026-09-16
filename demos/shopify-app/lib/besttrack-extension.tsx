import type { PageBuilderExtension } from "@standhigher/puck-page-builder/extensions";
import { BestTrackToolbarSlot, StatusToneField, TrackingStatusBlock } from "./besttrack-extension-components";

export const bestTrackExtension: PageBuilderExtension = {
  name: "besttrack.tracking",
  version: "0.3.0",
  blocks: [{
    type: "besttrack.tracking-status",
    version: 1,
    label: "物流状态",
    category: "BestTrack",
    targets: ["web"],
    defaultProps: { heading: "Shipment update", status: "In transit" },
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
  dataSources: [{
    key: "besttrack.tracking.query",
    mock: async () => ({ status: "In transit" }),
    live: async () => ({ status: "Live data is configured in V0.6" })
  }],
  templates: [{
    id: "besttrack.tracking.ready-to-go",
    version: 1,
    name: "Ready-to-go Tracking",
    target: "web",
    create: () => ({ schemaVersion: 1, pageId: "besttrack-ready-to-go", target: "web", root: {}, blocks: [], settings: { locale: "en", seoTitle: "Track your order" } })
  }],
  slots: [{ id: "besttrack.tracking.toolbar-status", slot: "toolbar.right", order: 20, component: BestTrackToolbarSlot }]
};
