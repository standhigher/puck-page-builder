# Ready-to-go 模板

V0.7.0 的内置模板 ID 为 `besttrack.ready-to-go`、版本为 `1`，默认包含订单查询、物流进度、配送信息和推荐商品四个 Web 区块。通过业务扩展包注册：

```ts
import { bestTrackPageExtension } from "@standhigher/besttrack-page-extension";
import { createExtensionRegistry } from "@standhigher/puck-page-builder/runtime";

const registry = createExtensionRegistry([bestTrackPageExtension]);
const document = registry.getTemplate("besttrack.ready-to-go")!.create();
```

模板创建出的页面是普通 `PageDocument`，可在编辑器修改并保存。查询、进度、配送不可删除或复制；推荐商品不可复制，可以删除，删掉后仍可从区块库加回。没有数据时可隐藏内容。之后的模板升级不会自动覆盖已有页面或补齐历史缺块。三套模板的共享范围与兼容边界见 [Ready-to-go 共用基础能力](./ready-to-go-shared-foundation.md)。

配送信息区块提供“显示承运商”（Show carrier）开关，位于 Inspector 中 Carrier heading 字段卡片的标题行右侧，保存为 `besttrack.ready-to-go.delivery` 的 `props.showCarrier` 布尔值。开关关闭时 Carrier heading 输入框禁用。新页面默认开启；旧文档缺少字段时继续显示。Carrier 区域只显示承运商名称，不显示目的地；缺少承运商时显示“暂无信息”（Not available），语言跟随查单页 Runtime 的 `locale`。关闭后，Carrier 标题和承运商名称一起收起，画布、预览与发布页使用相同规则。该配置只控制 Ready-to-go 的承运商区域，查询、物流时间线、包裹内容和广告保持各自原有展示规则。

## 模块样式

四个区块的 Inspector 都有 Style 分组，字段保存在各自 `props` 中：

| 字段 | 区块 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `backgroundColor` | 全部 | `#ffffff` | 模块背景色，只接受 6 位十六进制颜色。 |
| `moduleRadius` | 订单查询 | `16px` | Tab 查询卡片圆角，单位 px；其他区块不提供此控件。 |
| `inputRadius` | 订单查询 | `33.33%` | 输入框圆润程度，0 为直角、100% 为胶囊形；默认外观仍为 8px。 |
| `buttonRadius` | 订单查询 | `27.59%` | 按钮圆润程度，0 为直角、100% 为胶囊形；默认外观仍为 8px。 |
| `shadowStrength` | 订单查询 | `"100"` | Tab 查询卡片阴影强度，范围 0–100；0 无阴影，100 保持原有阴影，中间值按比例降低透明度。 |
| `imageRadius` | 配送信息、推荐商品 | `8px` | 商品图片和广告图片的圆角，单位 px。 |
| `verticalSpacing` | 订单查询、配送信息 | 查询模块 `0px` | 模块上下额外间距，单位 px，叠加在区块自身间距之外。查询卡片内部顶部内边距为 `28px`，外层查询区上下内边距各为 `48px`。 |

阴影强度滑块显示百分比，重置为 100%。旧文档缺少强度时默认 100%；旧 `hideShadow: true` 仍按 0% 显示和渲染。配置 `shadowStrength` 后优先使用该值，旧隐藏选项不再显示。

输入框和按钮圆角保存带 `%` 后缀的 0–100 数值，分别映射到 0–24px 和 0–29px，适配现有 48px 和 58px 高度。旧文档的 `px` 或无后缀数值继续按像素渲染，滑块按最大有效圆角换算为百分比，不自动改写旧值。

查询模块新建时写入上述默认值；旧文档缺失或空值时，滑块显示对应默认值，重置也写回该默认值。已有自定义值（包括 `0`）保持不变。其他区块仍保留原有的空值继承规则。

像素字段为空表示沿用对应默认值；图片圆角默认显示和重置为 8px；有值时必须是 0–100 之间的数字，可带 `px` 后缀。输入框只接受数字和小数点，超过 100 的输入不会写入。编辑器和服务端校验入口（`@standhigher/besttrack-page-extension/validation`）使用同一套规则，非法值无法保存或发布。进度区块的 Style 分组显示背景色、进度色和字体颜色（`textColor`，默认 `#334155`，仅控制进度节点名称；未配置或空值时右侧显示默认色，重置恢复默认色），不再提供模块圆角和上下间距控件；配送信息不提供模块圆角，仅保留图片圆角和上下间距；推荐商品的 Style 分组仅保留背景色和图片圆角；旧文档保存的这些样式字段继续兼容。

画布和发布页都会把有效样式写到区块外层的 `<div data-module-style>` 上，并通过 `--pb-color-background`、`--pb-radius`、`--pb-image-radius` 传给区块内部。订单查询的 `moduleRadius` 直接应用于 Tab 查询卡片，不改变外层区块、输入框或按钮的圆角；为空时卡片恢复默认 16px。有模块样式时，区块不再绘制底部分隔线。区块本身没有内容时（例如查询前的进度区、没有商品的推荐区）不会输出外层容器。

