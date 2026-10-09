"use client";

import { useMemo } from "react";
import { pageStudioRegistry } from "../lib/registry";
import { StudioDocument } from "./StudioDocument";

export function TemplateLoadingPreview({ templateId }: { templateId: string }) {
  const template = pageStudioRegistry.getTemplate(templateId);
  const document = useMemo(() => template?.create(), [template]);
  if (!template || !document) return <main className="studio-message"><h1>模板不存在</h1><a href="/templates">返回模板列表</a></main>;
  return <main>
    <header className="preview-bar">
      <a href="/templates">← 返回模板</a>
      <span>查询 Loading 演示 · 请求不会结束</span>
      <a className="studio-link-button" href={`/templates/${encodeURIComponent(templateId)}/preview`}>普通预览</a>
    </header>
    <StudioDocument document={document} holdLoading />
  </main>;
}
