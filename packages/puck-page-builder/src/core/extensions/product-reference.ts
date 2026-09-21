import type { JsonValue } from "../schema/page-document";

/**
 * JSON-only product snapshot persisted in PageDocument props.
 * Hosts may add a stable id plus display fields; never store tokens or prices as secrets.
 */
export type ProductReference = {
  id: string;
  title?: string;
  imageUrl?: string;
  handle?: string;
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isProductReference(value: unknown): value is ProductReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<ProductReference>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return false;
  if (candidate.title !== undefined && typeof candidate.title !== "string") return false;
  if (candidate.handle !== undefined && typeof candidate.handle !== "string") return false;
  if (candidate.imageUrl !== undefined && (typeof candidate.imageUrl !== "string" || !isHttpUrl(candidate.imageUrl))) return false;
  return true;
}

export function parseProductReferences(value: unknown): ProductReference[] {
  if (!Array.isArray(value)) return [];
  const products: ProductReference[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Partial<ProductReference>;
    if (typeof candidate.id !== "string" || !candidate.id.trim()) continue;
    products.push({
      id: candidate.id.trim(),
      ...(typeof candidate.title === "string" && candidate.title.trim() ? { title: candidate.title.trim() } : {}),
      ...(typeof candidate.handle === "string" && candidate.handle.trim() ? { handle: candidate.handle.trim() } : {}),
      ...(typeof candidate.imageUrl === "string" && isHttpUrl(candidate.imageUrl) ? { imageUrl: candidate.imageUrl } : {})
    });
  }
  return products;
}

export function toProductReferenceJson(product: ProductReference): JsonValue {
  return {
    id: product.id,
    ...(product.title ? { title: product.title } : {}),
    ...(product.handle ? { handle: product.handle } : {}),
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {})
  };
}
