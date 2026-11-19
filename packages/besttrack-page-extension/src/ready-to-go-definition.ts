import { DeliveryIcon, ProductIcon, SearchIcon, StatusIcon } from "@shopify/polaris-icons";
import { createPageDocument, validateFieldValue, type BlockDefinition, type FieldConfig, type JsonValue, type PageBuilderExtension, type TemplateDefinition } from "@standhigher/puck-page-builder/runtime";
import { ReadyToGoDeliveryBlock, ReadyToGoDeliveryEditor, ReadyToGoPixelField, ReadyToGoInputRadiusField, ReadyToGoButtonRadiusField, ReadyToGoShadowStrengthField, ReadyToGoProgressBlock, ReadyToGoProgressEditor, ReadyToGoQueryBlock, ReadyToGoQueryEditor, ReadyToGoRecommendationsBlock, ReadyToGoRecommendationsEditor, ReadyToGoTextField, ReadyToGoToggleField } from "./ready-to-go";
import { READY_TO_GO_INPUT_RADIUS_FIELD, READY_TO_GO_BUTTON_RADIUS_FIELD, READY_TO_GO_SHADOW_FIELD, READY_TO_GO_PIXEL_FIELD, readyToGoModuleStyleDefaults, readyToGoModuleStyleFields, validateReadyToGoModuleStyle } from "./ready-to-go-module-style";
import { defineTemplatePolicy } from "./template-policy";

