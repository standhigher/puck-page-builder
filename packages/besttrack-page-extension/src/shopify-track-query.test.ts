import { describe, expect, it, vi } from "vitest";
import {
  buildShopifyRecommendPayload,
  buildShopifyTrackQueryPayload,
  createShopifyRecommendationsQuery,
  createShopifyTrackQuery,
  mapShopifyRecommendationsResponse,
  mapShopifyTrackQueryResponse,
  readTrackingQueryFromLocation,
  readTrackingQueryLocationState,
  shouldHidePoweredBy,
  withShopifyAppProxyPrefix,
  withShopifyTrackCacheBust
} from "./shopify-track-query";
import { formatEstimatedDelivery, shouldShowEstimatedDelivery } from "./shopify-track-page/timeline";
import type { TrackMilestone } from "./shopify-track-page/pages/home/types";

const transitMilestone: TrackMilestone = {
  tracking_number: "BT-2048",
  carrier: "BestTrack",
  package_items: [{ product_id: "gid://shopify/Product/1", variant_id: "gid://shopify/ProductVariant/1", title: "Tote", variant_title: "Black", image_url: "https://cdn.example.test/tote.png", quantity: 1 }],
  nodeList: [{
    node: "InTransit_Other",
    description: "Accepted at the hub",
    time: "2026-09-17 10:00",
    location: "Shanghai",
    country: "CN",
    state: "Shanghai",
    city: "Shanghai",
    street: "12 Secret Street",
    carrier: "BestTrack"
  }],
  estimated_delivery: {
    from: "2026-09-22",
    to: "2026-09-24",
    source: "carrier",
    display_state: "in_transit"
  }
};

