import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyAppProxySignature(searchParams: URLSearchParams, apiSecret: string) {
  const signature = searchParams.get("signature");
  if (!signature) return false;

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("");
  const expected = createHmac("sha256", apiSecret).update(message).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
