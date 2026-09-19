import type { ShopifyResolvedResource, ShopifyResourceKind, ShopifyResourceReference, ShopifyResourceSearchPage } from "@standhigher/besttrack-page-extension";

export class ShopifyResourceHostError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(reason);
    this.name = "ShopifyResourceHostError";
  }
}

type ResourceHostResponse = { items?: unknown; nextCursor?: unknown; resources?: unknown };
const gid = /^gid:\/\/shopify\/(Product|Collection)\/[1-9]\d*$/;

function kindFromId(value: string): ShopifyResourceKind | undefined {
  const match = gid.exec(value);
  return match?.[1] === "Product" ? "product" : match?.[1] === "Collection" ? "collection" : undefined;
}

export function parseShopifyResourceReference(value: unknown): ShopifyResourceReference | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const kind = typeof item.id === "string" ? kindFromId(item.id) : undefined;
  if (!kind || item.kind !== kind || typeof item.title !== "string" || !item.title.trim() || item.title.length > 160) return undefined;
  if (item.handle !== undefined && (typeof item.handle !== "string" || !/^[a-z0-9][a-z0-9-]{0,254}$/i.test(item.handle))) return undefined;
  return { id: item.id as string, kind, title: item.title.trim(), ...(typeof item.handle === "string" ? { handle: item.handle } : {}) };
}

function resolved(value: unknown): ShopifyResolvedResource | undefined {
  const item = parseShopifyResourceReference(value);
  if (!item || !value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.status !== "resolved" || !["available", "sold-out", "unavailable", "unknown"].includes(String(candidate.availability))) return undefined;
  return {
    ...item,
    status: "resolved",
    availability: candidate.availability as ShopifyResolvedResource["availability"],
    ...(typeof candidate.href === "string" ? { href: candidate.href } : {}),
    ...(typeof candidate.imageUrl === "string" ? { imageUrl: candidate.imageUrl } : {})
  };
}

function configuredEndpoint() {
  const endpoint = process.env.SHOPIFY_RESOURCE_RUNTIME_URL;
  if (!endpoint) throw new ShopifyResourceHostError(503, "shopify-resource-runtime-not-configured");
  try {
    const url = new URL(endpoint);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("unsafe-url");
    return url;
  } catch {
    throw new ShopifyResourceHostError(503, "shopify-resource-runtime-not-configured");
  }
}

async function callHost(payload: Record<string, unknown>): Promise<ResourceHostResponse> {
  const endpoint = configuredEndpoint();
  const token = process.env.SHOPIFY_RESOURCE_RUNTIME_TOKEN;
  let response: Response;
  try {
    response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload), cache: "no-store" });
  } catch {
    throw new ShopifyResourceHostError(502, "shopify-resource-runtime-unavailable");
  }
  if (!response.ok) throw new ShopifyResourceHostError(response.status === 401 || response.status === 403 ? 403 : 502, "shopify-resource-runtime-rejected");
  try {
    return await response.json() as ResourceHostResponse;
  } catch {
    throw new ShopifyResourceHostError(502, "shopify-resource-runtime-invalid-response");
  }
}

/** Server-only proxy to the merchant's trusted resource Runtime/BFF, never Shopify Admin API from the browser. */
export async function searchShopifyResources(input: { shop: string; kinds: readonly ShopifyResourceKind[]; query: string; cursor?: string; limit: number }): Promise<ShopifyResourceSearchPage> {
  const response = await callHost({ mode: "search", ...input });
  const items = Array.isArray(response.items) ? response.items.map(parseShopifyResourceReference).filter((item): item is ShopifyResourceReference => item !== undefined && input.kinds.includes(item.kind)) : [];
  return { items, ...(typeof response.nextCursor === "string" && response.nextCursor.length <= 1024 ? { nextCursor: response.nextCursor } : {}) };
}

/** Server-only batch resolution. Availability exists only in this transient response. */
export async function resolveShopifyResourcesForRuntime(input: { shop: string; references: readonly ShopifyResourceReference[] }): Promise<readonly ShopifyResolvedResource[]> {
  const response = await callHost({ mode: "resolve", ...input });
  return Array.isArray(response.resources) ? response.resources.map(resolved).filter((item): item is ShopifyResolvedResource => Boolean(item)) : [];
}
