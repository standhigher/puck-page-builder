# Runtime 接入

## 当前状态

本包没有导出的通用 `Runtime` 类或自动绑定引擎。现有 `WebRenderer` 接收：

```ts
type WebRendererProps = {
  document: PageDocument;
  registry?: ExtensionRegistry;
  className?: string;
};
```

因此，业务应用必须在调用 `WebRenderer` 前处理页面读取、授权、绑定解析、缓存、超时和降级。不要把这些职责放进 React 区块组件。

## 推荐的宿主 Runtime 契约

第一阶段可在业务项目中定义一个服务端模块，而不是修改包 API：

```ts
type RuntimeMode = "preview" | "published";

type WebRuntimeResult = {
  document: PageDocument;
  blockData: Record<string, unknown>;
  blockErrors: Record<string, { code: string; message: string }>;
};

async function prepareWebPage(pageId: string, mode: RuntimeMode): Promise<WebRuntimeResult> {
  // 读取文档 → migrate/validate → 解析允许的数据绑定 → 形成渲染结果。
  throw new Error("Implement in the host application");
}
```

这只是推荐接入契约，不是当前包的公开 API。

## Runtime 的职责

1. 按页面、店铺、访客或订单等业务上下文执行访问控制。
2. 读取草稿或已发布文档，并用 `migratePageDocument` 验证。
3. 为当前 target 创建确定性的 `ExtensionRegistry`。
4. 审核区块是否允许调用声明的 DataSource，再执行参数校验。
5. 并发控制、超时、缓存、重试、追踪与错误归类。
6. 将结果投影为临时渲染数据；不得将结果或机密写回已发布 `PageDocument`。
7. 对每个失败区块采用明确策略：隐藏、占位、上次成功缓存或受控错误卡片。

## 绑定数据如何进入 Web 区块

当前 `WebRenderer` 不会把 `blockData` 作为额外 props 传给 `render.web`。首个业务接入应由宿主选择并明确记录一种策略：

- **静态优先**：只渲染文档中的 props；含 binding 的区块显示受控占位。
- **临时投影**：Runtime 将可信数据转换为临时 props 副本，再传给 `WebRenderer`；该副本绝不保存回文档。
- **业务包装器**：由宿主按区块类型渲染并显式传入 `blockData`；适合需要 loading/error 状态的实时区块。

不要在未定义投影规则前，让区块组件自行读取 DataSource。这会绕开鉴权、缓存与错误边界。

## 发布页面与预览页面

| 模式 | 文档来源 | 数据模式 | 安全要求 |
| --- | --- | --- | --- |
| `published` | 已发布快照 | Live 或可公开的缓存 | 服务端授权、稳定缓存、无管理端 token |
| `preview` | 有权限的草稿 | Mock 优先，可选受控 Live | 明确操作人和审计信息 |

Live 失败不应自动回退到 mock；mock 仅用于明确选择的预览/开发模式。
