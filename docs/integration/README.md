# BestTrack Page Builder 接入指南

本目录面向两类读者：把已发布页面接入业务 Web 站点的应用开发者，以及为页面构建器增加业务能力的扩展开发者。

## 正式包名

所有安装、导入、依赖声明和对外接入文档统一使用 npm 包名：`@standhigher/puck-page-builder`。

- `BestTrack Page Builder` 是产品展示名。
- `packages/puck-page-builder` 是本仓库内的源码目录。
- 只有 `@standhigher/puck-page-builder` 及其公开子路径（`/renderer`、`/extensions`、`/schema`、`/styles.css`）可作为业务应用的集成标识。

## 建议阅读路径

| 目标 | 先读 |
| --- | --- |
| 在业务站点渲染一个已发布页面 | [Web 快速开始](./quick-start-web.md) |
| 新增业务区块、字段或模板 | [常规扩展开发](./extension-development.md) |
| 配置模板、Variant 与 Theme Token | [模板与主题](./template-theme.md) |
| 接入 Ready-to-go 模板 | [Ready-to-go 模板](./ready-to-go.md) |
| 接入 Branded 模板 | [Branded 模板](./branded-template.md) |
| 接入 Sales 模板 | [Sales 模板](./sales-template.md) |
| 设计服务端页面加载、数据绑定与降级 | [Runtime 接入](./runtime.md) |
| 对接外部 Consumer Runtime API | [Consumer Runtime API 契约](./consumer-runtime-api.md) |
| 接 BestTrack 或其他实时数据 | [DataSource 接入](./data-source.md) |
| 实现草稿、发布与数据库持久化 | [文档存储](./document-storage.md) |
| 让 AI 参与接入或开发 | [AI 接入指南](./ai-integration-guide.md) |

## Web 接入的最小链路

```text
HTTP 请求
  → 读取已发布 PageDocument
  → migratePageDocument（校验并迁移）
  → 创建 ExtensionRegistry
  → 业务 Runtime（按需解析绑定数据）
  → WebRenderer
```

## 已实现能力与宿主责任

| 能力 | 当前状态 | 归属 |
| --- | --- | --- |
| `PageDocument` 创建、校验、迁移 | 已实现 | 包 |
| 核心文本、图片与扩展 Web 区块渲染 | 已实现 | 包 |
| 扩展、区块、字段、模板、DataSource 注册 | 已实现 | 包 |
| 草稿/发布 API 示例 | 仅 Demo | `demos/shopify-app` |
| 生产数据库与访问控制 | 待业务接入 | 宿主应用 |
| Runtime、绑定解析、缓存、鉴权编排 | 待业务接入 | 宿主应用 |
| DataSource 结果自动传入 `WebRenderer` | 未实现 | 后续 Runtime 设计 |

不要把“已注册 DataSource”理解为“页面渲染时已自动取数”。当前 `WebRenderer` 只根据文档的静态 `props` 和 Registry 中的 `render.web` 渲染区块。

## 第一阶段交付建议

先完成一个生产可用的 Web 路径：

1. 用真实数据库替换 Demo 的进程内存存储。
2. 仅读取已发布文档，并在服务端迁移/校验。
3. 注册 `core.text`、`core.image` 与一个 BestTrack Web 区块。
4. 为数据源失败设计明确的区块降级界面与日志。
5. 在完成上述闭环前，不扩展编辑器、邮件渲染或版本回滚。
