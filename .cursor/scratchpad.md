# 画布文案改侧边栏

## 背景和动机

商家不应在画布虚线框里改标题、Tab、按钮和单号。画布只做预览和选中区块；文案在右侧属性面板改，并写回 PageDocument。

## 关键挑战和分析

- Ready-to-go / Branded / Sales 的 `InlineText` 和画布单号输入是虚线编辑来源。
- Core 文本 `contenteditable` 和画布图片 URL 同样是页面内编辑。
- 侧边栏 `fields` 已经存在，inspector → 画布预览仍要同步。

## 高层任务拆分

1. 画布文案改为只读预览。
2. 属性面板提示改为在侧边栏编辑。
3. 改测试：画布不再 `onPropsChange` 文案。

## 项目状态看板

- [x] 画布预览只读
- [x] 测试更新并通过（ReadyToGo / EditorShell 相关 41 条）

## 执行者反馈或请求帮助

请刷新 `http://localhost:3000/page-builder`，选中 Order query：标题、Tab、单号、按钮不应再出现虚线输入。在右侧 Heading / Button label 等字段改文案，画布预览应跟着变。Shopify Admin 里那份是已发布包，本地改动不会出现在那个嵌入页，除非重新发版。

`huabu` 已快进到 `main`（`dbcff14`，Core `0.10.0` / 扩展 `0.4.0`），画布只读改动已叠回最新代码，尚未提交。

已去掉 `.pb-canvas-stage` 的 24px 内边距。请刷新编辑器，预览框应贴齐画布舞台边缘。
