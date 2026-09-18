# Ready-to-go 模板

V0.7.0 的内置模板 ID 为 `besttrack.ready-to-go`、版本为 `1`，默认包含订单查询、物流进度、配送信息和推荐商品四个 Web 区块。通过业务扩展包注册：

```ts
import { bestTrackPageExtension } from "@standhigher/besttrack-page-extension";
import { createExtensionRegistry } from "@standhigher/puck-page-builder/runtime";

const registry = createExtensionRegistry([bestTrackPageExtension]);
const document = registry.getTemplate("besttrack.ready-to-go")!.create();
```

模板创建出的页面是普通 `PageDocument`，可在编辑器修改并保存；之后的模板升级不会自动覆盖已有页面。

## RuntimeState 与数据边界

每个 Ready-to-go 页面都由 `ReadyToGoRuntimeProvider` 包裹。查询区块只发起受控 `queryTracking`，物流进度、配送信息和推荐区块都订阅同一份 RuntimeState：

```tsx
<ReadyToGoRuntimeProvider queryTracking={queryTracking}>
  <WebRenderer document={document} registry={registry} />
</ReadyToGoRuntimeProvider>
```

不传 `queryTracking` 时，Provider 使用显式 Mock，适用于本地编辑与 Mock Preview。Live 模式必须由宿主注入已鉴权的 Consumer Runtime API 查询函数；失败会显示受控错误，不会回退为 Mock。不要将 Session Token、订单私密数据或查询结果写入 `PageDocument`。

Shopify Demo 的 `/page-builder` 已包含该模板的编辑器和 Consumer WebRenderer 预览。独立访问时使用 Mock；通过嵌入式 Shopify 应用访问时才启用现有 Session Token 保护的 Live DataSource。

## 响应式与样式隔离

区块使用受控 `--pb-*` Theme Token，并仅在 WebRenderer 的页面范围内生效。查询表单在窄视口会自动换行，结果卡片不使用固定最小宽度，因此同一 WebRenderer 可用于 375、768、1280 与 1440 宽度的容器。生产店铺仍需在实际 Shopify Theme 中进行人工视觉验收。
