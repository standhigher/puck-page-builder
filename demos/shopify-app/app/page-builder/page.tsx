"use client";

import { EditorShell } from "@standhigher/puck-page-builder";
import { NavMenu, useAppBridge } from "@shopify/app-bridge-react";
import { AppProvider, Banner, BlockStack, Button, Page } from "@shopify/polaris";
import { useAppBridgeStatus } from "../../components/AppBridgeLoader";

function AppBridgeStatus() {
  const shopify = useAppBridge();
  return <Button size="slim" onClick={() => shopify.toast.show("Demo App Bridge 已就绪")}>验证 App Bridge</Button>;
}

export default function PageBuilderPage() {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const appBridgeStatus = useAppBridgeStatus();
  return <AppProvider i18n={{}}>
    {appBridgeStatus === "ready" ? <NavMenu><a href="/page-builder" rel="home">Page Builder</a></NavMenu> : null}
    <Page fullWidth>
      <BlockStack gap="300">
        {!apiKey ? <Banner tone="warning" title="Shopify 开发店铺尚未配置">复制 <code>.env.example</code> 为 <code>.env.local</code> 并填写 App Client ID；本地编辑器演示仍可运行。</Banner> : null}
        {appBridgeStatus === "ready" ? <AppBridgeStatus /> : <Banner tone={appBridgeStatus === "failed" ? "critical" : "info"} title={appBridgeStatus === "standalone" ? "独立本地演示模式" : appBridgeStatus === "failed" ? "App Bridge 加载失败" : "正在加载 App Bridge"}>{appBridgeStatus === "standalone" ? "直接访问 localhost 时不会加载 App Bridge。通过 Shopify 开发店铺打开此页面后，会自动启用嵌入式功能。" : "编辑器本地演示不受影响；嵌入式 Shopify 功能将在 App Bridge 就绪后启用。"}</Banner>}
      </BlockStack>
    </Page>
    <EditorShell />
  </AppProvider>;
}
