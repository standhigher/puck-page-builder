# BestTrack Page Builder

> npm 包的唯一正式标识：`@standhigher/puck-page-builder`。产品展示名和目录名不能替代它出现在安装命令、代码导入或集成配置中。

## 阅读顺序

开始任何 Page Builder 接入或开发任务前，按以下顺序阅读：

1. `docs/integration/ai-integration-guide.md`
2. `docs/integration/quick-start-web.md`
3. 与任务相符的扩展、Runtime、DataSource 或文档存储专题。

`demos/shopify-app/AGENTS.md` 对该 Demo 中的 Next.js 改动同样生效，且优先于本文件。

## 当前产品边界

- 当前优先目标是：业务宿主读取已发布的 `PageDocument` 并完成 Web 渲染。
- 包已提供 `PageDocument` 校验/迁移、`ExtensionRegistry`、编辑器和 `WebRenderer`。
- 包**尚未**提供通用 Runtime、自动数据绑定解析、缓存或统一鉴权编排；这些由业务宿主实现。
- `WebRenderer` 仅接收文档和 Registry，不会自动执行 DataSource 或注入其结果。

## 代码归属与公开入口

- 可复用库源码：`packages/puck-page-builder/src/`。
- 可运行示例：`demos/`；不要把 Demo 的内存存储或客户端鉴权直接当作生产实现。
- 优先从 `@standhigher/puck-page-builder`、`/renderer`、`/extensions`、`/schema` 导入公开能力。
- 扩展、区块、字段、数据源和模板均使用稳定的命名空间 ID，例如 `besttrack.tracking-status`。

## 数据与安全

- 所有外部文档在读取和发布边界都要经过 `migratePageDocument`。
- `PageDocument` 与 `binding.params` 只能保存 JSON 数据；禁止保存 token、密钥或订单隐私数据。
- 生产 Web 的 Live DataSource 只能由服务端 Runtime 调用；Shopify Demo 的客户端 Session 模式仅用于嵌入式 Admin 验证。失败时不得静默退回 mock 数据。

## 验证

修改后至少执行与改动相称的检查；完整门禁为：

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```
