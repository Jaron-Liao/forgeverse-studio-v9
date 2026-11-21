# ForgeVerse 设计系统 v9（全站视觉规范）

> **v9.2 配色更新（2026-11-21）**：视觉方向由「暗金玄墨」调整为「3A Q 版明亮风」——明亮高饱和、层次清晰、精致可爱。配色以 `docs/COLOR_PALETTE_3A_Q_V9_2.md` 为**唯一真相源**（60% 中性亮底 / 30% 暖橙金 / 10% 彩色强调）。本文 §2 的色值以 v9.2 色板为准，其余结构/字体/间距/组件/动效规范不变。

> 基于 `design/concept/ART_BIBLE.md` 的暗金玄墨体系，扩展为覆盖多页网站 + SPA 游戏 + 方块 UI 的统一设计系统。所有页面与组件必须引用本文变量，不得新增 rogue 色值。

## 1. 设计定位
- **视觉语言**：东方暗金（史诗层级、材质真实、克制光比）× Q 版简约（圆润操作、亲和反馈）——"舞台写实、操作 Q 版"。
- **设计读数**：artifact=多页游戏站+3D沙盒；audience=创作者/玩家；mode=overhaul（在暗金基线上扩展）；visual-variance=4；motion-intensity=5；information-density=6；asset-dependence=3；brand-fidelity=8。
- **禁止**：紫→粉→蓝渐变、emoji 当图标、彩色左边框卡片、Inter/Roboto 作展示字体、虚构数据。

## 2. 配色（CSS 变量 · `css/3d.css` 已实现的部分沿用）
| 语义 | 变量 | 值 | 用途 |
|---|---|---|---|
| 象牙底 | `--bg` | `#F3EFE6` | 应用/页面背景 |
| 面板 | `--panel` | `rgba(255,255,255,.92)` | 卡片/侧栏底 |
| 面板2 | `--panel2` | `rgba(255,250,240,.96)` | 悬浮层 |
| 描边 | `--line` | `rgba(255,158,79,.35)` | 分隔/边框 |
| 暖橙金 | `--acc` / `--gold` | `#FF9E4F` | Logo/激活/主按钮 |
| 亮金 | `--gold2` | `#FFC85C` | 标题/高光文字 |
| 深橙(阴影金) | `--gold-deep` | `#E07B28` | 次级金/阴影金 |
| 朱粉 | `--cinnabar` / `--danger` | `#FF6B7A` | 危险/点缀 |
| 青玉 | `--jade` / `--neon` | `#3AC5E8` | focus 环/成功高亮 |
| 紫罗兰 | `--acc2` / `--violet` | `#9B7EDE` | 赛博场景点缀（局部） |
| 正文 | `--txt` | `#2E2A3A` | 主文字 |
| 次文 | `--sub` | `#6B6378` | 辅助文字 |
| 成功/警告 | `--ok` / `--warn` | `#4FCB8A` / `#FFB84D` | 状态反馈 |
| 补充 | `--mint`/`--sakura`/`--sky` | `#5FD6A0`/`#FF8FB1`/`#7FD4F5` | 草原/点缀/天空 |

四生态场景色（WORLD THEMES）：草原 `#8FD96B`+`#5FC24C` / 雪原 `#E8F6FF`+`#D2EAFF` / 沙漠 `#FFE0A3`+`#F5C46B` / 赛博 `#6A5FE0`+`#8B6BE8`（完整 6 色见 `COLOR_PALETTE_3A_Q_V9_2.md` §3）。

高光/阴影：高光用白色渐变，阴影用暖棕 `rgba(120,86,48,.18)`，**禁止纯黑阴影**。

## 3. 字体体系
- 展示/标题：`"Noto Serif SC", "Songti SC", Georgia, serif`（东方衬线，史诗感；避免宋体默认锯齿，加 `-webkit-font-smoothing: antialiased`）。
- 正文/UI：`"PingFang SC", "Microsoft YaHei", system-ui, sans-serif`。
- 代码/数值：`ui-monospace, "SFMono-Regular", Consolas, monospace`（种子/坐标/分数）。
- 字号（clamp 流式）：h1 `clamp(28px,4vw,48px)`；h2 `clamp(22px,3vw,32px)`；h3 `18px`；正文 `16px`；辅助 `14px`（下限 12px）。标题/正文比 ≥2.5×。

