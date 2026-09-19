# BestTrack Page Studio

独立的 Next.js 第一阶段示例：模板选择、创建页面、模板约束编辑、本地历史、草稿预览与发布快照。

```bash
pnpm dev
```

打开 `http://localhost:3000/templates`。

## 边界

- 草稿、历史和发布快照只保存在当前浏览器的 `localStorage`，用于本地演示。
- Preview 和发布展示都使用明确注入的 Mock Runtime；不请求 BestTrack 或 Shopify 服务。
- 真实业务接入应以服务端仓储保存已发布快照，并在读取边界使用 `migratePageDocument` 校验；Live 查询由宿主 Runtime 负责，不能写回 `PageDocument`。
