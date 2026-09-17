# BestTrack Page Builder 模板编码任务清单

本文用于两名开发者并行实现前两套模板。视觉细节以随后提供的 UI 稿为准；在 UI 稿确认前，只实现布局骨架、状态、Theme Token 和响应式规则，不自行固化最终视觉。

## 1. 协作规则

| 角色 | 分支 | 模板 |
| --- | --- | --- |
| A | codex/template-ready-to-go | Ready-to-go |
| B | codex/template-branded | Branded |
| 集成负责人 | 集成分支 | 公共出口、Demo 聚合、版本、完整门禁与合并 |

- 每个模板的区块 ID 必须使用独立命名空间：besttrack.ready-to-go.* 或 besttrack.branded.*。
- 区块只接收宿主注入的查询函数；不得在区块中直接请求 Live DataSource，不得复制 DataSource。
- PageDocument、区块 props 和 binding params 只能保存 JSON；不得保存 token、密钥或订单隐私数据。
- Editor、Preview 和 Storefront 必须使用同一份 ExtensionRegistry。
- 全部样式使用 --pb-* Theme Token 与局部样式；不得污染 Shopify Theme 全局样式。
- 公共入口、Demo 首页聚合、包版本由集成负责人统一修改，避免两个模板分支冲突。

## 2. 共同状态与响应式约定

- 查询状态：idle、loading、success、empty、error。
- 资源状态：正常、加载中、空数据、失效资源、无权限或受控错误。
- 验收断点：375、768、1280、1440。
- 移动端优先保证表单、商品卡、链接和按钮可操作；点击目标不小于 44px。
- 图片、链接和可选字段必须提供缺失或失效降级，不能导致区块塌陷。

## 3. A：Ready-to-go

### A1. Template 与默认文档

- [ ] 注册 besttrack.ready-to-go@1.0.0 Template。
- [ ] 创建默认 PageDocument、Theme、Variant 与默认文案。
- [ ] 默认区块顺序：Query → Progress → Delivery → Recommendations。
- [ ] 注册模板依赖的全部 Block Type 和 Fields。

### A2. Order Query

- [ ] 实现订单号输入、提交按钮与基础格式校验。
- [ ] loading 时禁用提交并显示加载反馈。
- [ ] error 时在表单附近显示受控错误。
- [ ] 支持配置标题、辅助文案、按钮文案和默认订单号。
- [ ] 根据 UI 稿实现桌面与移动端表单布局。

### A3. Shipment Progress

- [ ] 实现事件时间线及已完成、当前、未完成节点状态。
- [ ] idle 显示输入引导；loading 显示 skeleton。
- [ ] 空事件和错误显示独立的受控状态。
- [ ] 支持标题、说明、时间展示等可编辑字段。

### A4. Delivery Information

- [ ] 展示承运商、配送地址、预计送达和更新时间。
- [ ] 单字段缺失时显示字段级降级，不能隐藏整个区块。
- [ ] 支持卡片与紧凑 Variant。
- [ ] 移动端改为单列信息布局。

### A5. Recommendations

- [ ] 实现商品卡数据展示：标题、描述、图片、链接。
- [ ] 支持零、一、多个商品结果。
- [ ] 图片失效使用占位，不展示破损图片。
- [ ] 支持单列与 Grid Variant。

### A6. Ready-to-go 验收

- [ ] 单测覆盖模板注册、默认区块顺序和一次查询驱动全部结果区块。
- [ ] 单测覆盖 loading、empty、error 和图片失效。
- [ ] Shopify Demo 中 Editor 和 Consumer Preview 使用同一 Registry。
- [ ] 编写模板字段、状态和 Storefront 验收说明。

## 4. B：Branded

### B1. Template 与默认文档

- [ ] 注册 besttrack.branded@1.0.0 Template。
- [ ] 创建默认 Theme：主色、字体、圆角、间距和表面色。
- [ ] 默认区块顺序：Announcement → Query → Order Items → Recommendations → Quick Links → Blog。
- [ ] 定义 Brand、Minimal、Editorial 等 Variant 的适用区块。

### B2. Announcement

- [ ] 支持 Logo、品牌名和公告文案。
- [ ] Logo 缺失或失效时显示品牌首字母或默认占位。
- [ ] 支持 Brand 与 Minimal Variant。
- [ ] 提供 Logo URL、品牌名、公告文案等 Editor Fields。

### B3. Brand Query

- [ ] 复用共享查询行为和状态，不复制查询逻辑。
- [ ] 实现品牌标题、辅助文案和 CTA。
- [ ] 支持 Brand 与 Compact Variant。
- [ ] 输入、按钮和错误提示跟随品牌 Theme。

### B4. Order Items

- [ ] 展示商品图片、名称、数量和可选状态。
- [ ] 图片 loading、error 显示受控占位。
- [ ] empty、error、部分缺图均保持稳定布局。
- [ ] 支持普通列表与紧凑列表 Variant。

### B5. Recommendations

- [ ] 实现品牌商品卡：图片、标题、描述、链接或 CTA。
- [ ] 支持 Brand 与 Editorial Variant。
- [ ] Grid 在移动端按 UI 稿降为单列或双列。
- [ ] 无推荐时显示简洁空状态。

### B6. Quick Links 与 Blog

- [ ] Quick Links 支持图标、标题、说明和链接，保证键盘焦点可见。
- [ ] Blog 支持封面、标题、摘要和阅读链接。
- [ ] URL 仅允许站内路径或 http/https；非法值显示受控降级。
- [ ] 图像失效和内容缺失时维持布局稳定。

### B7. Branded 验收

- [ ] 单测覆盖 Template 注册、品牌 Theme、Logo 降级、链接安全和查询联动。
- [ ] Shopify Demo 中修改品牌字段后，Editor 与 Consumer Preview 一致。
- [ ] 编写品牌字段、Variant、响应式和资源降级说明。

## 5. UI 稿确认后的补充任务

- [ ] 补齐 Desktop、Tablet、Mobile 三套关键布局。
- [ ] 补齐 default、hover、focus、disabled、loading、error 状态。
- [ ] 建立颜色、字体、阴影、圆角、间距至 Theme Token 的映射表。
- [ ] 明确卡片、列表、图片比例、空状态占位与视觉回归基线。

## 6. 集成与合并

- [ ] 分支完成后分别执行 pnpm lint、pnpm test、pnpm typecheck、pnpm build。
- [ ] 在真实 Shopify 开发店铺进行人工 Storefront 验收。
- [ ] 人工确认后，由集成负责人处理公共出口、Demo 聚合与版本发布。
- [ ] 每个模板通过独立分支合并到主干。
