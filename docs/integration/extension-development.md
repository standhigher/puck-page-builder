# 常规扩展开发

扩展让业务方在不修改 Page Builder Core 的前提下提供区块、字段、DataSource、模板、操作与 UI 插槽。公开类型和 Registry 位于 `@standhigher/puck-page-builder/extensions`。

## 扩展规则

- Extension、Block、Field、DataSource、Template、Action 和 Slot ID 都必须为小写命名空间 ID，例如 `besttrack.tracking-status`。
- Block 必须声明 `targets`，当前有效值为 `web`、`email` 或 `all`。
- `render.web` 必须是无副作用的 React 组件；不得在其中读取管理端 Session 或直接请求私有数据。
- `defaultProps`、`block.props` 和 `binding.params` 必须可序列化为 JSON。
- 跨扩展依赖使用 `dependsOn`；Registry 会拒绝循环依赖、缺失依赖和重复定义。

## 最小 Web 区块

```tsx
import type { FieldProps, PageBuilderExtension } from "@standhigher/puck-page-builder/extensions";

type NoticeProps = { title: string; description: string };

function DeliveryNotice(props: NoticeProps) {
  return <section aria-label={props.title}><h2>{props.title}</h2><p>{props.description}</p></section>;
}

function DeliveryTitleField({ value, onChange }: FieldProps) {
  return <label>标题<input value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

export const deliveryExtension: PageBuilderExtension = {
  name: "besttrack.delivery",
  version: "1.0.0",
  fields: [{ type: "besttrack.delivery-title", component: DeliveryTitleField }],
  blocks: [{
    type: "besttrack.delivery-notice",
    version: 1,
    label: "配送通知",
    category: "BestTrack",
    targets: ["web"],
    defaultProps: { title: "配送进度", description: "我们会持续更新包裹状态。" },
    fields: {
      title: { field: "besttrack.delivery-title", label: "标题", required: true }
    },
    render: { web: DeliveryNotice }
  }]
};
```

当前包不会为扩展自动提供通用文本字段。需要在编辑器属性面板编辑业务 props 时，扩展应先注册自己的 `FieldDefinition`，再在区块的 `fields` 中引用它。

将其加入业务侧稳定 Registry 后，`WebRenderer` 即可渲染该区块：

```ts
const registry = createExtensionRegistry([deliveryExtension]);
```

## 版本演进

- `BlockDefinition.version` 表示区块自身的数据版本；变更 props 语义时递增它。
- `PageDocument.schemaVersion` 是整个文档版本；迁移集中在 `migratePageDocument`。
- 删除或重命名已发布区块前，先提供兼容渲染或数据迁移；不能只从 Registry 移除。

## 开发检查

每个业务扩展至少应覆盖：Registry 装配、默认 props、Web 渲染、非法参数及禁用扩展后的表现。DataSource 场景继续阅读 [DataSource 接入](./data-source.md)。
