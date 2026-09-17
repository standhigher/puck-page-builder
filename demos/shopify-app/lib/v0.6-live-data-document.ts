import type { PageDocument } from "@standhigher/puck-page-builder";

/** V0.6 demo document: its block binding is resolved without saving the document. */
export const v06LiveDataDocument: PageDocument = {
  schemaVersion: 1,
  pageId: "v06-live-tracking-demo",
  target: "web",
  theme: {},
  root: {},
  settings: { locale: "en", seoTitle: "Live tracking data" },
  blocks: [{
    id: "besttrack-live-status",
    type: "besttrack.tracking-status",
    version: 1,
    props: { heading: "Shipment update", status: "Loading tracking status" },
    variant: "default",
    style: {},
    binding: { source: "besttrack.tracking.query", params: { trackingNumber: "BT-2048-DEMO" } }
  }]
};