## 4. 间距系统（8px 基准）
`--grid-unit:8px`；刻度 4/8/12/16/24/32/48/64。组件内边距 16/24；区块间距 32/48；页面边距 24（手机）/48（桌面）。留白优先于堆砌。

## 5. 圆角 / 阴影 / 光效
- 圆角：卡片 `12px`；按钮 `8px`；标签/chip `999px`；视窗切角用 `clip-path`（东方切角，非圆角）。
- 阴影层级：`--shadow:0 12px 40px rgba(0,0,0,.55)`；悬浮 `0 20px 60px rgba(0,0,0,.65)`；金色辉光 `--gold-glow:rgba(232,195,122,.35)` 仅用于激活态与 CTA。
- 光比：舞台暗（玄墨）+ 焦点亮（金/青玉），单屏强调色 ≤2。

## 6. 图标风格
- 线性图标，1.75px 描边，24×24 视图盒，圆角端点；优先 inline SVG symbol（`icon-*` 命名）。
- **禁止 emoji 当图标**（现有 `◆` Logo 与少量装饰 emoji 为历史品牌元素，保留但不再新增）。缺图标用 `[icon]` 占位，不手写劣质 SVG。

## 7. 组件规范
### 按钮
- 主 CTA：朱砂→鎏金渐变（`.cta-gold`），文字 `#12131B` 或亮金，hover 提亮 + 金色外发光，active 下沉 1px。
- 次按钮：透明底 + `--line` 边框 + `--txt` 文字，hover 底色 `--panel2`。
- 危险按钮：`--cinnabar` 描边，需二次确认。
- 尺寸：标准高 40px / 触控 ≥44px；圆角 8px；focus-visible 青玉 2px 外环。
### 卡片
- 底 `--panel`，边框 `--line`，圆角 12px；四态：默认/悬停(上浮+金辉)/选中(金边+打光)/禁用(降透明度)。
- 世界卡片保留 `data-world-id` 与四层背景（ART_BIBLE §3）。
### 输入
- 世界名：大字号衬线、暗金下划线、placeholder `--sub`；focus 青玉外环。
- 滑块/分段控件：轨道 `--line`，激活 `--acc`，数值用等宽字体。

## 8. 动效规范
- 缓动：`cubic-bezier(.22,.61,.36,1)`（标准出）、`cubic-bezier(.34,1.56,.64,1)`（弹性进入）。
- 时长：微交互 120–180ms；页面过渡 240–320ms；入场 400ms。
- 触发：hover/focus 即时；卡片入场 stagger 40ms；`prefers-reduced-motion` 全部降级为无动画。
- 3D 内：方块放置弹性缩放 180ms + 粒子闪；删除淡出 120ms。

## 9. 多页网站结构（多页外壳 + 单页游戏）
- 静态页：`home.html` 首页 / `levels.html` 关卡 / `leaderboard.html` 排行榜 / `help.html` 帮助 / `about.html` 关于。
- 游戏 SPA：`index.html`（世界管理 → 工作台）。
- 全站导航：顶部栏（Logo + 主导航 + 登录/世界）+ 移动端汉堡 + 面包屑 + 页脚。共享 `css/3d.css` + 新增 `css/site.css`（站点专属布局，变量复用）。
- 3 次点击内达任意核心页：顶栏直达首页/游戏/关卡/排行/帮助。

## 10. 验收清单
- [ ] 所有页面只用本文变量，无 rogue 色值
- [ ] 标题衬线、正文无衬线、数值等宽
- [ ] 8px 间距栅格，触控目标 ≥44px
- [ ] 按钮/卡片四态齐全，focus 环为青玉
- [ ] prefers-reduced-motion 降级生效
- [ ] 无 emoji 新图标、无紫粉蓝渐变
- [ ] 桌面/平板/手机三端无溢出
