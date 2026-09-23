"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { createCustomTemplate, customTemplateListServerSnapshot, customTemplateListSnapshot, subscribeToCustomTemplates } from "../lib/custom-template-repository";
import { createPage, createPageFromDocument } from "../lib/local-page-repository";
import { pageStudioRegistry } from "../lib/registry";
import { templateProfile } from "../lib/template-profiles";

export function TemplateGallery() {
  const router = useRouter();
  const templates = pageStudioRegistry.templates.filter((template) => template.target === "web" && templateProfile(template.id));
  const customTemplates = useSyncExternalStore(subscribeToCustomTemplates, customTemplateListSnapshot, customTemplateListServerSnapshot);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [baseTemplateId, setBaseTemplateId] = useState(templates[0]?.id ?? "");
  const createFromBase = (templateId: string, name: string) => {
    const base = templates.find((template) => template.id === templateId);
    if (!base) return;
    const custom = createCustomTemplate(base.id, base.create(), name || `${base.name} copy`, base.theme);
    router.push(`/template-studio/${custom.id}/edit`);
  };
  return <main className="studio-page">
    <header className="studio-page__header"><div><p className="studio-eyebrow">BESTTRACK PAGE STUDIO</p><h1>选择或创建页面模板</h1><p>内置模板保持只读；编辑时会生成一份可保存、可复用的本地自定义模板。</p></div><div className="studio-page__actions"><button type="button" className="studio-button" onClick={() => setCreatorOpen((open) => !open)}>新建自定义模板</button><a className="studio-link-button" href="/pages">我的页面</a></div></header>
    {creatorOpen ? <section className="template-creator" aria-label="创建自定义模板"><h2>基于现有模板创建</h2><label>模板名称<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="例如：秋季品牌物流页" /></label><label>基础模板<select value={baseTemplateId} onChange={(event) => setBaseTemplateId(event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><div><button type="button" className="studio-button studio-button--secondary" onClick={() => setCreatorOpen(false)}>取消</button><button type="button" className="studio-button" onClick={() => createFromBase(baseTemplateId, templateName)}>创建并编辑</button></div></section> : null}
    <h2 className="template-section-title">内置模板</h2><section className="template-grid" aria-label="内置页面模板">
      {templates.map((template) => <article className="template-card" key={template.id}>
        <div className={`template-card__cover template-card__cover--${template.id.split(".").at(-1)}`} aria-hidden="true"><span>{template.name}</span></div>
        <div className="template-card__body"><p className="studio-eyebrow">内置模板 · Web</p><h2>{template.name}</h2><p>{templateProfile(template.id)?.summary}</p><small>{template.requiredBlocks?.length ?? 0} 个业务区块</small></div>
        <footer><button type="button" className="studio-button studio-button--secondary" onClick={() => router.push(`/templates/${encodeURIComponent(template.id)}/preview`)}>预览</button><button type="button" className="studio-button studio-button--secondary" onClick={() => createFromBase(template.id, `${template.name} copy`)}>编辑副本</button><button type="button" className="studio-button" onClick={() => { const page = createPage(template); router.push(`/pages/${page.pageId}/edit`); }}>使用</button></footer>
      </article>)}
    </section>
    <h2 className="template-section-title">自定义模板</h2>{customTemplates.length === 0 ? <section className="empty-template-state"><p>尚未创建自定义模板。选择一个内置模板作为基础，即可调整区块、字段和样式后重复使用。</p></section> : <section className="template-grid" aria-label="自定义页面模板">{customTemplates.map((template) => <article className="template-card" key={template.id}>
      <div className="template-card__cover template-card__cover--custom" aria-hidden="true"><span>{template.name}</span></div><div className="template-card__body"><p className="studio-eyebrow">自定义模板 · 本地</p><h2>{template.name}</h2><p>基于 {templates.find((item) => item.id === template.sourceTemplateId)?.name ?? template.sourceTemplateId} 创建，包含 {template.document.blocks.length} 个区块。</p><small>最近编辑 {new Date(template.updatedAt).toLocaleString()}</small></div><footer><button type="button" className="studio-button studio-button--secondary" onClick={() => router.push(`/template-studio/${template.id}/preview`)}>预览</button><button type="button" className="studio-button studio-button--secondary" onClick={() => router.push(`/template-studio/${template.id}/edit`)}>编辑模板</button><button type="button" className="studio-button" onClick={() => { const page = createPageFromDocument(template.document, template.name); router.push(`/pages/${page.pageId}/edit`); }}>使用</button></footer>
    </article>)}</section>}
  </main>;
}
