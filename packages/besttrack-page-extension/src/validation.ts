import type { BlockDefinition, FieldConfig, PageBuilderExtension, TemplateDefinition, ValidationIssue } from "@standhigher/puck-page-builder/runtime";
import { isValidTrackingNumber } from "./tracking-page-runtime";
import { isSafeTrackingPageUrl } from "./tracking-page-url";

const textField: FieldConfig = { field: "besttrack.validation.text", control: "text" };
const strictUrlField: FieldConfig = {
  field: "besttrack.validation.url",
  control: "url",
  validation: { allowRelativeUrl: false, allowedUrlProtocols: ["https:"], allowLocalhost: true }
};

function fields(keys: readonly string[], urlKeys: readonly string[] = []) {
  return Object.fromEntries(keys.map((key) => [key, urlKeys.includes(key) ? strictUrlField : textField]));
}

function block(type: string, version: number, keys: readonly string[], variants: readonly string[], validate?: BlockDefinition["validate"], urlKeys: readonly string[] = []): BlockDefinition {
  return {
    type,
    version,
    label: type,
    category: "BestTrack",
    targets: ["web"],
    defaultProps: {},
    fields: fields(keys, urlKeys),
    defaultVariant: variants[0],
    variants: variants.map((id) => ({ id, label: id })),
    validate,
    render: {}
  };
}

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

function validateSalesQuery(props: Record<string, unknown>) {
  const issues = textProps([["heading", 120], ["submitLabel", 80]])(props);
  if (typeof props.defaultTrackingNumber !== "string" || !isValidTrackingNumber(props.defaultTrackingNumber)) {
    issues.push({ path: "props.defaultTrackingNumber", message: "Use 6-64 letters, numbers, hyphens, or underscores. Use a non-sensitive preview placeholder only." });
  }
  if (props.heroImageUrl !== undefined && !isSafeTrackingPageUrl(props.heroImageUrl)) {
    issues.push({ path: "props.heroImageUrl", message: "Use an HTTPS URL for the merchant-configured hero image." });
  }
  return issues;
}

function validateCategories(props: Record<string, unknown>) {
  const issues = textProps([["heading", 120], ["collectionId", 256], ["collectionLabel", 120]])(props);
  if (typeof props.collectionId !== "string" || !/^gid:\/\/shopify\/Collection\/\d+$/.test(props.collectionId)) {
    issues.push({ path: "props.collectionId", message: "Use a Shopify collection GID selected by an authorized integration." });
  }
  return issues;
}

const readyToGoContracts: BlockDefinition[] = [
  block("besttrack.ready-to-go.query", 1, ["heading", "submitLabel", "defaultTrackingNumber", "defaultOrderNumber", "defaultQueryMode", "trackingTabLabel", "orderTabLabel"], ["default"]),
  block("besttrack.ready-to-go.progress", 1, [], ["default"]),
  block("besttrack.ready-to-go.delivery", 1, ["heading", "contentsHeading", "carrierHeading"], ["default", "compact"]),
  block("besttrack.ready-to-go.recommendations", 1, ["heading"], ["default", "grid"])
];

const brandedContracts: BlockDefinition[] = [
  block("besttrack.branded.announcement", 1, ["message", "href"], ["brand", "minimal"], undefined, ["href"]),
  block("besttrack.branded.tracking-experience", 1, ["heading", "submitLabel", "trackAnotherLabel", "defaultTrackingNumber", "defaultOrderNumber", "defaultQueryMode", "trackingTabLabel", "orderTabLabel", "shipmentLabels", "heroImageUrl"], ["brand", "compact"], undefined, ["heroImageUrl"]),
  block("besttrack.branded.query", 1, ["heading", "submitLabel", "defaultTrackingNumber", "defaultOrderNumber", "defaultQueryMode", "trackingTabLabel", "orderTabLabel", "shipmentLabels", "heroImageUrl"], ["brand", "compact"], undefined, ["heroImageUrl"]),
  block("besttrack.branded.order-items", 1, ["heading"], ["brand", "minimal"]),
  block("besttrack.branded.recommendations", 1, ["heading", "hideWhenEmpty"], ["brand", "editorial"]),
  block("besttrack.branded.quick-links", 1, ["heading", "primaryLabel", "primaryHref", "secondaryLabel", "secondaryHref"], ["brand"], undefined, ["primaryHref", "secondaryHref"]),
  block("besttrack.branded.blog", 1, ["heading", "articleTitle", "excerpt", "articleHref", "linkLabel"], ["brand"], undefined, ["articleHref"])
];

const salesContracts: BlockDefinition[] = [
  block("besttrack.sales.announcement", 1, ["message"], ["hero", "commerce", "minimal"], textProps([["message", 280]])),
  block("besttrack.sales.query", 1, ["heading", "submitLabel", "defaultTrackingNumber", "defaultOrderNumber", "heroImageUrl"], ["hero", "commerce", "compact"], validateSalesQuery, ["heroImageUrl"]),
  block("besttrack.sales.order-items", 1, ["heading"], ["hero", "commerce"], textProps([["heading", 120]])),
  block("besttrack.sales.other-tracking", 1, ["heading", "emptyMessage"], ["hero", "commerce"], textProps([["heading", 120], ["emptyMessage", 280]])),
  block("besttrack.sales.service-cards", 1, ["heading", "firstTitle", "firstDescription", "secondTitle", "secondDescription"], ["hero", "commerce"], textProps([["heading", 120], ["firstTitle", 120], ["firstDescription", 280], ["secondTitle", 120], ["secondDescription", 280]])),
  block("besttrack.sales.product-categories", 2, ["heading", "collectionId", "collectionLabel"], ["hero", "commerce", "grid"], validateCategories),
  block("besttrack.sales.recommendations", 1, ["heading"], ["hero", "commerce", "grid"], textProps([["heading", 120]]))
];

function template(id: string, version: number, requiredBlocks: readonly BlockDefinition[]): TemplateDefinition {
  return {
    id,
    version,
    name: id,
    target: "web",
    source: "built-in",
    requiredBlocks: requiredBlocks.map((contract) => contract.type),
    create: () => {
      throw new Error("The validation-only template cannot create a PageDocument.");
    }
  };
}

function extension(name: string, contracts: BlockDefinition[], templateVersion: number, requiredBlocks = contracts): PageBuilderExtension {
  return Object.freeze({
    name,
    version: "0.8.0",
    blocks: contracts,
    templates: [template(name, templateVersion, requiredBlocks)]
  });
}

/**
 * Server-safe contracts for validating persisted documents. They intentionally
 * omit React fields and renderers so Route Handlers never import client code.
 */
export const bestTrackDocumentValidationExtensions: PageBuilderExtension[] = [
  extension("besttrack.ready-to-go", readyToGoContracts, 1),
  extension("besttrack.branded", brandedContracts, 1, brandedContracts.filter((contract) => !["besttrack.branded.query", "besttrack.branded.order-items"].includes(contract.type))),
  extension("besttrack.sales", salesContracts, 2)
];
