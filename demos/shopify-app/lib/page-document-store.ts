import { migratePageDocument, type PageDocument, type PageDocumentIssue } from "@standhigher/puck-page-builder/schema";

export type StoredPageDocument = {
  document: PageDocument;
  updatedAt: string;
};

export type PublishedPageDocument = StoredPageDocument & {
  publishedAt: string;
};

export class PageDocumentStoreError extends Error {
  constructor(readonly issues: PageDocumentIssue[]) {
    super("Invalid PageDocument");
  }
}

const drafts = new Map<string, StoredPageDocument>();
const published = new Map<string, PublishedPageDocument>();

function clone(document: PageDocument): PageDocument {
  return JSON.parse(JSON.stringify(document)) as PageDocument;
}

function validateForPage(pageId: string, value: unknown): PageDocument {
  const migration = migratePageDocument(value);
  if (!migration.success) throw new PageDocumentStoreError(migration.issues);
  if (migration.data.pageId !== pageId) {
    throw new PageDocumentStoreError([{ path: "$.pageId", message: "URL 中的 pageId 必须与文档一致" }]);
  }
  return migration.data;
}

/**
 * Process-memory storage is intentional: this API exists only to exercise the
 * V0.5 draft/publish contract in the Shopify Demo, not as production storage.
 */
export function getDraft(pageId: string): StoredPageDocument | undefined {
  const record = drafts.get(pageId);
  return record && { ...record, document: clone(record.document) };
}

export function saveDraft(pageId: string, value: unknown, now = new Date()): StoredPageDocument {
  const record = { document: clone(validateForPage(pageId, value)), updatedAt: now.toISOString() };
  drafts.set(pageId, record);
  return { ...record, document: clone(record.document) };
}

export function getPublished(pageId: string): PublishedPageDocument | undefined {
  const record = published.get(pageId);
  return record && { ...record, document: clone(record.document) };
}

export function publishDocument(pageId: string, value: unknown, now = new Date()): PublishedPageDocument {
  const draft = saveDraft(pageId, value, now);
  const record = { ...draft, document: clone(draft.document), publishedAt: now.toISOString() };
  published.set(pageId, record);
  return { ...record, document: clone(record.document) };
}

/** Test-only reset for the demo's process-memory adapter. */
export function resetPageDocumentStore() {
  drafts.clear();
  published.clear();
}
