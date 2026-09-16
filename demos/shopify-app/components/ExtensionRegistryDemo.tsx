"use client";

import { createExtensionRegistry } from "@standhigher/puck-page-builder/extensions";
import { Banner, BlockStack, Button, Card, Checkbox, InlineStack, Page, Text } from "@shopify/polaris";
import { useMemo, useState } from "react";
import { bestTrackExtension } from "../lib/besttrack-extension";
import { demoPageDocument } from "../lib/page-document-demo";
import { DraftPageDocumentEditor } from "./DraftPageDocumentEditor";

export function ExtensionRegistryDemo() {
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [fieldValue, setFieldValue] = useState("calm");
  const registry = useMemo(() => createExtensionRegistry([bestTrackExtension], { disabled: enabled ? [] : [bestTrackExtension.name] }), [enabled]);
  const template = registry.templates[0];
  const action = registry.actions[0];
  const Field = registry.fields[0]?.component;
  const ToolbarSlot = registry.getSlot("toolbar.right")[0]?.component;

  return <>
    <Page fullWidth>
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <BlockStack gap="100"><Text as="h2" variant="headingSm">V0.3 Extension Registry</Text><Text as="p" tone="subdued">BestTrack 扩展通过独立 Registry 装配；未改动 Page Builder Core。</Text></BlockStack>
            <Checkbox label="启用 BestTrack 扩展" checked={enabled} onChange={setEnabled} />
          </InlineStack>
          {enabled ? <InlineStack gap="200" wrap>
            <Text as="span">Block: {registry.blocks[0]?.type}</Text><Text as="span">Field: {registry.fields[0]?.type}</Text><Text as="span">Template: {template?.id}</Text><Text as="span">UI Slot: {registry.getSlot("toolbar.right")[0]?.id}</Text>
          </InlineStack> : <Banner tone="info">扩展已禁用：Block、Field、Toolbar Action、Template、DataSource 和 UI Slot 均未装配。</Banner>}
          {enabled && action && template ? <InlineStack gap="200" wrap>
            <Button onClick={() => void action.execute({ document: demoPageDocument, pageId: demoPageDocument.pageId, notify: setNotice })}>{action.label}</Button>
            <Button onClick={() => setNotice(`Template 已创建：${template.create().pageId}`)}>验证 Template</Button>
            {Field ? <Field value={fieldValue} onChange={(value) => setFieldValue(typeof value === "string" ? value : "calm")} /> : null}
            {ToolbarSlot ? <ToolbarSlot /> : null}
            {notice ? <span role="status"><Text as="span">{notice}</Text></span> : null}
          </InlineStack> : null}
        </BlockStack>
      </Card>
    </Page>
    <DraftPageDocumentEditor initialDocument={demoPageDocument} registry={registry} />
  </>;
}
