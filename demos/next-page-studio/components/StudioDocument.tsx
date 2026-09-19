"use client";

import { BrandedRuntimeProvider, ReadyToGoRuntimeProvider, SalesRuntimeProvider, type TrackingPageQuery } from "@standhigher/besttrack-page-extension";
import { WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { pageStudioRegistry } from "../lib/registry";

const mockQuery: TrackingPageQuery = async (request) => ({
  trackingNumber: request.mode === "tracking" ? request.trackingNumber : request.orderNumber,
  status: "In transit",
  carrier: "BestTrack demo carrier",
  latestEvent: "Shipment accepted at the regional hub",
  updatedAt: "Sep 17, 10:00 AM",
  destination: "Shanghai",
  estimatedDelivery: "Sep 22 - Sep 24",
  shipments: [{ id: "demo-shipment", label: "Shipment #1", trackingNumber: request.mode === "tracking" ? request.trackingNumber : request.orderNumber, status: "In transit", latestEvent: "Shipment accepted at the regional hub" }],
  orderItems: [{ id: "demo-item", title: "Demo shipment item", quantity: 1, description: "Preview-only product information." }],
  recommendations: [{ id: "demo-recommendation", title: "Delivery alerts", description: "Receive an update at every milestone.", price: { amount: 400, currencyCode: "USD" } }]
});

/** Explicit mock-only Runtime boundary for this local demo. */
export function StudioDocument({ document }: { document: PageDocument }) {
  return <ReadyToGoRuntimeProvider query={mockQuery}>
    <BrandedRuntimeProvider query={mockQuery}>
      <SalesRuntimeProvider query={mockQuery}>
        <WebRenderer document={document} registry={pageStudioRegistry} />
      </SalesRuntimeProvider>
    </BrandedRuntimeProvider>
  </ReadyToGoRuntimeProvider>;
}