字段名与 Best Track 之前在宿主侧追加的字段一致，已保存的文档无需迁移。Best Track 升级到包含此能力的版本后，应删除宿主侧重复的实现，否则间距和圆角会叠加两次：`withModuleStyleWrapper` 的样式包装、`styleInspectorFields`、`createStyleField`、`validateStyleProps`，以及 `host.css` 中针对 `[data-module-style]` 的覆盖规则。

## RuntimeState 与数据边界

每页由一份公共 `TrackingRuntimeProvider` 包裹。Ready-to-go、Branded、Sales 共用它；原 `ReadyToGoRuntimeProvider` 等名称保留为兼容入口。查询区块只发起受控 `query`；物流进度和配送信息订阅查单 RuntimeState。推荐商品与原 Track Page 一样页面打开即加载，不依赖是否点击查询。区块 `products` 非空时优先使用商家选品，否则读取独立推荐请求；不读取 `query` 结果中的 `recommendations`：

```tsx
// WebRenderer 只渲染文档；公共 Provider 接收宿主回调，为三套模板区块提供同一份查询状态。
// 推荐回调独立于 query，不能仅把推荐商品塞进查单返回值。
<TrackingRuntimeProvider query={query} queryRecommendations={queryRecommendations}>
  <WebRenderer document={document} registry={registry} />
</TrackingRuntimeProvider>
```

不传 `query` 且不传 `transport` 时，Provider 使用显式 Mock，适用于本地编辑与 Mock Preview。对接原 Shopify Track Page 后端时注入 `transport.post`，不要再手写一套 camelCase 查询参数。鉴权、超时和 App Proxy 前缀仍由宿主补在 `post` 里。失败不会回退为 Mock，也不要把 Session Token、订单私密数据或查询结果写入 `PageDocument`。

商家未选品时，推荐后端默认返回该店铺前 8 个产品，前端展示独立推荐请求的结果。宿主需提供 `queryRecommendations` 或 `transport` 才能取得这份默认商品；未选品本身不应被当作隐藏推荐的条件。

## 预览 Demo 与正式查单

进度和配送区块只在查单成功后渲染。正式店铺页、已发布页和 `transport` 路径必须保持「用户点击查询才出订单内容」。

仅 Mock / Studio 预览可以打开 `autoQueryDemo`：进入预览时用内部固定演示号 `BT-2048-DEMO` 自动查一笔订单，用来展示完整效果；不读取提示文案，也不把演示号填入输入框。预览 Demo 不显示 EDD（`Est. Delivery`），避免把占位日期当成真实预计送达。画布编辑器本身也不渲染 EDD。

Ready-to-go 的 `defaultTrackingNumber` / `defaultOrderNumber` 保留旧 JSON 字段名，编辑器将它们显示为 Tracking number placeholder / Order number placeholder。它们仅作为空输入框的提示文案，不再预填查询值或参与提交。旧文档里的自定义文案会继续显示，旧内置演示值 `BT-2048-DEMO` 则回退到默认提示。预览和正式 Web 共用此规则：空输入点击按钮只提示填写；用户输入、已启用的 URL 深链和历史记录回填仍可提供实际查询值。

右侧暂不显示 `Default query mode` 配置；新建页面默认使用 `tracking`，旧文档中的配置继续兼容。

画布支持点击 Tracking Number / Order Number 标签切换表单布局，也支持左右方向键、Home 和 End。切换只改变当前画布预览，不写入 `defaultQueryMode` 或触发查询。选中区块后可直接编辑当前标签标题和对应的占位提示；Order Number 模式也可编辑邮箱提示文案，右侧属性中的 Email placeholder 对应 `emailPlaceholder`。预览和正式 Web 使用同一文案，未配置或清空时显示 `Email`；提示文案不会预填邮箱值或参与提交。高度随字段数量自适应。

```tsx
// 表单每次挂载只查询内部演示编号一次，用于展示预览；这不会预填三条历史，也不会自动加载推荐。
<TrackingRuntimeProvider query={mockQuery} autoQueryDemo>
  <WebRenderer document={document} registry={registry} />
</TrackingRuntimeProvider>
```

next-page-studio 只在模板预览、自定义模板预览和草稿预览传入该开关；`/p/:pageId` 已发布页不传。回溯说明、入口对照和测试见 [Ready-to-go 预览 Demo 自动查单](./ready-to-go-preview-demo.md)。线上 `transport` / 消费者页不要打开这个开关。

对接原 Shopify Track Page 后端时注入 `transport.post`：

```tsx
import {
  TrackingRuntimeProvider,
  withShopifyAppProxyPrefix
} from "@standhigher/besttrack-page-extension";

// 未注入 query / queryRecommendations 时，transport 分别负责查单与推荐接口。
// 同一 post 封装处理 App Proxy 前缀；鉴权与请求超时等仍需由宿主 apiPost 实现。
<TrackingRuntimeProvider
  transport={{
    post: (url, body) => apiPost(withShopifyAppProxyPrefix(url, APP_PROXY_PREFIX), body)
  }}
>
  <WebRenderer document={document} registry={registry} />
</TrackingRuntimeProvider>
```

