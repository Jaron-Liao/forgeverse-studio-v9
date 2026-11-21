import * as THREE from 'three';
import { App, bus, toast, setPet, isFocusMode, setFocusMode } from './state.js';
import { createEngine } from './engine.js';
import {
  spawnPrimitive, spawnModel, selectObject, selectFromMesh, deleteSelected,
  duplicateSelected, applyMaterial, toggleHideSelected, updateInspector, renderTree, updateHUD, refreshSelBox,
} from './objects.js';
import { initPaint } from './paint.js';
import { initWorld, generateTerrain, applyTheme, createWater, setFog, setGrid } from './world.js';
import { initTasks, addTask } from './tasks.js';
import { saveLocal, loadFile, exportGLTF, screenshot, deserialize, serialize, deserializeWorld } from './io.js';
import {
  spawnAdvanced, booleanOp, subdivideSelected, mirrorSelected, arraySelected, extrudeShape,
} from './modeling.js';
import {
  PRESETS, applyPreset, initTextureCanvas, clearTexture, applyTextureToSelected, exportTexture,
} from './materials.js';
import { initSky, updateSky, setWeather, scatterVegetation, clearVegetation } from './environment.js';
import { initExplore, toggleFirstPerson, bindUnlock, drawMinimap } from './explore.js';
import { createPipeline, setQuality, render as pipelineRender, resize as pipelineResize, QUALITY } from './render-pipeline.js';
import { setupLighting } from './lighting.js';
import { enhanceAssets, applyTextureToSelected as applyPbrTexture } from './textures.js';
import { initCloud, restoreAuth, signIn, signOut, cloudLoad, cloudSave, getSession } from './cloud.js';
import { initItemInfo, searchAll, showItemInfo } from './item-info.js';
import { initInfiniteMap, applySeed, enableInfinite, renderBookmarks, addBookmark, addObjectBookmark, goTo, getSeed } from './infinite-map.js';
import { initModelImport } from './model-import.js';
import { saveToLocalFile, loadFromLocalFile } from './localfile.js';
import { toggleThirdPerson } from './explore.js';
import { buildBiome, replaceLayer, registerBiome, getBiomeNames } from './biomes.js';
import { initTerrainEdit, addWater, removeWaterNear, digTerrain, serializeEdits, loadEdits } from './terrain-edit.js';
import { applyRealisticTime, enableSurfaceDetail, applyPerfProfile, applyWeatherMood, setRealism } from './realism.js';
import { registerProBiomes } from './biome-pro.js';
import {
  initWorldManager, listWorlds, createWorld, openWorld, closeWorld, deleteWorld,
  getCurrentWorld, updateWorldMeta, getActiveWorldId, getDefaultConfig, normalizeConfig,
  hasLegacySave, migrateLegacyWorld, cloneWorld, saveWorld, syncWorldToCloud, syncWorldListWithCloud,
  showManager, showConfig, hideConfig, renderManager,
} from './world-manager.js';
import { initViewport, registerViewport, setPaused, renderViewports, resize as viewportResize, setViewportActive } from './viewport.js';
import {
  initVoxel, setVoxelMode, isVoxelMode, placeVoxel, removeVoxel, getVoxelCount,
  getVoxelState, serializeVoxels, loadVoxels, clearVoxels, setVoxelMaterial, getVoxelMaterial, VOXEL_PALETTE,
} from './voxel.js';
import { initPhysics, registerBody, unregisterBody, setPhysicsEnabled, isPhysicsEnabled, getBodyCount } from './physics.js';
import { initGuide } from './guide.js';

const $ = id => document.getElementById(id);
const MODE_TXT = { select: '选择', paint: '绘画', sculpt: '雕刻', terrain: '地貌' };
const TABS = ['obj', 'build', 'paint', 'mat', 'world', 'env', 'scene'];
// FV-A1：面板显隐（键 + 栏 ID + 提示名），localStorage 键固定为 v9.panels
const PANELS_KEY = 'v9.panels';
const PANEL_BARS = { left: 'leftbar', right: 'rightbar', bottom: 'bottombar' };
const PANEL_NAME = { left: '左侧栏', right: '右侧栏', bottom: '下侧栏' };

// ---------- 撤销/重做 ----------
const undoStack = [], redoStack = [];
function snapshot() {
  const painted = [];
  const grab = o => { if (o.isMesh && o.geometry?.attributes.color) painted.push({ uuid: o.uuid, color: o.geometry.attributes.color.array.slice() }); };
  App.objects.forEach(r => r.root.traverse(grab));
  if (window.__terrain) window.__terrain.traverse(grab);
  return {
    objs: App.objects.map(r => ({ id: r.id, p: r.root.position.toArray(), r: [r.root.rotation.x, r.root.rotation.y, r.root.rotation.z], s: r.root.scale.toArray() })),
    painted,
    terrain: window.__terrain ? { y: window.__terrain.geometry.attributes.position.array.slice(), c: window.__terrain.geometry.attributes.color.array.slice() } : null,
  };
}
function restore(s) {
  s.objs.forEach(o => {
    const rec = App.objects.find(r => r.id === o.id);
    if (rec) { rec.root.position.fromArray(o.p); rec.root.rotation.set(...o.r); rec.root.scale.fromArray(o.s); }
  });
  const map = {};
  App.objects.forEach(r => r.root.traverse(o => { if (o.uuid) map[o.uuid] = o; }));
  if (window.__terrain) map[window.__terrain.uuid] = window.__terrain;
  s.painted.forEach(p => { const o = map[p.uuid]; if (o && o.geometry?.attributes.color) { o.geometry.attributes.color.array.set(p.color); o.geometry.attributes.color.needsUpdate = true; } });
  if (s.terrain && window.__terrain) {
    window.__terrain.geometry.attributes.position.array.set(s.terrain.y);
    window.__terrain.geometry.attributes.color.array.set(s.terrain.c);
    window.__terrain.geometry.attributes.position.needsUpdate = true;
    window.__terrain.geometry.attributes.color.needsUpdate = true;
    window.__terrain.geometry.computeVertexNormals();
  }
  refreshSelBox(); updateInspector();
}
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 30) undoStack.shift(); redoStack.length = 0; }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); toast('已撤销'); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); toast('已重做'); }

