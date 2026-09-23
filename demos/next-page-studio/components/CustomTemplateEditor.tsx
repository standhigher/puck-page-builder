"use client";

import { AppProvider, TextField } from "@shopify/polaris";
import { PageDocumentEditorShell, type PageDocument } from "@standhigher/puck-page-builder";
import { useState, useSyncExternalStore } from "react";
import { customTemplateSnapshot, saveCustomTemplate, subscribeToCustomTemplates, type CustomTemplateRecord } from "../lib/custom-template-repository";
import { pageStudioRegistry } from "../lib/registry";
import { StudioAdPreview } from "../lib/studio-ad";
import { studioProductPicker } from "../lib/studio-product-picker";
import { templateProfile } from "../lib/template-profiles";

export function CustomTemplateEditor({ templateId }: { templateId: string }) {
  const template = useSyncExternalStore(subscribeToCustomTemplates, () => customTemplateSnapshot(templateId), () => null);
  if (!template) return <main className="studio-message"><h1>自定义模板不存在</h1><a href="/templates">返回模板中心</a></main>;
  return <LoadedCustomTemplateEditor key={template.id} template={template} />;
}

function LoadedCustomTemplateEditor({ template: initialTemplate }: { template: CustomTemplateRecord }) {
  const [template, setTemplate] = useState(initialTemplate);
  const [name, setName] = useState("");
  const profile = templateProfile(template.sourceTemplateId);
  const availableBlockTypes = profile?.allowedBlockTypes ?? [...new Set(template.document.blocks.map((block) => block.type))];
  const save = async (document: PageDocument) => setTemplate(saveCustomTemplate(template.id, document, name));
  return <AppProvider i18n={{}}><main className="editor-page"><header className="studio-editor-bar"><a href="/templates">← 模板中心</a><TextField label="模板名称" labelHidden value={name || template.name} onChange={setName} autoComplete="off" /><span>自定义模板 · 基于 {profile?.id ?? template.sourceTemplateId}</span><div><a className="studio-link-button" href={`/template-studio/${template.id}/preview`} target="_blank">预览模板</a></div></header>
    <StudioAdPreview><PageDocumentEditorShell key={template.updatedAt} initialDocument={template.document} registry={pageStudioRegistry} policy={profile?.editorPolicy} availableBlockTypes={availableBlockTypes} appearanceControls productPicker={studioProductPicker} onSave={save} /></StudioAdPreview>
  </main></AppProvider>;
}
