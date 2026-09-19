import { safeTrackingPageUrl } from "./tracking-page-url";

/** The JSON-only Shopify reference that may be persisted in PageDocument props. */
export type ShopifyResourceReference = Readonly<{ id: string; kind: "product" | "collection"; title: string; handle?: string }>;
export type ShopifyResourceKind = ShopifyResourceReference["kind"];
export type ShopifyResourceSearchInput = Readonly<{ kinds: readonly ShopifyResourceKind[]; query: string; cursor?: string; limit: number }>;
export type ShopifyResourceSearchPage = Readonly<{ items: readonly ShopifyResourceReference[]; nextCursor?: string }>;

/** Injected by the authenticated Admin host; it owns browse, search, pagination, and authorization. */
export type ShopifyResourceBrowser = { search(input: ShopifyResourceSearchInput): Promise<ShopifyResourceSearchPage> };

const resourcePattern = /^gid:\/\/shopify\/(Product|Collection)\/[1-9]\d*$/;

export function isShopifyResourceReference(value: unknown, kind?: ShopifyResourceKind): value is ShopifyResourceReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<ShopifyResourceReference>;
  const match = typeof candidate.id === "string" ? resourcePattern.exec(candidate.id) : null;
  const expectedKind = match?.[1] === "Product" ? "product" : match?.[1] === "Collection" ? "collection" : undefined;
  return candidate.kind === expectedKind && expectedKind !== undefined && (kind === undefined || expectedKind === kind)
    && typeof candidate.title === "string" && Boolean(candidate.title.trim()) && candidate.title.length <= 160
    && (candidate.handle === undefined || (typeof candidate.handle === "string" && /^[a-z0-9][a-z0-9-]{0,254}$/i.test(candidate.handle)));
}

export type ShopifyResourceAvailability = "available" | "sold-out" | "unavailable" | "unknown";
/** A trusted Runtime may add these values transiently; they must never be saved back to PageDocument. */
export type ShopifyResolvedResource = ShopifyResourceReference & Readonly<{ status: "resolved"; href?: string; imageUrl?: string; availability: ShopifyResourceAvailability }>;
export type ShopifyResourceResolutionError = Readonly<{ code: "invalid-reference" | "missing" | "unavailable" | "resolution-failed" }>;
export type ShopifyResourceResolution = Readonly<{ resources: Readonly<Record<string, ShopifyResolvedResource>>; errors: Readonly<Record<string, ShopifyResourceResolutionError>> }>;

/** Server-side host contract. The extension never contacts Shopify or supplies an implementation. */
export type ShopifyResourceResolver = { resolve(input: { references: readonly ShopifyResourceReference[] }): Promise<readonly ShopifyResolvedResource[]> };

function resourceKey(reference: Pick<ShopifyResourceReference, "id" | "kind">) { return `${reference.kind}:${reference.id}`; }
function isResolvedResource(value: unknown): value is ShopifyResolvedResource {
  if (!isShopifyResourceReference(value)) return false;
  const candidate = value as Partial<ShopifyResolvedResource>;
  return candidate.status === "resolved"
    && (candidate.availability === "available" || candidate.availability === "sold-out" || candidate.availability === "unavailable" || candidate.availability === "unknown")
    && (candidate.href === undefined || typeof candidate.href === "string")
    && (candidate.imageUrl === undefined || typeof candidate.imageUrl === "string");
}

/** Validates and normalizes a host response; a live resolution failure never becomes mock data. */
export async function resolveShopifyResources(references: readonly unknown[], resolver: ShopifyResourceResolver): Promise<ShopifyResourceResolution> {
  const resources: Record<string, ShopifyResolvedResource> = {};
  const errors: Record<string, ShopifyResourceResolutionError> = {};
  const valid = new Map<string, ShopifyResourceReference>();
  references.forEach((reference, index) => {
    if (!isShopifyResourceReference(reference)) { errors[`invalid:${index}`] = { code: "invalid-reference" }; return; }
    valid.set(resourceKey(reference), reference);
  });
  if (!valid.size) return { resources, errors };
  let resolved: readonly ShopifyResolvedResource[];
  try { resolved = await resolver.resolve({ references: [...valid.values()] }); }
  catch {
    valid.forEach((reference) => { errors[resourceKey(reference)] = { code: "resolution-failed" }; });
    return { resources, errors };
  }
  resolved.forEach((candidate) => {
    if (!isResolvedResource(candidate)) return;
    const key = resourceKey(candidate);
    if (!valid.has(key)) return;
    const href = safeTrackingPageUrl(candidate.href);
    const imageUrl = safeTrackingPageUrl(candidate.imageUrl);
    resources[key] = { id: candidate.id, kind: candidate.kind, title: candidate.title.trim(), ...(candidate.handle ? { handle: candidate.handle } : {}), status: "resolved", availability: candidate.availability, ...(href ? { href } : {}), ...(imageUrl ? { imageUrl } : {}) };
  });
  valid.forEach((reference, key) => { if (!resources[key]) errors[key] = { code: "missing" }; });
  return { resources, errors };
}

export function getResolvedShopifyResource(reference: unknown, resolution?: ShopifyResourceResolution) {
  return isShopifyResourceReference(reference) ? resolution?.resources[resourceKey(reference)] : undefined;
}
export function getShopifyResourceResolutionError(reference: unknown, resolution?: ShopifyResourceResolution) {
  return isShopifyResourceReference(reference) ? resolution?.errors[resourceKey(reference)] : undefined;
}