// ---------- 启动 ----------
function boot() {
  App.engine = createEngine($('stage'));
  const eng = App.engine;

  initWorld();
  registerProBiomes();      // 雪地 / 沙漠 Pro 资产覆盖注册
  setupLighting(eng);       // 环境反射 + 电影级光照
  initSky();                // 程序化天空（修复后被裁剪的 bug）
  initPaint();
  initTasks();
  initExplore($('minimap'));
  initTextureCanvas($('texCanvas'));
  initInfiniteMap();
  initTerrainEdit();
  initModelImport();
  initItemInfo(loc => { if (loc) goTo({ name: loc.name, x: loc.root.position.x, y: loc.root.position.y + 1, z: loc.root.position.z, seed: getSeed() }); });
  renderBookmarks();

  // 后处理管线：把渲染与缩放交给视窗管理器（多视口）
  createPipeline(eng, 'high');
  initViewport(eng, { renderMain: pipelineRender, resizeMain: pipelineResize });
  eng.setRenderFn(renderViewports);
  eng.setResizeFn(viewportResize);

  // 体素沙盒 + 物理（P0-4/5）：先初始化，模式默认关闭，不干扰现有交互
  initVoxel(eng);
  initPhysics(eng);
  wireVoxelTools();

  // 多世界管理：showManager 内部已含 init/render/bind，单一入口
  showManager();
  setupWorldAutosave();

  eng.onUpdate(() => { refreshSelBox(); drawMinimap(); });

  // 云端认证恢复（回调分发必须先于任何 auth gate）
  initCloud();
  restoreAuth(user => {
    App.cloudUser = user || null;
    renderUserInfo();
    if (user) cloudLoad('main').then(row => {
      if (row?.payload) {
        App.pendingCloudSave = row.payload;
        const w = $('worldName'); if (w && row.world_name) w.value = row.world_name;
        toast('检测到云端存档：' + (row.world_name || '') + '（点开始建造即恢复）');
      }
    });
  });
  setupAutoHide();

  // 选择 + 布尔拾取
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downXY = null;
  eng.renderer.domElement.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    downXY = [ev.clientX, ev.clientY];
  });
  eng.renderer.domElement.addEventListener('pointerup', ev => {
    if (ev.button !== 0 || !downXY) return;
    if (isVoxelMode()) { downXY = null; return; } // 体素模式下不做物体拾取，交给 voxel.js
    const moved = Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1]);
    downXY = null;
    if (moved > 5 || eng.tcontrols.dragging) return;
    const rect = eng.renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, eng.camera);
    const hits = ray.intersectObjects(App.objects.map(o => o.root), true);
    if (!hits.length) return;
    if (App.pickingBool) {
      // 拾取布尔目标
      let o = hits[0].object;
      while (o && !o.userData.recId) o = o.parent;
      const rec = App.objects.find(r => r.id === o?.userData.recId);
      if (rec && rec !== App.selected) {
        App.boolTarget = rec;
        App.pickingBool = false;
        $('btnPickBool').classList.remove('picking');
        $('btnPickBool').textContent = '◎ 拾取目标';
        $('boolTargetName').textContent = rec.name;
        toast('已设定布尔目标：' + rec.name);
      } else toast('目标不能是主体本身');
      return;
    }
    if (App.mode === 'select') selectFromMesh(hits[0].object);
  });

  wireUI();
  wirePanelToggles();       // FV-A1：面板关闭/重开接线（只做显隐，不碰渲染与 bus）
  wireFocusMode();          // v10：专注模式（一次性跳过所有提示）
  wireGuideBridge();        // v10：创作向导配置落地（面板/画质/时段）
  initGuide();              // v10：30 问引导（可跳过全部，随时补填）
  bus.on('objects', () => { renderTree(); updateHUD(); const tc = $('treeCount'); if (tc) tc.textContent = App.objects.length; });
  bus.on('select', () => renderTree());
  window.addEventListener('wb:transform', updateInspector);
  window.addEventListener('keydown', onKey);

  bindUnlock(() => {
    if (App.firstPerson) { App.firstPerson = false; eng.controls.enabled = true; eng.controls.target.set(0, 1, 0); toast('已退出漫游'); }
  });

  $('loading').classList.add('hidden');
  // 入口由 showManager() 统一展示全屏世界管理页，旧的 #intro 弹窗不再弹出
}

// ---------- FV-A1：面板显隐 / 重开 / 持久化 ----------
function readPanelState() {
  const state = { left: true, right: true, bottom: true };
  try {
    const raw = JSON.parse(localStorage.getItem(PANELS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      Object.keys(state).forEach(k => { if (typeof raw[k] === 'boolean') state[k] = raw[k]; });
    }
  } catch (_) { /* 隐私模式 / 存储不可用时用默认值 */ }
  return state;
}
let panelState = readPanelState();

function applyPanelState() {
  const app = $('app');
  if (!app) return;
  Object.keys(PANEL_BARS).forEach(key => {
    const bar = $(PANEL_BARS[key]);
    const shown = panelState[key];
    // 只切 class，不删 DOM / 不改 ID；.collapsed（闲置自动收起）与之彼此独立
    if (bar) bar.classList.toggle('v9-panel-hidden', !shown);
    app.classList.toggle('v9-no-' + key, !shown); // 触发 CSS 槽位变化 → 其余栏自动扩展
    const cb = $('v9-show-' + key);
    if (cb) cb.checked = shown;
  });
  try { localStorage.setItem(PANELS_KEY, JSON.stringify(panelState)); } catch (_) {}
}
function setPanel(key, shown) {
  if (!Object.prototype.hasOwnProperty.call(PANEL_BARS, key)) return;
  panelState[key] = !!shown;
  applyPanelState();
}
function togglePanel(key) { setPanel(key, !panelState[key]); }

function wirePanelToggles() {
  // 三个关闭按钮 + 顶栏三个复选项，共用同一份状态
  Object.keys(PANEL_BARS).forEach(key => {
    const hide = $('v9-hide-' + key);
    if (hide) hide.onclick = () => {
      setPanel(key, false);
      toast('已收起' + PANEL_NAME[key] + '，可从顶栏「面板」恢复');
    };
    const cb = $('v9-show-' + key);
    if (cb) cb.onchange = e => setPanel(key, e.target.checked);
  });

  // 顶栏下拉：点击展开/收起，点击外部或 Esc 关闭
  const btn = $('v9-panel-toggle');
  const menu = $('v9-panel-menu');
  if (btn && menu) {
    const closeMenu = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.onclick = ev => {
      ev.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    };
    menu.onclick = ev => ev.stopPropagation();
    document.addEventListener('click', ev => {
      if (!menu.hidden && !ev.target.closest('.v9-panel-toggle-wrap')) closeMenu();
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !menu.hidden) { closeMenu(); btn.focus(); }
    });
  }
  applyPanelState(); // 恢复 localStorage 中的显隐状态
}

