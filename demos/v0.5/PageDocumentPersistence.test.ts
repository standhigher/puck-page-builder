import { beforeEach, describe, expect, it } from "vitest";
import { migratePageDocument, type PageDocument } from "../../src/core/schema/page-document";
import { GET as getDraft, PUT as putDraft } from "../shopify-app/app/api/page-documents/[pageId]/draft/route";
import { GET as getPublished, POST as postPublished } from "../shopify-app/app/api/page-documents/[pageId]/published/route";
import { getDraft as readDraft, getPublished as readPublished, resetPageDocumentStore, saveDraft } from "../shopify-app/lib/page-document-store";

const document: PageDocument = {
  schemaVersion: 1,
  pageId: "v05-demo",
  target: "web",
  root: {},
  settings: { locale: "en" },
  blocks: [{ id: "text-1", type: "core.text", version: 1, props: { content: "Draft" } }]
};

const context = { params: Promise.resolve({ pageId: document.pageId }) };

describe("V0.5 PageDocument persistence", () => {
  beforeEach(() => resetPageDocumentStore());

  it("migrates the pre-versioned legacy Demo shape before it crosses the persistence boundary", () => {
    const legacy = { ...document } as Partial<PageDocument>;
    delete legacy.schemaVersion;
    const migration = migratePageDocument(legacy);
    expect(migration).toEqual({ success: true, data: document, migrated: true });
  });

  it("stores isolated draft and published snapshots", () => {
    const saved = saveDraft(document.pageId, document, new Date("2026-01-02T03:04:05.000Z"));
    saved.document.blocks[0].props.content = "Mutated response";
    expect(readDraft(document.pageId)?.document.blocks[0].props.content).toBe("Draft");
    expect(readPublished(document.pageId)).toBeUndefined();
  });

  it("exposes draft save/load and atomic publish through the Demo APIs", async () => {
    const saved = await putDraft(new Request("http://demo/api", { method: "PUT", body: JSON.stringify(document) }), context);
    expect(saved.status).toBe(200);
    expect((await getDraft(new Request("http://demo/api"), context)).status).toBe(200);

    const published = await postPublished(new Request("http://demo/api", { method: "POST", body: JSON.stringify({ ...document, settings: { locale: "zh-CN" } }) }), context);
    expect(published.status).toBe(200);
    const publishedPayload = await (await getPublished(new Request("http://demo/api"), context)).json() as { document: PageDocument; publishedAt: string };
    expect(publishedPayload.document.settings.locale).toBe("zh-CN");
    expect(publishedPayload.publishedAt).toBeTruthy();
    expect(readDraft(document.pageId)?.document.settings.locale).toBe("zh-CN");
  });

  it("rejects a document whose identity disagrees with the URL", async () => {
    const response = await putDraft(new Request("http://demo/api", { method: "PUT", body: JSON.stringify({ ...document, pageId: "different" }) }), context);
    expect(response.status).toBe(400);
  });
});
