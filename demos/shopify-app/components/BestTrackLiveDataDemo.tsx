"use client";

import { createExtensionRegistry } from "@standhigher/puck-page-builder/extensions";
import { Banner, BlockStack, Button, Card, InlineStack, Page, Text } from "@shopify/polaris";
import { useMemo, useState } from "react";
import { createBestTrackExtension } from "../lib/besttrack-extension";
import { type GetSessionToken } from "../lib/besttrack-data-source";
import { resolveBlockDataBinding } from "../lib/page-builder-data-binding";
import { v06LiveDataDocument } from "../lib/v0.6-live-data-document";

export function BestTrackLiveDataDemo({ getSessionToken }: { getSessionToken?: GetSessionToken }) {
  const [result, setResult] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [loading, setLoading] = useState<"mock" | "live" | null>(null);
  const registry = useMemo(() => createExtensionRegistry([createBestTrackExtension(getSessionToken)]), [getSessionToken]);
  const block = v06LiveDataDocument.blocks[0]!;

  const resolve = async (mode: "mock" | "live") => {
    setLoading(mode);
    setResult(undefined);
    setFailure(undefined);
    try {
      const data = await resolveBlockDataBinding(v06LiveDataDocument, block.id, registry, mode);
      setResult(JSON.stringify(data));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "besttrack-data-source-failed");
    } finally {
      setLoading(null);
    }
  };

  return <Page fullWidth>
    <Card>
      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="h2" variant="headingSm">V0.6 BestTrack Live Data Binding</Text>
          <Text as="p" tone="subdued">PageDocument 的 <code>besttrack.tracking-status</code> 区块绑定到 <code>{block.binding?.source}</code>。此演示只读取并渲染数据，不保存草稿或发布页面。</Text>
        </BlockStack>
        <InlineStack gap="200" wrap>
          <Button onClick={() => void resolve("mock")} loading={loading === "mock"}>验证 Mock 绑定</Button>
          <Button variant="primary" onClick={() => void resolve("live")} loading={loading === "live"} disabled={!getSessionToken}>请求 Live 物流数据</Button>
        </InlineStack>
        {!getSessionToken ? <Banner tone="info">Live 请求需在 Shopify 嵌入式应用中运行，并在 <code>.env.local</code> 设置 V0.6 的 BestTrack 服务端配置；本地独立模式仍可验证绑定与 Mock 数据。</Banner> : null}
        {result ? <pre data-testid="besttrack-bound-data">{result}</pre> : null}
        {failure ? <Banner tone="critical" title="数据源请求失败">{failure}</Banner> : null}
      </BlockStack>
    </Card>
  </Page>;
}
