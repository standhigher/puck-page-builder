# BestTrack Page Builder

基于 React、TypeScript、Puck 和 Shopify Polaris 的页面构建器。通过可持久化的 `PageDocument` 描述页面，使用扩展 Registry 装配业务区块，并由 `WebRenderer` 渲染 Web 页面。

仓库包含通用构建器、BestTrack 物流业务扩展，以及独立 Page Studio 和 Shopify 嵌入式应用两个 Next.js 示例。

> 通用构建器的正式 npm 包名为 `@standhigher/puck-page-builder`；安装、导入和依赖配置均使用该名称。BestTrack 业务扩展独立发布为 `@standhigher/besttrack-page-extension`。

## 快速开始

建议使用 Node.js 22 LTS，并按根目录 `package.json` 的 `packageManager` 配置使用 pnpm 11.19.0。

在仓库根目录执行：

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会依次构建两个库包，再启动 `demos/next-page-studio`。打开 [http://localhost:3000/templates](http://localhost:3000/templates) 选择模板并创建页面。

Page Studio 支持模板预览、页面编辑、本地历史、草稿预览和发布快照；内置模板可克隆为自定义模板，再编辑、预览并用于创建新页面。

| 路径 | 用途 |
| --- | --- |
| `/templates` | 模板列表与创建页面入口 |
| `/pages` | 页面列表 |
| `/pages/[pageId]/edit` | 页面编辑 |
| `/pages/[pageId]/preview` | 草稿预览 |
| `/p/[pageId]` | 本地已发布快照展示 |
| `/template-studio/[templateId]/edit` | 自定义模板编辑 |

草稿、历史、发布快照和自定义模板仅保存在当前浏览器的 `localStorage`。预览与发布展示使用明确注入的 Mock 查询，不请求 BestTrack 或 Shopify 服务；本地发布不会生成可供其他设备访问的生产页面。

库包由 Demo 通过构建产物引用。修改 `packages/` 下源码后，需要重新构建对应包或重启根目录的 `pnpm dev`。

## 当前能力

### 通用构建器

- **文档模型**：创建、校验和迁移 `PageDocument`，保存 JSON props、主题、区块顺序及可选数据绑定声明。
- **扩展机制**：注册区块、字段、模板、DataSource、操作、生命周期钩子和 UI 插槽；检查重复 ID 与扩展依赖。
- **编辑器**：区块添加、选择、拖拽排序、复制和删除，画布与属性面板同步，撤销/重做，以及桌面、平板和移动端预览。
- **编辑约束**：支持必需区块、单例区块及宿主操作策略；删除确认、字段校验、资源选择器和草稿/发布适配接口。
- **属性配置**：文本、颜色、图片和商品等控件；颜色默认值与重置，自定义字段可读取默认值、只读兄弟字段及本地化重置文案。宿主可通过 `inspectorActions` 控制属性面板底部的操作按钮。
- **Web 渲染**：根据文档与 Registry 渲染核心文本、图片和业务扩展区块。

### BestTrack 业务扩展

内置 **Ready-to-go、Branded、Sales** 三套模板，保留各自布局，共用 `TrackingRuntimeProvider` 管理查询、最近查询、多包裹切换、物流结果、独立推荐商品和消费者物流语言。

- 支持运单号、订单号加邮箱两种查询方式，并提供 Shopify Track Page 接口适配能力。
- 推荐商品独立加载，优先展示商家选品；广告和实时查询结果通过运行时数据提供。
- Ready-to-go 提供按区块配置的背景色、查询卡片圆角与阴影、输入框和按钮圆角、图片圆角及间距；编辑器与服务端校验共用样式规则。
- Ready-to-go 配送区提供承运商显示开关；承运商区域仅展示名称，缺失时显示随物流语言翻译的占位文案。
- 广告图片使用 16:9 比例、最大宽度 500px，窄屏随容器缩小；画布、预览和发布页使用一致的展示规则。
- 编辑器支持英语、简体中文、西班牙语、欧洲葡萄牙语和法语。消费者的 Translate updates 与编辑器语言、文档语言分别管理。

模板中的必要区块受编辑策略保护，推荐商品区块可删除后重新添加。升级模板不会自动覆盖已保存页面或补齐历史文档中缺失的区块。

## 仓库结构

```text
packages/
  puck-page-builder/         通用文档模型、Registry、编辑器和 WebRenderer
  besttrack-page-extension/  BestTrack 模板、物流 Runtime、字段与接口适配
demos/
  next-page-studio/          默认启动的独立 Page Studio
  shopify-app/               Shopify 嵌入式应用与服务端 API 示例
  v*/                       各阶段功能与回归验证用例
docs/
  integration/              当前接入指南与能力边界
  besttrack-page-builder/    产品设计与阶段开发资料
```

可复用能力放在 `packages/`，业务宿主示例放在 `demos/`。当前 API 以公开源码和测试为准，阶段设计资料不代表所有规划能力均已实现。

## 接入业务应用

安装通用包及宿主需要提供的 peer dependencies：

```bash
pnpm add @standhigher/puck-page-builder react@^18 react-dom@^18 @puckeditor/core@^0.23.0 @shopify/polaris@^13.9.5 @shopify/polaris-icons@^9.3.1
```

使用 BestTrack 模板时，额外安装：

```bash
pnpm add @standhigher/besttrack-page-extension
```

在应用全局样式入口引入：

```tsx
import "@standhigher/puck-page-builder/styles.css";
```

以下示例渲染宿主已经读取的已发布文档；扩展装配应与编辑、预览时保持一致：

```tsx
import { migratePageDocument } from "@standhigher/puck-page-builder";
import { createExtensionRegistry } from "@standhigher/puck-page-builder/extensions";
import { WebRenderer } from "@standhigher/puck-page-builder/renderer";
import {
  bestTrackPageExtension,
  bestTrackBrandedExtension,
  bestTrackSalesExtension,
} from "@standhigher/besttrack-page-extension";

const registry = createExtensionRegistry([
  bestTrackPageExtension,
  bestTrackBrandedExtension,
  bestTrackSalesExtension,
]);

export function PublishedPage({ storedDocument }: { storedDocument: unknown }) {
  const migration = migratePageDocument(storedDocument);
  if (!migration.success) throw new Error("Invalid published PageDocument");

  return <WebRenderer document={migration.data} registry={registry} />;
}
```

此示例只展示文档校验与渲染。真实物流查询需由宿主显式装配业务 `TrackingRuntimeProvider` 并提供已授权的查询与推荐接口，详见 [共用物流基础能力](./docs/integration/ready-to-go-shared-foundation.md)。

### 公开入口

| 入口 | 用途 |
| --- | --- |
| `@standhigher/puck-page-builder` | 编辑器、文档操作与基础导出 |
| `@standhigher/puck-page-builder/renderer` | WebRenderer |
| `@standhigher/puck-page-builder/extensions` | 扩展类型与 Registry |
| `@standhigher/puck-page-builder/schema` | 文档类型、校验与迁移 |
| `@standhigher/puck-page-builder/theme` | 主题 token 与合并工具 |
| `@standhigher/puck-page-builder/runtime` | 面向消费者页面的渲染、Schema、Registry 和主题导出，不包含编辑器 UI |
| `@standhigher/besttrack-page-extension` | 三套模板、共享物流 Provider 与业务适配能力 |
| `@standhigher/besttrack-page-extension/admin` | 编辑器多语言文案 |
| `@standhigher/besttrack-page-extension/validation` | 业务文档校验 |

`/runtime` 是消费者侧公共入口，不是通用数据绑定执行引擎。

### 生产接入边界

- 所有外部文档在读取和发布边界都必须经过 `migratePageDocument`，并由宿主检查页面、租户、访问权限和业务区块规则。
- `WebRenderer` 不会执行 DataSource、解析 `binding` 或自动注入实时数据。通用 Runtime、缓存、超时和鉴权编排由业务宿主实现。
- 生产 Live DataSource 由服务端 Runtime 调用；浏览器只能通过宿主授权接口访问业务数据。Live 失败不得静默回退为 Mock。
- `PageDocument` 和 `binding.params` 只能保存 JSON 配置，禁止保存 token、密钥、客户订单隐私或实时查询结果。
- 已发布页面读取已发布快照；数据库、租户隔离和生产发布存储由宿主提供。

## Shopify Demo

若要验证 Shopify 示例，在根目录完成安装后执行：

```bash
pnpm --filter @standhigher/puck-page-builder build
pnpm --filter @standhigher/besttrack-page-extension build
pnpm --filter @standhigher/demo-shopify-app dev
```

单独启动时打开 [http://localhost:3000/page-builder](http://localhost:3000/page-builder)。直接本地访问使用 standalone 模式；若 Page Studio 已占用该端口，请以终端输出的地址为准。

嵌入式开发店铺验证：

1. 将 `demos/shopify-app/.env.example` 复制为同目录下的 `.env.local`。
2. 配置所连接 Shopify 应用的 `NEXT_PUBLIC_SHOPIFY_API_KEY` 和 `SHOPIFY_API_SECRET`；Live 查询与资源服务配置按示例环境文件补充。
3. 确认 `shopify.app.toml` 对应目标开发应用，在 `demos/shopify-app` 目录执行 `shopify app dev`。
4. 从开发店铺打开嵌入式应用，验证 App Bridge、Session Token 和 App Proxy 链路。

`.env.local` 不应提交。客户端 Session 模式用于嵌入式 Admin 验证，不能作为生产消费者页面的鉴权方案。

该 Demo 提供 `GET/PUT /api/page-documents/:pageId/draft` 和 `GET/POST /api/page-documents/:pageId/published`，使用进程内存存储，重启后数据丢失。

## 开发与验证

在根目录执行完整门禁：

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

`pnpm build` 构建两个库包和两个 Next.js Demo；`pnpm typecheck` 会先构建库包，再检查根项目、库包和 Demo 的类型。

参与开发前先阅读 [AGENTS.md](./AGENTS.md)、[AI 接入指南](./docs/integration/ai-integration-guide.md) 和 [Web 快速开始](./docs/integration/quick-start-web.md)，再阅读任务对应专题。Demo 内的改动还需遵循其目录下的项目约定。

## 文档导航

| 主题 | 文档 |
| --- | --- |
| 接入路径与能力边界 | [接入总览](./docs/integration/README.md) |
| 扩展区块、字段与画布编辑 | [扩展开发](./docs/integration/extension-development.md) |
| 模板、Variant 与主题 | [模板与主题](./docs/integration/template-theme.md) |
| Ready-to-go 配置与模块样式 | [Ready-to-go](./docs/integration/ready-to-go.md) |
| Branded / Sales 模板 | [Branded](./docs/integration/branded-template.md) · [Sales](./docs/integration/sales-template.md) |
| 三套模板共用的查询与推荐逻辑 | [共用基础能力](./docs/integration/ready-to-go-shared-foundation.md) |
| 预览自动查 Demo | [预览规则](./docs/integration/ready-to-go-preview-demo.md) |
| 广告与推荐商品 | [动态内容](./docs/integration/track-page-dynamic-content.md) |
| 消费者物流语言 | [Translate updates](./docs/integration/translate-updates.md) |
| 服务端编排与实时数据 | [Runtime](./docs/integration/runtime.md) · [DataSource](./docs/integration/data-source.md) |
| 外部消费者服务契约 | [Consumer Runtime API](./docs/integration/consumer-runtime-api.md) |
| 草稿、发布与持久化 | [文档存储](./docs/integration/document-storage.md) |

两个库包仍处于 1.0 之前的版本。升级时应检查公开 API、文档迁移和已有页面兼容性；版本号以各包的 `package.json` 为准。
