import { createPageDocument, type BlockDefinition, type FieldConfig, type JsonValue, type PageBuilderExtension, type TemplateDefinition } from "@standhigher/puck-page-builder/runtime";
import { ReadyToGoDeliveryBlock, ReadyToGoDeliveryEditor, ReadyToGoProgressBlock, ReadyToGoProgressEditor, ReadyToGoQueryBlock, ReadyToGoQueryEditor, ReadyToGoRecommendationsBlock, ReadyToGoRecommendationsEditor, ReadyToGoTextField } from "./ready-to-go";
import { defineTemplatePolicy } from "./template-policy";

const text = (label: string, options: Partial<FieldConfig> = {}) => ({ field: "besttrack.ready-to-go.text", label, control: "text" as const, ...options });
function withTemplatePolicy(blocks: BlockDefinition[], protectedBlocks: readonly string[]): BlockDefinition[] {
  return blocks.map((block) => ({ ...block, policy: { singleton: true, ...(protectedBlocks.includes(block.type) ? { required: true, allowDelete: false } : {}) } }));
}
const readyToGoBlocks: BlockDefinition[] = withTemplatePolicy([
  {
    type: "besttrack.ready-to-go.query",
    version: 1,
    label: "Order query",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    defaultProps: {
      heading: "Track your order",
      submitLabel: "Track Your Order",
      submitButtonColor: "#111111",
      defaultTrackingNumber: "BT-2048-DEMO",
      defaultOrderNumber: "",
      defaultQueryMode: "tracking",
      trackingTabLabel: "Tracking Number",
      orderTabLabel: "Order Number"
    },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }],
    fields: {
      heading: text("Heading"),
      submitLabel: text("Button label"),
      submitButtonColor: { field: "besttrack.ready-to-go.text", label: "Button color", control: "color" as const, group: "Style" },
      defaultTrackingNumber: text("Default tracking number"),
      defaultOrderNumber: text("Default order number"),
      defaultQueryMode: text("Default query mode"),
      trackingTabLabel: text("Tracking tab label"),
      orderTabLabel: text("Order tab label")
    },
    render: { web: ReadyToGoQueryBlock, editor: ReadyToGoQueryEditor }
  },
  {
    type: "besttrack.ready-to-go.progress",
    version: 1,
    label: "Shipment progress",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    defaultProps: {},
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }],
    fields: {},
    render: { web: ReadyToGoProgressBlock, editor: ReadyToGoProgressEditor }
  },
  {
    type: "besttrack.ready-to-go.delivery",
    version: 1,
    label: "Delivery information",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    defaultProps: { heading: "Shipping Details", contentsHeading: "Package Contents", carrierHeading: "Carrier" },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }, { id: "compact", label: "Compact", theme: { spacing: "12px" } }],
    fields: {
      heading: text("Heading"),
      contentsHeading: text("Package contents heading"),
      carrierHeading: text("Carrier heading"),
      adImageUrl: { field: "besttrack.ready-to-go.asset", label: "Advertisement image", control: "asset", persist: false, group: "Advertisement" },
      adLinkUrl: { field: "besttrack.ready-to-go.url", label: "Advertisement link", control: "url", persist: false, group: "Advertisement", validation: { allowRelativeUrl: true, allowedUrlProtocols: ["https:", "http:"] } }
    },
    render: { web: ReadyToGoDeliveryBlock, editor: ReadyToGoDeliveryEditor }
  },
  {
    type: "besttrack.ready-to-go.recommendations",
    version: 1,
    label: "Recommended products",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    defaultProps: { heading: "You may also like...", products: [] },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }, { id: "grid", label: "Grid", theme: { "color.surface": "#ffffff" } }],
    fields: {
      heading: text("Heading"),
      products: { field: "besttrack.ready-to-go.products", label: "推荐商品 (Shopify)", control: "products", group: "Content" }
    },
    render: { web: ReadyToGoRecommendationsBlock, editor: ReadyToGoRecommendationsEditor }
  }
], ["besttrack.ready-to-go.query"]);

export const readyToGoTemplatePolicy = defineTemplatePolicy(
  "besttrack.ready-to-go",
  "Ready-to-go",
  readyToGoBlocks.map((block) => block.type),
  ["besttrack.ready-to-go.query"]
);

export function createReadyToGoTemplate(): TemplateDefinition {
  return {
    id: "besttrack.ready-to-go",
    version: 1,
    name: "Ready-to-go",
    target: "web",
    source: "built-in",
    requiredBlocks: readyToGoBlocks.map((block) => block.type),
    theme: {
      "color.primary": "#111111",
      "color.background": "#ffffff",
      "color.surface": "#ffffff",
      "color.text": "#0f172a",
      "color.muted": "#64748b",
      "color.border": "#cbd5e1",
      "font.family": "Inter, system-ui, sans-serif",
      radius: "8px",
      spacing: "24px"
    },
    create: () => createPageDocument({
      pageId: "besttrack-ready-to-go",
      target: "web",
      templateId: "besttrack.ready-to-go",
      templateVersion: 1,
      settings: { locale: "en", seoTitle: "Track your order" },
      blocks: readyToGoBlocks.map((block, index) => ({
        id: `ready-to-go-${index + 1}`,
        type: block.type,
        version: block.version,
        props: block.defaultProps as Record<string, JsonValue>,
        variant: block.defaultVariant,
        style: {}
      }))
    })
  };
}

export const bestTrackPageExtension: PageBuilderExtension = Object.freeze({
  name: "besttrack.ready-to-go",
  version: "0.7.0",
  fields: [{ type: "besttrack.ready-to-go.text", component: ReadyToGoTextField }],
  blocks: readyToGoBlocks,
  templates: [createReadyToGoTemplate()]
});
