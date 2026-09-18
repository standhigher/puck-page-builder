# Ready-to-go 执行看板

## 背景和动机

BestTrack 以后要在宿主里接入三套 Tracking 模板。当前只改 `@standhigher/besttrack-page-extension`，不改 Core、Demo 存储或 BestTrack 宿主。Ready-to-go 骨架已通，但还是卡片占位。视觉以本机 `Shopify Track Page` 为准：查询卡、五段进度、物流时间线、包裹内容和推荐商品。

## 关键挑战和分析

- 架构保持四个独立区块和 `ReadyToGoRuntimeProvider`；不要做成 Branded 那种复合 `tracking-experience`。
- 查询契约不变：`queryTracking(trackingNumber)`。订单号 Tab 只把订单号当作同一查询字符串；不把 email、token、接口地址写入 `PageDocument`。
- 样式用组件内联 `style` + `--pb-*` Token，不引入独立 CSS 文件，不污染 Shopify Theme。
- 本机 Track Page 的店铺头、语言切换、水印白名单和 Embla 轮播不搬进扩展包。推荐区用横向滚动替代 Embla，避免新增依赖。
- 画布编辑复用 Branded 的 `render.editor` + 选中虚线 `InlineText` / `onPropsChange`；editor 不得调用 Runtime。
- 预计送达由 BestTrack 配置后才在 C 端出现；编辑画布完全隐藏，不占位、不编辑。

## 高层任务拆分

1. 用 Track Page 视觉抽出进度条、时间线、商品卡/坏图占位。
2. 补齐 Query / Progress / Delivery / Recommendations 的 idle、loading、empty、error。
3. 保持 `demos/v0.7.0` 对模板注册和一次查询驱动全部结果区块的覆盖，并补状态测试。
4. 本地跑测试，并在 `pnpm dev` 的 Ready-to-go 页做浏览器验收。
5. 复用 Branded 画布内联文本编辑，接到 Ready-to-go 四个独立区块。

每个任务的成功标准：查询一次后进度、配送、推荐同时更新；失败不回退 Mock；375–1440 宽度可操作。画布文案与属性面板、PageDocument 双向同步；Powered by BestTrack 不可编辑。

## 项目状态看板

- [x] 读取 README / 接入文档 / 本机 Shopify Track Page
- [x] 扩展包内实现 Track Page 视觉的 Ready-to-go 四区块
- [x] Ready-to-go 单测通过
- [x] `http://localhost:3000/page-builder` SSR 已渲染 Track Page 查询卡（请人工点一次查询）
- [x] 五段进度按 Track Page 网格铺满宽度，不再横向滚动裁切文案
- [x] Ready-to-go 四个区块接入 `render.editor`（选中后虚线改标题/Tab/单号/按钮）
- [x] 预计送达在编辑画布完全隐藏（请刷新确认）

## 执行者反馈或请求帮助

预计送达和 “Shipment progress” 标题在编辑画布都已隐藏。C 端预计送达仍在查询结果带来后才显示。

请刷新 `http://localhost:3000/page-builder`，选中 **Shipment progress**：运单号上方不应再出现 “Shipment progress” 输入框。
