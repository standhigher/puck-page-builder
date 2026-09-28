import type { JsonValue } from "../schema/page-document";

/**
 * JSON-only product snapshot persisted in PageDocument props.
 * Hosts may add a stable id plus display fields. Catalog display money may be
 * stored as minor units; never persist tokens, secrets, or formatted price strings.
 */
export type ProductReferenceMoney = {
  amount: number;
  currencyCode: string;
};

export type ProductReference = {
  id: string;
  title?: string;
  imageUrl?: string;
  handle?: string;
  price?: ProductReferenceMoney;
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isProductMoney(value: unknown): value is ProductReferenceMoney {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { amount?: unknown; currencyCode?: unknown };
  const amount = candidate.amount;
  const currencyCode = candidate.currencyCode;
  return typeof amount === "number" && Number.isInteger(amount) && amount >= 0 && typeof currencyCode === "string" && Boolean(currencyCode.trim());
}

export function isProductReference(value: unknown): value is ProductReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return false;
  if (candidate.title !== undefined && typeof candidate.title !== "string") return false;
  if (candidate.handle !== undefined && typeof candidate.handle !== "string") return false;
  if (candidate.imageUrl !== undefined && (typeof candidate.imageUrl !== "string" || !isHttpUrl(candidate.imageUrl))) return false;
  if (candidate.price !== undefined && !isProductMoney(candidate.price)) return false;
  return true;
}

export function parseProductReferences(value: unknown): ProductReference[] {
  if (!Array.isArray(value)) return [];
  const products: ProductReference[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || !candidate.id.trim()) continue;
    products.push({
      id: candidate.id.trim(),
      ...(typeof candidate.title === "string" && candidate.title.trim() ? { title: candidate.title.trim() } : {}),
      ...(typeof candidate.handle === "string" && candidate.handle.trim() ? { handle: candidate.handle.trim() } : {}),
      ...(typeof candidate.imageUrl === "string" && isHttpUrl(candidate.imageUrl) ? { imageUrl: candidate.imageUrl } : {}),
      ...(isProductMoney(candidate.price) ? { price: { amount: candidate.price.amount, currencyCode: candidate.price.currencyCode } } : {})
    });
  }
  return products;
}

export function toProductReferenceJson(product: ProductReference): JsonValue {
  return {
    id: product.id,
    ...(product.title ? { title: product.title } : {}),
    ...(product.handle ? { handle: product.handle } : {}),
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    ...(isProductMoney(product.price) ? { price: { amount: product.price.amount, currencyCode: product.price.currencyCode } } : {})
  };
}
