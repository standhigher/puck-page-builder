"use client";

import { useSyncExternalStore } from "react";
import { pageSnapshot, subscribeToPages } from "../lib/local-page-repository";
import { StudioDocument } from "./StudioDocument";

export function PageViewer({ pageId, mode }: { pageId: string; mode: "draft" | "published" }) {
  const page = useSyncExternalStore(subscribeToPages, () => pageSnapshot(pageId), () => null);
  const document = mode === "published" ? page?.publishedDocument : page?.draftDocument;
  if (!page || !document) return <main className="studio-message"><h1>{mode === "published" ? "页面尚未发布" : "页面不存在"}</h1><a href="/pages">返回我的页面</a></main>;
  return <main><header className="preview-bar"><a href={mode === "published" ? "/pages" : `/pages/${pageId}/edit`}>← 返回</a><span>{mode === "published" ? `已发布页面 · v${page.publishedVersion}` : "草稿预览 · Mock 数据"}</span>{mode === "published" ? null : <a className="studio-link-button" href={`/pages/${pageId}/edit`}>继续编辑</a>}</header><StudioDocument document={document} previewAutoQuery={mode === "draft"} /></main>;
}
