# ForgeVerse · GitHub / Edge 资源侦察报告

> 任务：FV-A2 ｜ 侦察员：resource-scout ｜ 日期：2026-11-21
> 项目：`D:/WorkBuddy/2026-10-16-00-30-25/workbench3d/`（Three.js r160 沙盒造物工作台）
> 四生态：城市 / 沙漠 / 雪原 / 赛博；能力：体素方块 + 物理 + 角色 + GLB 导入 + PBR + 画质档位

---

## 0. 结论速览（TL;DR）

| 排名 | 类别 | 可立即整合（现在就做） |
|---|---|---|
| 1 | 画质增强 | `pmndrs/postprocessing`（Zlib，3.0k★）— 现有 render-pipeline 已是 EffectComposer 架构，直接加 SSR/GodRays/DOF pass |
| 2 | 画质增强 | `SkyeShark/Eanpa-Sky`（MIT，58★）— 纯 JS 模块无版本锁，含体积云/昼夜/天气/沙漠植被/科幻天空盒，一套覆盖四生态 |
| 3 | 素材库 | Kenney + Quaternius + Poly Pizza（全 CC0）— 走既有 `model-import.js` GLB 通道，挂到资产库做一键放置 |
| 4 | Skill | `RobLe3/cc-blender-skill`（MIT，179★）— 可直接放进 `.claude/skills/`，10 个子技能覆盖建模→材质→导出 GLB |
| 5 | Skill | `gamedev-skills/awesome-gamedev-agent-skills`（Apache-2.0，9.7k★）— three.js 专项 skill 与路由，方法论直接照搬 |

**最关键的一条**：画质提升的最高性价比不是换引擎，而是把 `Eanpa-Sky` 的天气/天空模块 + `postprocessing` 的 SSR/GodRays 接进现有 `js/render-pipeline.js`，两者都不要求升级 r160。

---

## 1. 调研方法说明

### 1.1 Edge 浏览器实际访问（用户明确要求，已执行）

使用 **Microsoft Edge（browser_id=2，扩展已登录 GitHub）**，实际操作 `tabs_new / tab_goto / tab_screenshot / dom_cua_get_visible_dom`，逐页打开并截图 + 读取 DOM 确认（非仅用 MCP）。共访问 6 个候选项目页：

| # | Edge 访问的 GitHub 页面 | 截图/DOM 确认的关键信息 |
|---|---|---|
| 1 | `https://github.com/ahujasid/mcp-for-blender` | 35.1k★、3.2k fork、MIT license、含 `.claude-plugin/` 与 `src/blender_mcp/` 目录、官网 mcp-for-blender.com |
| 2 | `https://github.com/pmndrs/postprocessing` | 3.0k★、Zlib license、含 `demo/GodRaysDemo.js`、`src/`、`manual/` |
| 3 | `https://github.com/RobLe3/cc-blender-skill` | 179★、20 fork、含 `skill/`、`plugin/`、`knowledge/` 目录，README 描述 10 个链载子技能 |
| 4 | `https://github.com/2600th/web-ocean-3d` | 60★、MIT（commit 信息明示）、含 WebGL2 fallback、`docs/`、`src/`、演示站 web-ocean-3d.vercel.app |
| 5 | `https://github.com/gamedev-skills/awesome-gamedev-agent-skills` | 9.7k★、981 fork、含 `.claude-plugin/`、`skills/`、`router/`、`docs/` |
| 6 | `https://github.com/SkyeShark/Eanpa-Sky` | 58★、MIT license、含 `weathersky.js`、`desert_dressing.js`、`mojave_flora.js`、`ringsky.js`、`src/vendor/` |

> Edge 全程可用，未出现 "No current window" 错误，因此**无需**回退到 browser_id=1 内置浏览器。

### 1.2 GitHub MCP 搜索 query（只读）

通过 `ToolSearch` 加载 `mcp__github__search_repositories` / `get_file_contents` / `get_me`，用 `DeferExecuteTool` 调用。认证用户 `Jaron-Liao`。主要 query：

