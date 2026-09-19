import { NextRequest, NextResponse } from "next/server";
import { parseShopifyResourceReference, resolveShopifyResourcesForRuntime, searchShopifyResources, ShopifyResourceHostError } from "../../../../lib/shopify/resources";
import { verifySessionToken } from "../../../../lib/shopify/session-token";

export const runtime = "nodejs";

function authenticatedShop(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = process.env.SHOPIFY_API_KEY ?? process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!token || !apiKey || !apiSecret) return undefined;
  const verification = verifySessionToken(token, apiKey, apiSecret);
  if (!verification.ok || !verification.claims.dest) return undefined;
  try { return new URL(verification.claims.dest).hostname; } catch { return undefined; }
}

function errorResponse(error: unknown) {
  if (error instanceof ShopifyResourceHostError) return NextResponse.json({ reason: error.reason }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ reason: "shopify-resource-request-failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

function resourceKinds(value: string | null) {
  const kinds = (value ?? "").split(",").filter((kind): kind is "product" | "collection" => kind === "product" || kind === "collection");
  return kinds.length ? [...new Set(kinds)] : undefined;
}

export async function GET(request: NextRequest) {
  const shop = authenticatedShop(request);
  if (!shop) return NextResponse.json({ reason: "invalid-session-token" }, { status: 401 });
  const kinds = resourceKinds(request.nextUrl.searchParams.get("kinds"));
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  if (!kinds || query.length > 160 || (cursor && cursor.length > 1024) || !Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) return NextResponse.json({ reason: "invalid-resource-search" }, { status: 400 });
  try {
    return NextResponse.json(await searchShopifyResources({ shop, kinds, query, ...(cursor ? { cursor } : {}), limit: requestedLimit }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  const shop = authenticatedShop(request);
  if (!shop) return NextResponse.json({ reason: "invalid-session-token" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ reason: "invalid-resource-resolution" }, { status: 400 }); }
  const references = body && typeof body === "object" && !Array.isArray(body) ? (body as { references?: unknown }).references : undefined;
  if (!Array.isArray(references) || references.length > 50) return NextResponse.json({ reason: "invalid-resource-resolution" }, { status: 400 });
  const parsedReferences = references.map(parseShopifyResourceReference);
  if (parsedReferences.some((reference) => !reference)) return NextResponse.json({ reason: "invalid-resource-resolution" }, { status: 400 });
  const validReferences = parsedReferences.filter((reference): reference is NonNullable<typeof reference> => Boolean(reference));
  try {
    // The BFF validates the exact resource shape again. Browser-supplied shop IDs are never accepted.
    return NextResponse.json({ resources: await resolveShopifyResourcesForRuntime({ shop, references: validReferences }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
