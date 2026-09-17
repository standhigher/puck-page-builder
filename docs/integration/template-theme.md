# 模板、Variant 与 Theme Token

V0.6.1 定义了页面的模板与样式协议，但不提供 Ready-to-go、Branded、Sales 的正式模板，也不提供模板商城 UI。

## 新页面文档

新文档仍使用 `schemaVersion: 1`。没有已接入的历史页面，因此当前 `migratePageDocument` 是严格校验边界，不会把旧形状自动转换为新形状。

`templateId` 存在时必须同时保存正整数 `templateVersion`。`theme` 是页面 Token 覆盖；每个区块必须保存 `variant` 和 `style`，其中 `style` 同样只能是 Token 覆盖：

```json
{
  "schemaVersion": 1,
  "pageId": "tracking-page",
  "target": "web",
  "templateId": "besttrack.tracking.starter",
  "templateVersion": 1,
  "theme": { "color.primary": "#008060" },
  "root": {},
  "settings": { "locale": "en" },
  "blocks": [{
    "id": "tracking-status",
    "type": "besttrack.tracking-status",
    "version": 1,
    "variant": "emphasis",
    "style": { "color.primary": "#d72c0d" },
    "props": { "heading": "Track your order" }
  }]
}
```

可保存的 Token 仅包括颜色、字体、圆角和间距这一组受控键：`color.background`、`color.surface`、`color.text`、`color.muted`、`color.primary`、`color.border`、`font.family`、`font.size`、`radius`、`spacing`。Token 值不能包含 CSS 块或声明分隔符；任意 CSS 属性、函数、密钥和 API URL 都不能写入文档。

## 扩展与模板注册

业务区块通过 `defaultVariant` 和 `variants` 声明可选视觉形式。每个 Variant 可贡献 Token，但不运行代码：

```ts
const block = {
  type: "besttrack.tracking-status",
  defaultVariant: "default",
  variants: [{ id: "default", label: "Default" }, {
    id: "emphasis",
    label: "Emphasis",
    theme: { "color.primary": "#5c3bfe" }
  }]
};
```

`TemplateDefinition` 必须声明 `source: "built-in" | "marketplace" | "custom"`，并可使用 `requiredBlocks` 声明它需要的已注册区块。`createExtensionRegistry` 会在装配期拒绝缺失依赖，避免请求时静默失败。模板只生成初始 `PageDocument`；它不能携带任意 JavaScript、全局 CSS、API Token、鉴权信息或 API URL，也不会自动改写既有文档。

## Theme 合并与消费者 Runtime

`WebRenderer` 按以下优先级合并 Token：系统默认 → 模板 → 页面 → Variant → 区块。最终 Token 以 `--pb-*` CSS 变量写到渲染范围内，不污染 Shopify Theme 的全局样式。

消费者页面从独立入口导入：

```tsx
import { WebRenderer, migratePageDocument } from "@standhigher/puck-page-builder/runtime";
```

该入口不打包 Puck Editor、Builder UI、Polaris 或 App Bridge。它仍不会执行 DataSource；数据绑定、鉴权、缓存和失败降级继续由服务端宿主 Runtime 负责。
