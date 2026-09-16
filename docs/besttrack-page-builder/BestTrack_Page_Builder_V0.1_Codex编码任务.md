# BestTrack Page Builder V0.1 Codex 编码任务

> 版本：V0.1  
> 任务状态：待开发  
> 验收方式：Codex 完成自测后，由用户人工验收  
> 上位文档：总体设计、详细设计实现、交互设计确认、开发编码计划

## 1. 任务目标

在现有项目中完成 `@standhigher/puck-page-builder` 的基础工程和 Polaris EditorShell，按照产品原型搭建可运行、可交互、可测试的编辑器外壳。

本版本只验证工程基线和编辑器交互框架，不实现 PageDocument、真实保存、DataSource、发布接口和 Shopify Menu 调用。

## 2. 开始前必须完成

1. 阅读仓库中的 `AGENTS.md`、README、package manager、workspace 和构建配置；
2. 阅读以下设计文档：
   - `BestTrack_Page_Builder_总体设计.md`
   - `BestTrack_Page_Builder_详细设计实现.md`
   - `BestTrack_Page_Builder_交互设计确认.md`
   - `BestTrack_Page_Builder_开发编码计划.md`
3. 检查现有 Puck、Polaris、App Bridge、`@standhigher/shopify-app-kit` 和测试依赖；
4. 复用现有仓库结构和工具链，不重复创建应用，不擅自升级主要依赖；
5. 检查工作区现有改动并保留与本任务无关的用户代码。

如果缺少目标仓库、无法确定公共包放置位置或现有工程无法启动，停止编码并明确报告阻塞，不自行新建独立项目替代。

## 3. 已冻结的设计决策

### 3.1 页面结构

```text
EditorShell
├── Header：返回、页面标题、Undo/Redo、保存状态、版本、预览、发布
├── Left Rail
│   ├── Blocks：已添加区块的卡片操作视图
│   └── Outline：同一批区块的紧凑结构视图
├── Component Picker：由“添加模块”打开
├── Canvas Toolbar：设备、全屏、缩放
├── Canvas：iframe 内的 Puck Preview
└── Right Panel：当前区块属性面板
```

### 3.2 状态约束

- Blocks、Outline、Canvas 和 Right Panel 共享同一个 `selectedBlockId`；
- Blocks 与 Outline 只改变展示方式，不复制或转换区块数据；
- 设备切换只改变视口，不改变 Mock/Live 数据模式；
- Editor Language 与 Page Locale 是两个独立状态；
- Admin 外壳使用 Polaris；Canvas 内容按消费者页面样式渲染；
- 红色只用于错误、警告或破坏性操作，不作为普通选中态和主按钮颜色。

### 3.3 Puck 使用约束

- 使用 Puck Composition 搭建自定义布局；
- Canvas 使用 `Puck.Preview` 并保持 iframe 启用；
- Outline、Fields 和 Component Picker 优先复用 Puck 官方能力；
- Blocks 卡片视图通过 Puck Adapter 读取当前演示区块数据；
- Puck Internal API 和 UI Overrides 只能出现在 `adapters/puck`；
- V0.1 尽量不使用 UI Overrides，禁止业务组件直接依赖 Puck Internal API。

## 4. 开发范围

### 4.1 工程基础

- 建立或补齐 `@standhigher/puck-page-builder` 包；
- 建立可运行的 Demo/Story 页面，用于独立验收 EditorShell；
- 配置 TypeScript、ESLint、测试、构建和必要的 workspace scripts；
- Puck 作为 `peerDependency` 管理，具体版本遵循现有仓库锁文件；
- 公共包不得引入 BestTrack API、Shopify Admin API 或业务 URL。

建议目录，可按仓库现状微调：

```text
packages/puck-page-builder/src
├── editor
│   ├── shell
│   ├── header
│   ├── sidebar
│   ├── canvas
│   └── state
├── adapters/puck
├── ui/polaris
├── runtime
├── renderer
└── testing
```

### 4.2 Polaris EditorShell

- 顶部、左侧、右侧、弹窗、按钮、表单和反馈使用现有 Polaris 技术栈；
- 已有公共能力优先复用 `@standhigher/shopify-app-kit`；
- 不重复实现 Polaris 已提供的 Button、Modal、Banner、Toast、Tooltip 等基础能力；
- 颜色、间距、圆角、阴影和字体使用 Design Token；
- 支持桌面和窄屏布局，左右面板可收起；
- 图标按钮必须有 Tooltip、`aria-label` 和可见焦点状态。

### 4.3 Blocks / Outline 双视图

使用一份演示区块数据完成：

