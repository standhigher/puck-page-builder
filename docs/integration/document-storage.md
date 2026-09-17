# 文档存储与发布

`PageDocument` 是可持久化的页面描述，而不是运行时数据缓存。存储层至少应区分草稿与已发布快照。

## 最小数据模型

```text
page_documents
  page_id
  tenant_id / shop_id
  draft_document_json
  draft_updated_at
  published_document_json
  published_at
  published_version
```

生产实现可拆分为多张表，但必须保证“发布版本”是可原子读取的快照。

## 写入边界

```text
编辑器提交 JSON
  → migratePageDocument
  → pageId / 租户 / target 授权校验
  → 草稿保存

发布请求
  → 再次 migratePageDocument
  → 业务发布前校验
  → 原子写入 published 快照与版本
```

不要信任浏览器传入的 pageId、tenantId、target 或 block type；它们都必须与服务端上下文和 Registry 再次比对。

## 迁移与未知区块

- 每次读取草稿或已发布文档都调用 `migratePageDocument`。
- 迁移失败时保留原始 JSON 与错误详情，禁止覆盖为默认文档。
- 已发布文档中的未知区块应按产品策略安全跳过或显示降级内容，同时产生告警。
- 删除扩展前，先评估引用它的已发布页面并准备迁移或兼容渲染。

## Demo 限制

`demos/shopify-app` 使用进程内 `Map` 保存草稿和发布文档，只用于演示 API 契约。部署重启、水平扩容或多租户环境都不能使用该实现。