- 素材类：`Kenney assets`、`quaternius models CC0`、`polyhaven assets library CC0 textures hdri models`、`CC0 3d models low poly pack`、`3d models pack in:name`、`free 3d models library glb game assets`、`glTF sample models KhronosGroup`
- Skill 类：`blender mcp server 3d`、`blender-mcp in:name`、`claude code skills 3d modeling in:name,description`、`awesome-gamedev-agent-skills in:name`
- 画质类：`threejs postprocessing`、`postprocessing in:name org:pmndrs`、`threejs sky`、`threejs water ocean shader in:name,description`、`procedural city generation`
- 许可/兼容性核验（get_file_contents）：`LICENSE` × 5、`package.json` × 2、目录列表 × 1

> 说明：GitHub 搜索对多关键词 AND 很严格，部分复合 query 返回 0；已拆成单词 query 重搜。搜索结果中大量 2026-11 新建、描述雷同的 `blender-ai-mcp-*` 仓库疑似 SEO 垃圾仓，已在「过滤项」中处理。

### 1.3 评分口径

四维度均 **1–5 分，分数越高越好**。其中「集成成本」5 分 = 极低（复制文件/加依赖即可用），1 分 = 极高（需升级引擎/付费/重写）。「许可证」5 分 = CC0/MIT/Apache 等可商用宽松许可，1 分 = 版权不明或禁止商用。

---

## 2. 三类候选清单

### 2.1 开源 3D 模型 / 素材库

> 现实情况：Kenney / Quaternius / Poly Pizza / Poly Haven 是**网页平台**，GitHub 上只有低星镜像，star 列以平台形态标注。四个平台全部 CC0，是 ForgeVerse GLB 通道最稳的素材源。

| 名称 | URL | star | 许可证 | 契合度 | 集成成本 | 视觉收益 | 一句话理由 |
|---|---|---:|---|---:|---:|---:|---|
| **Kenney（City / Nature / Prototype / Survival Kits）** | https://kenney.nl/assets | 平台（GitHub 镜像 <20★） | **CC0 1.0** | 5 | 5 | 3 | 城市/自然/生存套件齐全且全 CC0，低模风格与体素方块天然统一，下载即 GLB 走现成导入通道。 |
| **Quaternius（Ultimate Modular City / Nature / Characters）** | https://quaternius.com | 平台（GitHub 镜像 <5★） | **CC0 1.0** | 5 | 5 | 4 | 模块化城市 + 自然 + 带骨骼动画角色，正好补齐本项目缺的"角色模型"与城市外景。 |
| **Poly Pizza** | https://poly.pizza | 平台 | **CC0 1.0** | 4 | 5 | 3 | 可按"city / desert / beach / character"检索并直接下 GLB，是补海滩/赛博长尾素材的最快搜索入口。 |
| **Poly Haven（Models / HDRI / Textures）** | https://polyhaven.com | 平台 | **CC0 1.0** | 4 | 4 | 5 | PBR 贴图 + HDRI 环境光是"3A 质感"最缺的一环，比单纯堆低模更能提升写实度。 |
| **t-mw/citygen** | https://github.com/t-mw/citygen | 252 | MIT（含第三方 MIT 声明） | 4 | 3 | 3 | TypeScript 程序化城市算法（道路网+地块+建筑），可读性好，适合移植进城市生态的生成器。 |
| josauder/procedural_city_generation | https://github.com/josauder/procedural_city_generation | 597 | 未核验（Python/Blender） | 3 | 3 | 3 | 经典城市生成参考，但 Python+Blender 技术栈与纯前端工作台不直接兼容，仅作算法参考。 |

**Top 3（素材类）**：Kenney、Quaternius、Poly Pizza（全部 CC0，直接走 GLB 通道）。
**补充**：Poly Haven 作为"写实度升级"的第二梯队；citygen 作为城市程序化生成的算法源。

---

### 2.2 3D 场景建模 Skill / 工作流（供 Codex / Claude Code 使用）

