"use client";

import { useSyncExternalStore } from "react";
import { customTemplateSnapshot, subscribeToCustomTemplates } from "../lib/custom-template-repository";
import { StudioDocument } from "./StudioDocument";

export function CustomTemplatePreview({ templateId }: { templateId: string }) {
  const template = useSyncExternalStore(subscribeToCustomTemplates, () => customTemplateSnapshot(templateId), () => null);
  if (!template) return <main className="studio-message"><h1>自定义模板不存在</h1><a href="/templates">返回模板中心</a></main>;
  return <main><header className="preview-bar"><a href="/templates">← 返回模板中心</a><span>自定义模板预览 · Mock 数据</span><a className="studio-link-button" href={`/template-studio/${template.id}/edit`}>编辑模板</a></header><StudioDocument document={template.document} previewAutoQuery /></main>;
}
