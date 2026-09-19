"use client";

import { bestTrackPageExtension, ReadyToGoRuntimeProvider, type TrackingPageQuery } from "@standhigher/besttrack-page-extension";
import { PageDocumentEditorShell } from "@standhigher/puck-page-builder";
import { createExtensionRegistry, migratePageDocument, WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { Banner, BlockStack, Card, Page, Text } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBestTrackExtension } from "../lib/besttrack-extension";
import type { GetSessionToken } from "../lib/besttrack-data-source";

export function ReadyToGoDemo({ getSessionToken }: { getSessionToken?: GetSessionToken }) {
  const registry = useMemo(() => createExtensionRegistry([bestTrackPageExtension, createBestTrackExtension(getSessionToken)]), [getSessionToken]);
  const initialDocument = useMemo(() => registry.getTemplate("besttrack.ready-to-go")!.create(), [registry]);
  const [document, setDocument] = useState<PageDocument>(initialDocument);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/page-documents/${encodeURIComponent(initialDocument.pageId)}/draft`, { cache: "no-store" });
        if (response.ok) {
          const stored = await response.json() as { document: unknown };
          const migration = migratePageDocument(stored.document);
          if (!migration.success) throw new Error("ready-to-go-draft-invalid");
          if (active) setDocument(migration.data);
        } else if (response.status === 404 && active) {
          setDocument(initialDocument);
        } else if (!response.ok) {
          throw new Error(`ready-to-go-draft-load-${response.status}`);
        }
        if (active) setLoadState("ready");
      } catch {
        if (active) setLoadState("error");
      }
    };
    void load();
    return () => { active = false; };
  }, [initialDocument]);
  const query = useCallback<TrackingPageQuery>(async (request) => {
    const trackingNumber = request.mode === "tracking" ? request.trackingNumber : request.orderNumber;
    if (!getSessionToken) return { trackingNumber, status: "In transit", carrier: "BestTrack demo carrier", latestEvent: "Shipment accepted at the regional hub", destination: "Shanghai", recommendations: [{ id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery." }] };
    if (request.mode !== "tracking") throw new Error("demo-order-query-not-configured");
    const source = registry.getDataSource("besttrack.tracking.query");
    if (!source) throw new Error("besttrack-tracking-source-not-registered");
    return source.live({ trackingNumber }) as Promise<Awaited<ReturnType<TrackingPageQuery>>>;
  }, [getSessionToken, registry]);

  const save = async (next: PageDocument, resource: "draft" | "published") => {
    const response = await fetch(`/api/page-documents/${encodeURIComponent(next.pageId)}/${resource}`, { method: resource === "draft" ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) throw new Error(`ready-to-go-${resource}-save-${response.status}`);
  };
  if (loadState === "error") return <Page fullWidth><Banner tone="critical" title="无法加载 Ready-to-go 草稿">草稿未通过 PageDocument 校验，编辑器未打开。</Banner></Page>;

  return <ReadyToGoRuntimeProvider query={query}>
    <Page fullWidth>
      <BlockStack gap="300">
        <Card>
          <BlockStack gap="100">
            <Text as="h2" variant="headingSm">V0.7.0 Ready-to-go</Text>
            <Text as="p" tone="subdued">编辑器、Mock/Live Preview 与消费者 Web 渲染复用同一套区块定义和 <code>WebRenderer</code>。所有结果区块订阅同一个受控 RuntimeState。</Text>
            {!getSessionToken ? <Banner tone="info">独立模式使用显式 Mock Runtime；在 Shopify 嵌入式应用中会改用受控的 Live DataSource，失败不会回退为 Mock。</Banner> : null}
          </BlockStack>
        </Card>
        {loadState === "ready" ? <PageDocumentEditorShell initialDocument={document} registry={registry} iframe={false} onDocumentChange={setDocument} onSave={(next) => save(next, "draft")} onPublish={(next) => save(next, "published")} /> : <Banner tone="info">正在加载 Ready-to-go 草稿…</Banner>}
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingSm">Consumer WebRenderer preview</Text>
            <WebRenderer document={document} registry={registry} className="pb-web-renderer pb-web-renderer--demo" />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  </ReadyToGoRuntimeProvider>;
}