// ---------- UI 连线 ----------
function wireUI() {
  // 模式
  document.querySelectorAll('.mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  // 模型库
  document.querySelectorAll('#libPrim [data-spawn]').forEach(b => b.onclick = () => { pushUndo(); spawnPrimitive(b.dataset.spawn); setPet('work', '放了个 ' + b.dataset.spawn + '，继续造！'); });
  document.querySelectorAll('#libAdv [data-adv]').forEach(b => b.onclick = () => { pushUndo(); spawnAdvanced(b.dataset.adv); setPet('work', '高级几何体已就位'); });
  document.querySelectorAll('#libModel [data-model]').forEach(b => b.onclick = () => { pushUndo(); spawnModel(b.dataset.model); setPet('work', '好物件，位置随意摆～'); });
  // 检查器标签（6 个）
  document.querySelectorAll('.it').forEach(b => b.onclick = () => {
    document.querySelectorAll('.it').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    TABS.forEach(t => { const el = $('tab-' + t); if (el) el.hidden = (t !== b.dataset.tab); });
  });
  // 对象属性
  $('objName').oninput = e => { if (App.selected) App.selected.name = e.target.value; renderTree(); };
  ['px', 'py', 'pz'].forEach((id, i) => $(id).onchange = e => { if (App.selected) { pushUndo(); App.selected.root.position.setComponent(i, +e.target.value); } });
  ['rx', 'ry', 'rz'].forEach((id, i) => $(id).onchange = e => { if (App.selected) { pushUndo(); App.selected.root.rotation.setComponent(i, THREE.MathUtils.degToRad(+e.target.value)); } });
  ['sx', 'sy', 'sz'].forEach((id, i) => $(id).onchange = e => { if (App.selected) { pushUndo(); const v = Math.max(0.05, +e.target.value); App.selected.root.scale.setComponent(i, v); } });
  $('mColor').oninput = e => { pushUndo(); applyMaterial('color', e.target.value); };
  $('mRough').oninput = e => applyMaterial('roughness', +e.target.value);
  $('mMetal').oninput = e => applyMaterial('metalness', +e.target.value);
  $('mEmissive').oninput = e => applyMaterial('emissive', e.target.value);
  $('mOpacity').oninput = e => applyMaterial('opacity', +e.target.value);
  $('mWire').onchange = e => applyMaterial('wireframe', e.target.checked);
  $('btnDup').onclick = () => { pushUndo(); duplicateSelected(); };
  $('btnDel').onclick = () => { pushUndo(); deleteSelected(); };
  $('btnHide').onclick = () => toggleHideSelected();

  // ===== 建模 =====
  $('btnPickBool').onclick = () => {
    if (!App.selected) { toast('先选中主体物体'); return; }
    App.pickingBool = !App.pickingBool;
    $('btnPickBool').classList.toggle('picking', App.pickingBool);
    $('btnPickBool').textContent = App.pickingBool ? '◉ 点击目标…' : '◎ 拾取目标';
    if (App.pickingBool) toast('请在视口中点击另一个物体作为目标');
  };
  document.querySelectorAll('[data-bool]').forEach(b => b.onclick = () => { pushUndo(); booleanOp(b.dataset.bool); });
  $('btnSubdivide').onclick = () => { pushUndo(); subdivideSelected(); };
  $('btnMirrorX').onclick = () => { pushUndo(); mirrorSelected('x'); };
  document.querySelectorAll('[data-array]').forEach(b => b.onclick = () => { pushUndo(); arraySelected(b.dataset.array, +$('arCount').value, +$('arParam').value); });
  document.querySelectorAll('[data-extrude]').forEach(b => b.onclick = () => { pushUndo(); extrudeShape(b.dataset.extrude, +$('exDepth').value); });

  // ===== 画笔 =====
  document.querySelectorAll('.pmode').forEach(b => b.onclick = () => {
    document.querySelectorAll('.pmode').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    App.paintMode = b.dataset.pmode;
    $('vertexBrush').hidden = App.paintMode !== 'vertex';
    $('textureBrush').hidden = App.paintMode !== 'texture';
  });
  $('bColor').oninput = e => App.brush.color = e.target.value;
  $('bSize').oninput = e => App.brush.size = +e.target.value;
  $('bStr').oninput = e => App.brush.strength = +e.target.value;
  $('bErase').onchange = e => App.brush.erase = e.target.checked;
  $('bSoft').onchange = e => App.brush.soft = e.target.checked;
  document.querySelectorAll('.bshape').forEach(b => b.onclick = () => {
    document.querySelectorAll('.bshape').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); App.brush.shape = b.dataset.bshape;
  });
  $('texColor').oninput = e => App.texture.drawColor = e.target.value;
  $('texSize').oninput = e => App.texture.drawSize = +e.target.value;
  $('btnTexClear').onclick = clearTexture;
  $('btnTexApply').onclick = applyTextureToSelected;
  $('btnTexExport').onclick = exportTexture;

  // ===== 材质 =====
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { pushUndo(); applyPreset(b.dataset.preset); });
  document.querySelectorAll('[data-pbr]').forEach(b => b.onclick = () => { pushUndo(); applyPbrTexture(b.dataset.pbr); });
  $('btnEnhanceAll').onclick = () => { pushUndo(); enhanceAssets(); };

  // ===== 场景：环境分层 / 地形编辑 / 真实感 =====
  document.querySelectorAll('#biomeBtnsTop [data-biome-switch]').forEach(b => b.onclick = () => {
    document.querySelectorAll('#biomeBtnsTop [data-biome-switch]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); buildBiome(b.dataset.biomeSwitch);
  });
  $('btnReplBuild').onclick = () => {
    const list = (App.biomeName === 'desert') ? [() => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.9 }));
      g.position.y = 2.5; g.castShadow = true; return g;
    }] : null;
    replaceLayer('buildings', list || undefined);
  };
  $('btnReplDecor').onclick = () => replaceLayer('decor', undefined);
  $('btnReplRoad').onclick = () => replaceLayer('roads', undefined);
  document.querySelectorAll('[data-editmode]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-editmode]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    App.mode = b.dataset.editmode;
    const label = { select: '选择', water: '水源', dig: '挖地' }[App.mode];
    if ($('hMode')) $('hMode').textContent = label;
    App.engine.controls.enableRotate = (App.mode === 'select');
  });
  $('editWaterR').oninput = e => { App.editBrush = App.editBrush || {}; App.editBrush.waterR = +e.target.value; };
  $('editDigR').oninput = e => { App.editBrush = App.editBrush || {}; App.editBrush.digR = +e.target.value; };
  $('editDigD').oninput = e => { App.editBrush = App.editBrush || {}; App.editBrush.digDepth = +e.target.value; };
  $('wRealism').onchange = e => { App.realism = e.target.checked; setRealism(e.target.checked); };
  $('wSurfaceDetail').onchange = e => enableSurfaceDetail(e.target.checked);

  // ===== 世界 =====
  document.querySelectorAll('[data-sculpt]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-sculpt]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); App.sculpt.mode = b.dataset.sculpt;
  });
  $('scSize').oninput = e => App.sculpt.size = +e.target.value;
  $('scStr').oninput = e => App.sculpt.strength = +e.target.value;
  document.querySelectorAll('[data-biome]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-biome]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); App.biome = b.dataset.biome;
  });
  $('btnGenTerrain').onclick = () => { pushUndo(); generateTerrain({ seed: +$('tSeed').value, height: +$('tHeight').value, seg: +$('tSeg').value }); };
  $('wWater').onchange = e => { App.settings.water = e.target.checked; if (window.__water) window.__water.visible = e.target.checked; };
  $('wAutoDay').onchange = e => { App.settings.autoDay = e.target.checked; };

  // ===== 环境 =====
  document.querySelectorAll('[data-weather]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-weather]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); setWeather(b.dataset.weather); updateInfoBar(); applyWeatherMood(b.dataset.weather);
  });
  $('btnScatter').onclick = () => scatterVegetation(+$('vgDensity').value);
  $('btnClearVeg').onclick = clearVegetation;
  // 无限地图：种子 + 书签
  $('btnApplySeed').onclick = () => { applySeed($('mapSeed').value); updateInfoBar(); };
  $('btnAddBookmark').onclick = () => addBookmark('位置 ' + ((App.bookmarks||[]).length + 1));
  // 模型导入
  $('btnImportGLB').onclick = () => $('modelFileInput').click();
  $('btnImportGLTF').onclick = () => $('modelFileInput').click();
  $('wSky').onchange = e => {
    App.skyPreset = e.target.checked;
    const s = App.engine.scene.getObjectByName('sky') || App.engine.scene.children.find(o => o.type === 'Mesh' && o.material?.uniforms?.sunPosition);
    if (s) s.visible = e.target.checked;
  };

  // ===== 顶栏 =====
  $('timeSlider').oninput = e => {
    const t = +e.target.value / 100;
    if (App.realism !== false) applyRealisticTime(t); else { App.engine.setTimeOfDay(t); updateSky(t); }
  };
  $('btnGrid').onclick = e => { App.settings.grid = !App.settings.grid; setGrid(App.settings.grid); e.target.classList.toggle('active', App.settings.grid); };
  $('btnFog').onclick = e => { App.settings.fog = !App.settings.fog; setFog(App.settings.fog); e.target.classList.toggle('active', App.settings.fog); };
  $('btnParticles').onclick = e => { App.settings.particles = !App.settings.particles; if (window.__particles) window.__particles.visible = App.settings.particles; e.target.classList.toggle('active', App.settings.particles); };
  // 画质档位循环切换
  const qOrder = ['low', 'medium', 'high', 'cinema'];
  $('btnQuality').onclick = () => {
    const cur = App.quality || 'high';
    const next = qOrder[(qOrder.indexOf(cur) + 1) % qOrder.length];
    setQuality(next);
    applyPerfProfile(next);
    $('btnQuality').textContent = '🎬 ' + QUALITY[next].label;
  };
  $('btnFP').onclick = () => toggleFirstPerson(!App.firstPerson);
  $('btnThird').onclick = () => toggleThirdPerson(!App.thirdPerson);
  $('btnCloudSync').onclick = async () => {
    if (App.cloudUser) {
      const ok = await cloudSave(serializeForCloud(), App.worldName, 'main');
      if (ok) toast('已同步到云端');
    } else signIn();
  };
  $('btnSaveLocalFile').onclick = () => saveToLocalFile(serializeForCloud());
  $('btnLoadLocalFile').onclick = () => loadFromLocalFile(() => updateInfoBar());
  // 全局搜索
  const si = $('globalSearch'), sr = $('searchResults');
  si.oninput = () => {
    const q = si.value;
    const res = searchAll(q, $('noteBox').value);
    sr.innerHTML = '';
    if (!q.trim()) { sr.classList.remove('show'); return; }
    res.slice(0, 30).forEach(r => {
      const d = document.createElement('div');
      d.className = 'sr-item';
      d.innerHTML = `<b>[${r.kind}]</b> ${r.label}<small>${r.sub || ''}</small>`;
      d.onclick = () => {
        if (r.ref && r.ref.root) { selectObject(r.ref); showItemInfo(r.ref); goTo({ name: r.ref.name, x: r.ref.root.position.x, y: r.ref.root.position.y + 1, z: r.ref.root.position.z, seed: getSeed() }); }
        sr.classList.remove('show');
      };
      sr.appendChild(d);
    });
    if (!res.length) sr.innerHTML = '<div class="sr-item">无匹配结果</div>';
    sr.classList.add('show');
  };
  si.onblur = () => setTimeout(() => sr.classList.remove('show'), 200);
  // 笔记输入持久化
  $('noteBox').oninput = e => { App.note = e.target.value; };
  $('btnHelp').onclick = () => $('helpModal').classList.remove('hidden');
  $('btnHelpClose').onclick = () => $('helpModal').classList.add('hidden');
  $('btnUndo').onclick = undo;
  $('btnRedo').onclick = redo;
  $('btnShot').onclick = screenshot;
  $('btnSave').onclick = saveLocal;
  $('btnLoad').onclick = () => $('fileInput').click();
  $('fileInput').onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
  $('btnExport').onclick = exportGLTF;
  // 返回世界管理：先保存当前世界再展示管理页
  $('btnBackWorlds').onclick = async () => {
    if (getActiveWorldId()) await saveWorld();
    showManager();
  };

  // ===== 任务 =====
  $('taskAdd').onclick = () => { addTask($('taskIn').value); $('taskIn').value = ''; };
  $('taskIn').onkeydown = e => { if (e.key === 'Enter') { addTask($('taskIn').value); $('taskIn').value = ''; } };

  // ===== 世界管理：新建配置页 + 工具条交互 =====
  wireWorldConfig();
  wireManagerToolbar();

  // 兼容旧钩子：入口卡（若仍显示）点击后进入配置页而非直接建造
  document.querySelectorAll('#themePick [data-theme]').forEach(b => b.onclick = () => {
    document.querySelectorAll('#themePick [data-theme]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); App.theme = b.dataset.theme;
  });

  // wb:world-close 事件：清理本模块私有撤销栈（world-manager 无法直接访问）
  window.addEventListener('wb:world-close', () => { undoStack.length = 0; redoStack.length = 0; });
  // world:apply-config 事件：应用初始模式的 UI 表现
  window.addEventListener('world:apply-config', e => applyWorldUiConfig(e.detail?.config || {}));

  // world:open 事件：世界载入成功后统一进入工作区
  // （此前卡片点击只 openWorld 不切页，会停在管理页并反复提示「世界已载入」）
  window.addEventListener('world:open', () => {
    enterWorkspace();
    // 画布在 hidden 容器里尺寸为 0，切页后补一次尺寸校正
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });

  // 自动昼夜（同步天空）
  let autoT = 0.55;
  App.engine.onUpdate((dt) => {
    if (!App.settings.autoDay || App.firstPerson || App.thirdPerson) return;
    autoT = (autoT + dt * 0.015) % 1;
    if (App.realism !== false) applyRealisticTime(autoT); else { App.engine.setTimeOfDay(autoT); updateSky(autoT); }
    const ts = $('timeSlider'); if (ts) ts.value = Math.round(autoT * 100);
  });
}

