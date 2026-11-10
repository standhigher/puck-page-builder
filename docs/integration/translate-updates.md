# Translate updates：物流语言

消费者页提供 **Translate updates** 入口，用来切换物流节点和页面写死文案的语言。三套模板共用 `TrackingRuntimeProvider` 的 `locale`，不要按模板各写一套语言状态。

配套接入见 [Ready-to-go 共用基础能力](./ready-to-go-shared-foundation.md)。实现集中在 `packages/besttrack-page-extension/src/i18n/`。

## 三种语言互不影响

| 语言 | 作用 | 不要用来 |
| --- | --- | --- |
| Runtime `locale`（本入口） | 消费者物流查询的 `lang`、写死店面文案、节点时间格式 | 改编辑器界面、写入 `PageDocument` |
| 编辑器 `adminLocale` | 管理端区块名、字段标签 | 改消费者页文案 |
| `PageDocument.settings.locale` | 文档元数据 | 当作 Translate updates 的当前值 |

切换 Translate updates **不会** 改商家保存的区块标题，也不会改 `settings.locale`。

## 画布和正式页

Translate updates **不是只在画布里切换**。编辑器画布和已发布的物流查询页共用同一份 Runtime `locale`：

- **正式页**：消费者点击后立即替换写死店面文案；已有成功结果时带新 `lang` 原地重查。
- **画布**：同一入口只预览这套 Runtime。切到法语时默认标题显示译本，文档里仍保存英文默认值。

「译本不写回 PageDocument」指的是存档，不是指正式页无效。Shipping Details / Package Contents / Carrier 若仍是英文默认值或为空，显示时走词典；若已被商家改过（与英文默认值不同），所有语言都显示那句自定义文案。

## 支持的语言

与原 Track Page 相同，大写规范码：

`EN`、`ZH-HANS`、`FR`、`ES`、`DE`、`PT-BR`、`IT`、`ID`、`VI`、`TH`

默认 **`EN`**。解析顺序：

1. URL 查询参数 `?lang=`
2. `localStorage` 键 `bestrack_locale`
3. 回退英文

不读取浏览器 `navigator.language`。别名如 `zh-CN`、`fr-FR` 会规范成上表码。

## 入口位置与样式

- Ready-to-go：进度卡运单号同一行右侧；视口或进度卡容器宽度 **≤640px**，或单号与语言入口同一行放不下时，放到运单号正上方（与移动端相同）。
- Branded / Sales：Tracking timeline 标题同一行右侧。
- 桌面：地球图标 + 「Translate updates」+ 下拉箭头。
- 视口宽度 **≤640px**：地球图标 + 短文案「Translate」，隐藏箭头。短文案用视口 media query，不用配送栏的容器查询（桌面配送栏本身已 ≤500px）。
- 读屏名称始终是完整的 「Translate updates」（或当前语言对应完整句）。

列表列出全部 10 种语言，当前项带选中标记。

## 切换后 Runtime 做什么

`setLocale` 会：

1. 写入 `bestrack_locale`，并用 `history.replaceState` 把 `?lang=` 设为规范码。
2. 更新 Provider 的 `locale`。
3. **仅当当前结果是成功查单** 时，按当前选中的最近查询原地重查（`preserveResult: true`）。重查期间不进入整页 `loading`，进度条和承运商保持可见；物流节点文案换成三个与 Translating... 同色的点依次出现。点的尺寸和颜色写在行内样式上，透明度由 Web Animations 驱动，避免 Shopify 在线商店主题用 `:empty`、`span { display }` 或 `animation: none !important` 盖掉。Translate updates 入口和 Track Your Order 提交按钮都灰掉且不可点，直到这次请求返回。历史记录顺序和选中包裹不变。
4. 未找到或请求失败时不自动换语言再查。

`transport` 路径每次请求读当前 Runtime locale，请求体为 `{ order_number, email, tracking_number, lang }`。不要再给 `transport.locale` 传一份与入口脱节的快照。

自定义 `query` 的请求类型不含 `locale`。若宿主也要按语言翻译承运商节点，须在回调执行时自行读取已更新的 `?lang=` 或 `bestrack_locale`；不要缓存页面加载时的语言。

## 哪些文案会随语言变

包内 `storefront-copy` 翻译的是 **英文默认写死文案**，包括：

- 区块默认标题：Shipping Details、Package Contents、Carrier、Tracking timeline 等
- 进度五段：Ordered / Order Ready / In Transit / Out for Delivery / Delivered
- 空态、查询中 Searching...、语言重查 Translating...、EDD、Reorder、运单号/订单号标签
- 画布演示节点：`Shipment accepted at the regional hub`、`The order has been placed and confirmed.`

**保持原样：**

- 商家在编辑器改过的标题（与英文默认值不同）
- 承运商接口返回、且不等于上述英文默认句的节点描述
- 承运商名、目的地、商品名等业务数据

英文 locale 下即使命中目录，也显示原文大小写，避免把 `In transit` 改成 `In Transit` 这类展示差异。

画布上：未选中或仍是英文默认标题时，只把译本画在预览里，不写回 `PageDocument`。选中且标题已被商家改过，或当前语言是英文时，才允许 InlineText 编辑。正式页没有 InlineText，只按当前 Runtime 语言渲染。

## 宿主接入

Shopify Track Page 后端继续注入 `transport.post` 即可，无需为语言入口增加 props：

```tsx
<TrackingRuntimeProvider
  transport={{
    post: (url, body) => apiPost(withShopifyAppProxyPrefix(url, APP_PROXY_PREFIX), body)
  }}
>
  <WebRenderer document={document} registry={registry} />
</TrackingRuntimeProvider>
```

不要把所选语言、查询结果或 `bestrack_locale` 写入 `PageDocument` / `binding.params`。

## 验证

- 默认英文；菜单列出 10 种语言。
- 切到简体中文后标题变为「物流详情」，`localStorage` 与 URL 为 `ZH-HANS`。
- 已有成功结果时切换语言，时间线不闪没；`transport` 重查带上新的 `lang`。
- 商家改过的 Shipping Details 标题不随语言替换。
- 演示节点在法语下变为对应译本。
- 窄视口显示短按钮「Translate」，并出现在 Ready-to-go 运单号上方；桌面仍显示完整句并在运单号右侧。
- 正式查单页切换语言与画布预览使用同一套 Runtime；默认标题走词典，商家改过的标题保持原文，两种情况都不改 `PageDocument`。
