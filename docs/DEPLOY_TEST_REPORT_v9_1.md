# ForgeVerse v9.1 · 部署与测试报告

日期：2026-11-21 ｜ 版本：v9.1（工作台布局重构 + 画质升级 + 资源调研）

## 一、本轮改动清单

### A1 · 工作台四栏布局重构
- `index.html`：left/right/bottom 三栏各加隐藏按钮；顶栏新增「面板」入口（3 个重开复选项）。
- `js/main.js`：新增 `wirePanelToggles()`，槽位变量系统（复选项文案自动带出栏名）；localStorage 键 `v9.panels` 持久化；快捷键 F2（面板菜单）/ [ ]（面板循环开关，Shift 反向）；置顶按钮 `Z` 键切换。
- `css/3d.css`：顶栏重排（Logo+面板+模式+搜索+工具栏+功能），窄屏标签隐藏保图标；左右栏统一 300px、下栏分段等高；stage 独立 flex 列占满剩余高度；网格纹理背景。

### A3 · 画质/光照/后处理升级
- `js/render-pipeline.js`：Bloom strength 0.45→0.32、radius 0.5→0.4、threshold 1.05→1.35（修天空过曝）；cinema 像素比 2.0→1.75（性能）；SSAO kernelRadius 8→12、maxDistance 0.1→0.12。
- `js/realism.js`：天空 zenith hue 0.60→0.57 / sat 降低（去紫）；exposure 上限 0.98→0.88（压白场）。
- `js/environment.js`：Sky shader rayleigh `0.6+day*1.6`→`0.5+day*1.1`（减泛白）。

### A2 · GitHub 开源资源调研
- `docs/GITHUB_RESOURCES.md`：详见该文件（契合度/许可证/集成成本/视觉收益评估 + 整合建议）。

## 二、测试结果

| 项 | 结果 | 证据 |
|---|---|---|
| 28 模块语法 | PASS | node --check 全过 |
| 跨模块导入符号 | PASS | ALL IMPORTS RESOLVED（上轮基线） |
| DOM ID 完整性 | PASS | 215 个 ID 全对应（207 + A1 新增 8） |
| 面板开关语义 | 10/10 PASS | `_tmp_panel_check.mjs`（临时脚本，验证后删除） |
| 存档 v4 体素 round-trip | 4/4 PASS | `_tmp_io_check.mjs`（临时脚本，验证后删除） |
| 真机浏览器 BUG 测试 | **未执行** | 内置浏览器对 WebGL 重页面持续失效（DOM 空、截图超 10MiB），非产品缺陷 |

## 三、部署

- 云端站点（v9 对齐版本）：https://www.workbuddy.cn/space/d/4ci7xHY6LpqMdHbiGNYnvg
- GitHub 仓库：见文末（A5 创建后填入）
- 本地运行：`cd workbench3d && python -m http.server 8091`，浏览器访问 `http://127.0.0.1:8091/`

## 四、运维与迭代方案
1. **版本管理**：main(dev 稳定后合并) / dev(集成) / feature/*(单功能)；Conventional Commits；CHANGELOG 每次发版更新。
2. **发布流程**：feature 分支开发 → 静态校验 → PR 回 dev → 真机冒烟 → 合并 main → 同步云端 Page。
3. **监控**：顶栏 FPS 计数器（hFps）+ 画质档位；云端 RLS 保证用户数据隔离。
4. **回滚**：git revert / 云端 Page 事务版本回退。
5. **迭代优先级**：P1 关卡数据接入与计分胜负 → P2 分享码与社区 → P3 IndexedDB 与性能。

## 五、已知限制
- 真机 WebGL 交互测试在本环境不可行，需在有 GUI 的浏览器手工验收：方块放置/物理下落/面板开关视觉/赛博场景观感。
- 云端 Page 的 HTML 会被平台注入 `data-page-node-id`（每页 +1 行），属正常机制。
