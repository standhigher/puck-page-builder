"use client";

import type { PageDocument, ThemeTokens } from "@standhigher/puck-page-builder";
import { migratePageDocument } from "@standhigher/puck-page-builder";

const storageKey = "besttrack-page-studio.custom-templates.v1";

export type CustomTemplateRecord = {
  id: string;
  name: string;
  sourceTemplateId: string;
  createdAt: string;
  updatedAt: string;
  document: PageDocument;
};

type Store = { templates: CustomTemplateRecord[] };
const listeners = new Set<() => void>();
const emptyStore: Store = { templates: [] };
let cachedSerialized: string | null = null;
let cachedStore: Store = emptyStore;

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function now() { return new Date().toISOString(); }
function documentOrNull(value: unknown): PageDocument | null {
  const migration = migratePageDocument(value);
  return migration.success ? migration.data : null;
}
function normalize(value: unknown): CustomTemplateRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CustomTemplateRecord>;
  const document = documentOrNull(raw.document);
  if (!document || typeof raw.id !== "string" || !raw.id.startsWith("besttrack.custom.") || document.templateId !== raw.id || typeof raw.name !== "string" || !raw.name.trim() || typeof raw.sourceTemplateId !== "string") return null;
  return { id: raw.id, name: raw.name, sourceTemplateId: raw.sourceTemplateId, createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now(), updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now(), document };
}
function readStore(): Store {
  if (typeof window === "undefined") return emptyStore;
  try {
    const serialized = window.localStorage.getItem(storageKey) ?? "{}";
    if (serialized === cachedSerialized) return cachedStore;
    const parsed = JSON.parse(serialized) as Partial<Store>;
    cachedSerialized = serialized;
    cachedStore = { templates: Array.isArray(parsed.templates) ? parsed.templates.map(normalize).filter((template): template is CustomTemplateRecord => template !== null) : [] };
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
function replace(template: CustomTemplateRecord) {
  const store = readStore();
  writeStore({ templates: [template, ...store.templates.filter((item) => item.id !== template.id)] });
  return clone(template);
}

export function subscribeToCustomTemplates(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey) listener(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
export function customTemplateListSnapshot() { return readStore().templates; }
/** Stable SSR snapshot. A fresh array on each call makes useSyncExternalStore loop. */
export function customTemplateListServerSnapshot() { return emptyStore.templates; }
export function customTemplateSnapshot(id: string) { return readStore().templates.find((template) => template.id === id) ?? null; }
export function getCustomTemplate(id: string) {
  const template = customTemplateSnapshot(id);
  return template ? clone(template) : null;
}
export function createCustomTemplate(sourceTemplateId: string, sourceDocument: PageDocument, name: string, sourceTheme: ThemeTokens = {}): CustomTemplateRecord {
  const suffix = crypto.randomUUID().slice(0, 8);
  const id = `besttrack.custom.${suffix}`;
  const templateName = name.trim() || "Untitled template";
  // A custom template is not part of the immutable Registry, so preserve the
  // source template tokens as document-level tokens before changing templateId.
  const document = documentOrNull({ ...clone(sourceDocument), pageId: `template-${suffix}`, templateId: id, templateVersion: 1, theme: { ...sourceTheme, ...sourceDocument.theme }, settings: { ...sourceDocument.settings, seoTitle: templateName } });
  if (!document) throw new Error("Template source generated an invalid PageDocument.");
  const createdAt = now();
  return replace({ id, name: templateName, sourceTemplateId, createdAt, updatedAt: createdAt, document });
}
export function saveCustomTemplate(id: string, document: PageDocument, name?: string): CustomTemplateRecord {
  const current = getCustomTemplate(id);
  const nextDocument = documentOrNull({ ...document, templateId: id, templateVersion: 1 });
  if (!current || !nextDocument) throw new Error("Invalid custom template.");
  const templateName = name?.trim() || current.name;
  return replace({ ...current, name: templateName, updatedAt: now(), document: { ...nextDocument, settings: { ...nextDocument.settings, seoTitle: templateName } } });
}