| 名称 | URL | star | 许可证 | 契合度 | 集成成本 | 视觉收益 | 一句话理由 |
|---|---|---:|---|---:|---:|---:|---|
| **gamedev-skills/awesome-gamedev-agent-skills**（已知项复验） | https://github.com/gamedev-skills/awesome-gamedev-agent-skills | 9,658（Edge 显示 9.7k） | **Apache-2.0** | 5 | 4 | 3 | 79 个游戏开发 skill + 引擎路由，明确含 three.js 专项，是 Skill 体系最成熟的范本，照搬其 SKILL.md 结构即可。 |
| **ahujasid/mcp-for-blender**（原 blender-mcp） | https://github.com/ahujasid/mcp-for-blender | 35,133（Edge 35.1k） | **MIT** | 5 | 3 | 4 | 事实标准的 Blender MCP（35k★），带 `.claude-plugin` 与多 LLM 集成，让 Agent 直接建场景并导出 GLB。 |
| **RobLe3/cc-blender-skill** | https://github.com/RobLe3/cc-blender-skill | 179 | **MIT（已读 LICENSE 文件确认）** | 5 | 4 | 4 | 纯 Claude Code skill 插件，10 个链载子技能覆盖建模→材质→灯光→glTF 导出，已在 6 类场景验证，最易落地。 |
| **ig-shadow-walker/BlenderXAlpha-3DGenSkill** | https://github.com/ig-shadow-walker/BlenderXAlpha-3DGenSkill | 32 | 未核验 | 4 | 3 | 4 | 文生场景→Blender 内生成 3D，兼容 Claude Code/Codex/Cursor，但依赖 Alpha3D API（可能需付费/额度）。 |
| **ReactorcoreGames/Asset-Forge-Workspace** | https://github.com/ReactorcoreGames/Asset-Forge-Workspace | 9 | 未核验 | 4 | 4 | 3 | 基于 Kenney Asset Forge 方块库批量造素材的 Claude Code 工作流，与本项目"体素方块"概念高度同构。 |
| ProfRino/Blender-MCP-Assembly-Skill | https://github.com/ProfRino/Blender-MCP-Assembly-Skill | 85 | 未核验 | 3 | 3 | 2 | 专注修正 AI 建模常见错误（缩放/旋转/重叠），适合作 quality gate 子技能而非主力。 |

**Top 3（Skill 类）**：awesome-gamedev-agent-skills（方法论）、mcp-for-blender（MCP 底座）、cc-blender-skill（可直接安装的 skill）。
**过滤**：`flowful-ai/cad-skill`（734★）虽高星，但经 MCP 读取 LICENSE 确认为 **PolyForm Noncommercial 1.0（禁止商用）**，见第 4 节。

---

### 2.3 Three.js 画质增强库（后处理 / 光照 / 材质 / 天空 / 水体）

| 名称 | URL | star | 许可证 | 契合度 | 集成成本 | 视觉收益 | 一句话理由 |
|---|---|---:|---|---:|---:|---:|---|
| **pmndrs/postprocessing** | https://github.com/pmndrs/postprocessing | 2,987（Edge 3.0k） | **Zlib（宽松可商用）** | 5 | 5 | 5 | 与项目现有 EffectComposer 同构且效果更多（SSR/GodRays/DOF/色差），npm 或 vendor 均可，画质收益最大。 |
| **SkyeShark/Eanpa-Sky** | https://github.com/SkyeShark/Eanpa-Sky | 58 | **MIT（Edge 确认）** | 5 | 4 | 5 | 体积云 + 昼夜 + 完整天气 + 沙漠植被 + 科幻天空盒，一套覆盖城市/沙漠/雪原/赛博四生态，且无 npm 版本锁。 |
| **Ameobea/three-good-godrays** | https://github.com/Ameobea/three-good-godrays | 238 | 未核验 | 4 | 3 | 4 | 基于 pmndrs postprocessing 的屏幕空间体积光，适合赛博霓虹与雪原逆光，但需先引入 postprocessing。 |
| **xiaxiangfeng/sky-cloud-3d** | https://github.com/xiaxiangfeng/sky-cloud-3d | 30 | 未核验 | 4 | 5 | 4 | 物理化天空 + 体积云、"一行接入"，是 Eanpa-Sky 之外的轻量备选。 |
| **2600th/web-ocean-3d** | https://github.com/2600th/web-ocean-3d | 60 | **MIT（已读 LICENSE；含 CC-BY 第三方素材）** | 5 | 2 | 5 | FFT 海浪 + 海岸碎浪泡沫 + 焦散，完美补海滩生态；但 `package.json` 要求 `three ^0.187`，与 r160 不兼容，仅 backlog。 |
| spite/Wagner | https://github.com/spite/Wagner | 1,088 | 未核验（较老） | 3 | 3 | 3 | 老牌 three.js 合成器，但维护活跃度低、效果被 pmndrs/postprocessing 覆盖，不优先。 |

