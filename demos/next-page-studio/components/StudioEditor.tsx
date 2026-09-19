"use client";

import { AppProvider, Button, Modal, TextField } from "@shopify/polaris";
import { PageDocumentEditorShell, type PageDocument } from "@standhigher/puck-page-builder";
import { useState, useSyncExternalStore } from "react";
import { pageSnapshot, publishPage, restoreDraft, saveDraft, subscribeToPages, type PageRecord } from "../lib/local-page-repository";
import { pageStudioRegistry } from "../lib/registry";
import { templateProfile } from "../lib/template-profiles";

export function StudioEditor({ pageId }: { pageId: string }) {
  const record = useSyncExternalStore(subscribeToPages, () => pageSnapshot(pageId), () => null);
  if (!record) return <main className="studio-message"><h1>页面不存在</h1><a href="/pages">返回我的页面</a></main>;
  return <LoadedStudioEditor key={record.pageId} record={record} />;
}

function LoadedStudioEditor({ record: initialRecord }: { record: PageRecord }) {
  const [record, setRecord] = useState(initialRecord);
  const [title, setTitle] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const pageId = record.pageId;
  const profile = templateProfile(record.draftDocument.templateId);
  const save = async (document: PageDocument) => { setRecord(saveDraft(pageId, document, title)); };
  const publish = async (document: PageDocument) => { setRecord(publishPage(pageId, document, title)); };
  return <AppProvider i18n={{}}><main className="editor-page"><header className="studio-editor-bar"><a href="/pages">← 我的页面</a><TextField label="页面名称" labelHidden value={title || record.title} onChange={setTitle} autoComplete="off" /><span>{record.publishedDocument ? `已发布 v${record.publishedVersion}` : "草稿"}</span><div><Button onClick={() => setHistoryOpen(true)}>历史记录</Button><a className="studio-link-button" href={`/pages/${pageId}/preview`} target="_blank">预览</a></div></header>
    <PageDocumentEditorShell key={record.updatedAt} initialDocument={record.draftDocument} registry={pageStudioRegistry} policy={profile?.editorPolicy} availableBlockTypes={profile?.allowedBlockTypes} appearanceControls onSave={save} onPublish={publish} />
    <Modal instant open={historyOpen} onClose={() => setHistoryOpen(false)} title="本地历史记录" primaryAction={{ content: "关闭", onAction: () => setHistoryOpen(false) }}><Modal.Section><div className="history-list">{record.history.map((entry) => <div key={entry.id}><div><strong>{entry.action === "published" ? "发布" : entry.action === "restored" ? "恢复" : entry.action === "created" ? "创建" : "保存"}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></div><Button onClick={() => { setRecord(restoreDraft(pageId, entry.id)); setHistoryOpen(false); }}>恢复为草稿</Button></div>)}</div></Modal.Section></Modal>
  </main></AppProvider>;
}
