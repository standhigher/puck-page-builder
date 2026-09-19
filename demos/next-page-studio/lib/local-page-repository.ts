"use client";

import type { PageDocument } from "@standhigher/puck-page-builder";
import { migratePageDocument } from "@standhigher/puck-page-builder";
import type { TemplateDefinition } from "@standhigher/puck-page-builder/extensions";

const storageKey = "besttrack-page-studio.records.v1";

export type HistoryEntry = {
  id: string;
  createdAt: string;
  action: "created" | "saved" | "published" | "restored";
  document: PageDocument;
};

export type PageRecord = {
  pageId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedVersion: number;
  draftDocument: PageDocument;
  publishedDocument?: PageDocument;
  history: HistoryEntry[];
};

type Store = { records: PageRecord[] };
const listeners = new Set<() => void>();
let cachedSerialized: string | null = null;
let cachedStore: Store = { records: [] };

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function now() { return new Date().toISOString(); }
function ensureDocument(value: unknown): PageDocument | null {
  const migration = migratePageDocument(value);
  return migration.success ? migration.data : null;
}
function normalizeRecord(value: unknown): PageRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PageRecord>;
  const draftDocument = ensureDocument(raw.draftDocument);
  if (!draftDocument || typeof raw.pageId !== "string" || draftDocument.pageId !== raw.pageId) return null;
  const publishedDocument = raw.publishedDocument === undefined ? undefined : ensureDocument(raw.publishedDocument);
  if (raw.publishedDocument !== undefined && (!publishedDocument || publishedDocument.pageId !== raw.pageId)) return null;
  const history = Array.isArray(raw.history) ? raw.history.flatMap((entry) => {
    const document = ensureDocument((entry as Partial<HistoryEntry>).document);
    const action = (entry as Partial<HistoryEntry>).action;
    return document && typeof (entry as Partial<HistoryEntry>).id === "string" && typeof (entry as Partial<HistoryEntry>).createdAt === "string" && ["created", "saved", "published", "restored"].includes(action ?? "")
      ? [{ id: (entry as HistoryEntry).id, createdAt: (entry as HistoryEntry).createdAt, action: action as HistoryEntry["action"], document }]
      : [];
  }) : [];
  return {
    pageId: raw.pageId,
    title: typeof raw.title === "string" ? raw.title : draftDocument.settings.seoTitle || raw.pageId,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now(),
    ...(typeof raw.publishedAt === "string" ? { publishedAt: raw.publishedAt } : {}),
    publishedVersion: typeof raw.publishedVersion === "number" ? raw.publishedVersion : 0,
    draftDocument,
    ...(publishedDocument ? { publishedDocument } : {}),
    history
  };
}
function readStore(): Store {
  if (typeof window === "undefined") return { records: [] };
  try {
    const serialized = window.localStorage.getItem(storageKey) ?? "{}";
    if (serialized === cachedSerialized) return cachedStore;
    const parsed = JSON.parse(serialized) as Partial<Store>;
    cachedSerialized = serialized;
    cachedStore = { records: Array.isArray(parsed.records) ? parsed.records.map(normalizeRecord).filter((record): record is PageRecord => record !== null) : [] };
    return cachedStore;
  } catch { return cachedStore; }
}
function writeStore(store: Store) {
  const serialized = JSON.stringify(store);
  cachedSerialized = serialized;
  cachedStore = store;
  window.localStorage.setItem(storageKey, serialized);
  listeners.forEach((listener) => listener());
}
function snapshot(document: PageDocument, action: HistoryEntry["action"]): HistoryEntry {
  return { id: crypto.randomUUID(), createdAt: now(), action, document: clone(document) };
}
function replace(record: PageRecord) {
  const store = readStore();
  writeStore({ records: [record, ...store.records.filter((item) => item.pageId !== record.pageId)] });
  return clone(record);
}

export function listPages() { return readStore().records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone); }
export function subscribeToPages(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey) listener(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
export function pageListSnapshot() { return readStore().records; }
export function pageSnapshot(pageId: string) { return readStore().records.find((item) => item.pageId === pageId) ?? null; }
export function getPage(pageId: string) {
  const record = readStore().records.find((item) => item.pageId === pageId);
  return record ? clone(record) : null;
}
export function createPage(template: TemplateDefinition): PageRecord {
  return createPageFromDocument(template.create(), template.name);
}
export function createPageFromDocument(sourceDocument: PageDocument, title: string): PageRecord {
  const pageId = `page-${crypto.randomUUID().slice(0, 8)}`;
  const draftDocument = ensureDocument({ ...clone(sourceDocument), pageId });
  if (!draftDocument) throw new Error("Template generated an invalid PageDocument.");
  const createdAt = now();
  return replace({ pageId, title, createdAt, updatedAt: createdAt, publishedVersion: 0, draftDocument, history: [snapshot(draftDocument, "created")] });
}
export function saveDraft(pageId: string, document: PageDocument, title?: string): PageRecord {
  const current = getPage(pageId);
  const draftDocument = ensureDocument(document);
  if (!current || !draftDocument || draftDocument.pageId !== pageId) throw new Error("Invalid draft document.");
  const updatedAt = now();
  return replace({ ...current, ...(title?.trim() ? { title: title.trim() } : {}), updatedAt, draftDocument, history: [snapshot(draftDocument, "saved"), ...current.history].slice(0, 30) });
}
export function publishPage(pageId: string, document: PageDocument, title?: string): PageRecord {
  const saved = saveDraft(pageId, document, title);
  const publishedAt = now();
  return replace({ ...saved, publishedAt, updatedAt: publishedAt, publishedVersion: saved.publishedVersion + 1, publishedDocument: clone(saved.draftDocument), history: [snapshot(saved.draftDocument, "published"), ...saved.history].slice(0, 30) });
}
export function restoreDraft(pageId: string, entryId: string): PageRecord {
  const current = getPage(pageId);
  const entry = current?.history.find((item) => item.id === entryId);
  if (!current || !entry) throw new Error("History entry not found.");
  const updatedAt = now();
  return replace({ ...current, updatedAt, draftDocument: clone(entry.document), history: [snapshot(entry.document, "restored"), ...current.history].slice(0, 30) });
}
