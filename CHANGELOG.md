# Changelog

本项目所有重要变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循语义化版本（SemVer）。

## [10.1.1] — 2026-11-21

### Fixed
- **点世界卡片进不去工作区**：`openWorld()` 成功后只提示「世界已载入」却停在管理页（`world:open` 事件无人消费）。`main.js` 新增 `world:open` 监听统一调用 `enterWorkspace()`，并在下一帧补发 `resize`，避免画布在 hidden 容器里按 0×0 初始化。
- **管理页「共 0 个世界」与卡片数不符**：首屏渲染早于 `world:list` 监听器绑定，计数停在静态 0；`wireManagerToolbar()` 末尾先同步一次 `listWorlds().length`。
- **世界卡片缩略图空白且图腾贴角**：`renderManager` 只往 `[data-thumb]` 写了「草/雪/沙」文字，从未写 `data-biome`，`.wm-thumb[data-biome=…]` 的生态渐变全部落空；补写属性并把图腾改为居中衬线字。
- **1440/1536 笔记本宽度顶栏挤爆**：`.topright` 右侧溢出 117px，`保存/读取/导出/世界` 被压成竖排两行。新增 `@media(max-width:1600px)`：收起专注模式与面板的文字标签、隐藏时间滑杆与三人称、禁止按钮折行与压缩，1440 下总宽 1392px 全部落屏。
- **引导开场页在窄视口横向溢出**：`.gv-intro` 作为 grid 居中项宽度取 `max-content`，会把 720px 撑出壳外；显式 `width:100%;min-width:0`。
- **跳过后的轻提示压住「本地存储」状态文字**：世界管理页下方有状态条，`body:has(#worldManager:not(.hidden)) .gv-note{bottom:58px}` 避让。

### Changed
- 样式表加版本参数 `?v=10.1.x`（3d/guide/site），避免用户端缓存旧主题配色。
- 夜间模式下 `--accent-ink` 统一切到 `#6EE7B7`，一处改动全站跟随。

### Verified
- Playwright + Edge 1440×900 实测：跳过全部 → 建世界 → 工作区全链路通过；日间 20 个选择器实测对比度 **20/20 PASS**（5.04–15.47:1），夜间 **9.13–15.74:1**。
- `node tests/guide.smoke.mjs` ALL PASS；30 个 JS 模块 `node --check` 全通过。

## [10.1.0] — 2026-11-21

### Added
- **创作向导（30 问）融合**：`js/guide-data.js`（5 章 30 题 + 安全默认值）、`js/guide.js`（向导引擎）、`css/guide.css`（绿色主题）、`docs/GUIDE_V10.md`（规范与验收）。
- **跳过全部**：开场与每屏常驻入口，保留已答、其余落安全默认，同步关层实测 **14ms**；单步「跳过这题」保留。
- **配置补填**：顶栏「🧭 向导」、世界管理「⚙」、跳过后的轻提示「去补填」三处入口，30 项全量可改，未答标「默认」。
- **配置落地**：核心面板 → 三栏显隐（复用 `setPanel`）；设备 → 画质档；时段 → 时间滑杆 + 真实光照；生态/画质 → 新建世界配置页段选；名字 → 世界名（用户改过不覆盖）。
- **6 套绿系配色**（翡翠/薄荷/森林/青玉/苔石/松针）+ 深浅 4 档 + 质感 5 档 + 密度 3 档 + 动效 4 档。
- 引导配置导出为 `forgeverse-guide-config.json`；`fv.guide.v1` 持久化。
- 测试：`tests/guide.smoke.mjs`（jsdom，30 项断言，含跳过计时）。

### Changed
- `--sub` 由 `#5A7A6E` 加深为 `#4F6E62`（AA 小字 5.17:1）；`--acc2`/`--violet` 由紫罗兰改为青绿 `#0EA5A4`；`--sakura` 改为 `#99F6E4`，主色紫残留清零。
- 主按钮 / CTA / 模式激活态由「朱红→金」改为绿渐变（墨色文字 6.5:1）；选中印章与空状态印章改深绿。
- `#toast` 层级 40 → 130，世界管理页与引导层上方仍可见；`meta theme-color` 改 `#10B981`。
- 顶栏新增向导入口；窄屏（<1200px）收起时间滑杆/搜索/三人称/画质文字，避免按钮被挤出。

