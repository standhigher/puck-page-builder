"use client";

import { bestTrackSalesExtension, isShopifyResourceReference, resolveShopifyResources, SalesRuntimeProvider, ShopifyResourcePickerProvider, type ShopifyResolvedResource, type ShopifyResourceBrowser, type ShopifyResourceReference, type ShopifyResourceResolver, type TrackingPageQuery } from "@standhigher/besttrack-page-extension";
import { PageDocumentEditorShell } from "@standhigher/puck-page-builder";
import { createExtensionRegistry, migratePageDocument, WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { Banner, BlockStack, Card, Page, Text } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBestTrackExtension } from "../lib/besttrack-extension";
import type { GetSessionToken } from "../lib/besttrack-data-source";
import { createShopifyResourceBrowser, createShopifyResourceResolver } from "../lib/shopify-resource-client";

const localResources: ShopifyResourceReference[] = [
  { id: "gid://shopify/Collection/1", kind: "collection", title: "Featured collection", handle: "featured" },
  { id: "gid://shopify/Collection/2", kind: "collection", title: "New arrivals", handle: "new-arrivals" },
  { id: "gid://shopify/Product/1", kind: "product", title: "Featured product", handle: "featured-product" },
  { id: "gid://shopify/Product/2", kind: "product", title: "Travel case", handle: "travel-case" }
];

const localBrowser: ShopifyResourceBrowser = { async search({ kinds, query, cursor, limit }) {
  const start = cursor ? Number(cursor) : 0;
  const filtered = localResources.filter((item) => kinds.includes(item.kind) && item.title.toLowerCase().includes(query.toLowerCase()));
  const items = filtered.slice(start, start + limit);
  return { items, ...(start + items.length < filtered.length ? { nextCursor: String(start + items.length) } : {}) };
} };

const localResolver: ShopifyResourceResolver = { async resolve({ references }) {
  return references.map((reference): ShopifyResolvedResource => ({ ...reference, status: "resolved", availability: reference.kind === "product" ? "available" : "unknown", href: `/${reference.kind === "product" ? "products" : "collections"}/${reference.handle ?? ""}` }));
} };

function documentResources(document: PageDocument): ShopifyResourceReference[] {
  return document.blocks.flatMap((block) => [block.props.collection, block.props.product]).filter((value): value is ShopifyResourceReference => isShopifyResourceReference(value));
}

export function SalesDemo({ getSessionToken }: { getSessionToken?: GetSessionToken }) {
  const registry = useMemo(() => createExtensionRegistry([bestTrackSalesExtension, createBestTrackExtension(getSessionToken)]), [getSessionToken]);
  const initialDocument = useMemo(() => registry.getTemplate("besttrack.sales")!.create(), [registry]);
  const [document, setDocument] = useState<PageDocument>(initialDocument);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [resourceResolution, setResourceResolution] = useState<Awaited<ReturnType<typeof resolveShopifyResources>>>({ resources: {}, errors: {} });
  const resourceBrowser = useMemo(() => getSessionToken ? createShopifyResourceBrowser(getSessionToken) : localBrowser, [getSessionToken]);
  const resourceResolver = useMemo(() => getSessionToken ? createShopifyResourceResolver(getSessionToken) : localResolver, [getSessionToken]);
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
  useEffect(() => {
    let active = true;
    void resolveShopifyResources(documentResources(document), resourceResolver).then((result) => { if (active) setResourceResolution(result); });
    return () => { active = false; };
  }, [document, resourceResolver]);
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
  return <ShopifyResourcePickerProvider browser={resourceBrowser}><SalesRuntimeProvider query={query} resourceResolution={resourceResolution}><Page fullWidth><BlockStack gap="300">
    <Card><BlockStack gap="100"><Text as="h2" variant="headingSm">V0.8 Shopify resources</Text><Text as="p" tone="subdued">商品与集合字段通过受信宿主浏览、搜索和分页；文档只保存稳定 ID 与最小展示文案。产品可售性由短暂 Runtime 结果提供，模板不会请求 Shopify Admin API。</Text>{!getSessionToken ? <Banner tone="info">独立模式使用显式本地资源 Runtime；嵌入 Shopify 后资源请求会携带 Session Token 到服务端 BFF，Live 失败不会回退为 Mock。</Banner> : null}</BlockStack></Card>
    {loadState === "ready" ? <PageDocumentEditorShell initialDocument={document} registry={registry} iframe={false} onDocumentChange={setDocument} onSave={(next) => save(next, "draft")} onPublish={(next) => save(next, "published")} /> : <Banner tone="info">正在加载 Sales 草稿…</Banner>}
    <Card><BlockStack gap="200"><Text as="h2" variant="headingSm">Consumer WebRenderer preview</Text><WebRenderer document={document} registry={registry} className="pb-web-renderer pb-web-renderer--demo" /></BlockStack></Card>
  </BlockStack></Page></SalesRuntimeProvider></ShopifyResourcePickerProvider>;
}
