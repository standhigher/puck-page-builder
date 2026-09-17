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
    if (!getSessionToken) return { trackingNumber, status: "In transit", carrier: "BestTrack demo carrier", latestEvent: "Shipment accepted at the regional hub", deliveryAddress: "Demo recipient · Shanghai", orderItems: [{ id: "sample-order", title: "Studio tote", quantity: 1 }], recommendations: [{ id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery." }] };
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