// ---- v10 专注模式：一次性跳过所有提示 ----
function wireFocusMode() {
  const btn = $('v10-focus-toggle');
  const apply = on => {
    if (btn) {
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.title = on ? '专注模式已开启 · 提示已静默（F9 恢复）' : '开启专注模式 · 跳过所有提示（F9）';
      const label = btn.querySelector('.v10-focus-label');
      if (label) label.textContent = on ? '专注 · 已静默' : '专注模式';
    }
    document.body.classList.toggle('v10-focus-on', on);
    // 开启时清掉现存 toast 与任何引导气泡；关掉自动帮助弹窗
    if (on) {
      document.querySelectorAll('#toast .toast-i').forEach(el => el.remove());
      const hm = $('helpModal'); if (hm) hm.classList.add('hidden');
    }
  };
  if (btn) btn.onclick = () => toggleFocusMode();
  bus.on('focus:change', e => apply(e.detail?.on));
  apply(isFocusMode());
}
function toggleFocusMode() {
  const next = !isFocusMode();
  setFocusMode(next);
  // toast 在专注模式下静默，用直接 DOM 反馈开关状态（不受 toast 静默影响）
  const box = document.getElementById('toast');
  if (box && !next) {
    const el = document.createElement('div');
    el.className = 'toast-i';
    el.textContent = '已退出专注模式，提示恢复';
    box.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}

// ---- 体素沙盒：模式切换 / 材质 / 物理开关（P0-3/4/5/6）----
// ---- v10 创作向导：把配置落到现有面板 / 画质 / 时段，不新增一套状态 ----
const QUALITY_TEXT = { low: '流畅', medium: '标准', high: '高清', cinema: '电影级' };
function wireGuideBridge() {
  window.addEventListener('fv:guide-apply', e => {
    const d = e.detail || {};
    const cfg = d.cfg || {};

    // 1) 面板显隐：走既有 setPanel（含 localStorage 持久化与勾选态同步）
    if (d.panels) {
      Object.keys(PANEL_BARS).forEach(k => {
        if (typeof d.panels[k] === 'boolean' && panelState[k] !== d.panels[k]) setPanel(k, d.panels[k]);
      });
    }

    // 2) 画质：只在真的不同时切，避免重复重建后处理管线
    if (d.quality && QUALITY[d.quality] && App.quality !== d.quality) {
      setQuality(d.quality);
      applyPerfProfile(d.quality);
      const qb = $('btnQuality');
      if (qb) qb.textContent = '🎬 ' + (QUALITY_TEXT[d.quality] || QUALITY[d.quality].label);
    }

    // 3) 时段：同步滑杆与真实光照
    if (typeof d.time === 'number') {
      const ts = $('timeSlider');
      const now = ts ? +ts.value / 100 : 0.55;
      if (Math.abs(now - d.time) > 0.01) {
        if (ts) ts.value = Math.round(d.time * 100);
        if (App.realism !== false) applyRealisticTime(d.time);
        else { App.engine?.setTimeOfDay?.(d.time); updateSky(d.time); }
      }
    }

    // 4) 新建世界配置页的默选项（生态 / 画质段选），复用既有点击逻辑
    const bBtn = document.querySelector(`#wcBiomes [data-biome-switch="${cfg.biome}"]`);
    if (bBtn && !bBtn.classList.contains('active')) bBtn.click();
    const qBtn = document.querySelector(`#wcQuality [data-quality="${d.quality}"]`);
    if (qBtn && !qBtn.classList.contains('active')) qBtn.click();
    if ($('wcTimeOfDay') && typeof d.time === 'number') {
      $('wcTimeOfDay').value = Math.round(d.time * 100);
      if ($('wcTimeOut')) $('wcTimeOut').textContent = d.time > 0.7 ? '黄昏' : d.time < 0.3 ? '清晨' : '正午';
    }

    // 5) 首屏 C 位：只切检查器标签，不夺焦点、不打断操作
    if (cfg.hero === 'assets' && panelState.left === false) setPanel('left', true);
    if (cfg.hero === 'stat') setPanel('bottom', true);
  });
}

function wireVoxelTools() {
  const modeBtns = ['v9-mode-free', 'v9-mode-voxel'];
  const tools = $('v9-voxel-tools');
  modeBtns.forEach(id => {
    const b = $(id); if (!b) return;
    b.onclick = () => {
      const voxel = id === 'v9-mode-voxel';
      modeBtns.forEach(x => $(x)?.classList.toggle('active', x === id));
      setVoxelMode(voxel);
      if (tools) tools.classList.toggle('hidden', !voxel);
      toast(voxel ? '方块沙盒：左键放置 · 右键破坏' : '已返回自由创作');
      bus.emit('voxel:ui-mode', { voxel });
    };
  });
  document.querySelectorAll('[data-voxel-mat]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-voxel-mat]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    setVoxelMaterial(b.dataset.voxelMat);
  });
  if ($('v9-physics-toggle')) $('v9-physics-toggle').onchange = e => {
    setPhysicsEnabled(e.target.checked);
    toast(e.target.checked ? '物理已开启：方块与物体受重力/碰撞影响' : '物理已关闭');
  };
  // 方块变化纳入自动保存触发
  bus.on('voxel:change', () => { App.voxelDirty = true; });
}

