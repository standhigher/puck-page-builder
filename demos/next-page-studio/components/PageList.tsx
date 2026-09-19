"use client";

import { useSyncExternalStore } from "react";
import { pageListSnapshot, subscribeToPages } from "../lib/local-page-repository";

export function PageList() {
  const pages = useSyncExternalStore(subscribeToPages, pageListSnapshot, () => []);
  return <main className="studio-page"><header className="studio-page__header"><div><p className="studio-eyebrow">BESTTRACK PAGE STUDIO</p><h1>我的页面</h1><p>草稿和发布快照仅保存在此浏览器的 localStorage 中。</p></div><a className="studio-link-button" href="/templates">新建页面</a></header>
    {pages.length === 0 ? <section className="empty-state"><h2>还没有页面</h2><p>从模板创建第一张 BestTrack 页面。</p><a className="studio-button" href="/templates">查看模板</a></section> : <section className="page-list">{pages.map((page) => <article key={page.pageId}><div><p className="studio-eyebrow">{page.publishedDocument ? `已发布 v${page.publishedVersion}` : "仅草稿"}</p><h2>{page.title}</h2><p>{page.draftDocument.templateId} · 最近编辑 {new Date(page.updatedAt).toLocaleString()}</p></div><div className="page-list__actions"><a className="studio-button studio-button--secondary" href={`/pages/${page.pageId}/preview`}>预览</a><a className="studio-button" href={`/pages/${page.pageId}/edit`}>编辑</a>{page.publishedDocument ? <a className="studio-text-link" href={`/p/${page.pageId}`}>查看已发布页</a> : null}</div></article>)}</section>}
  </main>;
}
