import { NextRequest, NextResponse } from "next/server";
import { verifyAppProxySignature } from "../../../lib/shopify/app-proxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret || !verifyAppProxySignature(request.nextUrl.searchParams, apiSecret)) {
    return NextResponse.json({ ok: false, error: "invalid-app-proxy-signature" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    source: "shopify-app-proxy",
    shop: request.nextUrl.searchParams.get("shop"),
    path: request.nextUrl.pathname
  });
}
