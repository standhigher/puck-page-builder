import { NextResponse } from "next/server";
import { getDraft, PageDocumentStoreError, saveDraft } from "../../../../../lib/page-document-store";

type RouteContext = { params: Promise<{ pageId: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  const draft = getDraft(pageId);
  return draft ? NextResponse.json(draft) : NextResponse.json({ error: "draft-not-found" }, { status: 404 });
}

export async function PUT(request: Request, context: RouteContext) {
  const { pageId } = await context.params;
  try {
    return NextResponse.json(saveDraft(pageId, await request.json()));
  } catch (error) {
    if (error instanceof PageDocumentStoreError) return NextResponse.json({ error: "invalid-page-document", issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
}
