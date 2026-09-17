# BestTrack Page Builder：AI 接入指南

本文件是 AI 参与接入、排查或扩展开发时的事实导航。它不替代源码；当文档与源码不一致时，以包公开入口和测试为准。

## 正式名称

安装、导入和依赖配置一律使用 `@standhigher/puck-page-builder`。`BestTrack Page Builder` 仅为产品展示名，`packages/puck-page-builder` 仅为仓库目录，二者均不能替代 npm 包名。

## 任务开始时必须确认

1. 当前目标是 Web 渲染、编辑器、扩展、数据源还是存储？
2. 目标是 `published` 还是 `preview`？
3. 是否涉及外部数据、鉴权或租户隔离？
4. 本次使用的是已实现 API，还是在设计尚未存在的 Runtime 能力？

## 必读顺序

1. 仓库根目录 `AGENTS.md`。
2. [接入总览](./README.md)。
3. 目标专题文档。
4. 对应的公开源码与 `demos/shopify-app` 实例。

## 事实清单

| 主题 | 当前事实 |
| --- | --- |
| 文档模型 | `PageDocument` 仅保存 JSON 结构、静态 props 与可选 binding。 |
| 校验入口 | 所有外部文档用 `migratePageDocument` 读取、迁移与校验。 |
| Web 渲染 | `WebRenderer` 渲染核心区块和 Registry 中的 `render.web`。 |
| 扩展 | 用 `createExtensionRegistry` 装配，ID 必须命名空间化。 |
| DataSource | 可注册 `mock`、`live` 和参数校验，但不会被 `WebRenderer` 自动调用。 |
| Runtime | 不是当前包 API；由业务宿主负责绑定解析、鉴权、缓存、容错。 |
| Demo 存储 | 进程内存，仅用于演示，不能用于生产。 |

## Web 渲染任务模板

```text
输入：pageId、请求上下文、已发布文档仓储、启用扩展
步骤：
1. 依据请求上下文验证访问范围。
2. 读取已发布 JSON。
3. migratePageDocument；失败则中止或 404。
4. 装配确定性的 ExtensionRegistry。
5. 若需要实时数据，交给服务端宿主 Runtime。
6. 使用 WebRenderer 输出页面。
7. 记录未知区块、绑定失败和渲染降级。
输出：不含 secret 的 Web 响应。
```

## 新增扩展任务模板

```text
1. 选择稳定命名空间 ID，例如 besttrack.delivery-notice。
2. 定义默认 JSON props、target 和 render.web。
3. 如需编辑，定义 fields；如需数据，声明 dataSources。
4. 注册至业务 Registry，而不是修改 Core 的区块列表。
5. 为渲染、注册冲突、参数错误和禁用状态编写测试。
6. 更新专题接入文档与示例。
```

## 严禁假设

- 不假设 DataSource 会自动执行或自动进入 `render.web` props。
- 不假设 Demo API、Demo 内存存储或 Shopify Admin Token 可用于消费者 Web 页面。
- 不假设未知区块可安全忽略而无需记录。
- 不把 API key、token、客户数据写入 `PageDocument`、`binding.params`、客户端状态或日志。
- 不通过修改包 Core 来实现单个业务区块。

## 代码导航

| 能力 | 位置 |
| --- | --- |
| 包公共入口 | `packages/puck-page-builder/src/index.ts` |
| 文档模型 | `packages/puck-page-builder/src/core/schema/page-document.ts` |
| 扩展类型 | `packages/puck-page-builder/src/core/extensions/types.ts` |
| Registry | `packages/puck-page-builder/src/core/extensions/registry.ts` |
| Web Renderer | `packages/puck-page-builder/src/renderer/web/WebRenderer.tsx` |
| Shopify 扩展示例 | `demos/shopify-app/lib/besttrack-extension.tsx` |
| Demo 数据绑定示例 | `demos/shopify-app/lib/page-builder-data-binding.ts` |

## 交付前检查

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

同时说明：改动涉及的 target、文档来源、扩展清单、数据源模式、鉴权边界、失败降级策略与未实现能力。
