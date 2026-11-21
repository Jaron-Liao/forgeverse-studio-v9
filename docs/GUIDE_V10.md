# 创作向导 v10 · 融合规范与验收

> 把原 `workbench/index.html` 的「30 问生成器」自然融入 ForgeVerse：不再是一块独立的小工作台，而是**进入 3D 工作区前的配置向导**。
> 单一实现：`js/guide-data.js`（数据）+ `js/guide.js`（引擎）+ `css/guide.css`（主题）。

## 1. 目标与边界

| 项 | 约定 |
|---|---|
| 增量整合 | 只新增 `#fv-guide` / `#fv-guide-note` / `.gv-*` 命名空间，**不重建、不删除**任何既有 DOM ID |
| 结构保持 | 原顶栏、四栏布局、检查器、操作台、世界管理页逻辑零改动 |
| 样式变量化 | 全部色值走 `3d.css :root` 变量 + 引导层局部 `--gv-*`，不出现第二套色值真源 |
| 入口 | ① 首次进入自动开场（700ms，专注模式/已完成/已主动关闭则不打扰）② 顶栏「🧭 向导」③ 世界管理页「⚙」④ 跳过后的轻提示「去补填」 |

## 2. 30 问结构（5 章）

| 章节 | 题数 | 题号 | 落点 |
|---|---|---|---|
| 🌱 认识你 | 6 | scene / timeband / pain / role / device / budget | 任务模板、默认时段、精灵语气、画质档位 |
| 🧱 工作区 | 6 | core / extra / statdepth / remind / storage / people | 三栏显隐、HUD、小地图、云同步建议 |
| 🎨 外观 | 6 | palette / pet / texture / light / motion / density | 全局绿系变量、精灵 emoji、质感/明暗/密度/动效 |
| 🎮 玩法 | 6 | xp / badge / combo / reward / punish / surprise | 经验条显隐、徽章提示、连击、奖励 |
| 🎚️ 调参 | 6 | hero / taskview / priority / pomolen / biome / name | 首屏 C 位、任务视图、起始生态、世界名 |

> 题库与原 30 问同构（章节 + 单选/多选/文本、`max` 上限），选项全部改写为 ForgeVerse 真实能力；`palette` 收窄为**绿色家族 6 套**（翡翠/薄荷/森林/青玉/苔石/松针），确保主题不被粉紫破坏。

## 3. 「跳过全部」行为规范

| 要求 | 实现 |
|---|---|
| 一键跳过 | 开场页大按钮 + 每屏头部常驻 `跳过全部`，`Esc` 关闭（关闭不填充，仅收起） |
| ≤ 0.5s 直达主界面 | 纯同步：读答案 → 合并默认 → 写 localStorage → 关层。实测 **14ms**（jsdom，见 §7） |
| 保留已答 | `answers` 只增不删；跳过不覆盖任何已答项 |
| 默认值兜底 | `DEFAULTS` 覆盖 30/30 题，且**每个默认值都命中真实选项**（测试断言） |
| Toast 提示 | `已按默认设定跳过 N 个问题 · 随时可在「向导」补填`；`#toast` 层级提到 130，世界管理页也能看到 |
| 保留单步跳过 | 每屏 `跳过这题`，计入 `skippedIds`，章节标签显示 `·` 提示 |
| 设置入口可补填 | 顶栏「向导」/世界管理「⚙」/轻提示「去补填」→ 补填页，30 行全量可改，未答标「默认」 |
| 必填项安全默认 | 去掉「未选不能下一步」的阻断；必填项仅做文案提示，未答自动取默认 |
| 可关闭轻提示 | 左下角 `#fv-guide-note`，含「去补填」「✕」，8s 自动淡出但不写已读 |

## 4. 数据与持久化

```json
// localStorage: fv.guide.v1
{
  "answers": { "scene": "indie", "core": ["assets","inspector","console"], "name": "小怪兽造物室" },
  "skippedIds": ["pain"],
  "done": true,
  "skippedAll": false,
  "hinted": false,
  "introSeen": true,
  "updatedAt": 1795226256572
}
```

- `resolve()` = `answers` + `DEFAULTS` 合并，保证任意时刻配置完整（30 键）。
- 导出：`⬇ 导出` 生成 `forgeverse-guide-config.json`（含 raw 与 resolved）。
- 存储不可用（隐私模式/`file://` 限制）时降级为内存态，单次会话仍可用。

## 5. 配置如何落地（不新增一套状态）

