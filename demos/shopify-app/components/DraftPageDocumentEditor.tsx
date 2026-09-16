"use client";

import { Banner } from "@shopify/polaris";
import { migratePageDocument, PageDocumentEditorShell, type ExtensionRegistry, type PageDocument } from "@standhigher/puck-page-builder";
import { useEffect, useState } from "react";
import { clearLegacySessionDocument, loadLegacySessionDocument } from "../lib/page-document-session";

type DraftRecord = { document: unknown };

function endpoint(pageId: string, resource: "draft" | "published") {
  return `/api/page-documents/${encodeURIComponent(pageId)}/${resource}`;
}

async function requestDocument(url: string, method: "PUT" | "POST", document: PageDocument) {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(document) });
  if (!response.ok) throw new Error(`PageDocument request failed: ${response.status}`);
}

export function DraftPageDocumentEditor({ initialDocument, registry }: { initialDocument: PageDocument; registry: ExtensionRegistry }) {
  const [document, setDocument] = useState(initialDocument);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(endpoint(initialDocument.pageId, "draft"), { cache: "no-store" });
        if (!active) return;
        if (response.ok) {
          const stored = await response.json() as DraftRecord;
          const migration = migratePageDocument(stored.document);
          if (!migration.success) throw new Error("Stored draft is invalid");
          setDocument(migration.data);
        } else if (response.status === 404) {
          const legacy = loadLegacySessionDocument(initialDocument);
          if (JSON.stringify(legacy) !== JSON.stringify(initialDocument)) {
            await requestDocument(endpoint(initialDocument.pageId, "draft"), "PUT", legacy);
            clearLegacySessionDocument();
          }
          if (active) setDocument(legacy);
        } else {
          throw new Error(`Could not load draft: ${response.status}`);
        }
        if (active) setLoadState("ready");
      } catch {
        if (active) setLoadState("error");
      }
    };
    void load();
    return () => { active = false; };
  }, [initialDocument]);

  if (loadState === "error") return <Banner tone="critical" title="无法加载草稿">草稿 API 未返回可用的 PageDocument；编辑器未进入可编辑状态。</Banner>;

  return <PageDocumentEditorShell
    initialDocument={document}
    registry={registry}
    loadState={loadState}
    onSave={(next) => requestDocument(endpoint(next.pageId, "draft"), "PUT", next)}
    onPublish={(next) => requestDocument(endpoint(next.pageId, "published"), "POST", next)}
  />;
}
