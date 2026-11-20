# Track Page 动态内容改动说明

本次修改针对 `@standhigher/besttrack-page-extension` 的 Ready-to-go 模板，补齐旧 Shopify Track Page 的广告位显示契约，并增加独立推荐商品加载入口。

## 改动范围

### 1. 新增广告数据类型

`TrackingPageQueryResult` 和 `TrackingPageShipment` 新增可选的 `ad` 字段：

```ts
type TrackingPageAd = {
  imageUrl: string
  href?: string
  alt?: string
}
```

该字段是查询结果中的临时数据，不会写入 `PageDocument` 或区块 props。

### 2. Ready-to-go 广告位

`Delivery` 区块现在会读取 `result.ad`：

- 有合法图片地址时渲染广告图片。广告位与 BestTrack 宿主统一为 16:9，最大宽度 500px，窄屏随容器缩小；图片按 `object-fit: fill` 拉伸铺满。画布、预览、发布页与右侧图片预览使用相同比例。
- 有 `href` 时使用新窗口打开链接。
- 没有广告数据时整个广告位隐藏，和旧页面的 `ad_config?.image_url` 逻辑一致。编辑器同样不显示空占位。

图片和链接都经过包内安全 URL 处理，不把原始接口对象直接交给 DOM。

### 3. 推荐商品独立于查单

推荐商品对齐原 Track Page 首页 `RecommendationsCarousel`：页面挂载即请求，不要求先点查询。有 `transport` 时默认 `POST /products/recommend`；也可以传入 `queryRecommendations`。没有 live loader 时，编辑器画布仍显示静态预览商品，方便摆放区块；Mock 预览不展示这组占位，只有区块里配置了推荐商品才渲染。推荐为空或失败时线上区块隐藏，查单失败也不收起已显示的推荐。

```tsx
<ReadyToGoRuntimeProvider query={query} queryRecommendations={queryRecommendations}>
  <WebRenderer document={document} registry={registry} />
</ReadyToGoRuntimeProvider>
```

```ts
type TrackingPageRecommendationsQuery = () => Promise<TrackingPageRecommendation[]>
```

宿主应提供引用稳定的函数；函数更换时重新加载，并忽略旧请求结果。缓存和网络重试仍由宿主实现。

业务宿主应在受信任的 storefront host 中请求推荐商品，然后将结果转换为：

```ts
{
  id,
  title,
  description,
  imageUrl,
  href,
  price
}
```

编辑器画布继续使用包内 preview fixture。商家选品快照可带 `{ amount, currencyCode }` 展示价，编辑器、预览和已配置的线上页面都读这份快照。宿主选品器需保存正确的价格最小货币单位与币种；快照继续使用自身的 `price.currencyCode`，不由推荐接口的币种覆盖。线上页面在未配置商品时只渲染 host 注入的动态结果。

## 宿主接入要求

物流查询 host 需要将旧接口返回的：

```json
{
  "ad_config": {
    "image_url": "https://cdn.example/promo.png",
    "link_url": "https://shop.example/promo"
  }
}
```

转换为：

```ts
{
  ad: {
    imageUrl: ad_config.image_url,
    href: ad_config.link_url
  }
}
```

推荐商品仍由 host 的 `transport.post` 或 `queryRecommendations` 发请求。Ready-to-go 在传入 `transport` 时按原页面调用 `POST /products/recommend`，请求体 `{ page: 1, page_size: 20 }`，与查单并行，失败时隐藏推荐区块。App Proxy Base Path 仍由宿主按店铺配置添加，例如 `/apps/bestrack-test/products/recommend`，不能在包内写死。也可以自行传入 `queryRecommendations`。

推荐响应在 `data` 顶层返回 Shopify 店铺默认币种 `currencyCode`，采用 ISO 4217 代码，例如 `USD`、`EUR`、`CNY`；接口外层格式保持不变：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "currencyCode": "EUR",
    "products": [
      {
        "id": "gid://shopify/Product/9",
        "title": "Travel tote",
        "variants": [{ "price": "12.00" }]
      }
    ]
  },
  "trace_id": "..."
}
```

旧推荐请求不要并入物流查询的 loading/error 状态。没有 `onlineStoreUrl` 时回退到 `/products/:handle`。价格仍取商品价，没有则取第一个变体价；结合 `data.currencyCode` 转成包的 `TrackingPageMoney`，`amount` 为该币种的最小单位：USD、EUR、CNY 保留两位，JPY 为零位，KWD 为三位。例如 `12.00 EUR` 转为 `{ amount: 1200, currencyCode: "EUR" }`，`1025 JPY` 转为 `{ amount: 1025, currencyCode: "JPY" }`，`1.234 KWD` 转为 `{ amount: 1234, currencyCode: "KWD" }`。

Ready-to-go、Branded、Sales 的推荐卡片按 `currencyCode` 显示价格，保留货币符号与数值之间的间距，例如 `$ 12.00`、`€ 12.00`。币种缺失或格式无效时仅隐藏价格、保留商品卡片，不默认使用 USD，也不执行汇率换算。图片和跳转地址应是公开 HTTPS 地址，相对商品路径会在浏览器中解析为当前 origin。

## 版本与主项目接入状态

本次修改的是包仓库的 `0.4.0` 源码，尚未发布 npm。主项目 `bast Tack` 仍使用 `0.3.0` 和已有查询补丁，因此不能直接使用新增的 `queryRecommendations` 属性。

主项目应对齐原 Shopify Track Page 查询，而不是继续手写一套请求体：

1. Ready-to-go Provider 改用 `transport={{ post }}`，让包发送 `{ order_number, email, tracking_number, lang }` 和 `/track/query?_t=`。
2. `post` 只补 App Proxy 前缀、鉴权和超时；不要把订单号塞进 `trackingNumber`。
3. 需要独立推荐时使用默认 `transport` 推荐请求，或显式传入 `queryRecommendations`。
4. 检查 `destination`、结构化价格和水印覆盖等契约变化，再移除 `0.3.0` 补丁。

本次未修改 Core、区块 ID、模板版本或文档 schema；已有发布文档无需因新增可选广告字段做迁移。广告仅在 Ready-to-go 的 Delivery 中渲染，Branded / Sales 尚未增加广告布局。

## 验证

新增测试覆盖：

- 查询成功后广告图片和跳转地址正确渲染。
- 没有 `ad` 时线上和编辑器广告位都保持隐藏。
