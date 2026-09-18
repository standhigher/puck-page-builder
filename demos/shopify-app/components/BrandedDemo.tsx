"use client";

import { bestTrackBrandedExtension, BrandedRuntimeProvider, type ReadyToGoTrackingQuery } from "@standhigher/besttrack-page-extension";
import { PageDocumentEditorShell } from "@standhigher/puck-page-builder";
import { createExtensionRegistry, migratePageDocument, WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { Banner, BlockStack, Card, Page, Text } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBestTrackExtension } from "../lib/besttrack-extension";
import type { GetSessionToken } from "../lib/besttrack-data-source";

/** V0.7.1 keeps the same host-owned query contract as Ready-to-go; only the template presentation changes. */
export function BrandedDemo({ getSessionToken }: { getSessionToken?: GetSessionToken }) {
  const registry = useMemo(() => createExtensionRegistry([bestTrackBrandedExtension, createBestTrackExtension(getSessionToken)]), [getSessionToken]);
  const initialDocument = useMemo(() => registry.getTemplate("besttrack.branded")!.create(), [registry]);
  const [document, setDocument] = useState<PageDocument>(initialDocument);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/page-documents/" + encodeURIComponent(initialDocument.pageId) + "/draft", { cache: "no-store" });
        if (response.ok) {
          const stored = await response.json() as { document: unknown };
          const migration = migratePageDocument(stored.document);
          if (!migration.success) throw new Error("branded-draft-invalid");
          if (active) setDocument(migration.data);
        } else if (response.status === 404 && active) setDocument(initialDocument);
        else if (!response.ok) throw new Error("branded-draft-load-" + response.status);
        if (active) setLoadState("ready");
      } catch { if (active) setLoadState("error"); }
    };
    void load();
    return () => { active = false; };
  }, [initialDocument]);
  const queryTracking = useCallback<ReadyToGoTrackingQuery>(async (trackingNumber) => {
    if (!getSessionToken) return {
      trackingNumber, status: "In transit", carrier: "BestTrack demo carrier", latestEvent: "Shipment accepted at the regional hub", deliveryAddress: "Demo recipient · Shanghai",
      shipments: [
        {
          id: "shipment-1", label: "Shipment #1", trackingNumber, status: "In transit",
          progress: [{ id: "ordered", label: "Ordered", state: "complete" }, { id: "ready", label: "Order Ready", state: "complete" }, { id: "transit", label: "In Transit", state: "current" }, { id: "out", label: "Out for Delivery", state: "upcoming" }, { id: "delivered", label: "Delivered", state: "upcoming" }],
          events: [{ id: "hub", title: "Shipment accepted at the regional hub", at: "Sep 4, 3:51 PM", detail: "BestTrack demo carrier", state: "current" }, { id: "warehouse", title: "Warehouse accepted your order", at: "Sep 4, 3:46 PM", state: "complete" }, { id: "placed", title: "The order has been placed and confirmed.", at: "Sep 4, 3:31 PM", state: "complete" }],
          orderItems: [{ id: "studio-tote", title: "Studio tote", quantity: 1, description: "Product details load automatically after tracking.", imageUrl: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=120&q=80" }],
          recommendations: [{ id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery.", imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=640&q=80", href: "/products/shipping-protection", price: "$12.00" }]
        },
        {
          id: "shipment-2", label: "Shipment #2", trackingNumber: trackingNumber + "-2", status: "Order Ready",
          progress: [{ id: "ordered", label: "Ordered", state: "complete" }, { id: "ready", label: "Order Ready", state: "current" }, { id: "transit", label: "In Transit", state: "upcoming" }, { id: "out", label: "Out for Delivery", state: "upcoming" }, { id: "delivered", label: "Delivered", state: "upcoming" }],
          events: [{ id: "packed", title: "Your package is being prepared", at: "Sep 4, 4:20 PM", state: "current" }, { id: "confirmed", title: "The order has been placed and confirmed.", at: "Sep 4, 3:31 PM", state: "complete" }],
          orderItems: [{ id: "travel-case", title: "Travel case", quantity: 1, description: "Packed separately for safe delivery.", imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=120&q=80" }],
          recommendations: [{ id: "delivery-alerts", title: "Delivery alerts", description: "Receive updates at every milestone.", imageUrl: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=640&q=80", href: "/products/delivery-alerts", price: "$8.00" }]
        },
        { id: "shipment-3", label: "Shipment #3", trackingNumber: trackingNumber + "-3", status: "Ordered", progress: [{ id: "ordered", label: "Ordered", state: "current" }, { id: "ready", label: "Order Ready", state: "upcoming" }, { id: "transit", label: "In Transit", state: "upcoming" }, { id: "out", label: "Out for Delivery", state: "upcoming" }, { id: "delivered", label: "Delivered", state: "upcoming" }], events: [{ id: "confirmed", title: "The order has been placed and confirmed.", at: "Sep 4, 3:31 PM", state: "current" }], orderItems: [], recommendations: [] }
      ]
    };
    const source = registry.getDataSource("besttrack.tracking.query");
    if (!source) throw new Error("besttrack-tracking-source-not-registered");
    return source.live({ trackingNumber }) as Promise<Awaited<ReturnType<ReadyToGoTrackingQuery>>>;
  }, [getSessionToken, registry]);
  const save = async (next: PageDocument, resource: "draft" | "published") => {
    const response = await fetch("/api/page-documents/" + encodeURIComponent(next.pageId) + "/" + resource, { method: resource === "draft" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) throw new Error("branded-" + resource + "-save-" + response.status);
  };
  if (loadState === "error") return <Page fullWidth><Banner tone="critical" title="无法加载 Branded 草稿">草稿未通过 PageDocument 校验，编辑器未打开。</Banner></Page>;
  return <BrandedRuntimeProvider queryTracking={queryTracking}><Page fullWidth><BlockStack gap="300">
    <Card><BlockStack gap="100"><Text as="h2" variant="headingSm">V0.7.1 Branded</Text><Text as="p" tone="subdued">品牌化模板复用 Ready-to-go 的受控查询 Runtime 和标准数据模型。Logo、文案与链接在 Editor 中配置；颜色、字体和圆角由模板 Theme Token 与文档 Theme 共同决定。</Text>{!getSessionToken ? <Banner tone="info">独立模式使用显式 Mock Runtime；嵌入 Shopify 后使用受控 Live DataSource，失败不会回退为 Mock。</Banner> : null}</BlockStack></Card>
    {loadState === "ready" ? <PageDocumentEditorShell initialDocument={document} registry={registry} iframe={false} onDocumentChange={setDocument} onSave={(next) => save(next, "draft")} onPublish={(next) => save(next, "published")} /> : <Banner tone="info">正在加载 Branded 草稿…</Banner>}
    <Card><BlockStack gap="200"><Text as="h2" variant="headingSm">Consumer WebRenderer preview</Text><WebRenderer document={document} registry={registry} className="pb-web-renderer pb-web-renderer--demo" /></BlockStack></Card>
  </BlockStack></Page></BrandedRuntimeProvider>;
}
