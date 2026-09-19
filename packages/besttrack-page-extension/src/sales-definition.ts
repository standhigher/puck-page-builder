import { createPageDocument, type BlockDefinition, type FieldConfig, type JsonValue, type PageBuilderExtension, type TemplateDefinition, type ValidationIssue } from "@standhigher/puck-page-builder/runtime";
import { SalesAnnouncementBlock, SalesAnnouncementEditor, SalesFeaturedProductBlock, SalesFeaturedProductEditor, SalesOrderItemsBlock, SalesOrderItemsEditor, SalesOtherTrackingBlock, SalesOtherTrackingEditor, SalesProductCategoriesBlock, SalesProductCategoriesEditor, SalesQueryBlock, SalesQueryEditor, SalesRecommendationsBlock, SalesRecommendationsEditor, SalesServiceCardsBlock, SalesServiceCardsEditor, SalesTextField } from "./sales";
import { defineTemplatePolicy } from "./template-policy";
import { isValidTrackingNumber } from "./tracking-page-runtime";
import { isSafeTrackingPageUrl } from "./tracking-page-url";
import { isShopifyResourceReference, ShopifyCollectionResourceField, ShopifyProductResourceField } from "./shopify-resources";

const text = (label: string, options: Partial<FieldConfig> = {}) => ({ field: "besttrack.sales.text", label, control: "text" as const, required: true, ...options });
const shortText = (label: string, description?: string) => text(label, { description, group: "Content" });
const longText = (label: string, description?: string) => text(label, { control: "textarea", description, group: "Content" });
function requiredString(props: Record<string, unknown>, key: string, issues: ValidationIssue[], maxLength = 160) {
  const value = props[key];
  if (typeof value !== "string" || !value.trim()) issues.push({ path: `props.${key}`, message: "A non-empty value is required." });
  else if (value.length > maxLength) issues.push({ path: `props.${key}`, message: `Must be at most ${maxLength} characters.` });
}
function textProps(keys: Array<[string, number]>) {
  return (props: Record<string, unknown>) => {
    const issues: ValidationIssue[] = [];
    keys.forEach(([key, maxLength]) => requiredString(props, key, issues, maxLength));
    return issues;
  };
}
function validateQuery(props: Record<string, unknown>) {
  const issues = textProps([["heading", 120], ["submitLabel", 80]])(props);
  const trackingNumber = props.defaultTrackingNumber;
  if (typeof trackingNumber !== "string" || !isValidTrackingNumber(trackingNumber)) issues.push({ path: "props.defaultTrackingNumber", message: "Use 6–64 letters, numbers, hyphens, or underscores. Use a non-sensitive preview placeholder only." });
  if (props.heroImageUrl !== undefined && !safeImage(props.heroImageUrl)) issues.push({ path: "props.heroImageUrl", message: "Use an HTTPS URL for the merchant-configured hero image." });
  return issues;
}
function safeImage(value: unknown) {
  return isSafeTrackingPageUrl(value);
}
function validateCategories(props: Record<string, unknown>) {
  const issues = textProps([["heading", 120]])(props);
  if (!isShopifyResourceReference(props.collection, "collection")) issues.push({ path: "props.collection", message: "Select a Shopify collection through an authorized resource integration." });
  return issues;
}
function validateFeaturedProduct(props: Record<string, unknown>) {
  const issues = textProps([["heading", 120]])(props);
  if (!isShopifyResourceReference(props.product, "product")) issues.push({ path: "props.product", message: "Select a Shopify product through an authorized resource integration." });
  return issues;
}