| 答案 | 落地方式 |
|---|---|
| core / hero | 走既有 `setPanel()`（`v9.panels` 持久化），三栏显隐 + 勾选态同步 |
| device | `QUALITY_BY_DEVICE` → `setQuality()` + `applyPerfProfile()`，同步按钮文案 |
| timeband | `TIME_BY_BAND` → 时间滑杆 + `applyRealisticTime()` / `updateSky()` |
| biome / quality | 点击 `#wcBiomes` / `#wcQuality` 既有分段控件（复用原点击逻辑） |
| name | 写 `App.worldName` 与 `#wcName`/`#worldName`，用户手动改过（`dataset.touched`）则不覆盖 |
| palette / light / texture / motion / density | 覆盖 `:root` 的 `--acc/--gold/--gold2/--gold-deep/--mint` + `body[data-fv-*]` |
| pet / role | `#pet` emoji + 光晕 + `.pet-name`，语气库用于向导气泡 |
| xp / badge / combo / statdepth / taskview / remind | `body.fv-no-*` / `fv-hud-*` / `fv-task-board` / `fv-quiet` 类，CSS 层显隐 |

跨模块通过 `window` 事件 `fv:guide-apply`（detail: `{cfg, panels, quality, time}`）交给 `main.js` 的 `wireGuideBridge()`，不改任何原有函数签名。

## 6. 绿色主题

- 6 套绿系：翡翠 `#10B981`（默认）/ 薄荷 `#34D399` / 森林 `#059669` / 青玉 `#06B6D4` / 苔石 `#84CC16` / 松针 `#065F46`。
- 浅底文字统一用深绿墨 `#047857`（对白 5.48:1），不用亮绿直接做小字。
- 深浅：日间 / 黄昏 / 夜间 / 自动（按小时），夜间覆盖面板、弹窗、输入、世界管理页表面。
- 质感 5 档（软糖/线条/玻璃/像素/涂鸦）、密度 3 档、动效 4 档，全部走 `body[data-fv-*]`。
- 过渡统一 0.2–0.3s `ease`；`prefers-reduced-motion` 下全部关闭。

## 7. 验收结果

| 项 | 标准 | 结果 |
|---|---|---|
| 跳过耗时 | < 500ms | **14.1ms**（jsdom，含写库+关层+轻提示） |
| 数据完整性 | 30 题 / 5 章 / 默认值全命中 | PASS（9 项断言） |
| 交互链路 | 开场→答题→跳过→补填→蓝图→生成 | PASS（7 组 30 项断言） |
| 对比度 | 关键文本 ≥ 4.5:1 | 12/12 PASS（最低 4.84，强调墨 on D1FAE5） |
| 紫系残留 | 0 | 0（`--acc2/--violet/--sakura` 全部改绿青） |
| 绿色覆盖 | ≥ 95% | **96.3%**（绿系+中性底 79/82；余 3 个为 3D 默认物件/笔刷色） |
| DOM 守恒 | 既有 ID 不删不改 | 217 → 219，仅新增 2 个 |
| 语法 | 全模块可解析 | 30/30 PASS |

## 8. 已知限制

- 顶栏在 1440/1536 笔记本宽度已收口（见 §9），但 < 1100px 时仍需进一步收起（当前 1200/980 两档已收起搜索、时间滑杆、三人称、画质与向导文字）。
- 夜间模式覆盖的是 UI 表面（面板/弹窗/输入/世界管理页），3D 场景光照仍由时段滑杆与真实感渲染控制，避免破坏美术基调。
- 引导层不接管体素/建模快捷键之外的按键；打开时拦截 `W/E/R/Delete/Backspace` 与数字键，防止误改场景。
- 世界卡片缩略图使用程序化生态渐变，不读取真实场景截图（无外部资源依赖）。

## 9. 收尾修复（v10.1.1）

| 问题 | 现象 | 处理 |
| --- | --- | --- |
| 点卡片进不去世界 | 只提示「世界已载入」，停在管理页 | `main.js` 监听 `world:open` → `enterWorkspace()` + 下一帧 `resize` |
| 计数不符 | 「共 0 个世界」而卡片有 2 张 | 绑定监听器后立即同步一次计数 |
| 缩略图空白 | 生态渐变全部落空，「草」贴在卡片角上 | 补写 `data-biome` + 图腾居中 |
| 顶栏挤爆 | 1440 下右侧溢出 117px，「保存/读取」竖排 | 新增 `≤1600px` 档：收标签、藏滑杆与三人称、禁折行 |
| 开场页溢出 | 窄视口文本被壳裁掉 | `.gv-intro{width:100%;min-width:0}` |
| 轻提示挡状态条 | 压住「本地存储 %」 | 管理页可见时 `bottom:58px` |

实测（Playwright + Edge，1440×900）：跳过全部 → 建世界 → 进入工作区全链路通过；日间 20 个选择器对比度 20/20 PASS（5.04–15.47:1），夜间 9.13–15.74:1。

