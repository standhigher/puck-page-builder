"use client";

import { WebRenderer } from "@standhigher/puck-page-builder/renderer";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { loadSessionDocument } from "../lib/page-document-session";
import type { PageDocument } from "@standhigher/puck-page-builder";

export function PageDocumentPreview({ initialDocument }: { initialDocument: PageDocument }) {
  const subscribe = useCallback(() => () => undefined, []);
  const snapshot = useMemo(() => loadSessionDocument(initialDocument), [initialDocument]);
  const getSnapshot = useCallback(() => snapshot, [snapshot]);
  const getServerSnapshot = useCallback(() => initialDocument, [initialDocument]);
  const document = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return <WebRenderer document={document} className="pb-web-renderer pb-web-renderer--demo" />;
}
