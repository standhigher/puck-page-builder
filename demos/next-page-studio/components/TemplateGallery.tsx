"use client";

import { useRouter } from "next/navigation";
import { createPage } from "../lib/local-page-repository";
import { pageStudioRegistry } from "../lib/registry";
import { templateProfile } from "../lib/template-profiles";

export function TemplateGallery() {
  const router = useRouter();
  const templates = pageStudioRegistry.templates.filter((template) => template.target === "web" && templateProfile(template.id));
  return <main className="studio-page">
    <header className="studio-page__header"><div><p className="studio-eyebrow">BESTTRACK PAGE STUDIO</p><h1>选择一个页面模板</h1><p>创建后会生成可独立编辑的本地草稿；模板更新不会覆盖你的页面。</p></div><a className="studio-link-button" href="/pages">我的页面</a></header>
    <section className="template-grid" aria-label="页面模板">
      {templates.map((template) => <article className="template-card" key={template.id}>
        <div className={`template-card__cover template-card__cover--${template.id.split(".").at(-1)}`} aria-hidden="true"><span>{template.name}</span></div>
        <div className="template-card__body"><p className="studio-eyebrow">内置模板 · Web</p><h2>{template.name}</h2><p>{templateProfile(template.id)?.summary}</p><small>{template.requiredBlocks?.length ?? 0} 个业务区块</small></div>
        <footer><button type="button" className="studio-button studio-button--secondary" onClick={() => router.push(`/templates/${encodeURIComponent(template.id)}/preview`)}>预览</button><button type="button" className="studio-button" onClick={() => { const page = createPage(template); router.push(`/pages/${page.pageId}/edit`); }}>使用此模板</button></footer>
      </article>)}
    </section>
  </main>;
}
