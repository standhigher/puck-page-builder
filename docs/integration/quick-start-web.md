# Web 渲染快速开始

本指南在业务站点中渲染一份**已发布**的 `PageDocument`。示例使用 Next.js App Router；其他 React 服务端框架遵循同一顺序。

## 1. 安装与样式

业务应用应依赖 `@standhigher/puck-page-builder`，并在全局样式入口引入包样式：

```tsx
// app/layout.tsx
import "@standhigher/puck-page-builder/styles.css";
```

不要从仓库相对路径导入 `src/styles.css`；接入方只使用包公开子路径。

## 2. 提供已发布文档仓储

业务应用需要自行实现仓储。它应只返回已发布版本，返回值仍视为不可信输入：

```ts
// lib/page-document-repository.ts
export async function loadPublishedDocument(pageId: string): Promise<unknown | null> {
  // 从业务数据库、CMS 或发布服务读取 JSON。
  // 不要返回草稿；不要在这里把第三方数据写入文档。
  return null;
}
```

## 3. 创建稳定的扩展装配

同一个页面的编辑、预览和正式 Web 渲染必须使用同一组启用扩展：

```ts
// lib/page-builder-registry.ts
import { createExtensionRegistry } from "@standhigher/puck-page-builder/extensions";
import { bestTrackExtension } from "./besttrack-extension";

export const pageBuilderRegistry = createExtensionRegistry([bestTrackExtension]);
```

扩展注册失败（重复 ID、依赖缺失、非法 target）应在应用启动阶段暴露，而不是延后到页面请求时静默忽略。

## 4. 在服务端页面渲染

```tsx
// app/pages/[pageId]/page.tsx
import { migratePageDocument } from "@standhigher/puck-page-builder";
import { WebRenderer } from "@standhigher/puck-page-builder/renderer";
import { notFound } from "next/navigation";
import { loadPublishedDocument } from "../../../lib/page-document-repository";
import { pageBuilderRegistry } from "../../../lib/page-builder-registry";

export default async function PublishedPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const stored = await loadPublishedDocument(pageId);
  const migration = migratePageDocument(stored);

  if (!migration.success || migration.data.pageId !== pageId) notFound();

  return <WebRenderer document={migration.data} registry={pageBuilderRegistry} />;
}
```

`migratePageDocument` 既是旧文档升级入口，也是 Web 边界的结构校验。校验失败时不要尝试自行修复或直接渲染原始 JSON。

## 5. 验收清单

- 已发布文本、图片和业务 Web 区块在页面中出现。
- 不存在的页面、非法文档和 pageId 不匹配均不会渲染。
- 未注册的业务区块安全跳过，并留下可观测日志。
- 页面请求没有读取草稿、浏览器 token 或管理端 Session。
- 编辑器预览和生产页面使用同一扩展装配。

## 下一步

页面包含 `binding` 时，继续阅读 [Runtime 接入](./runtime.md) 与 [DataSource 接入](./data-source.md)。仅注册 DataSource 不会让此页面自动取得实时数据。
