"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { customTemplateListSnapshot, subscribeToCustomTemplates } from "../lib/custom-template-repository";
import { pageListSnapshot, subscribeToPages } from "../lib/local-page-repository";

const templatePreviews = [
  { label: "Ready-to-go 预览", href: "/templates/besttrack.ready-to-go/preview" },
  { label: "Branded 预览", href: "/templates/besttrack.branded/preview" },
  { label: "Sales 预览", href: "/templates/besttrack.sales/preview" }
];

export function RouteNavigator() {
  const pathname = usePathname();
  const router = useRouter();
  const pages = useSyncExternalStore(subscribeToPages, pageListSnapshot, () => []);
  const templates = useSyncExternalStore(subscribeToCustomTemplates, customTemplateListSnapshot, () => []);
  return <nav className="studio-route-nav" aria-label="Studio 页面导航">
    <a className="studio-route-nav__brand" href="/templates">BestTrack Studio</a>
    <div className="studio-route-nav__links">
      <a className={pathname === "/templates" ? "is-active" : undefined} href="/templates">模板中心</a>
      <a className={pathname === "/pages" ? "is-active" : undefined} href="/pages">我的页面</a>
      {templatePreviews.map((item) => <a className={pathname === item.href ? "is-active" : undefined} href={item.href} key={item.href}>{item.label}</a>)}
    </div>
    <label className="studio-route-nav__picker"><span>页面路由</span><select aria-label="选择页面路由" defaultValue="" onChange={(event) => { if (event.target.value) router.push(event.target.value); }}>
      <option value="" disabled>选择已创建页面…</option>
      {pages.map((page) => <optgroup key={page.pageId} label={page.title}>
        <option value={`/pages/${page.pageId}/edit`}>编辑草稿</option>
        <option value={`/pages/${page.pageId}/preview`}>草稿预览</option>
        {page.publishedDocument ? <option value={`/p/${page.pageId}`}>已发布页 v{page.publishedVersion}</option> : null}
      </optgroup>)}
      {templates.map((template) => <optgroup key={template.id} label={`模板：${template.name}`}>
        <option value={`/template-studio/${template.id}/edit`}>编辑模板</option>
        <option value={`/template-studio/${template.id}/preview`}>模板预览</option>
      </optgroup>)}
    </select></label>
  </nav>;
}