// ---- 自动保存：2s 防抖 + 切后台强制 flush ----
function setupWorldAutosave() {
  let timer = null;
  const schedule = () => {
    if (!getActiveWorldId()) return;
    clearTimeout(timer);
    timer = setTimeout(() => { saveWorld(); timer = null; }, 2000);
  };
  window.addEventListener('world:list', schedule);
  window.addEventListener('world:meta', schedule);
  // 场景改动时由 bus 触发的保存点（物体增删等）
  bus.on?.('objects', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && getActiveWorldId()) { clearTimeout(timer); saveWorld(); }
  });
}

// ---- 世界管理 UI 接线 ----
function readConfigFromDom() {
  const pick = (sel) => {
    // 只用点击处理器会互斥切换的 .active / data-active，避免残留的 aria-checked 抢先命中
    const el = document.querySelector(sel + ' .active, ' + sel + ' [data-active="true"]');
    if (!el) return null;
    // 生态卡片用 data-biome-switch；其余分段控件用各自 data-* 属性
    return el.dataset.biomeSwitch || el.dataset.biome || el.dataset.quality ||
           el.dataset.kit || el.dataset.view || el.dataset.panel || el.dataset.imode || null;
  };
  return {
    name: $('wcName')?.value || '',
    biome: pick('#wcBiomes') || 'grass',
    seed: +$('wcSeed')?.value || 7,
    weather: $('wcWeather')?.value || 'clear',
    timeOfDay: +$('wcTimeOfDay')?.value / 100 || 0.55,
    quality: pick('#wcQuality') || 'medium',
    starterKit: pick('#wcStarterKit') || 'basic',
    cloudSync: !!$('wcCloudSync')?.checked,
    terrainHeight: +$('wcTerrainHeight')?.value || 3,
    terrainSeg: +$('wcTerrainSeg')?.value || 96,
    startView: pick('#wcStartView') || 'top',
    initialPanel: pick('#wcInitialPanel') || 'collapsed',
    initialMode: pick('#wcInitialMode') || 'select',
    envDetails: {
      water: !!$('wcEnvWater')?.checked,
      grid: !!$('wcEnvGrid')?.checked,
      fog: !!$('wcEnvFog')?.checked,
      particles: !!$('wcEnvParticles')?.checked,
    },
  };
}