- Blocks 卡片视图；
- Outline 紧凑视图；
- 视图切换；
- 区块选中；
- 演示排序；
- 复制、删除按钮的 UI 状态；
- Canvas 与右侧面板同步选中；
- “添加模块”打开和关闭独立 Component Picker。

复制、删除和添加在本版只操作演示数据，不接 PageDocument 和后端。

### 4.4 Canvas 与设备工具栏

- 使用 iframe 内的 `Puck.Preview` 渲染最小演示页面；
- 支持 desktop、tablet、mobile、full 四种视口；
- 支持 `auto / 50% / 70% / 100%` 缩放展示；
- 缩放不得破坏拖拽与选中行为；
- Admin CSS 不得泄漏到 Canvas；
- Canvas 区块选中后，Blocks、Outline 和 Right Panel 同步更新。

### 4.5 顶部状态与动作外壳

实现可交互但不请求真实接口的状态展示：

```text
saveState     clean / dirty / saving / saved / failed / conflict
previewMode   editor / mock-preview / live-preview
publishState  draft / publishing / published / publish-failed
editorLocale  Admin 编辑器语言
pageLocale    消费者页面语言
```

- Preview 入口显示 Mock Preview 与 Live Preview；
- Live Preview 仅展示入口和说明，不调用真实接口；
- 首次发布显示“发布”，已发布状态显示“发布变更”；
- “添加到店铺菜单”作为发布后的独立动作；
- Undo/Redo 与版本历史使用不同入口和文案；
- Editor Language 与 Page Locale 使用不同位置和明确标签。

## 5. 明确不做

- 不实现 PageDocument、Schema、Migration 和 Puck Adapter 双向转换；
- 不实现真实草稿保存、自动保存 API 和乐观锁；
- 不实现 Runtime Context、DataSource、Mock/Live 请求；
- 不实现发布、回滚、版本 API 和 Shopify Menu API；
- 不实现 BestTrack 三类模板和正式业务区块；
- 不实现 Email Renderer；
- 不实现多人协同、Presence、CRDT；
- 不发布 npm、不部署、不修改线上环境；
- 不提前开发 V0.2 内容。

## 6. 自动化测试

至少覆盖：

- Blocks / Outline 切换后区块数据不变；
- 两个视图共享选中状态；
- Canvas 选中能同步到 Blocks、Outline 和 Right Panel；
- Component Picker 可以打开和关闭；
- 设备和缩放状态切换正确；
- Editor Language 与 Page Locale 相互独立；
- 保存、预览和发布状态能正确渲染；
- 窄屏下侧栏收起后核心操作仍可访问。

必须执行并报告仓库实际可用的：

```text
lint
typecheck
test
build
```

若仓库没有其中某条命令，不要伪造结果，应说明替代检查方式。

## 7. 人工验收清单

- [ ] 按 README 可以一次启动 Demo；
- [ ] 页面结构与 Blocks / Outline 两张产品原型一致；
- [ ] Blocks 和 Outline 展示同一批区块；
- [ ] 切换视图后选中、顺序和 Canvas 状态保持一致；
- [ ] “添加模块”打开独立 Component Picker；
- [ ] Canvas 使用 iframe，Admin 样式未污染预览内容；
- [ ] desktop、tablet、mobile、full 和缩放切换可用；
- [ ] Right Panel 随选中区块更新；
- [ ] 保存、Mock/Live Preview、发布和菜单动作边界清楚；
- [ ] Editor Language 与 Page Locale 区分明确；
- [ ] Admin 外壳符合 Polaris，普通选中态和主按钮不使用错误红色；
- [ ] 桌面和窄屏核心操作可用；
- [ ] `lint`、`typecheck`、`test`、`build` 通过或有合理替代说明。

## 8. Codex 完成后的输出格式

完成编码后只输出本版结果：

```text
版本：V0.1
完成状态：待人工验收

实现内容：
- ...

主要文件：
- ...

运行方式：
- ...

检查结果：
- lint：
- typecheck：
- test：
- build：

人工验收入口：
- ...

已知问题 / 未实现项：
- ...
```

不要宣称“验收通过”。只有用户完成验证并明确回复“V0.1 验收通过”后，才允许生成或执行 V0.2 编码任务。

## 9. 可直接交给 Codex 的任务指令

> 请严格按照《BestTrack Page Builder V0.1 Codex 编码任务》实施 V0.1。先检查仓库说明、现有工程结构、依赖和工作区改动，再开始编码。只实现基础工程、Polaris EditorShell、Blocks/Outline 双视图、Component Picker、iframe Canvas、设备缩放和顶部状态外壳；不要实现 PageDocument、真实接口、DataSource、发布或 V0.2 内容。完成后执行 lint、typecheck、test、build，并按文档规定格式提交待人工验收结果。
