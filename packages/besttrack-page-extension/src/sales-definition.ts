import { createPageDocument, type BlockDefinition, type FieldConfig, type JsonValue, type PageBuilderExtension, type TemplateDefinition, type ValidationIssue } from "@standhigher/puck-page-builder/runtime";
import { SalesAnnouncementBlock, SalesOrderItemsBlock, SalesOtherTrackingBlock, SalesProductCategoriesBlock, SalesQueryBlock, SalesRecommendationsBlock, SalesServiceCardsBlock, SalesTextField } from "./sales";

const trackingNumberPattern = /^[A-Za-z0-9-]{4,64}$/;
const text = (label: string, options: Partial<FieldConfig> = {}) => ({ field: "besttrack.sales.text", label, control: "text" as const, required: true, ...options });
const shortText = (label: string, description?: string) => text(label, { description, group: "Content" });
const longText = (label: string, description?: string) => text(label, { control: "textarea", description, group: "Content" });
const link = (label: string, description?: string) => text(label, { control: "url", description: description ?? "Use a site-relative path or HTTPS URL.", group: "Links" });

function safeLink(value: unknown) {
  if (typeof value !== "string") return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") && !value.includes("\\") && !hasControlCharacter(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
function hasControlCharacter(value: string) { return [...value].some((character) => character.charCodeAt(0) < 32); }
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
  if (typeof trackingNumber !== "string" || !trackingNumberPattern.test(trackingNumber)) issues.push({ path: "props.defaultTrackingNumber", message: "Use 4–64 letters, numbers, or hyphens. Use a non-sensitive preview placeholder only." });
  return issues;
}
function validateCategories(props: Record<string, unknown>) {
  const issues = textProps([["heading", 120], ["collectionId", 256], ["collectionLabel", 120]])(props);
  if (!safeLink(props.collectionHref)) issues.push({ path: "props.collectionHref", message: "Use a site-relative path or HTTPS URL." });
  return issues;
}

const salesBlocks: BlockDefinition[] = [
  { type: "besttrack.sales.announcement", version: 1, label: "Announcement", category: "BestTrack Sales", targets: ["web"], defaultProps: { message: "Free delivery on orders over $50" }, defaultVariant: "commerce", variants: [{ id: "commerce", label: "Commerce" }, { id: "minimal", label: "Minimal", theme: { "color.primary": "#202223" } }], fields: { message: longText("Announcement", "Short, customer-facing promotion copy.") }, validate: textProps([["message", 280]]), render: { web: SalesAnnouncementBlock } },
  { type: "besttrack.sales.query", version: 1, label: "Order query", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Track an order", submitLabel: "Track order", defaultTrackingNumber: "BT-2048-DEMO" }, defaultVariant: "commerce", variants: [{ id: "commerce", label: "Commerce" }, { id: "compact", label: "Compact", theme: { spacing: "12px" } }], fields: { heading: shortText("Heading"), submitLabel: shortText("Button label"), defaultTrackingNumber: text("Default tracking number", { group: "Tracking settings", description: "Preview-only placeholder; never save a customer's tracking number." }) }, validate: validateQuery, render: { web: SalesQueryBlock } },
  { type: "besttrack.sales.order-items", version: 1, label: "Order items", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Items in your order" }, defaultVariant: "commerce", variants: [{ id: "commerce", label: "Commerce" }], fields: { heading: shortText("Heading") }, validate: textProps([["heading", 120]]), render: { web: SalesOrderItemsBlock } },
  { type: "besttrack.sales.other-tracking", version: 1, label: "Other tracking", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Other shipments", emptyMessage: "No other shipments are linked to this order." }, defaultVariant: "commerce", variants: [{ id: "commerce", label: "Commerce" }], fields: { heading: shortText("Heading"), emptyMessage: longText("Empty message") }, validate: textProps([["heading", 120], ["emptyMessage", 280]]), render: { web: SalesOtherTrackingBlock } },
  { type: "besttrack.sales.service-cards", version: 1, label: "Service cards", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Shop with confidence", firstTitle: "Easy returns", firstDescription: "Simple support when plans change.", secondTitle: "Secure delivery", secondDescription: "Follow every milestone in one place." }, defaultVariant: "commerce", variants: [{ id: "commerce", label: "Commerce" }], fields: { heading: shortText("Heading"), firstTitle: shortText("First card title"), firstDescription: longText("First card description"), secondTitle: shortText("Second card title"), secondDescription: longText("Second card description") }, validate: textProps([["heading", 120], ["firstTitle", 120], ["firstDescription", 280], ["secondTitle", 120], ["secondDescription", 280]]), render: { web: SalesServiceCardsBlock } },
  { type: "besttrack.sales.product-categories", version: 1, label: "Product categories", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Shop by category", collectionId: "gid://shopify/Collection/featured", collectionLabel: "Featured collection", collectionHref: "/collections/featured" }, defaultVariant: "commerce", variants: [{ id: "commerce", label: "Commerce" }, { id: "grid", label: "Grid", theme: { "color.surface": "#f8fafc" } }], fields: { heading: shortText("Heading"), collectionId: text("Collection ID", { group: "Resource", description: "JSON-only reference selected by an authorized integration." }), collectionLabel: shortText("Collection label"), collectionHref: link("Collection URL") }, validate: validateCategories, render: { web: SalesProductCategoriesBlock } },
  { type: "besttrack.sales.recommendations", version: 1, label: "Recommended products", category: "BestTrack Sales", targets: ["web"], defaultProps: { heading: "Complete your order" }, defaultVariant: "commerce", variants: [{ id: "commerce", label: "Commerce" }, { id: "grid", label: "Product grid", theme: { "color.surface": "#f8fafc" } }], fields: { heading: shortText("Heading") }, validate: textProps([["heading", 120]]), render: { web: SalesRecommendationsBlock } }
];

/** Stable Sales v1 document and block IDs are intentionally retained for published-page compatibility. */
export function createSalesTemplate(): TemplateDefinition {
  return { id: "besttrack.sales", version: 1, name: "Sales", target: "web", source: "built-in", requiredBlocks: salesBlocks.map((block) => block.type), theme: { "color.primary": "#dc2626", "color.background": "#fffaf5", "color.surface": "#ffffff", "color.text": "#1c1917", "color.border": "#fed7aa", "font.family": "system-ui, sans-serif", radius: "10px", spacing: "20px" }, create: () => createPageDocument({ pageId: "besttrack-sales", target: "web", templateId: "besttrack.sales", templateVersion: 1, settings: { locale: "en", seoTitle: "Shop and track your order" }, blocks: salesBlocks.map((block, index) => ({ id: "sales-" + (index + 1), type: block.type, version: block.version, props: block.defaultProps as Record<string, JsonValue>, variant: block.defaultVariant, style: {} })) }) };
}

export const bestTrackSalesExtension: PageBuilderExtension = Object.freeze({ name: "besttrack.sales", version: "0.7.2", fields: [{ type: "besttrack.sales.text", component: SalesTextField }], blocks: salesBlocks, templates: [createSalesTemplate()] });
