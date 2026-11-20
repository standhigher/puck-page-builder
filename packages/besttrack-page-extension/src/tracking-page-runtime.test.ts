import { describe, expect, it } from "vitest";
import { createExtensionRegistry, createPageDocument, validatePageDocumentWithRegistry } from "@standhigher/puck-page-builder/runtime";
import { formatTrackingPageMoney, isTrackingPageResourceReference, isValidOrderNumber, isValidTrackingNumber } from "./tracking-page-runtime";
import { formatRecommendationPrice } from "./tracking-block-model";
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

  it.each([
    { currencyCode: "USD", amount: 1234, display: "$12.34", recommendation: "$ 12.34" },
    { currencyCode: "EUR", amount: 1234, display: "€12.34", recommendation: "€ 12.34" },
    { currencyCode: "CNY", amount: 1234, display: "CN¥12.34", recommendation: "CN¥ 12.34" },
    { currencyCode: "JPY", amount: 1025, display: "¥1,025", recommendation: "¥ 1,025" },
    { currencyCode: "KWD", amount: 1234, display: "KWD\u00a01.234", recommendation: "KWD 1.234" }
  ])("formats $currencyCode minor units using the currency precision", ({ currencyCode, amount, display, recommendation }) => {
    expect(formatTrackingPageMoney({ amount, currencyCode })?.amount).toBe(display);
    expect(formatRecommendationPrice({ amount, currencyCode })).toBe(recommendation);
  });

  it("overrides only the recommendation symbol and preserves currency precision", () => {
    expect(formatRecommendationPrice({ amount: 1234, currencyCode: "BDT" }, " ৳ ")).toBe("৳ 12.34");
    expect(formatRecommendationPrice({ amount: 1025, currencyCode: "JPY" }, "円")).toBe("円 1,025");
    expect(formatRecommendationPrice({ amount: 1234, currencyCode: "KWD" }, "KD")).toBe("KD 1.234");
    expect(formatRecommendationPrice({ amount: 1234, currencyCode: "USD" }, "  ")).toBe("$ 12.34");
    expect(formatRecommendationPrice({ amount: 1234, currencyCode: "" }, "$")).toBe("");
    expect(formatRecommendationPrice({ amount: -1, currencyCode: "USD" }, "$")).toBe("");
  });

  it("uses the currency precision for compare-at prices as well", () => {
    expect(formatTrackingPageMoney({ amount: 1025, compareAtAmount: 1200, currencyCode: "JPY", startsAt: true })).toEqual({
      amount: "¥1,025", compareAt: "¥1,200", startsAt: true
    });
    expect(formatTrackingPageMoney({ amount: 1234, compareAtAmount: 2500, currencyCode: "KWD" })).toEqual({
      amount: "KWD\u00a01.234", compareAt: "KWD\u00a02.500", startsAt: false
    });
  });

  it.each(["", "EURO", "usd", "$"])("hides prices with an invalid currency format: %s", (currencyCode) => {
    expect(formatTrackingPageMoney({ amount: 1200, currencyCode })).toBeUndefined();
    expect(formatRecommendationPrice({ amount: 1200, currencyCode })).toBe("");
  });

  it("does not display missing or invalid recommendation amounts as a price", () => {
    expect(formatRecommendationPrice()).toBe("");
    for (const amount of [-1, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(formatRecommendationPrice({ amount, currencyCode: "USD" })).toBe("");
    }
    expect(formatRecommendationPrice({ amount: 0, currencyCode: "USD" })).toBe("$ 0.00");
  });

  it("provides a renderer-free contract for persisted template documents", () => {
    const registry = createExtensionRegistry(bestTrackDocumentValidationExtensions);
    const document = createPageDocument({
      pageId: "sales-validation",
      target: "web",
      templateId: "besttrack.sales",
      templateVersion: 3,
      blocks: [{
        id: "sales-category",
        type: "besttrack.sales.product-categories",
        version: 3,
        variant: "grid",
        style: {},
        props: {
          heading: "Shop by category",
          collection: { id: "gid://shopify/Collection/1", kind: "collection", title: "Featured collection", handle: "featured" }
        }
      }]
    });
    expect(validatePageDocumentWithRegistry(document, registry)).toEqual([]);

    document.blocks[0]!.props.collection = { id: "https://example.com/collections/featured", kind: "collection", title: "Featured collection" };
    document.blocks[0]!.props.unexpected = "not allowed";
    expect(validatePageDocumentWithRegistry(document, registry)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "blocks[0].props.collection" }),
      expect.objectContaining({ path: "blocks[0].props.unexpected" })
    ]));
  });
});
