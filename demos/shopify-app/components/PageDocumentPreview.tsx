"use client";

import { WebRenderer } from "@standhigher/puck-page-builder/renderer";
import { migratePageDocument, type PageDocument } from "@standhigher/puck-page-builder";
import { useEffect, useState } from "react";

export function PageDocumentPreview({ initialDocument }: { initialDocument: PageDocument }) {
  const [document, setDocument] = useState(initialDocument);

  useEffect(() => {
    let active = true;
    const loadPublished = async () => {
      const response = await fetch(`/api/page-documents/${encodeURIComponent(initialDocument.pageId)}/published`, { cache: "no-store" });
      if (!response.ok) return;
      const stored = await response.json() as { document: unknown };
      const migration = migratePageDocument(stored.document);
      if (active && migration.success) setDocument(migration.data);
    };
    void loadPublished().catch(() => undefined);
    return () => { active = false; };
  }, [initialDocument]);

  return <WebRenderer document={document} className="pb-web-renderer pb-web-renderer--demo" />;
}