describe("Shopify Track Page query helpers", () => {
  it("appends a cache-bust timestamp to the legacy query path", () => {
    expect(withShopifyTrackCacheBust("/track/query", 1700000000000)).toBe("/track/query?_t=1700000000000");
    expect(withShopifyTrackCacheBust("/track/query?lang=EN", 1700000000000)).toBe("/track/query?lang=EN&_t=1700000000000");
  });

  it("builds the snake_case body used by /track/query", () => {
    expect(buildShopifyTrackQueryPayload({ mode: "tracking", trackingNumber: "BT-2048" }, "ZH-HANS")).toEqual({
      order_number: "",
      email: "",
      tracking_number: "BT-2048",
      lang: "ZH-HANS"
    });
    expect(buildShopifyTrackQueryPayload({ mode: "order", orderNumber: "#2048", email: "buyer@example.test" })).toEqual({
      order_number: "#2048",
      email: "buyer@example.test",
      tracking_number: "",
      lang: "EN"
    });
  });

  it("prefixes Track Page paths the way the original App Proxy helper did", () => {
    expect(withShopifyAppProxyPrefix("/track/query", "/apps/bestrack")).toBe("/apps/bestrack/track/query");
    expect(withShopifyAppProxyPrefix("track/query", "/apps/bestrack/")).toBe("/apps/bestrack/track/query");
    expect(withShopifyAppProxyPrefix("/products/recommend", "/")).toBe("/products/recommend");
    expect(buildShopifyRecommendPayload()).toEqual({ page: 1, page_size: 20 });
  });

  it("maps a successful legacy envelope onto the display-safe runtime result", () => {
    const result = mapShopifyTrackQueryResponse({
      code: 0,
      data: {
        order_number: "#2048",
        mileStoneList: [transitMilestone],
        ad_config: { image_url: "https://cdn.example.test/promo.png", link_url: "shop.example.test/promo" },
        trace_id: "trace"
      }
    }, { mode: "tracking", trackingNumber: "BT-2048" });

    expect(result.outcome).toBe("found");
    expect(result.trackingNumber).toBe("BT-2048");
    expect(result.status).toBe("In Transit");
    expect(result.carrier).toBe("BestTrack");
    expect(result.destination).toBe("Shanghai, Shanghai, CN");
    expect(result.destination).not.toContain("Secret Street");
    expect(result.ad).toEqual({ imageUrl: "https://cdn.example.test/promo.png", href: "https://shop.example.test/promo" });
    expect(result.orderItems?.[0]).toMatchObject({ title: "Tote - Black", quantity: 1 });
    expect(result.progress?.map((step) => step.state)).toEqual(["complete", "complete", "current", "upcoming", "upcoming"]);
    expect(result.events?.[0]?.title).toContain("Accepted at the hub");
    expect(result.estimatedDelivery).toBe(formatEstimatedDelivery(transitMilestone.estimated_delivery, "EN")?.dateText);
  });

  it("keeps the original default Ordered steps when the lookup succeeds with no milestones", () => {
    const result = mapShopifyTrackQueryResponse({
      code: 0,
      data: { order_number: "#2048", mileStoneList: [], ad_config: { image_url: "", link_url: "" }, trace_id: "" }
    }, { mode: "order", orderNumber: "#2048", email: "buyer@example.test" });
    expect(result.outcome).toBe("found");
    expect(result.status).toBe("Ordered");
    expect(result.progress?.map((step) => step.state)).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(result.shipments).toEqual([]);
  });

  it("maps a non-zero business code to the empty outcome instead of throwing", () => {
    expect(mapShopifyTrackQueryResponse({ code: 404, data: null }, { mode: "tracking", trackingNumber: "missing" })).toEqual({
      outcome: "empty",
      trackingNumber: "",
      status: ""
    });
  });

  it("hides estimated delivery after an actual delivery, matching the original page rule", () => {
    const delivered: TrackMilestone = {
      ...transitMilestone,
      rawEventList: [{
        stage: "Delivered",
        sub_status: "Delivered_Other",
        description: "Left at the door",
        time: "2026-09-20 09:00",
        location: "Shanghai",
        country: "CN",
        state: "Shanghai",
        city: "Shanghai",
        street: ""
      }]
    };
    expect(shouldShowEstimatedDelivery(transitMilestone, new Date("2026-09-18T00:00:00"))).toBe(true);
    expect(shouldShowEstimatedDelivery(delivered, new Date("2026-09-18T00:00:00"))).toBe(false);
  });

  it("retries a thrown lookup and cache-busts each attempt", async () => {
    const post = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ code: 0, data: { order_number: "", mileStoneList: [transitMilestone], ad_config: { image_url: "", link_url: "" }, trace_id: "" } });
    const query = createShopifyTrackQuery({ post, retries: 1, locale: "EN" });
    const result = await query({ mode: "tracking", trackingNumber: "BT-2048" });
    expect(result.status).toBe("In Transit");
    expect(post).toHaveBeenCalledTimes(2);
    expect(String(post.mock.calls[0]?.[0])).toMatch(/^\/track\/query\?_t=\d+$/);
    expect(post.mock.calls[0]?.[1]).toEqual({
      order_number: "",
      email: "",
      tracking_number: "BT-2048",
      lang: "EN"
    });
  });

  it("treats exhausted lookup throws as a missing order, matching the original page", async () => {
    const post = vi.fn().mockRejectedValue(new Error("timeout"));
    const query = createShopifyTrackQuery({ post, retries: 1, locale: "EN" });
    await expect(query({ mode: "tracking", trackingNumber: "BT-2048" })).resolves.toEqual({
      outcome: "empty",
      trackingNumber: "",
      status: ""
    });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("sends the current locale and falls back to English after a business miss", async () => {
    const post = vi.fn()
      .mockResolvedValueOnce({ code: 404, data: null })
      .mockResolvedValueOnce({ code: 0, data: { order_number: "", mileStoneList: [transitMilestone], ad_config: { image_url: "", link_url: "" }, trace_id: "" } });
    const query = createShopifyTrackQuery({ post, locale: () => "ZH-HANS", fallbackToEnglish: true, retries: 0 });
    const result = await query({ mode: "tracking", trackingNumber: "BT-2048" });
    expect(result.status).toBe("In Transit");
    expect(post.mock.calls[0]?.[1]).toMatchObject({ lang: "ZH-HANS", tracking_number: "BT-2048" });
    expect(post.mock.calls[1]?.[1]).toMatchObject({ lang: "EN", tracking_number: "BT-2048" });
  });

  it("maps the independent recommend payload without joining the tracking query", () => {
    expect(mapShopifyRecommendationsResponse({
      data: {
        products: [{
          id: "gid://shopify/Product/9",
          title: "Travel tote",
          handle: "travel-tote",
          onlineStoreUrl: "https://shop.example.test/products/travel-tote",
          featuredImage: { url: "https://cdn.example.test/tote.png" },
          price: "12.00"
        }]
      }
    })).toEqual([{
      id: "gid://shopify/Product/9",
      title: "Travel tote",
      description: "",
      imageUrl: "https://cdn.example.test/tote.png",
      href: "https://shop.example.test/products/travel-tote",
      price: { amount: 1200, currencyCode: "USD" }
    }]);
  });

  it("falls back to /products/:handle when the recommend API omits onlineStoreUrl", () => {
    expect(mapShopifyRecommendationsResponse({
      data: { products: [{ id: "gid://shopify/Product/9", title: "Travel tote", handle: "travel-tote" }] }
    })[0]?.href).toMatch(/\/products\/travel-tote$/);
  });

  it("swallows recommend transport failures the way the original carousel did", async () => {
    const queryRecommendations = createShopifyRecommendationsQuery(vi.fn().mockRejectedValue(new Error("offline")));
    await expect(queryRecommendations()).resolves.toEqual([]);
  });

  it("reads tracking and mixed hash/query-string deep links the way the original page did", () => {
    expect(readTrackingQueryFromLocation("?tracking_number=BT-1", "")).toEqual({ mode: "tracking", trackingNumber: "BT-1" });
    expect(readTrackingQueryFromLocation("", "#order_number=%232048&email=buyer@example.test")).toEqual({
      mode: "order",
      orderNumber: "#2048",
      email: "buyer@example.test"
    });
    expect(readTrackingQueryFromLocation("?order_number=1001", "#email=buyer@example.test")).toEqual({
      mode: "order",
      orderNumber: "1001",
      email: "buyer@example.test"
    });
    expect(readTrackingQueryLocationState("?order_number=1001", "")).toEqual({
      tab: "order",
      trackingNumber: "",
      orderNumber: "1001",
      email: "",
      canAutoQuery: false
    });
  });

  it("hides powered-by for the original storefront allow-list and feature flag", () => {
    const hidden = {
      location: { hostname: "shop.example", search: "?shop=wavvveglobal.com", hash: "" },
      Shopify: {}
    } as unknown as Window;
    expect(shouldHidePoweredBy(hidden)).toBe(true);
    const flagged = {
      location: { hostname: "shop.example", search: "", hash: "" },
      __BESTRACK__: { featureFlags: { enableTrackingPageWatermarkRemoval: true } }
    } as unknown as Window;
    expect(shouldHidePoweredBy(flagged)).toBe(true);
    const visible = {
      location: { hostname: "shop.example", search: "", hash: "" }
    } as unknown as Window;
    expect(shouldHidePoweredBy(visible)).toBe(false);
  });
});
