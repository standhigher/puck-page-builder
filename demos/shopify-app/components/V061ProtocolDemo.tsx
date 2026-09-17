"use client";

import { bestTrackPageExtension } from "@standhigher/besttrack-page-extension";
import { createExtensionRegistry, createPageDocument, WebRenderer } from "@standhigher/puck-page-builder/runtime";
import { BlockStack, Card, Page, Text } from "@shopify/polaris";
import { bestTrackExtension } from "../lib/besttrack-extension";

const registry = createExtensionRegistry([bestTrackPageExtension, bestTrackExtension]);
const document = createPageDocument({
  pageId: "v061-protocol-demo",
  target: "web",
  templateId: "besttrack.tracking.ready-to-go",
  templateVersion: 1,
  theme: { "color.primary": "#008060" },
  settings: { locale: "en", seoTitle: "V0.6.1 protocol check" },
  blocks: [{
    id: "variant-status",
    type: "besttrack.tracking-status",
    version: 1,
    variant: "emphasis",
    style: { "color.primary": "#d72c0d" },
    props: { heading: "Theme and Variant protocol", status: "Storefront-safe runtime entry" }
  }]
});

export function V061ProtocolDemo() {
  const template = registry.getTemplate(document.templateId!);
  return <Page fullWidth>
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingSm">V0.6.1 protocol validation</Text>
        <Text as="p" tone="subdued">The consumer preview imports only <code>@standhigher/puck-page-builder/runtime</code>. The block below has a template, page theme, Variant theme, and block Token override.</Text>
        <Text as="p">Template source: {template?.source ?? "unavailable"} · Variant: {document.blocks[0]?.variant}</Text>
        <WebRenderer document={document} registry={registry} className="pb-web-renderer pb-web-renderer--demo" />
      </BlockStack>
    </Card>
  </Page>;
}
