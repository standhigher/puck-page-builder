import { NextResponse } from "next/server";
import { getPublished, PageDocumentStoreError, publishDocument } from "../../../../../lib/page-document-store";

type RouteContext = { params: Promise<{ pageId: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  const document = getPublished(pageId);
  return document ? NextResponse.json(document) : NextResponse.json({ error: "published-document-not-found" }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  try {
    return NextResponse.json(publishDocument(pageId, await request.json()));
  } catch (error) {
    if (error instanceof PageDocumentStoreError) return NextResponse.json({ error: "invalid-page-document", issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
}
