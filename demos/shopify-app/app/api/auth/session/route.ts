import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "../../../../lib/shopify/session-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = process.env.SHOPIFY_API_KEY ?? process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!token || !apiKey || !apiSecret) return NextResponse.json({ authenticated: false, reason: "missing-auth-configuration" }, { status: 401 });

  const verification = verifySessionToken(token, apiKey, apiSecret);
  if (!verification.ok) return NextResponse.json({ authenticated: false, reason: verification.reason }, { status: 401 });

  return NextResponse.json({
    authenticated: true,
    shop: verification.claims.dest,
    subject: verification.claims.sub ?? null
  });
}
