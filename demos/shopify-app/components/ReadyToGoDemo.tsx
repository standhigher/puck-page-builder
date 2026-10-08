"use client";

import { bestTrackPageExtension, ReadyToGoRuntimeProvider, type TrackingPageQuery, type TrackingPageRecommendationsQuery } from "@standhigher/besttrack-page-extension";
import { PageDocumentEditorShell } from "@standhigher/puck-page-builder";
import { createExtensionRegistry, migratePageDocument, WebRenderer, type PageDocument } from "@standhigher/puck-page-builder/runtime";
import { Banner, BlockStack, Card, Page, Text } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBestTrackExtension } from "../lib/besttrack-extension";
import type { GetSessionToken } from "../lib/besttrack-data-source";

// 推荐已从查单结果中分离，独立模式通过此回调演示“未查单也能加载推荐”。
// 定义在组件外使回调身份稳定，编辑文档或切换查询结果造成重渲染时不会重启推荐请求。
const mockRecommendationsQuery: TrackingPageRecommendationsQuery = async () => [{ id: "shipping-protection", title: "Shipping protection", description: "Extra assurance for your next delivery." }];

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
    if (!getSessionToken) {
      // 不同号码返回不同状态，便于连续查询后检查历史恢复是否真正切回了缓存结果。
      const lookups: Record<string, { status: string; carrier: string; latestEvent: string }> = {
        "BT-2048-DEMO": { status: "In transit", carrier: "BestTrack North", latestEvent: "Shipment accepted at the regional hub" },
        "BT-2049-DEMO": { status: "Delivered", carrier: "BestTrack Express", latestEvent: "Left at the front door" },
        "BT-2050-DEMO": { status: "Out for Delivery", carrier: "BestTrack City", latestEvent: "With the local courier" }
      };
      // 未列出的输入继续使用通用演示结果，便于测试第四条查询及重复号码的历史排序。
      const lookup = lookups[trackingNumber] ?? { status: "In transit", carrier: "BestTrack demo carrier", latestEvent: "Shipment accepted at the regional hub" };
      // Demo 仅为订单查询构造两个包裹。这里的模式判断控制模拟数据，不是第二层的显示规则；
      // 真实返回只要含多个 shipments，运单号查询同样能切换包裹，且不占用最近三条查询记录。
      const shipments = request.mode === "order"
        ? [
            { id: `${trackingNumber}-a`, label: `${trackingNumber}-A`, trackingNumber: `${trackingNumber}-A`, status: lookup.status, carrier: lookup.carrier },
            { id: `${trackingNumber}-b`, label: `${trackingNumber}-B`, trackingNumber: `${trackingNumber}-B`, status: "Out for Delivery", carrier: "BestTrack Local" }
          ]
        : undefined;
      return {
        trackingNumber,
        status: lookup.status,
        carrier: lookup.carrier,
        latestEvent: lookup.latestEvent,
        destination: "Shanghai",
        shipments,
      };
    }
    // 此 Demo 的 Live DataSource 目前只接通运单号查询；表单支持订单模式不代表该宿主已接通接口。
    // 未配置的订单查询直接抛错，由共用 Runtime 展示受控错误，不使用上面的 Mock 结果冒充成功。
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

  // 商家未选品时，业务后端默认返回该店铺前 8 个产品；此 Demo 的 Live 尚未接入推荐回调或 transport。
  // 这里只向独立 Mock 模式注入模拟推荐，不代表正式业务要求商家必须手动选品。
  // 编辑器和下面的 WebRenderer 同处一个 Provider 内，文档配置改变不会另建一份查询缓存。
  return <ReadyToGoRuntimeProvider query={query} queryRecommendations={getSessionToken ? undefined : mockRecommendationsQuery}>
    <Page fullWidth>
      <BlockStack gap="300">
        <Card>
          <BlockStack gap="100">
            <Text as="h2" variant="headingSm">V0.7.0 Ready-to-go</Text>
            <Text as="p" tone="subdued">编辑器、Mock/Live Preview 与消费者 Web 渲染复用同一套区块定义和 <code>WebRenderer</code>。所有结果区块订阅同一个受控 RuntimeState。</Text>
            {!getSessionToken ? <Banner tone="info">独立模式使用显式 Mock Runtime。连续查询 BT-2048-DEMO、BT-2049-DEMO、BT-2050-DEMO，结果区会留下最近 3 条。</Banner> : null}
          </BlockStack>
        </Card>
        {loadState === "ready" ? <PageDocumentEditorShell initialDocument={document} registry={registry} iframe={false} productPicker={{ async selectProducts({ current }) { return current.length ? current : [{ id: "gid://shopify/Product/101", title: "Studio Wireless Headphones", imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80" }, { id: "gid://shopify/Product/102", title: "Cloud Buds Pro", imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=200&q=80" }, { id: "gid://shopify/Product/103", title: "Compact Mechanical Keyboard", imageUrl: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=200&q=80" }, { id: "gid://shopify/Product/104", title: "Travel tote", imageUrl: "https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=200&q=80" }]; } }} onDocumentChange={setDocument} onSave={(next) => save(next, "draft")} onPublish={(next) => save(next, "published")} /> : <Banner tone="info">正在加载 Ready-to-go 草稿…</Banner>}
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
