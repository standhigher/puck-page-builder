# Ready-to-go 预览 Demo 自动查单

本次修改只改变 **Studio / Mock 预览** 的展示，不改变正式店铺页的查单契约。正式页仍须用户点击查询后才出现物流进度和配送信息。

配套接入说明见 [Ready-to-go 模板](./ready-to-go.md)。

## 为什么改

Ready-to-go 的进度、配送区块订阅查单 `RuntimeState`：`phase === "idle"` 时整段不渲染。预览页和正式页共用同一套 `render.web`，因此点「预览」进来时只有查询表单和推荐商品，看不到订单结果。

商家预览需要一眼看到完整页面效果，但不能把「进入即查单」带到线上店铺。EDD（`Est. Delivery`）在 demo 数据里是占位日期，预览时也不应展示，以免被当成真实预计送达。

## 改动范围

### 1. Provider 增加预览开关 `autoQueryDemo`

`ReadyToGoRuntimeProvider` 新增可选布尔属性 `autoQueryDemo`，默认 `false`。

- 预览宿主显式打开后，查询区块挂载时用表单上的 demo 运单号（缺省 `BT-2048-DEMO`，或区块 `defaultTrackingNumber`）自动发起一次 `mode: "tracking"` 查询。
- 若 URL 深链已能自动查单（`autoQueryFromUrl` + 合法 query），仍走 URL，不重复用 demo 单号。
- 线上 `transport` / 消费者页不要传这个属性。

```tsx
<ReadyToGoRuntimeProvider query={mockQuery} autoQueryDemo>
  <WebRenderer document={document} registry={registry} />
</ReadyToGoRuntimeProvider>
```

### 2. 预览 Demo 隐藏 EDD

进度区块 `ReadyToGoProgressBlock` 在 `autoQueryDemo === true` 时把 `showEstimatedDelivery` 设为 `false`。画布编辑器本来就不渲染 EDD，行为与预览对齐。正式查单成功后仍显示接口返回的预计送达。

Mock 结果里可以继续带 `estimatedDelivery` 字段，只是预览 UI 不渲染 `Est. Delivery` 卡片。

### 3. next-page-studio 只在预览入口打开

`StudioDocument` 增加 `previewAutoQuery`，转发给 `autoQueryDemo`。打开的入口：

| 入口 | 是否自动查 demo |
| --- | --- |
| 模板预览 `/templates/:id/preview` | 是 |
| 自定义模板预览 `/template-studio/:id/preview` | 是 |
| 草稿预览 `/pages/:id/preview` | 是 |
| 已发布页 `/p/:id` | 否，保持点击查询 |

未改 `PageDocument`、区块 ID、模板版本或 schema。已发布文档不需要迁移。

## 刻意不改的边界

- 正式店铺页、Shopify `transport` 路径：仍须点击查询。
- 推荐商品：继续页面打开即加载，与这次查单开关无关。
- 编辑器画布：继续用 `render.editor` 的静态 demo，不走 `autoQueryDemo`。
- Branded / Sales：本次未加同样的预览自动查单。

## 验证

- `packages/besttrack-page-extension/src/ready-to-go-empty.test.tsx`：未开开关不自动查；打开后用 demo 单号查一次，进度和配送出现，EDD 不出现。
- `demos/v0.7.0/ReadyToGo.test.tsx`：正式点击查询路径仍会显示 EDD。
