# ForgeVerse · 3D 造物工作台

一个**完全离线**的实时 3D 工作台：建模、布尔运算、顶点/纹理绘画、世界搭建、第一人称漫游、任务游戏化一体。纯静态网页，双击 `index.html` 即可运行。

## 引擎（已本地化，无需联网）
- `vendor/three/` — Three.js r160 核心 + 控制器/导出器/天空 addons
- `vendor/csg/` — three-bvh-csg + three-mesh-bvh（布尔运算）
- 通过 `index.html` 的 importmap 映射，全部本地加载

## 功能地图

### 🛠 建模（`js/modeling.js`）
- 高级几何体：纽结、二十面体、十二面体、八面体、旋转体、弹簧、拱门
- **布尔运算**：并集 / 差集 / 交集（选中主体 → 拾取目标 → 选运算）
- 细分曲面（面数 ×4）、镜像、线性/环形/网格阵列、挤出建模（星/齿轮/心）

### 🎨 绘画与材质（`js/paint.js` + `js/materials.js`）
- 顶点绘画：圆/方/星笔刷、柔边、擦除
- 纹理画布：2D 画板绘制 → 贴到模型、导出 PNG
- 12 种 PBR 材质预设（金/银/铜/玻璃/陶瓷/塑料/木/橡胶/熔岩/霓虹/大理石/巧克力）

### 🌍 世界与环境（`js/world.js` + `js/environment.js`）
- 程序化高度图地形（种子/起伏/分辨率）、地形雕刻、6 色地貌涂装、动态水面
- 程序化天空（Sky + 太阳联动昼夜）、天气粒子（晴/雨/雪）、实例化植被散布

### 🚶 交互（`js/explore.js` + `js/main.js`）
- 第一人称漫游（WASD + 鼠标环视，ESC 退出）、小地图、6 标签检查器
- 撤销/重做、快捷键、XP/等级/成就、存档 JSON、导出 GLTF

## ☁ v5 全栈升级（云持久化 + 王者风格 + 无限地图）
- **腾讯云持久化**：WorkBuddy Cloud SDK（CDN）接入；`wb_saves` 表（RLS 用户隔离），WorkBuddy 账号登录后点「☁登录·同步」保存，重载自动检测云端存档；同时支持「💾/📂」保存到用户自选本地文件/读取恢复。
- **主栏「操作台」**：下方分「信息台」（笔记 + 天气 + 个人信息）与「任务台」；顶部搜索栏可定位物体/任务/笔记；点击物体弹完整信息卡，可为同类/异类物体改标签名、★标记对比、一键定位。
- **漫游**：顶栏「🚶」第一人称 /「🧍 三人称」，WASD 移动，第一人称鼠标环视、第三人称按住左键拖动控制上下视角，ESC 退出。
- **无限地图**：种子化分块地形（`infinite-map.js`），环境面板可改种子、加导航书签、一键返回；物体信息卡也可「定位到此物体」。
- **资产库**：左侧「导入 GLB/GLTF」通道，可直接导入 Tripo/Blender 导出的模型并重复放置。
- **天气**：9 种（晴/雨/雪/雷暴/浓雾/极光/沙暴/多云/薄雾），修复了雪粒子过密与天空过曝。
- **侧栏闲置自动收起**：4 秒无操作自动收起，鼠标靠近或动一下即展开，也可点把手切换。
- 约束：沙箱无 GUI，**未安装 Unity/Blender**；用本地 WebGL 引擎 + GLTF 导入通道等效满足建模资产接入。原 `unity/` 目录保留 C# 骨架。

## 🎬 渲染画质（v3 电影级管线）
- **后处理管线**（`js/render-pipeline.js`）：RenderPass → SSAO 环境光遮蔽 → UnrealBloom 辉光 → SMAA 抗锯齿 → OutputPass（ACES 色调映射）
- **环境反射**（`js/lighting.js`）：PMREM + RoomEnvironment 生成 IBL，PBR 金属/玻璃有真实反射；补光/轮廓光/软阴影
- **程序化 PBR 纹理**（`js/textures.js`）：零依赖生成草地/岩石/树皮/沙/雪的颜色图 + **法线图** + 粗糙度图，无缝平铺；材质面板可单物体贴图或「一键润色全场」
- **4 档画质**：顶栏「🎬 画质」按钮循环切换 流畅 / 标准 / 高清 / 电影级（适配不同设备）
- **修复**：天空球曾被相机远裁剪面切掉导致白天空紫地面，已改为 far=3000 + 天空球 scale=1200 + 跟随相机
- 高端资产：树木换成分层树冠+顶点扰动，岩石高细分+噪声，角色加细节

## 操作
- 视角：左键旋转 / 滚轮缩放 / 右键平移
- 变换：W 移动 · E 旋转 · R 缩放
- 绘画：切到「绘画」模式，在模型上按住拖动
- 漫游：顶栏 🚶，WASD 移动，ESC 退出
- 存档：顶栏「保存/读取」，「导出」给 Blender/Unity

## 目录
```
index.html          # 入口 + importmap
css/3d.css          # UI 样式
js/
  state.js          # 状态 + 事件总线
  engine.js         # 渲染引擎
  objects.js        # 物体系统
  modeling.js       # 建模工具
  paint.js          # 顶点绘画
  materials.js      # 材质 + 纹理画布
  world.js          # 地形
  environment.js    # 天空 + 天气 + 植被
  explore.js        # 漫游 + 小地图
  render-pipeline.js# 后处理：Bloom/SSAO/SMAA/色调映射
  lighting.js       # PMREM 环境反射 + 电影级光照
  textures.js       # 程序化 PBR 纹理（颜色/法线/粗糙度）
  tasks.js          # 任务/XP
  io.js             # 存档/导出
  main.js           # 主控
unity/              # Unity C# 工程骨架（供在 Unity 落地）
vendor/             # 本地 3D 引擎（1.7MB）
```

> 提示：若用 `file://` 直接打开时浏览器禁用了本地模块，请在此目录运行任意静态服务器（如 `python -m http.server`）后访问。用预览面板打开则无此问题。

---

## v9.1 更新（2026-11-21）

- **工作台四栏重构**：左右/下侧栏可关闭（栏内关闭按钮），顶栏「面板」入口 + 快捷键 `F2`/`[`/`]` 可随时重开；显隐状态存 `v9.panels`。
- **画质升级**：修天空过曝（Bloom threshold 1.35、exposure 上限 0.88、rayleigh 降低）；SSAO/像素比调优。
- **体素沙盒 + 物理**：`voxel.js` + `physics.js`，双模式切换。
- **多页站点**：home / levels / leaderboard / help / about。

**部署与仓库**
- 云端站点：https://www.workbuddy.cn/space/d/4ci7xHY6LpqMdHbiGNYnvg
- GitHub：https://github.com/Jaron-Liao/forgeverse-studio-v9
- GitHub Pages：https://jaron-liao.github.io/forgeverse-studio-v9/ （Pages 来源 GitHub Actions，首次部署需工作流跑完）
- 详见 `docs/DEPLOY_TEST_REPORT_v9_1.md`、`docs/GITHUB_RESOURCES.md`。
