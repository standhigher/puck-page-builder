import { describe, expect, it } from "vitest";
import { createExtensionRegistry, createPageDocument, validatePageDocumentWithRegistry } from "@standhigher/puck-page-builder/runtime";
import { formatTrackingPageMoney, isTrackingPageResourceReference, isValidOrderNumber, isValidTrackingNumber } from "./tracking-page-runtime";
import { isSafeTrackingPageUrl, safeTrackingPageUrl } from "./tracking-page-url";
import { bestTrackDocumentValidationExtensions } from "./validation";

describe("tracking page protocol and URL safety", () => {
  it("enforces final query identifier rules", () => {
    expect(isValidTrackingNumber("BT_2048-DEMO")).toBe(true);
    expect(isValidTrackingNumber("BT-12")).toBe(false);
    expect(isValidTrackingNumber("not valid")).toBe(false);
    expect(isValidOrderNumber("#2048")).toBe(true);
    expect(isValidOrderNumber("with space")).toBe(false);
  });

  it("accepts only public HTTPS URLs unless localhost is explicitly enabled", () => {
    expect(safeTrackingPageUrl("https://example.com/image.png")).toBe("https://example.com/image.png");
    expect(isSafeTrackingPageUrl("/collections/featured")).toBe(false);
    expect(isSafeTrackingPageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeTrackingPageUrl("https://user:pass@example.com/image.png")).toBe(false);
    expect(isSafeTrackingPageUrl("http://localhost:3000/image.png", { allowLocalhost: false })).toBe(false);
    expect(safeTrackingPageUrl("http://localhost:3000/image.png", { allowLocalhost: true })).toBe("http://localhost:3000/image.png");
  });

  it("keeps resource references and money values structured", () => {
    expect(isTrackingPageResourceReference({ id: "gid://shopify/Collection/1", kind: "collection" }, "collection")).toBe(true);
    expect(isTrackingPageResourceReference({ id: "collection-1", kind: "collection" })).toBe(false);
    expect(formatTrackingPageMoney({ amount: 1200, compareAtAmount: 1500, currencyCode: "USD" })).toEqual({ amount: "$12.00", compareAt: "$15.00", startsAt: false });
    expect(formatTrackingPageMoney({ amount: 12.5, currencyCode: "USD" })).toBeUndefined();
  });

  it("provides a renderer-free contract for persisted template documents", () => {
    const registry = createExtensionRegistry(bestTrackDocumentValidationExtensions);
    const document = createPageDocument({
      pageId: "sales-validation",
      target: "web",
      templateId: "besttrack.sales",
      templateVersion: 2,
      blocks: [{
        id: "sales-category",
        type: "besttrack.sales.product-categories",
        version: 2,
        variant: "grid",
        style: {},
        props: {
          heading: "Shop by category",
          collectionId: "gid://shopify/Collection/1",
          collectionLabel: "Featured collection"
        }
      }]
    });
    expect(validatePageDocumentWithRegistry(document, registry)).toEqual([]);

    document.blocks[0]!.props.collectionId = "https://example.com/collections/featured";
    document.blocks[0]!.props.unexpected = "not allowed";
    expect(validatePageDocumentWithRegistry(document, registry)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "blocks[0].props.collectionId" }),
      expect.objectContaining({ path: "blocks[0].props.unexpected" })
    ]));
  });
});
