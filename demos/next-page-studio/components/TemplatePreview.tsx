"use client";

import { useMemo } from "react";
import { pageStudioRegistry } from "../lib/registry";
import { StudioDocument } from "./StudioDocument";

export function TemplatePreview({ templateId }: { templateId: string }) {
  const template = pageStudioRegistry.getTemplate(templateId);
  const document = useMemo(() => template?.create(), [template]);
  if (!template || !document) return <main className="studio-message"><h1>模板不存在</h1><a href="/templates">返回模板列表</a></main>;
  return <main><header className="preview-bar"><a href="/templates">← 返回模板</a><span>模板预览 · Mock 数据</span><a className="studio-link-button" href="/templates">使用此模板请返回列表</a></header><StudioDocument document={document} previewAutoQuery /></main>;
}
