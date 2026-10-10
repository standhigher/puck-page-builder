# Ready-to-go 共用基础能力

Ready-to-go、Branded、Sales 统一使用 Ready-to-go 的业务逻辑。查询、物流进度、配送详情必须留在页面中。推荐商品默认提供，商家可以删除。

当前实现由业务扩展包导出的 `TrackingRuntimeProvider` 统一管理。`ReadyToGoRuntimeProvider`、`BrandedRuntimeProvider`、`SalesRuntimeProvider` 是同一个 Provider 的兼容入口，宿主每页只需装配一份。通用 Page Builder Core 仍不提供自动 DataSource 执行或鉴权编排。

已确认的实施边界：三套模板暂时保留各自样式和布局，业务规则与区块逻辑必须一致，统一以 Ready-to-go 为基础。区块接口和外观全面统一留待后续评估。本阶段不允许按模板分别实现查询校验、数据选择、内容显隐、错误处理等业务分支。

## 1. 四个必要区块

| 基础区块 | 职责 | 三套模板的公共行为 |
| --- | --- | --- |
| 查询 `besttrack.ready-to-go.query` | 两种查询方式、输入、提交、加载、错误、URL 同步、水印 | 三套模板使用同一查询控制逻辑 |
| 进度 `besttrack.ready-to-go.progress` | 查询标识、最近查询、多包裹切换、当前状态、预计送达、物流节点、未找到订单 | 三套模板保留完整能力，订阅同一选中结果 |
| 配送 `besttrack.ready-to-go.delivery` | 物流时间线、广告、包裹商品、承运商、目的地 | 与进度同步更新，不能维护第二份查询结果 |
| 推荐 `besttrack.ready-to-go.recommendations` | 商家选品或独立推荐接口、商品卡片、商品链接、价格、轮播 | 独立于查单加载，查单失败不清空推荐 |

“必要”指查询、进度、配送必须留在文档里。推荐商品默认出现在新页面中，商家可以删除，删除后仍可从区块库加回一份。展示仍按数据状态控制：未查单时不显示订单内容、没有推荐时隐藏推荐区域、没有广告时隐藏广告位。

Ready-to-go 的查询、进度、配送声明 `required: true`、`singleton: true`、`allowDelete: false`。推荐商品只声明 `singleton: true`。Branded 的 tracking-experience 承载查询、进度、配送并保持锁定，recommendations 可删除；Sales 的 query、order-items、other-tracking 保持锁定，recommendations 可删除。原公告锁定规则不变。

这些策略禁止编辑器删除、复制必要区块，也拒绝画布绕过控制的删除。已有文档不自动插入缺失区块，也没有改变模板 ID 或版本。`requiredBlocks` 只检查 Registry 装配依赖；当前 `validatePageDocumentWithRegistry` 只校验已存在区块，不能单独保证历史文档完整。历史缺块文档由宿主补齐并审核后再用于完整业务页面，本次没有自动迁移。

## 2. 当前查询流程

1. 表单支持运单号、订单号加邮箱两种模式；切换模式保留输入。
2. 提交时 trim 输入并检查非空；加载中禁止重复提交。三套模板均不再使用旧 Branded/Sales 的运单号格式与邮箱格式校验。
3. 同步 URL 中的查询参数，调用 Runtime 的 `query`，完成后滚动到结果区域。
4. Runtime 使用递增请求编号忽略过期查询响应。
5. 成功后更新结果、最近查询，默认选择第一个包裹；进度与配送读取同一结果。
6. `outcome: empty` 展示未找到订单；注入的 `query` 抛错时展示受控错误。

查询来源优先级：宿主注入 `query` → `transport` 创建 Shopify 查询适配器 → 两者均未提供时的本地 Mock。Live 失败不会改走 Mock。

Shopify 适配器负责 `/track/query` 请求体、语言、时间戳、防缓存、默认一次网络重试，以及旧接口到公共结果模型的映射。该路径将业务失败、重试耗尽转换为 `empty`；这与自定义 `query` 抛错进入 `error` 是两种明确的现有语义。可选 `fallbackToEnglish` 还支持英文重查。

