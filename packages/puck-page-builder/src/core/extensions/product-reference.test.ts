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
});