function wireWorldConfig() {
  // 单选组：限定作用域，避免与场景页 [data-biome-switch] 冲突
  ['#wcBiomes', '#wcQuality', '#wcStarterKit', '#wcStartView', '#wcInitialPanel', '#wcInitialMode'].forEach(sel => {
    const box = document.querySelector(sel);
    if (!box) return;
    box.addEventListener('click', ev => {
      const btn = ev.target.closest('button');
      if (!btn || !box.contains(btn)) return;
      [...box.querySelectorAll('button')].forEach(b => { b.classList.remove('active'); b.dataset.active = 'false'; });
      btn.classList.add('active'); btn.dataset.active = 'true';
    });
  });
  if ($('wcSeedRandom')) $('wcSeedRandom').onclick = () => { if ($('wcSeed')) $('wcSeed').value = Math.floor(Math.random() * 999999) + 1; };
  if ($('wcTimeOfDay')) $('wcTimeOfDay').oninput = e => { if ($('wcTimeOut')) $('wcTimeOut').textContent = e.target.value > 70 ? '黄昏' : e.target.value < 30 ? '清晨' : '正午'; };
  if ($('wcCancel')) $('wcCancel').onclick = () => showManager();
  if ($('wcSubmit')) $('wcSubmit').onclick = async () => {
    const cfg = normalizeConfig(readConfigFromDom());
    const world = createWorld(cfg);
    if (!world) { toast('世界创建失败'); return; }
    const opened = await openWorld(world.id);
    if (!opened) { toast('进入世界失败'); return; }
    hideConfig();
    enterWorkspace();
    toast('世界已创建：' + world.name);
  };
}