公共层统一使用 Ready-to-go 的查询流程，旧接口的错误映射留在适配器中。宿主仍负责服务端授权、访问范围和真实输入校验；模板不能代替这些边界。

## 3. 最近查询与多包裹

三套模板共用以下行为：

- 最近成功查询按最新优先去重，最多保留 3 条；空结果和错误不新增记录。
- 成功查询的模式变化时，替换此前另一种模式的记录；订单查询更换邮箱时同样开始新的记录组。
- 单条查询显示文本，多条显示可切换按钮。
- 点击最近查询直接恢复内存结果，并回填表单，不重新请求接口。
- 一个结果含多个包裹时，切换包裹不重新查单，同时更新进度、时间线、承运商、商品、目的地、预计送达和广告。
- 推荐商品使用独立状态，不随包裹切换重新加载。

这些行为由公共 Runtime 实现。最近查询及结果只保存在当前 Provider 内存中，不写入 PageDocument 或浏览器持久化存储。

恢复历史记录、切换包裹和重置都会使旧请求失效，避免未完成请求覆盖用户刚选择的结果。订单查询记录只在同一邮箱内按订单号去重。

## 4. 进度与配送展示

| 状态 | 进度区 | 配送区 |
| --- | --- | --- |
| idle / loading | 隐藏；加载反馈在表单中 | 隐藏 |
| success | 查询标识、切换入口、状态、进度；有有效预计送达时显示 EDD | 时间线、商品、承运商、目的地；有有效广告时显示广告 |
| empty | 未找到订单插图和提示 | 隐藏 |
| error | 进度暂不可用提示 | 配送暂不可用提示 |

进度优先使用结果提供的节点，缺少节点时按状态生成默认节点。配送优先使用结果事件，缺少事件时使用已有摘要生成展示内容；缺少商品和承运商等数据时使用相应占位。

EDD 是否可展示由真实数据映射与预览规则共同决定：编辑画布不展示 EDD，`autoQueryDemo` 预览也隐藏 EDD。生产页面不能用演示日期补齐数据。

广告属于配送能力中的子模块；生产读取结果中的广告，画布可使用宿主注入的 `adPreview`。图片无效或加载失败则隐藏，编辑态禁止点击广告跳转。

## 5. 推荐商品是独立流程

三套模板共用的推荐来源顺序：区块配置的 `products` 非空时优先使用；否则使用独立推荐请求的成功结果。Web 区块不会读取查单结果的 `result.recommendations`。

业务后端在商家未选品时默认返回该商家店铺中的前 8 个产品，因此“未选品”不意味着没有推荐内容。前端保持接口返回的商品顺序与数量，不自行查询店铺、补齐或截断成 8 条。该默认规则由后端实现；当前 Shopify 适配器仍沿用 `{ page: 1, page_size: 20 }` 请求参数。

独立推荐请求在 Provider 挂载时运行：优先 `queryRecommendations`，其次使用 `transport` 调用 `/products/recommend`。没有这两个来源时，不会自动请求推荐。

推荐使用独立 loading/success/empty/error 状态；查询失败、切换查询和切换包裹均不改变它。Shopify 推荐适配器当前将请求失败转为 `[]`，表现为空列表；自定义推荐回调抛错则进入 error。无可用商品时区块不渲染内容。

更换或移除推荐回调时立即清空原来源商品；旧来源的未完成响应不会覆盖新来源。显式点击历史记录才回填表单，查单完成不会覆盖用户已开始输入的下一笔查询。

Ready-to-go 使用 Embla 轮播，3 秒自动播放、悬停暂停，并提供响应式箭头。公共层负责商品来源和状态；Branded、Sales 保留各自网格外观。

推荐商品价格统一沿用 Ready-to-go / 原 Track Page 的 `$ 0.00` 展示规则。当前不是通用多币种价格组件。

## 6. 页面级配套能力

