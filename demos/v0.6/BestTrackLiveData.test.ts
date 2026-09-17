import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GET as getTracking } from "../shopify-app/app/api/besttrack/tracking/route";
import { createExtensionRegistry } from "../../packages/puck-page-builder/src/core/extensions";
import { createBestTrackExtension } from "../shopify-app/lib/besttrack-extension";
import { requestConfiguredBestTrackTracking, BestTrackLiveDataError } from "../shopify-app/lib/besttrack-tracking-api";
import { resolveBlockDataBinding } from "../shopify-app/lib/page-builder-data-binding";
import { v06LiveDataDocument } from "../shopify-app/lib/v0.6-live-data-document";

function createSessionToken(apiKey: string, secret: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const claims = encode({ aud: apiKey, dest: "https://besttrack-dev.myshopify.com", exp: Math.floor(Date.now() / 1000) + 60 });
  return `${header}.${claims}.${createHmac("sha256", secret).update(`${header}.${claims}`).digest("base64url")}`;
}

function trackingRequest(trackingNumber: string, authorization?: string) {
  return {
    headers: new Headers(authorization ? { Authorization: authorization } : {}),
    nextUrl: new URL(`https://demo.test/api/besttrack/tracking?trackingNumber=${trackingNumber}`)
  } as never;
}

describe("V0.6 BestTrack live data and Page Builder binding", () => {
  it("sends a configured server-side request without exposing its API token", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: { tracking_number: "BT-2048-DEMO", tracking_status: "Out for delivery", carrier_name: "BestTrack", latest_event: "Courier assigned", updated_at: "2026-09-16T10:00:00Z" }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(requestConfiguredBestTrackTracking(
      { trackingNumber: "BT-2048-DEMO" },
      { BESTTRACK_TRACKING_API_URL: "https://besttrack.example.test/v1/track", BESTTRACK_API_TOKEN: "private-token" },
      fetchImpl
    )).resolves.toEqual({ trackingNumber: "BT-2048-DEMO", status: "Out for delivery", carrier: "BestTrack", latestEvent: "Courier assigned", updatedAt: "2026-09-16T10:00:00Z" });
    expect(fetchImpl).toHaveBeenCalledWith(new URL("https://besttrack.example.test/v1/track?trackingNumber=BT-2048-DEMO"), expect.objectContaining({
      headers: { Accept: "application/json", Authorization: "Bearer private-token" }
    }));
  });

  it("does not substitute mock data when the live service is absent or malformed", async () => {
    await expect(requestConfiguredBestTrackTracking({ trackingNumber: "BT-2048-DEMO" }, {})).rejects.toMatchObject<Partial<BestTrackLiveDataError>>({ status: 503, reason: "besttrack-live-data-not-configured" });
    await expect(requestConfiguredBestTrackTracking(
      { trackingNumber: "BT-2048-DEMO" },
      { BESTTRACK_TRACKING_API_URL: "https://besttrack.example.test/v1/track", BESTTRACK_API_TOKEN: "private-token" },
      vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
    )).rejects.toMatchObject<Partial<BestTrackLiveDataError>>({ status: 502, reason: "besttrack-invalid-response" });
  });

  it("requires a Shopify session token before the server-side proxy calls BestTrack", async () => {
    const unauthorized = await getTracking(trackingRequest("BT-2048-DEMO"));
    expect(unauthorized.status).toBe(401);

    const apiKey = "shopify-api-key";
    const secret = "shopify-api-secret";
    vi.stubEnv("SHOPIFY_API_KEY", apiKey);
    vi.stubEnv("SHOPIFY_API_SECRET", secret);
    vi.stubEnv("BESTTRACK_TRACKING_API_URL", "https://besttrack.example.test/v1/track");
    vi.stubEnv("BESTTRACK_API_TOKEN", "private-token");
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { status: "Delivered" } }), { status: 200 }));
    vi.stubGlobal("fetch", upstream);

    const response = await getTracking(trackingRequest("BT-2048-DEMO", `Bearer ${createSessionToken(apiKey, secret)}`));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ trackingNumber: "BT-2048-DEMO", status: "Delivered" });
    expect(upstream).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("resolves the PageDocument binding through the registered source in mock and authenticated live modes", async () => {
    const liveRequest = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ trackingNumber: "BT-2048-DEMO", status: "Delivered" }), { status: 200 }));
    vi.stubGlobal("fetch", liveRequest);
    const registry = createExtensionRegistry([createBestTrackExtension(async () => "shopify-session-token")]);

    await expect(resolveBlockDataBinding(v06LiveDataDocument, "besttrack-live-status", registry, "mock")).resolves.toMatchObject({ trackingNumber: "BT-2048-DEMO", status: "In transit" });
    await expect(resolveBlockDataBinding(v06LiveDataDocument, "besttrack-live-status", registry, "live")).resolves.toEqual({ trackingNumber: "BT-2048-DEMO", status: "Delivered" });
    expect(liveRequest).toHaveBeenCalledWith("/api/besttrack/tracking?trackingNumber=BT-2048-DEMO", { headers: { Authorization: "Bearer shopify-session-token" } });
    vi.unstubAllGlobals();
  });

  it("rejects an invalid data binding before a source request is made", async () => {
    const registry = createExtensionRegistry([createBestTrackExtension(async () => "shopify-session-token")]);
    const invalid = structuredClone(v06LiveDataDocument);
    invalid.blocks[0]!.binding!.params = { trackingNumber: "?" };
    await expect(resolveBlockDataBinding(invalid, "besttrack-live-status", registry, "live")).rejects.toThrow("trackingNumber");
  });
});