// 管理页工具条：排布 / 筛选 / 排序 / 搜索 / 导入导出（渲染后过滤，不改 world-manager）
function wireManagerToolbar() {
  const box = $('wmWorlds');
  if (!box) return;

  // 排布切换：改容器 data-layout + 按钮态
  document.querySelectorAll('.wm-layout').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.wm-layout').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
    box.dataset.layout = btn.dataset.layout;
  });

  // 首屏渲染早于本监听器绑定，先补一次计数（否则「共 0 个世界」与卡片数不符）
  const firstCount = $('wmWorldCount');
  if (firstCount) firstCount.textContent = listWorlds().length;

  // world:list 后应用筛选/排序/搜索 + 计数
  window.addEventListener('world:list', e => {
    const worlds = e.detail?.worlds || listWorlds();
    const countEl = $('wmWorldCount');
    if (countEl) countEl.textContent = worlds.length;
    const biome = $('wmFilterBiome')?.value || '';
    const sync = $('wmFilterSync')?.value || '';
    const sort = $('wmSortBy')?.value || 'openedAt';
    const q = ($('wmSearch')?.value || '').trim().toLowerCase();

    // 计算可见集合
    const visible = worlds.filter(w => {
      if (biome && w.biome !== biome) return false;
      if (sync) {
        const s = w.sync?.state || 'off';
        if (sync === 'off' && s !== 'off' && w.sync?.enabled) return false;
        if (sync !== 'off' && s !== sync) return false;
      }
      if (q && !(w.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...visible].sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'createdAt') return (b.createdAt || '').localeCompare(a.createdAt || '');
      if (sort === 'size') return (b.snapshot?.objects?.length || 0) - (a.snapshot?.objects?.length || 0);
      return (b.openedAt || b.updatedAt || '').localeCompare(a.openedAt || a.updatedAt || '');
    });
    // 按排序重排 DOM
    const cards = new Map();
    box.querySelectorAll('[data-world-id]').forEach(el => cards.set(el.dataset.worldId, el));
    sorted.forEach(w => { const el = cards.get(w.id); if (el) { el.style.display = ''; box.insertBefore(el, $('wmNewCard') || null); } });
    // 隐藏不在可见集合的卡片
    cards.forEach((el, id) => { if (!visible.some(w => w.id === id) && id !== '__new__') el.style.display = 'none'; });
  });

  ['wmFilterBiome', 'wmFilterSync', 'wmSortBy'].forEach(id => { if ($(id)) $(id).onchange = () => renderManager(); });
  if ($('wmSearch')) $('wmSearch').oninput = () => renderManager();

  // 导入存档
  if ($('wmImportSave')) $('wmImportSave').onclick = () => loadFromLocalFile(d => {
    const cfg = normalizeConfig(readConfigFromDom());
    const w = createWorld({ ...cfg, name: d.worldName || d.name || '导入的世界' });
    if (w) {
      importSnapshotIntoWorld(w.id, d);
      toast('存档已导入为新世界');
      renderManager();
    }
  });

  // 导出全部
  if ($('wmExportAll')) $('wmExportAll').onclick = () => {
    const all = listWorlds().map(e => {
      const w = getCurrentWorld();
      return { id: e.id, name: e.name, worldName: e.name, config: e.config, biome: e.biome };
    });
    saveToLocalFile({ worldName: 'ForgeVerse 世界集', worlds: all }, 'forgeverse-worlds.json');
    toast('已导出世界清单');
  };

  // 卡片更多菜单：重命名 / 复制 / 删除（事件委托）
  box.addEventListener('click', async ev => {
    const more = ev.target.closest('[data-more]');
    if (!more) return;
    ev.stopPropagation();
    const card = more.closest('[data-world-id]');
    const id = card?.dataset.worldId;
    if (!id || id === '__new__') return;
    const action = window.prompt('世界操作（输入 r=重命名 d=复制 x=删除，取消退出）:', 'r');
    if (!action) return;
    const a = action.trim().toLowerCase();
    if (a === 'r') {
      const name = window.prompt('新名称:', listWorlds().find(w => w.id === id)?.name || '');
      if (name) { updateWorldMeta(id, { name }); renderManager(); }
    } else if (a === 'd') {
      cloneWorld(id); renderManager();
    } else if (a === 'x') {
      if (window.confirm('确定删除这个世界？')) { deleteWorld(id); renderManager(); }
    }
  });

  // 设置按钮：提示进入世界后调整
  if ($('wmSettings')) $('wmSettings').onclick = () => toast('进入世界后可调整画质与环境设置');
}

function importSnapshotIntoWorld(worldId, data) {
  // 载入存档数据后写回新世界的快照
  try {
    deserializeWorld(data);
    import('/js/world-manager.js').then(m => m.saveWorld(worldId)).catch(() => {});
  } catch (_) {}
}

function enterWorkspace() {
  $('worldManager')?.classList.add('hidden');
  $('worldConfig')?.classList.add('hidden');
  $('intro')?.classList.add('hidden');
  $('stage')?.classList.remove('hidden');
}