### Fixed
- 引导自动开场定时器会覆盖显式打开（如世界管理「⚙」）的问题。
- 补填页自动聚焦导致标题被顶出视野。

## [Unreleased] — v9 进行中

### Added（PR #1 · feature/voxel-sandbox）
- 体素方块沙盒 `js/voxel.js`：chunk + InstancedMesh 渲染、6 材质、放置/破坏、序列化（上限 20000）。
- 轻量物理 `js/physics.js`：重力 + AABB 碰撞 + 空间哈希（上限 200 body，60fps 目标）。
- 模式切换：自由创作 / 方块沙盒双模式；体素工具栏（材质 + 物理开关）。
- 多页导航外壳：home / levels / leaderboard / help / about 五个静态页 + `css/site.css`。
- 设计系统 v9：`docs/DESIGN_SYSTEM_V9.md`（全站配色/字体/间距/组件/动效规范）。

### Changed
- `io.js` 存档升级 v4，纳入体素数据。
- `main.js` 接线体素/物理并隔离体素模式下的物体拾取。

### Planned
- P0：GitHub 分支策略与 PR 流程（本文件即基线）
- P0：设计系统 v9、游戏主页 SPA 容器
- P0：体素方块系统、重力与 AABB 碰撞、视听反馈
- P1：全站静态页、响应式、关卡与计分胜负
- P2：分享码、社区展示、排行榜、云数据
- P3：IndexedDB、性能优化、跨浏览器

详见 `docs/REQUIREMENTS_V9.md`。

## [8.0.0] — 2026-11-19

### Added
- 全屏世界管理页与新建世界配置页（14 项细分配置），替代旧小弹窗。
- 多世界独立存档：`js/world-manager.js`，分键存储 + 活动指针，世界间互不污染。
- 独立渲染视窗：`js/viewport.js`，单 canvas scissor 多视口，非激活视窗降频。
- 四生态资产补齐：`js/biome-pro.js` 注册 grass/snow/desert/cyber。
- 自动保存（2s 防抖 + visibilitychange flush）、返回世界管理入口。
- 5 角色协作交付：概念文档、美术圣经、GDD、架构 ADR、Epics、QA 报告。

### Changed
- 视觉统一到暗金玄墨体系（ART_BIBLE §9.1 变量迁移表），删除蓝紫粉残留。
- 云存档 slot 从固定 `main` 改为 `worldId`（`js/cloud.js`）。
- 清理冗余技术文案 3 处。

### Fixed
- D1：旧 `#intro` 弹窗残留（已删 boot 中显示调用）。
- D2：配置页选非草原生态恒生成草原（pick 选择器 aria-checked 残留根因）。
- D3：管理页工具条（计数/排布/筛选/排序/搜索/导入导出/卡片菜单）未接线。

## [7.0.0] — 2026-11-17

### Added
- 雪地/沙漠 Pro 建模升级（沙岩民居/哨站/油井、北欧木屋/冰洞/观测站）。
- PWA 支持（manifest + Service Worker，可安装离线用）。
- 技术选型报告、Unity 集成方案、运维命令清单。

## [6.0.0] — 2026-11-17

### Added
- 三环境资产分层（沙漠/雪地/都市 × 建筑/地形/装饰/公路）。
- 地形编辑：水源放置/删除、挖地、编辑结果保存加载。
- 真实感渲染：太阳高度角驱动光色、天气氛围、4 档性能预设。

## [5.0.0] — 2026-10-16

### Added
- 腾讯云持久化（wb_saves + RLS）、操作台、第一/三人称漫游、无限地图、资产库、9 种天气。

## [1.0.0] — 初始版本

### Added
- Three.js r160 本地化；建模/布尔/细分/阵列、顶点与纹理绘画、12 种 PBR 材质、种子地形、XP/等级/任务。
