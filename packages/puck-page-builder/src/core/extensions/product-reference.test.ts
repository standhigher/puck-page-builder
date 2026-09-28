import { describe, expect, it } from "vitest";
import { isProductReference, parseProductReferences, toProductReferenceJson } from "./product-reference";

describe("product snapshots", () => {
  it("keeps JSON-only display fields and drops unsafe image URLs", () => {
    expect(isProductReference({ id: "gid://shopify/Product/1", title: "Tote" })).toBe(true);
    expect(isProductReference({ title: "Missing id" })).toBe(false);
    expect(parseProductReferences([
      { id: " gid://shopify/Product/1 ", title: " Tote ", imageUrl: "https://cdn.example/tote.jpg" },
      { id: "gid://shopify/Product/2", imageUrl: "javascript:alert(1)" },
      { title: "no-id" }
    ])).toEqual([
      { id: "gid://shopify/Product/1", title: "Tote", imageUrl: "https://cdn.example/tote.jpg" },
      { id: "gid://shopify/Product/2" }
    ]);
    expect(toProductReferenceJson({ id: "gid://shopify/Product/1", title: "Tote" })).toEqual({ id: "gid://shopify/Product/1", title: "Tote" });
  });

  it("keeps catalog display money and drops invalid prices", () => {
    const price = { amount: 1200, currencyCode: "USD" };
    expect(isProductReference({ id: "gid://shopify/Product/1", price })).toBe(true);
    expect(isProductReference({ id: "gid://shopify/Product/1", price: "$12.00" })).toBe(false);
    expect(isProductReference({ id: "gid://shopify/Product/1", price: { amount: -1, currencyCode: "USD" } })).toBe(false);
    expect(parseProductReferences([
      { id: "gid://shopify/Product/1", title: "Tote", price },
      { id: "gid://shopify/Product/2", price: "$12.00" },
      { id: "gid://shopify/Product/3", price: { amount: -1, currencyCode: "USD" } }
    ])).toEqual([
      { id: "gid://shopify/Product/1", title: "Tote", price },
      { id: "gid://shopify/Product/2" },
      { id: "gid://shopify/Product/3" }
    ]);
    expect(toProductReferenceJson({ id: "gid://shopify/Product/1", title: "Tote", price })).toEqual({
      id: "gid://shopify/Product/1",
      title: "Tote",
      price
    });
  });
});
