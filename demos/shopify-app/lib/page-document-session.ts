import type { PageDocument } from "@standhigher/puck-page-builder";

const storageKey = "besttrack-page-builder:v0.2:document";

/**
 * Demo-only browser cache used to exercise reload behavior without adding the
 * V0.5 draft persistence API or any backend storage.
 */
export function loadSessionDocument(fallback: PageDocument): PageDocument {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.sessionStorage.getItem(storageKey);
    return value ? JSON.parse(value) as PageDocument : fallback;
  } catch {
    return fallback;
  }
}

export function saveSessionDocument(document: PageDocument) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(storageKey, JSON.stringify(document));
}