const text = (label: string, options: Partial<FieldConfig> = {}) => ({ field: "besttrack.ready-to-go.text", label, control: "text" as const, ...options });
function withTemplatePolicy(blocks: BlockDefinition[], protectedBlocks: readonly string[]): BlockDefinition[] {
  return blocks.map((block) => ({ ...block, policy: { singleton: true, ...(protectedBlocks.includes(block.type) ? { required: true, allowDelete: false } : {}) } }));
}
// 进度区显示背景色与进度色，文字按背景自动配色；配送区保留图片圆角和间距，推荐区仅保留背景色和图片圆角，查询区保留卡片与表单样式。
function withModuleStyle(block: BlockDefinition): BlockDefinition {
  const style = readyToGoModuleStyleFields(block.type);
  const validateStyle = validateReadyToGoModuleStyle(block.type);
  return {
    ...block,
    defaultProps: { ...block.defaultProps, ...readyToGoModuleStyleDefaults(block.type) },
    fields: block.type === "besttrack.ready-to-go.progress"
      ? { backgroundColor: style.backgroundColor, ...block.fields }
      : block.type === "besttrack.ready-to-go.delivery"
        ? { ...block.fields, backgroundColor: style.backgroundColor, imageRadius: style.imageRadius!, verticalSpacing: style.verticalSpacing }
        : block.type === "besttrack.ready-to-go.recommendations"
          ? { ...block.fields, backgroundColor: style.backgroundColor, imageRadius: style.imageRadius! }
          : { ...block.fields, ...style },
    validate: (props) => [...(block.validate?.(props) ?? []), ...validateStyle(props)]
  };
}
// 查询、进度、配送必须保留。推荐商品保持单例，允许删除，删掉后仍可从区块库加回。
// required/allowDelete 约束编辑器操作，singleton 禁止复制；无数据时是否隐藏由 Web 组件决定。
// 此处不会给已有缺块文档自动补区块，也不等同于读取文档时的完整性迁移。
const readyToGoBlocks: BlockDefinition[] = withTemplatePolicy(([
  {
    type: "besttrack.ready-to-go.query",
    icon: SearchIcon,
    version: 1,
    label: "Order query",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    defaultProps: {
      heading: "",
      submitLabel: "Track Your Order",
      submitButtonColor: "#111111",
      defaultTrackingNumber: "",
      defaultOrderNumber: "",
      emailPlaceholder: "",
      defaultQueryMode: "tracking",
      trackingTabLabel: "Tracking Number",
      orderTabLabel: "Order Number"
    },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }],
    fields: {
      submitLabel: text("Button label", { validation: { maxLength: 52 } }),
      submitButtonColor: { field: "besttrack.ready-to-go.text", label: "Button color", control: "color" as const, group: "Style" },
      // 保留已保存文档的字段名；这两项只配置输入框提示文案，不是查询初值。
      defaultTrackingNumber: text("Tracking number placeholder", { description: "输入框为空时显示的提示文案，不会作为运单号提交。", group: "Tracking settings", validation: { maxLength: 52 } }),
      defaultOrderNumber: text("Order number placeholder", { description: "输入框为空时显示的提示文案，不会作为订单号提交。", group: "Tracking settings" }),
      emailPlaceholder: text("Email placeholder", { description: "邮箱输入框为空时显示的提示文案，不会作为邮箱提交。", group: "Tracking settings", validation: { maxLength: 52 } }),
      trackingTabLabel: text("Tracking tab label", { validation: { maxLength: 52 } }),
      orderTabLabel: text("Order tab label", { validation: { maxLength: 52 } })
    },
    render: { web: ReadyToGoQueryBlock, editor: ReadyToGoQueryEditor }
  },
  {
    type: "besttrack.ready-to-go.progress",
    icon: StatusIcon,
    version: 1,
    label: "Shipment progress",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    // Declare the legacy prop for saved-document compatibility without exposing its control.
    defaultProps: { progressColor: "#0f172a", textColor: "#334155" },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }],
    fields: {
      progressColor: { field: "besttrack.ready-to-go.text", label: "Progress color", control: "color" as const, group: "Style" }
    },
    // Keep validating legacy saved values after removing their inspector control.
    validate: (props) => validateFieldValue({ field: "besttrack.ready-to-go.text", control: "color" }, props.textColor)
      .map((issue) => ({ ...issue, path: "props.textColor" })),
    render: { web: ReadyToGoProgressBlock, editor: ReadyToGoProgressEditor }
  },
  {
    type: "besttrack.ready-to-go.delivery",
    icon: DeliveryIcon,
    version: 1,
    label: "Delivery information",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    defaultProps: { heading: "Shipping Details", contentsHeading: "Package Contents", carrierHeading: "Carrier", showCarrier: true },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }, { id: "compact", label: "Compact", theme: { spacing: "12px" } }],
    fields: {
      heading: text("Heading", { validation: { maxLength: 52 } }),
      contentsHeading: text("Package contents heading", { validation: { maxLength: 52 } }),
      carrierHeading: text("Carrier heading", { description: "When off, hide the carrier.", validation: { maxLength: 52 }, toggle: { prop: "showCarrier", label: "Show carrier", disablesField: true } }),
      adImageUrl: { field: "besttrack.ready-to-go.asset", label: "Advertisement image", control: "asset", persist: false, group: "Advertisement" },
      adLinkUrl: { field: "besttrack.ready-to-go.url", label: "Advertisement link", control: "url", persist: false, group: "Advertisement", validation: { allowRelativeUrl: true, allowedUrlProtocols: ["https:", "http:"] } }
    },
    render: { web: ReadyToGoDeliveryBlock, editor: ReadyToGoDeliveryEditor }
  },
  {
    type: "besttrack.ready-to-go.recommendations",
    icon: ProductIcon,
    version: 1,
    label: "Recommended products",
    category: "BestTrack Ready-to-go",
    targets: ["web"],
    defaultProps: { heading: "You may also like...", products: [] },
    defaultVariant: "default",
    variants: [{ id: "default", label: "Default" }, { id: "grid", label: "Grid", theme: { "color.surface": "#ffffff" } }],
    fields: {
      heading: text("Heading", { validation: { maxLength: 100 } }),
      products: { field: "besttrack.ready-to-go.products", label: "推荐商品 (Store)", control: "products", group: "Content" }
    },
    render: { web: ReadyToGoRecommendationsBlock, editor: ReadyToGoRecommendationsEditor }
  }
] satisfies BlockDefinition[] as BlockDefinition[]).map(withModuleStyle), ["besttrack.ready-to-go.query", "besttrack.ready-to-go.progress", "besttrack.ready-to-go.delivery"]);

// 面向宿主的策略概览需与上面 BlockDefinition.policy 的保护名单保持一致。
export const readyToGoTemplatePolicy = defineTemplatePolicy(
  "besttrack.ready-to-go",
  "Ready-to-go",
  readyToGoBlocks.map((block) => block.type),
  ["besttrack.ready-to-go.query", "besttrack.ready-to-go.progress", "besttrack.ready-to-go.delivery"]
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
  fields: [
    { type: "besttrack.ready-to-go.text", component: ReadyToGoTextField },
    { type: "besttrack.ready-to-go.toggle", component: ReadyToGoToggleField },
    { type: READY_TO_GO_INPUT_RADIUS_FIELD, component: ReadyToGoInputRadiusField, rendersLabel: true },
    { type: READY_TO_GO_BUTTON_RADIUS_FIELD, component: ReadyToGoButtonRadiusField, rendersLabel: true },
    { type: READY_TO_GO_SHADOW_FIELD, component: ReadyToGoShadowStrengthField, rendersLabel: true },
    { type: READY_TO_GO_PIXEL_FIELD, component: ReadyToGoPixelField, rendersLabel: true }
  ],
  blocks: readyToGoBlocks,
  templates: [createReadyToGoTemplate()]
});
