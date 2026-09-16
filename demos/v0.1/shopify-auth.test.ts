import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyAppProxySignature } from "../shopify-app/lib/shopify/app-proxy";
import { verifySessionToken } from "../shopify-app/lib/shopify/session-token";

const apiKey = "client-id";
const apiSecret = "client-secret";

function createToken(claims: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", apiSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

describe("Shopify V0.1.1 verification primitives", () => {
  it("accepts a valid App Bridge session token", () => {
    const token = createToken({ aud: apiKey, dest: "https://besttrack-dev.myshopify.com", exp: 2_000_000_000 });
    expect(verifySessionToken(token, apiKey, apiSecret, 1_000_000_000_000)).toMatchObject({ ok: true });
  });

  it("rejects expired or tampered session tokens", () => {
    const expired = createToken({ aud: apiKey, dest: "https://besttrack-dev.myshopify.com", exp: 1 });
    expect(verifySessionToken(expired, apiKey, apiSecret, 2_000)).toMatchObject({ ok: false, reason: "expired-token" });
    expect(verifySessionToken(`${expired}x`, apiKey, apiSecret, 0)).toMatchObject({ ok: false });
  });

  it("verifies Shopify app proxy signatures without exposing request data", () => {
    const parameters = new URLSearchParams({ shop: "besttrack-dev.myshopify.com", path_prefix: "/apps/besttrack-page-builder", timestamp: "123" });
    const message = [...parameters.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("");
    parameters.set("signature", createHmac("sha256", apiSecret).update(message).digest("hex"));
    expect(verifyAppProxySignature(parameters, apiSecret)).toBe(true);
    parameters.set("shop", "tampered.myshopify.com");
    expect(verifyAppProxySignature(parameters, apiSecret)).toBe(false);
  });
});
