import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.SHOPIFY_API_SECRET;
  const signature = request.headers.get("x-shopify-hmac-sha256");
  const body = await request.text();
  const expected = secret ? createHmac("sha256", secret).update(body).digest() : null;
  const received = signature ? Buffer.from(signature, "base64") : null;
  if (!expected || !received || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return new NextResponse(null, { status: 401 });
  }

  return new NextResponse(null, { status: 204 });
}