- URL 深链：开关控制读取和自动查询；默认只在使用 transport 且没有注入 query 时开启。普通访问仍由用户提交。URL 深链自动查询与演示自动查询是不同能力。
- 预览：`autoQueryDemo` 仅供明确的 Mock/Studio 预览使用。生产不能因演示配置自动查询占位订单。
- 滚动：Ready-to-go 提交完成后滚动页面到结果区域；Branded/Sales 可保留卡片内部滚动，由展示层指定滚动目标。
- 水印：宿主明确传入时优先使用，否则沿用原 powered-by 隐藏规则。公共层共享显隐结果，各模板决定位置。
- URL 安全与图片失败处理：继续使用公共校验能力。
- 文档：只保存商家配置和 JSON；订单数据、邮箱和结果均不写入文档。外部文档仍在读取和发布边界经过 `migratePageDocument` 和相应 Registry 校验。

## 7. 共用层结构

公共实现位于 `packages/besttrack-page-extension`：`tracking-runtime.tsx` 管理状态，`tracking-query-form.ts` 管理表单，`tracking-block-model.ts` 管理结果、事件、进度与推荐数据选择；BestTrack 专属逻辑不进入通用 Page Builder Core。

```text
宿主授权查询 / Shopify 接口适配器
                  ↓
公共 Tracking Runtime
  查询状态、最近查询、选中包裹、当前展示结果
  独立推荐状态、水印、预览配置
                  ↓
四项必要能力：查询 / 进度 / 配送 / 推荐
                  ↓
Ready-to-go 外观 / Branded 外观 / Sales 外观
                  +
模板专属扩展：公告、Blog、服务卡、分类、快捷链接
```

公共查询控制器负责输入模式、提交、统一校验规则和 URL 同步；公共结果选择逻辑负责历史查询和包裹联动；公共模型和 Runtime 负责数据选择、内容显隐所需状态与错误处理；展示组件只处理排版、颜色、布局和滚动目标。基础规则今后需要调整时，三套同步生效，不能靠三份实现手动保持一致。

Branded 当前把查询与结果合在 tracking-experience 区块中，Sales 把查询结果和部分商品内容拆开。当前保留这些文档 ID 和组合方式，但每套模板都必须覆盖完整四项基础能力。若要求三套文档统一为四个独立区块，则需要另行设计文档版本迁移，不能仅替换组件注册。

## 8. 宿主接入与验收

```tsx
import { TrackingRuntimeProvider } from "@standhigher/besttrack-page-extension";

// 这两个回调应由宿主提供并保持稳定引用，普通页面重渲染不应被当作更换推荐来源。
// 同一页面只装配一个 Provider，查询/进度/配送/推荐通过 Context 共享各自的状态。
<TrackingRuntimeProvider
  query={authorizedQuery}
  queryRecommendations={authorizedRecommendationsQuery}
>
  <WebRenderer document={document} registry={registry} />
</TrackingRuntimeProvider>
```

`queryRecommendations` 是独立无参回调，不能只把推荐商品放在查单结果里。推荐所需的店铺上下文由宿主闭包提供。Next Studio 已改为单个 Provider，保留最近查询 Demo 数据，同时独立提供 Mock 推荐。三个 Shopify Demo 仅在独立 Mock 模式注入模拟推荐；当前嵌入式 Live 尚未注入推荐回调或 `transport`，因此不能取得后端默认的店铺前 8 个产品。正式宿主需接通该推荐入口，商家未选品时也能展示后端默认商品。

一份 Provider 的查询结果与历史记录属于同一访问上下文。切换店铺、访客授权身份或 Mock/Live 查询环境时，宿主应通过 React `key` 或重新挂载建立新的 Provider，避免跨上下文保留查单记录；仅更换查询函数不会自动清空查询历史。

验收应覆盖两种查询、非空校验、深链、最近三条、包裹联动、响应乱序、empty/error、推荐独立加载、商家选品优先、预览边界以及必要区块不可删除。移动端布局和真实 Shopify Theme 兼容性仍由宿主在店铺中验证。