**Top 3（画质类）**：pmndrs/postprocessing、Eanpa-Sky、three-good-godrays（备选 sky-cloud-3d）。
**高价值但 backlog**：web-ocean-3d（需先把 Three.js 升到 r187）。

---

## 3. 整合建议（技术路径 + 优先级）

### 3.1 现在就做（0 外部依赖升级、可直接落地）

**A. CC0 GLB 素材包 → 资产库一键放置**
- 技术路径：从 Kenney / Quaternius / Poly Pizza 下载 `city`、`nature`、`characters` 三个 GLB 包 → 放到 `assets/models/`（新建静态目录）→ 在 `js/model-import.js` 中把现有 `loader.load(URL.createObjectURL(file))` 扩展为支持 `loader.load('assets/models/xxx.glb')` 的预置项 → `library.push(...)` 后由 `renderLibrary()` 生成一键按钮，`placeFromLibrary()` 已实现克隆放置。
- 改动点：`js/model-import.js:20`（importModelFile）、`js/model-import.js:37`（renderLibrary）。
- 配套：在 Q 版 UI 资产面板加"CC0 素材"分类标签，注明来源与 CC0 许可（合规留痕）。

**B. pmndrs/postprocessing → 现有 render-pipeline 增效**
- 技术路径：项目已是 `EffectComposer` 架构（`js/render-pipeline.js:2-8`）。两种路径任选：
  1. **npm**（若接受构建）：`npm i postprocessing`，新建 `js/render-pipeline-pro.js`，用 `EffectComposer`/`RenderPass`/`EffectPass` + `SSRSEffect`/`GodRaysEffect`/`DepthOfFieldEffect`；
  2. **vendor**（保持零构建静态站，推荐）：把 `postprocessing` 的 ESM `build/index.js` 复制到 `vendor/postprocessing/`，通过 import map 映射，再在 `QUALITY.cinema` 档开启新 pass。
- 改动点：`js/render-pipeline.js:12`（QUALITY 增加 `ssr/godrays/dof` 开关）、`js/render-pipeline.js:22`（createPipeline 挂载新 pass）。
- 收益：赛博生态玻璃幕墙反射（SSR）、霓虹体积光（GodRays）、雪原/沙漠景深（DOF）。

**C. Eanpa-Sky → 四生态统一天空/天气**
- 技术路径：复制 `src/weathersky.js`、`src/ringsky.js`、`src/desert_dressing.js`、`src/mojave_flora.js` 到 `vendor/eanpa/`，把其内部 three import 改为本地 import map；在 `js/environment.js` 的生态切换分支里调用对应天空盒（地球/科幻 ×3）与天气预设。
- 兼容性：该仓库**无 npm 依赖、未锁 three 版本**（已读 `package.json`），对 r160 友好；仍需在浏览器实测 shader 编译。
- 改动点：`js/environment.js`、`js/realism.js`。
- 注意：仓库内 `src/vendor/` 与第三方素材需逐个核对许可，只取代码模块、不整包复制素材。

