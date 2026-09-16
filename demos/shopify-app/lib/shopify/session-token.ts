import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionTokenClaims = {
  aud?: string | string[];
  dest?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
};

type VerificationResult =
  | { ok: true; claims: SessionTokenClaims }
  | { ok: false; reason: string };

function decodeSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

export function verifySessionToken(token: string, apiKey: string, apiSecret: string, now = Date.now()): VerificationResult {
  const [encodedHeader, encodedClaims, encodedSignature, ...rest] = token.split(".");
  if (!encodedHeader || !encodedClaims || !encodedSignature || rest.length > 0) return { ok: false, reason: "malformed-token" };

  try {
    const header = decodeSegment(encodedHeader);
    const claims = decodeSegment(encodedClaims) as SessionTokenClaims;
    if (header.alg !== "HS256") return { ok: false, reason: "unexpected-algorithm" };

    const expected = createHmac("sha256", apiSecret).update(`${encodedHeader}.${encodedClaims}`).digest();
    const received = Buffer.from(encodedSignature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return { ok: false, reason: "invalid-signature" };

    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(apiKey)) return { ok: false, reason: "unexpected-audience" };
    if (!claims.dest?.startsWith("https://") || !claims.dest.endsWith(".myshopify.com")) return { ok: false, reason: "invalid-destination" };
    if (!claims.exp || claims.exp * 1000 <= now) return { ok: false, reason: "expired-token" };

    return { ok: true, claims };
  } catch {
    return { ok: false, reason: "malformed-token" };
  }
}
