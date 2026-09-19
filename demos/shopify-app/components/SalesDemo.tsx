"use client";

import { bestTrackSalesExtension, SalesRuntimeProvider, type TrackingPageQuery } from "@standhigher/besttrack-page-extension";
import { PageDocumentEditorShell } from "@standhigher/puck-page-builder";
import { createExtensionRegistry, migratePageDocument, WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { Banner, BlockStack, Card, Page, Text } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBestTrackExtension } from "../lib/besttrack-extension";
import type { GetSessionToken } from "../lib/besttrack-data-source";

export function SalesDemo({ getSessionToken }: { getSessionToken?: GetSessionToken }) {
  const registry = useMemo(() => createExtensionRegistry([bestTrackSalesExtension, createBestTrackExtension(getSessionToken)]), [getSessionToken]);
  const initialDocument = useMemo(() => registry.getTemplate("besttrack.sales")!.create(), [registry]);
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
          if (!migration.success) throw new Error("sales-draft-invalid");
          if (active) setDocument(migration.data);
        } else if (response.status === 404 && active) setDocument(initialDocument);
        else if (!response.ok) throw new Error("sales-draft-load-" + response.status);
        if (active) setLoadState("ready");
      } catch { if (active) setLoadState("error"); }
    };
    void load();
    return () => { active = false; };
  }, [initialDocument]);
  const query = useCallback<TrackingPageQuery>(async (request) => {
    const trackingNumber = request.mode === "tracking" ? request.trackingNumber : request.orderNumber;
    if (!getSessionToken) return {
      trackingNumber,
      orderNumber: request.mode === "order" ? request.orderNumber : "#BT-2048",
      status: "In transit",
      carrier: "BestTrack demo carrier",
      estimatedDelivery: "Sep 12",
      destination: "Shanghai",
      transitDuration: "3 days",
      events: [{ id: "hub", title: "Shipment accepted at the regional hub", at: "Sep 4, 3:51 PM", state: "current" }, { id: "warehouse", title: "Warehouse accepted your order", at: "Sep 4, 3:46 PM", state: "complete" }, { id: "placed", title: "The order has been placed and confirmed.", at: "Sep 4, 3:31 PM", state: "complete" }, { id: "received", title: "Shipment information received", at: "Sep 4, 3:20 PM", state: "complete" }],
      orderItems: [{ id: "sales-order", title: "Express travel case", quantity: 1, price: { amount: 1200, compareAtAmount: 1500, currencyCode: "USD" } }],
      recommendations: [{ id: "cover", title: "Shipping cover", description: "Add delivery protection to a future order." }]
    };
    if (request.mode !== "tracking") throw new Error("demo-order-query-not-configured");
    const source = registry.getDataSource("besttrack.tracking.query");
    if (!source) throw new Error("besttrack-tracking-source-not-registered");
    return source.live({ trackingNumber }) as Promise<Awaited<ReturnType<TrackingPageQuery>>>;
  }, [getSessionToken, registry]);
  const save = async (next: PageDocument, resource: "draft" | "published") => {
    const response = await fetch("/api/page-documents/" + encodeURIComponent(next.pageId) + "/" + resource, { method: resource === "draft" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) throw new Error("sales-" + resource + "-save-" + response.status);
  };
  if (loadState === "error") return <Page fullWidth><Banner tone="critical" title="无法加载 Sales 草稿">草稿未通过 PageDocument 校验，编辑器未打开。</Banner></Page>;
  return <SalesRuntimeProvider query={query}><Page fullWidth><BlockStack gap="300">
    <Card><BlockStack gap="100"><Text as="h2" variant="headingSm">V0.7.2 Sales</Text><Text as="p" tone="subdued">商城化模板使用同一受控查询模型。商品与集合引用只保存 JSON 标识和最小展示数据；生产资源选择由受控 Consumer Runtime API 授权，浏览器不会请求 Shopify Admin API。</Text>{!getSessionToken ? <Banner tone="info">独立模式使用显式 Mock Runtime；嵌入 Shopify 后使用受控 Live DataSource。</Banner> : null}</BlockStack></Card>
    {loadState === "ready" ? <PageDocumentEditorShell initialDocument={document} registry={registry} iframe={false} onDocumentChange={setDocument} onSave={(next) => save(next, "draft")} onPublish={(next) => save(next, "published")} /> : <Banner tone="info">正在加载 Sales 草稿…</Banner>}
    <Card><BlockStack gap="200"><Text as="h2" variant="headingSm">Consumer WebRenderer preview</Text><WebRenderer document={document} registry={registry} className="pb-web-renderer pb-web-renderer--demo" /></BlockStack></Card>
  </BlockStack></Page></SalesRuntimeProvider>;
}
