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

每个 Ready-to-go 页面都由 `ReadyToGoRuntimeProvider` 包裹。查询区块只发起受控 `query`，物流进度、配送信息和推荐区块都订阅同一份 RuntimeState：

```tsx
<ReadyToGoRuntimeProvider query={query}>
  <WebRenderer document={document} registry={registry} />
</ReadyToGoRuntimeProvider>
```

不传 `query` 且不传 `transport` 时，Provider 使用显式 Mock，适用于本地编辑与 Mock Preview。对接原 Shopify Track Page 后端时注入 `transport.post`，不要再手写一套 camelCase 查询参数。鉴权、超时和 App Proxy 前缀仍由宿主补在 `post` 里。失败不会回退为 Mock，也不要把 Session Token、订单私密数据或查询结果写入 `PageDocument`。

```tsx
import {
  ReadyToGoRuntimeProvider,
  withShopifyAppProxyPrefix
} from "@standhigher/besttrack-page-extension";

<ReadyToGoRuntimeProvider
  transport={{
    post: (url, body) => apiPost(withShopifyAppProxyPrefix(url, APP_PROXY_PREFIX), body)
  }}
>
  <WebRenderer document={document} registry={registry} />
</ReadyToGoRuntimeProvider>
```

Ready-to-go 只换了 PageDocument + WebRenderer 渲染链路。`transport` 路径完整复用原 Track Page 逻辑：

- `POST /track/query?_t=Date.now()`，请求体 `{ order_number, email, tracking_number, lang }`
- `lang` 来自 `?lang=`、`bestrack_locale` 或宿主传入的 locale
- 网络失败重试一次；`code !== 0` 或重试耗尽都显示未找到订单
- 进度、物流时间、预计送达、`ad_config` 按原页面规则映射
- 表单只校验非空，文案与原页面一致
- URL 深链读写 `tracking_number` / `order_number` / `email`（search 优先，hash 回退）
- 独立 `POST /products/recommend`，请求体 `{ page, page_size }`
- 未传入 `watermark` 时沿用原 powered-by 隐藏规则

自定义 `query` 仍可用于 Mock、测试或新的 Consumer Runtime；一旦传入 `query`，就不再走 `/track/query`。

Shopify Demo 的 `/page-builder` 已包含该模板的编辑器和 Consumer WebRenderer 预览。独立访问时使用 Mock；通过嵌入式 Shopify 应用访问时才启用现有 Session Token 保护的 Live DataSource。

## 查询未找到订单

原 Track Page 把业务失败和请求失败都显示为未找到订单。`transport` 路径与此一致：`code !== 0` 或重试耗尽后，Ready-to-go 在进度区块显示原插图和 `Can not find order`，配送详情和广告收起。独立加载的推荐商品继续显示。插图随包内联，无需宿主额外复制静态资源。

若宿主注入自定义 `query` 并抛错，Ready-to-go 仍显示受控错误提示，以便新的 Consumer Runtime 区分不可用与未找到。不要把 Mock 结果当作失败回退。

## 响应式与样式隔离

区块使用受控 `--pb-*` Theme Token，并仅在 WebRenderer 的页面范围内生效。查询表单在窄视口会自动换行，结果卡片不使用固定最小宽度，因此同一 WebRenderer 可用于 375、768、1280 与 1440 宽度的容器。生产店铺仍需在实际 Shopify Theme 中进行人工视觉验收。