### 3.2 Backlog（需前置条件）

- **cc-blender-skill / mcp-for-blender（Skill 工作流）**：安装路径 —— 把 `skill/` 目录复制到项目 `.claude/skills/`（Claude Code 自动发现），或在项目根 `.mcp.json` 配置 `mcp-for-blender` 的启动命令；前置条件是本机安装 Blender 5.x 且允许 MCP 调用。**价值高但依赖桌面环境**，建议先装 cc-blender-skill（纯 skill、无 daemon）验证，再上 mcp-for-blender。
- **awesome-gamedev-agent-skills（方法论）**：不必整仓安装，提取其 three.js 专项 SKILL.md 作为 `.workbuddy/skills/` 编写模板；重点抄其"真实引擎校验"的 skill 结构。
- **Asset-Forge-Workspace**：若后续做"方块资产批量生产"，复用其 Kenney Asset Forge 流水线脚本（需先核验许可）。
- **web-ocean-3d（海滩水体）**：前置条件是 Three.js 从 r160 升级到 r187（涉及 `three/addons` API 变更、WebGPU/TSL 引入）。升级前不可直接接入；升级后取 `src/` 中 WebGL2 fallback 路径的 shader，并保留 `ASSET_LICENSES.md` 中的 CC-BY 署名。

---

## 4. 明确过滤掉的不合规 / 不可行项

| 项 | 过滤原因 |
|---|---|
| `flowful-ai/cad-skill`（734★） | MCP 读取 LICENSE 确认为 **PolyForm Noncommercial License 1.0**，明确限制非商业用途；ForgeVerse 有商业化可能，**不可用**。 |
| 一批 `blender-ai-mcp-*` / `Blender-AI-MCP-*` 仓库（2026-11 新建，star 497–1143，描述模板化雷同，如 `bookwjitchieni1986/blender-ai-mcp-addon`、`racdeufindurch198812/Blender-AI-MCP-Studio` 等） | 高度疑似 SEO/刷星垃圾仓，创建时间集中、fork 极少（1–16）、描述复制粘贴，缺乏可信社区背书；不推荐，避免供应链与维护风险。 |
| `2600th/web-ocean-3d` 的**整包素材** | 代码 MIT，但仓库内 3D 模型/贴图/字体为第三方资产，`ASSET_LICENSES.md` 要求保留 CC-BY 署名；只借鉴 shader 代码，不整包搬素材。 |
| `react-postprocessing` / `threlte-postprocessing` | 分别绑定 React Three Fiber / Svelte Threlte，与项目原生 Three.js 不兼容；用 `pmndrs/postprocessing` 本体替代。 |
| `josauder/procedural_city_generation`、`libcity`（C++）等 | Python/Blender/C++ 技术栈，与纯前端零构建架构不直接兼容，仅作算法论文级参考，不列为整合候选。 |
| Scripfab / Sketchfab 付费或版权不明模型、"一键生成 3A"私域工具 | 版权风险 / 需付费 / 不可行（延续 TECH_SELECTION.md 既有过滤结论）。 |

---

## 5. 风险与注意事项

1. **许可留痕**：所有 CC0/CC-BY 素材在资产面板标注来源与许可；Eanpa-Sky 的 `src/vendor/` 与 web-ocean-3d 的第三方资产不可整包复制。
2. **版本锁**：整合前务必确认依赖是否绑定 three 版本 —— web-ocean-3d（r187）不兼容 r160；postprocessing / Eanpa-Sky 暂无硬锁。
3. **性能**：SSR/GodRays/体积云为高开销效果，沿用现有 `QUALITY` 档位机制，仅在 `cinema` 档开启，并提供降级。
4. **Skill 安全**：第三方 skill / MCP server 属外部代码，安装前审阅其 `SKILL.md` 与工具调用权限，优先 MIT/Apache 且社区验证的项目。

---

*本报告唯一产物：`docs/GITHUB_RESOURCES.md`。未修改任何代码或其他文档。*
