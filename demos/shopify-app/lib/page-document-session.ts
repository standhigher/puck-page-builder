import { migratePageDocument, type PageDocument } from "@standhigher/puck-page-builder";

const storageKey = "besttrack-page-builder:v0.2:document";

/**
 * The earlier Demo preview used a session cache before the Demo had a
 * persistence API. V0.5 reads it once so the editor can migrate that local
 * work to the draft endpoint.
 */
export function loadLegacySessionDocument(fallback: PageDocument): PageDocument {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.sessionStorage.getItem(storageKey);
    const migration = value ? migratePageDocument(JSON.parse(value)) : undefined;
    return migration?.success ? migration.data : fallback;
  } catch {
    return fallback;
  }
}

export function clearLegacySessionDocument() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey);
}
