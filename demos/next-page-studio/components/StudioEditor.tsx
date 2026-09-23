"use client";

import { AppProvider, TextField } from "@shopify/polaris";
import { PageDocumentEditorShell, type PageDocument } from "@standhigher/puck-page-builder";
import { useState, useSyncExternalStore } from "react";
import { pageSnapshot, publishPage, saveDraft, subscribeToPages, type PageRecord } from "../lib/local-page-repository";
import { pageStudioRegistry } from "../lib/registry";
import { StudioAdPreview } from "../lib/studio-ad";
import { studioProductPicker } from "../lib/studio-product-picker";
import { templateProfile } from "../lib/template-profiles";

export function StudioEditor({ pageId }: { pageId: string }) {
  const record = useSyncExternalStore(subscribeToPages, () => pageSnapshot(pageId), () => null);
  if (!record) return <main className="studio-message"><h1>页面不存在</h1><a href="/pages">返回我的页面</a></main>;
  return <LoadedStudioEditor key={record.pageId} record={record} />;
}

function LoadedStudioEditor({ record: initialRecord }: { record: PageRecord }) {
  const [record, setRecord] = useState(initialRecord);
  const [title, setTitle] = useState("");
  const pageId = record.pageId;
  const profile = templateProfile(record.draftDocument.templateId);
  const save = async (document: PageDocument) => { setRecord(saveDraft(pageId, document, title)); };
  const publish = async (document: PageDocument) => { setRecord(publishPage(pageId, document, title)); };
  return <AppProvider i18n={{}}><main className="editor-page"><header className="studio-editor-bar"><a href="/pages">← 我的页面</a><TextField label="页面名称" labelHidden value={title || record.title} onChange={setTitle} autoComplete="off" /><span>{record.publishedDocument ? `已发布 v${record.publishedVersion}` : "草稿"}</span><div><a className="studio-link-button" href={`/pages/${pageId}/preview`} target="_blank">预览</a></div></header>
    <StudioAdPreview><PageDocumentEditorShell initialDocument={record.draftDocument} registry={pageStudioRegistry} policy={profile?.editorPolicy} availableBlockTypes={profile?.allowedBlockTypes} appearanceControls productPicker={studioProductPicker} onSave={save} onPublish={publish} /></StudioAdPreview>
  </main></AppProvider>;
}