Ready-to-go 只换了 PageDocument + WebRenderer 渲染链路。`transport` 路径完整复用原 Track Page 逻辑：

- `POST /track/query?_t=Date.now()`，请求体 `{ order_number, email, tracking_number, lang }`
- `lang` 由 Runtime 当前语言写入：`?lang=` 优先，其次 `bestrack_locale`，默认 `EN`。消费者用进度卡右上角的 Translate updates 切换；不要再给 `transport` 传一份与入口脱节的 locale 快照。详见 [Translate updates](./translate-updates.md)
- 网络失败重试一次；`code !== 0` 或重试耗尽都显示未找到订单
- 进度、物流时间、预计送达、`ad_config` 按原页面规则映射
- 表单只校验非空，文案与原页面一致
- URL 深链读写 `tracking_number` / `order_number` / `email`（search 优先，hash 回退）
- 独立 `POST /products/recommend`，请求体 `{ page, page_size }`；推荐区复用原页 Embla 轮播（loop、3 秒自动播放、悬停暂停、左右箭头）
- 未传入 `watermark` 时沿用原 powered-by 隐藏规则

自定义 `query` 仍可用于 Mock、测试或新的 Consumer Runtime；一旦传入 `query`，就不再走 `/track/query`。

Shopify Demo 的 `/page-builder` 已包含该模板的编辑器和 Consumer WebRenderer 预览。独立访问时使用 Mock；通过嵌入式 Shopify 应用访问时才启用现有 Session Token 保护的 Live DataSource。

## 最近查询与包裹切换

最近成功查询去重后最多保留 3 条；切换历史记录会回填输入并恢复内存结果，不重新请求。结果包含多个包裹时，切换同时更新进度、配送、商品和广告。切换查询模式或订单邮箱后开始新的记录组。旧请求不会覆盖已切换的结果，推荐状态始终独立。

## 查询未找到订单

原 Track Page 把业务失败和请求失败都显示为未找到订单。`transport` 路径与此一致：`code !== 0` 或重试耗尽后，Ready-to-go 在进度区块显示原插图和 `Can not find order`，配送详情和广告收起。独立加载的推荐商品继续显示。插图随包内联，无需宿主额外复制静态资源。

若宿主注入自定义 `query` 并抛错，Ready-to-go 仍显示受控错误提示，以便新的 Consumer Runtime 区分不可用与未找到。不要把 Mock 结果当作失败回退。

## 物流语言

进度卡运单号右侧的 Translate updates 与 Branded / Sales 共用同一份 Runtime `locale`；移动端，或单号与语言入口同一行放不下时，改到运单号正上方。画布预览和正式查单页都走这套 Runtime，不是只在画布里切换。默认英文；列表为原 Track Page 的 10 种语言。切换后会持久化、同步 URL，并在已有成功结果时按新 `lang` 原地重查，不把时间线切到 loading。英文默认标题显示时走词典、不写回文档；商家改过的标题保持原文。编辑器 `adminLocale` 与 `PageDocument.settings.locale` 不参与这次切换。规则与宿主注意项见 [Translate updates](./translate-updates.md)。

## 响应式与样式隔离

区块使用受控 `--pb-*` Theme Token，并仅在 WebRenderer 的页面范围内生效。查询表单在窄视口会自动换行，结果卡片不使用固定最小宽度，因此同一 WebRenderer 可用于 375、768、1280 与 1440 宽度的容器。生产店铺仍需在实际 Shopify Theme 中进行人工视觉验收。

当前有效查询完成后页面会平滑滚动到结果区：成功定位到运单号和物流状态，未找到或请求失败定位到对应提示。输入校验失败、加载中、已失效的旧响应和自动 Demo 预览不触发整页滚动。

滚动使用结果区的实际坐标，不依赖主题的 `scroll-margin` / `scroll-padding`。导航避让只识别 `header`、`nav`、相应 ARIA role、常见 Shopify sticky header 标记及其外层容器；第三方画布、遮罩和其他任意固定元素不参与计算。默认预留 64px，也可以在页面根元素或 `body` 上设置 `--bt-tracking-scroll-offset`（单位为 CSS 像素）。自动检测和显式配置最终都限制在滚动视口高度的三分之一以内，防止异常导航或配置抵消下滑距离。内部宿主容器、独立滚动的 `body` 和可滚动的外层页面会按从内到外的顺序计算目标，使位于视口外的结果也能进入视口。

该逻辑属于 `@standhigher/besttrack-page-extension`。宿主升级包后需重新构建和部署消费者查询页脚本；仅修改包仓库不会更新已经部署的静态资源。普通主题样式和第三方浮层不会改变目标计算，若另一个脚本主动锁定或反复改写滚动位置，仍需要宿主解决脚本冲突。
