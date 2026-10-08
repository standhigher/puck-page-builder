"use client";

import { bestTrackBrandedExtension, BrandedRuntimeProvider, type TrackingPageQuery, type TrackingPageRecommendationsQuery } from "@standhigher/besttrack-page-extension";
import { PageDocumentEditorShell } from "@standhigher/puck-page-builder";
import { createExtensionRegistry, migratePageDocument, WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { Banner, BlockStack, Card, Page, Text } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBestTrackExtension } from "../lib/besttrack-extension";
import type { GetSessionToken } from "../lib/besttrack-data-source";

// 原先各包裹内的推荐合并为独立加载来源，切换包裹时推荐区保持同一份结果。
// 回调定义在组件外，避免编辑或查询引发重渲染时因函数身份变化而重新加载推荐。
const mockRecommendationsQuery: TrackingPageRecommendationsQuery = async () => [{ id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery.", imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=640&q=80", href: "https://example.com/products/shipping-protection", price: { amount: 1200, currencyCode: "USD" } }, { id: "delivery-alerts", title: "Delivery alerts", description: "Receive updates at every milestone.", imageUrl: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=640&q=80", href: "https://example.com/products/delivery-alerts", price: { amount: 800, currencyCode: "USD" } }];

/** Branded 保留自己的布局，通过公共 Runtime 使用 Ready-to-go 的查询与推荐规则。 */
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
  const query = useCallback<TrackingPageQuery>(async (request) => {
    const trackingNumber = request.mode === "tracking" ? request.trackingNumber : request.orderNumber;
    // 此演示结果在两种查询方式下都包含三个包裹，用于检查“按返回数量切换”的公共规则。
    // 三个包裹属于一次查询，第一层历史只新增当前输入号码这一条记录。
    if (!getSessionToken) return {
      trackingNumber, orderNumber: request.mode === "order" ? request.orderNumber : "#BT-2048", status: "In transit", carrier: "BestTrack demo carrier", latestEvent: "Shipment accepted at the regional hub", estimatedDelivery: "Sep 12", destination: "Shanghai", transitDuration: "3 days",
      shipments: [
        {
          id: "shipment-1", label: "Shipment #1", trackingNumber, status: "In transit",
          progress: [{ id: "ordered", label: "Ordered", state: "complete" }, { id: "ready", label: "Order Ready", state: "complete" }, { id: "transit", label: "In Transit", state: "current" }, { id: "out", label: "Out for Delivery", state: "upcoming" }, { id: "delivered", label: "Delivered", state: "upcoming" }],
          events: [{ id: "hub", title: "Shipment accepted at the regional hub", at: "Sep 4, 3:51 PM", detail: "BestTrack demo carrier", state: "current" }, { id: "warehouse", title: "Warehouse accepted your order", at: "Sep 4, 3:46 PM", state: "complete" }, { id: "placed", title: "The order has been placed and confirmed.", at: "Sep 4, 3:31 PM", state: "complete" }, { id: "received", title: "Shipment information received", at: "Sep 4, 3:20 PM", state: "complete" }],
          orderItems: [{ id: "studio-tote", title: "Studio tote", quantity: 1, description: "Product details load automatically after tracking.", imageUrl: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=120&q=80", price: { amount: 1200, compareAtAmount: 1500, currencyCode: "USD" } }],
        },
        {
          id: "shipment-2", label: "Shipment #2", trackingNumber: trackingNumber + "-2", status: "Order Ready",
          progress: [{ id: "ordered", label: "Ordered", state: "complete" }, { id: "ready", label: "Order Ready", state: "current" }, { id: "transit", label: "In Transit", state: "upcoming" }, { id: "out", label: "Out for Delivery", state: "upcoming" }, { id: "delivered", label: "Delivered", state: "upcoming" }],
          events: [{ id: "packed", title: "Your package is being prepared", at: "Sep 4, 4:20 PM", state: "current" }, { id: "confirmed", title: "The order has been placed and confirmed.", at: "Sep 4, 3:31 PM", state: "complete" }],
          orderItems: [{ id: "travel-case", title: "Travel case", quantity: 1, description: "Packed separately for safe delivery.", imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=120&q=80", price: { amount: 800, currencyCode: "USD" } }],
        },
        { id: "shipment-3", label: "Shipment #3", trackingNumber: trackingNumber + "-3", status: "Ordered", progress: [{ id: "ordered", label: "Ordered", state: "current" }, { id: "ready", label: "Order Ready", state: "upcoming" }, { id: "transit", label: "In Transit", state: "upcoming" }, { id: "out", label: "Out for Delivery", state: "upcoming" }, { id: "delivered", label: "Delivered", state: "upcoming" }], events: [{ id: "confirmed", title: "The order has been placed and confirmed.", at: "Sep 4, 3:31 PM", state: "current" }], orderItems: [] }
      ]
    };
    // 嵌入式 Live 只接通现有运单号 DataSource；订单查询未配置时明确失败，交给公共 Runtime 处理。
    if (request.mode !== "tracking") throw new Error("demo-order-query-not-configured");
    const source = registry.getDataSource("besttrack.tracking.query");
    if (!source) throw new Error("besttrack-tracking-source-not-registered");
    return source.live({ trackingNumber }) as Promise<Awaited<ReturnType<TrackingPageQuery>>>;
  }, [getSessionToken, registry]);
  const save = async (next: PageDocument, resource: "draft" | "published") => {
    const response = await fetch("/api/page-documents/" + encodeURIComponent(next.pageId) + "/" + resource, { method: resource === "draft" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) throw new Error("branded-" + resource + "-save-" + response.status);
  };
  if (loadState === "error") return <Page fullWidth><Banner tone="critical" title="无法加载 Branded 草稿">草稿未通过 PageDocument 校验，编辑器未打开。</Banner></Page>;
  // 业务规则：商家未选品时，推荐后端默认返回该店铺前 8 个产品，由公共推荐状态提供给区块。
  // 此 Demo 的 Live 分支尚未注入推荐回调或 transport，无法取得这份默认列表；Mock 仅用于独立模式。
  return <BrandedRuntimeProvider query={query} queryRecommendations={getSessionToken ? undefined : mockRecommendationsQuery}><Page fullWidth><BlockStack gap="300">
    <Card><BlockStack gap="100"><Text as="h2" variant="headingSm">V0.7.1 Branded</Text><Text as="p" tone="subdued">品牌化模板复用 Ready-to-go 的受控查询 Runtime 和标准数据模型。Logo、文案与链接在 Editor 中配置；颜色、字体和圆角由模板 Theme Token 与文档 Theme 共同决定。</Text>{!getSessionToken ? <Banner tone="info">独立模式使用显式 Mock Runtime；嵌入 Shopify 后使用受控 Live DataSource，失败不会回退为 Mock。</Banner> : null}</BlockStack></Card>
    {loadState === "ready" ? <PageDocumentEditorShell initialDocument={document} registry={registry} iframe={false} onDocumentChange={setDocument} onSave={(next) => save(next, "draft")} onPublish={(next) => save(next, "published")} /> : <Banner tone="info">正在加载 Branded 草稿…</Banner>}
    <Card><BlockStack gap="200"><Text as="h2" variant="headingSm">Consumer WebRenderer preview</Text><WebRenderer document={document} registry={registry} className="pb-web-renderer pb-web-renderer--demo" /></BlockStack></Card>
  </BlockStack></Page></BrandedRuntimeProvider>;
}