function applyWorldUiConfig(cfg) {
  const env = cfg.envDetails || {};
  if (Object.prototype.hasOwnProperty.call(env, 'water') && window.__water) window.__water.visible = env.water !== false;
  if (Object.prototype.hasOwnProperty.call(env, 'grid') && App.engine?.grid) App.engine.grid.visible = env.grid !== false;
  if (Object.prototype.hasOwnProperty.call(env, 'fog')) setFog(env.fog !== false);
  if (Object.prototype.hasOwnProperty.call(env, 'particles') && window.__particles) window.__particles.visible = env.particles !== false;
  if (cfg.quality && QUALITY[cfg.quality]) { setQuality(cfg.quality); applyPerfProfile(cfg.quality); }
  if (cfg.initialMode === 'roam') toggleFirstPerson(true);
}

// ---- 云存档序列化（含笔记/标签/种子/书签）----
function serializeForCloud() {
  const d = serialize();
  d.note = App.note || '';
  d.mapSeed = getSeed();
  d.bookmarks = App.bookmarks || [];
  d.terrainEdits = serializeEdits();
  d.biomeName = App.biomeName || 'urban';
  return d;
}

function renderUserInfo() {
  const el = $('infoUser');
  if (!el) return;
  const u = App.cloudUser;
  el.innerHTML = u
    ? `☁ 已登录<br><b>${u.name || '造物者'}</b><br><span style="color:var(--gold)">数据自动云同步</span>`
    : '未登录<br>本地访客模式<br><span style="color:var(--sub);font-size:10px">点顶部 ☁登录 启用云保存</span>';
  const b = $('btnCloudSync');
  if (b) b.textContent = u ? '☁ 已登录·同步' : '☁ 登录';
}

function updateInfoBar() {
  const wx = $('infoWeather');
  if (wx) wx.textContent = ({ clear:'晴朗',rain:'下雨',snow:'下雪',storm:'雷暴',fog:'浓雾',aurora:'极光',sandstorm:'沙暴',sunny:'多云',mist:'薄雾' })[App.weather] || App.weather || '晴朗';
  const sd = $('infoSeed');
  if (sd) sd.textContent = '种子 ' + getSeed();
}

// 侧栏闲置自动收起（3 秒无操作），鼠标靠近展开
function setupAutoHide() {
  const bars = [$('leftbar'), $('rightbar')].filter(Boolean);
  if (!bars.length) return;
  let timer = null;
  const reset = () => {
    bars.forEach(b => b.classList.remove('collapsed'));
    clearTimeout(timer);
    timer = setTimeout(() => bars.forEach(b => {
      if (!b.matches(':hover')) b.classList.add('collapsed');
    }), 4000);
  };
  ['pointermove', 'pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, reset, { passive: true }));
  bars.forEach(b => {
    const h = b.querySelector('.rail-handle');
    if (h) h.onclick = () => b.classList.toggle('collapsed');
  });
  reset();
}

function setMode(m) {
  if (App.firstPerson) return;
  App.mode = m;
  document.querySelectorAll('.mode').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  $('hMode').textContent = MODE_TXT[m];
  const eng = App.engine;
  eng.controls.enableRotate = (m === 'select');
  if (m === 'select' && App.selected) eng.tcontrols.attach(App.selected.root);
  else eng.tcontrols.detach();
  if (m === 'paint') setPet('work', App.paintMode === 'texture' ? '纹理模式下在画板绘制再贴图～' : '选个物体，按住左键涂色吧～');
  else if (m === 'sculpt') setPet('work', '在地形上按住左键隆起/下沉');
  else if (m === 'terrain') setPet('work', '选个地貌色，在地形上涂装');
}

function startWorld() {
  App.worldName = $('worldName').value || '未命名世界';
  applyTheme(App.theme);
  generateTerrain();
  createWater();
  window.__water = App.engine.scene.getObjectByName('water');
  window.__particles = App.engine.scene.getObjectByName('particles');
  setPet('idle', '世界已就绪，开始你的造物之旅！');
  toast('🌍 ' + App.worldName + ' 已生成');
  $('intro').classList.add('hidden');
  // 若检测到云端存档，直接恢复
  let restored = false;
  if (App.pendingCloudSave) {
    deserialize(App.pendingCloudSave);
    App.pendingCloudSave = null;
    restored = true;
    toast('云端世界已恢复');
  }
  enhanceAssets();          // AI 风格 PBR 纹理：颜色 + 法线 + 粗糙度
  buildBiome(App.biomeName || 'urban');   // 三环境资产分层（建筑/装饰/公路）
  enableSurfaceDetail(true);              // 地表细节增强
  applyRealisticTime(+($('timeSlider').value) / 100); // 真实感光照
  if (!restored) spawnModel('tree');
  // 初始化信息台/地图
  App.note = App.note || '';
  if ($('noteBox')) $('noteBox').value = App.note;
  $('mapSeed').value = getSeed();
  updateInfoBar();
  renderUserInfo();
}

function onKey(e) {
  if (e.target.tagName === 'INPUT' || App.firstPerson) return;
  // FV-A1：面板快捷键（顶栏入口关闭后仍可用；不触碰 WASD/变换/撤销键）
  if (e.key === '[') { e.preventDefault(); togglePanel('left'); return; }
  if (e.key === ']') { e.preventDefault(); togglePanel('right'); return; }
  if (e.key === 'F2') { e.preventDefault(); togglePanel('bottom'); return; }
  if (e.key === 'F9') { e.preventDefault(); toggleFocusMode(); return; }   // v10 专注模式
  if (e.key === 'w' || e.key === 'W') App.engine.tcontrols.setMode('translate');
  else if (e.key === 'e' || e.key === 'E') App.engine.tcontrols.setMode('rotate');
  else if (e.key === 'r' || e.key === 'R') App.engine.tcontrols.setMode('scale');
  else if (e.key === 'Delete' || e.key === 'Backspace') { pushUndo(); deleteSelected(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
}

boot();

// PWA：注册 Service Worker（手机可安装、离线可用）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
