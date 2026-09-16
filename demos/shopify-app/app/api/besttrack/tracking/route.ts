import { NextRequest, NextResponse } from "next/server";
import { requestConfiguredBestTrackTracking, BestTrackLiveDataError } from "../../../../lib/besttrack-tracking-api";
import { verifySessionToken } from "../../../../lib/shopify/session-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = process.env.SHOPIFY_API_KEY ?? process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!token || !apiKey || !apiSecret) return NextResponse.json({ reason: "missing-auth-configuration" }, { status: 401 });
  if (!verifySessionToken(token, apiKey, apiSecret).ok) return NextResponse.json({ reason: "invalid-session-token" }, { status: 401 });

  try {
    const result = await requestConfiguredBestTrackTracking({ trackingNumber: request.nextUrl.searchParams.get("trackingNumber") ?? "" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BestTrackLiveDataError) return NextResponse.json({ reason: error.reason }, { status: error.status });
    return NextResponse.json({ reason: "besttrack-live-request-failed" }, { status: 502 });
  }
}