function withTemplatePolicy(blocks: BlockDefinition[], protectedBlocks: readonly string[]): BlockDefinition[] {
  return blocks.map((block) => ({ ...block, policy: { singleton: true, ...(protectedBlocks.includes(block.type) ? { required: true, allowDelete: false } : {}) } }));
}
const salesBlocks: BlockDefinition[] = withTemplatePolicy([
  { type: "besttrack.sales.announcement", version: 1, label: "Announcement", category: "BestTrack Sales", targets: ["web"], defaultProps: { message: "Free delivery on orders over $50" }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }, { id: "minimal", label: "Minimal", theme: { "color.primary": "#202223" } }], fields: { message: longText("Announcement", "Short, customer-facing promotion copy.") }, validate: textProps([["message", 280]]), render: { web: SalesAnnouncementBlock, editor: SalesAnnouncementEditor } },
  { type: "besttrack.sales.query", version: 1, label: "Order query", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Track your order", submitLabel: "Track order", defaultTrackingNumber: "BT-2048-DEMO", defaultOrderNumber: "", heroImageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=85" }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }, { id: "compact", label: "Compact", theme: { spacing: "12px" } }], fields: { heading: shortText("Heading"), submitLabel: shortText("Button label"), defaultTrackingNumber: text("Default tracking number", { group: "Tracking settings", description: "Preview-only placeholder; never save a customer's tracking number." }), defaultOrderNumber: text("Default order number", { group: "Tracking settings", description: "Preview-only placeholder; never save a customer's order number." }), heroImageUrl: text("Hero image URL", { control: "url", group: "Hero asset", description: "Merchant-configured HTTPS image. It is rendered as an image element, never as CSS.", validation: { allowRelativeUrl: false, allowedUrlProtocols: ["https:"], allowLocalhost: true } }) }, validate: validateQuery, render: { web: SalesQueryBlock, editor: SalesQueryEditor } },
  { type: "besttrack.sales.order-items", version: 1, label: "Order items", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Items in your order" }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }], fields: { heading: shortText("Heading") }, validate: textProps([["heading", 120]]), render: { web: SalesOrderItemsBlock, editor: SalesOrderItemsEditor } },
  { type: "besttrack.sales.other-tracking", version: 1, label: "Other tracking", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Other shipments", emptyMessage: "No other shipments are linked to this order." }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }], fields: { heading: shortText("Heading"), emptyMessage: longText("Empty message") }, validate: textProps([["heading", 120], ["emptyMessage", 280]]), render: { web: SalesOtherTrackingBlock, editor: SalesOtherTrackingEditor } },
  { type: "besttrack.sales.service-cards", version: 1, label: "Service cards", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Shop with confidence", firstTitle: "Easy returns", firstDescription: "Simple support when plans change.", secondTitle: "Secure delivery", secondDescription: "Follow every milestone in one place." }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }], fields: { heading: shortText("Heading"), firstTitle: shortText("First card title"), firstDescription: longText("First card description"), secondTitle: shortText("Second card title"), secondDescription: longText("Second card description") }, validate: textProps([["heading", 120], ["firstTitle", 120], ["firstDescription", 280], ["secondTitle", 120], ["secondDescription", 280]]), render: { web: SalesServiceCardsBlock, editor: SalesServiceCardsEditor } },
  { type: "besttrack.sales.product-categories", version: 3, label: "Product categories", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Shop by category", collection: { id: "gid://shopify/Collection/1", kind: "collection", title: "Featured collection", handle: "featured" } }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }, { id: "grid", label: "Grid", theme: { "color.surface": "#f8fafc" } }], fields: { heading: shortText("Heading"), collection: { field: "besttrack.shopify.collection", label: "Collection", group: "Resource", description: "Browse through an authorized host integration. Only a stable ID and minimal display copy are saved." } }, validate: validateCategories, render: { web: SalesProductCategoriesBlock, editor: SalesProductCategoriesEditor } },
  { type: "besttrack.sales.featured-product", version: 1, label: "Featured product", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Featured product", product: { id: "gid://shopify/Product/1", kind: "product", title: "Featured product", handle: "featured-product" } }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }], fields: { heading: shortText("Heading"), product: { field: "besttrack.shopify.product", label: "Product", group: "Resource", description: "Browse through an authorized host integration. Current availability is resolved only at runtime." } }, validate: validateFeaturedProduct, render: { web: SalesFeaturedProductBlock, editor: SalesFeaturedProductEditor } },
  { type: "besttrack.sales.recommendations", version: 1, label: "Recommended products", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Complete your order" }, defaultVariant: "hero", variants: [{ id: "hero", label: "Sales Hero" }, { id: "commerce", label: "Commerce" }, { id: "grid", label: "Product grid", theme: { "color.surface": "#f8fafc" } }], fields: { heading: shortText("Heading") }, validate: textProps([["heading", 120]]), render: { web: SalesRecommendationsBlock, editor: SalesRecommendationsEditor } }
], ["besttrack.sales.announcement", "besttrack.sales.query"]);

export const salesTemplatePolicy = defineTemplatePolicy(
  "besttrack.sales",
  "Sales",
  salesBlocks.map((block) => block.type),
  ["besttrack.sales.announcement", "besttrack.sales.query"]
);

/** Sales v3 uses stable IDs and JSON-only Shopify resource references in new documents. */
export function createSalesTemplate(): TemplateDefinition {
  return { id: "besttrack.sales", version: 3, name: "Sales", target: "web", source: "built-in", requiredBlocks: salesBlocks.map((block) => block.type), theme: { "color.primary": "#000000", "color.background": "#f7f5f0", "color.surface": "#ffffff", "color.text": "#0a0a0a", "color.muted": "#6b6b6b", "color.border": "#dfddd7", "font.family": "Arial, Helvetica, sans-serif", radius: "10px", spacing: "24px" }, create: () => createPageDocument({ pageId: "besttrack-sales", target: "web", templateId: "besttrack.sales", templateVersion: 3, settings: { locale: "en", seoTitle: "Shop and track your order" }, blocks: salesBlocks.map((block, index) => ({ id: "sales-" + (index + 1), type: block.type, version: block.version, props: block.defaultProps as Record<string, JsonValue>, variant: block.defaultVariant, style: {} })) }) };
}

export const bestTrackSalesExtension: PageBuilderExtension = Object.freeze({ name: "besttrack.sales", version: "0.8.0", fields: [{ type: "besttrack.sales.text", component: SalesTextField }, { type: "besttrack.shopify.collection", component: ShopifyCollectionResourceField }, { type: "besttrack.shopify.product", component: ShopifyProductResourceField }], blocks: salesBlocks, templates: [createSalesTemplate()] });
