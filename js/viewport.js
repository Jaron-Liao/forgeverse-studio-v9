// ============================================================
// viewport.js — Three.js 单 canvas 多视窗（主视窗 + 可选小预览视窗）
// 任务：FV-ENG-02 ｜ 依据：docs/architecture/ADR.md ADR-02
//
// 渲染顺序（不可颠倒）：
//   1) renderMain()（通常是 EffectComposer.render()，输出整张 canvas）
//   2) autoClear=false + scissorTest=true
//   3) 附加视窗：setViewport/setScissor → clear → render(scene, camera)
//   4) 恢复 autoClear / viewport / scissor / scissorTest
//
// 坐标约定：对外 rect 用 CSS 像素、原点左上；内部转 Three 的左下原点。
// ============================================================
import * as THREE from 'three';

let engine = null;
let renderer = null;
let renderMain = null;
let resizeMain = null;
let paused = false;
let canvasW = 1280;
let canvasH = 720;

const viewports = new Map(); // id -> viewport spec

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- 初始化 ----------
// 兼容两种调用：initViewport(engine, { renderMain, resizeMain })
//              initViewport({ engine, renderMain, resizeMain })
export function initViewport(engOrCfg = null, cfg = {}) {
  const looksLikeEngine = engOrCfg && (engOrCfg.renderer || engOrCfg.scene);
  const source = looksLikeEngine ? cfg : (engOrCfg || {});
  engine = looksLikeEngine ? engOrCfg : (source.engine || source);
  renderer = source.renderer || engine?.renderer || null;
  renderMain = typeof source.renderMain === 'function' ? source.renderMain : null;
  resizeMain = typeof source.resizeMain === 'function' ? source.resizeMain : null;

  if (!renderer) return false;
  const el = renderer.domElement;
  canvasW = Math.max(1, Math.round(el?.clientWidth || el?.width || canvasW));
  canvasH = Math.max(1, Math.round(el?.clientHeight || el?.height || canvasH));

  // 未显式注册主视窗时，用引擎自带 scene/camera 建立一个全画布主视窗。
  if (!viewports.has('main')) {
    registerViewport({
      id: 'main',
      scene: engine?.scene || null,
      camera: engine?.camera || null,
      rect: null,
      layer: 0,
      active: true,
      interval: 0,
    });
  }
  updateCameras();
  return true;
}

// ---------- 视窗注册 / 移除 ----------
export function registerViewport(spec = {}) {
  const id = typeof spec.id === 'string' && spec.id ? spec.id : `vp_${Date.now().toString(36)}`;
  const isOverlay = !!(spec.rect || spec.anchor || spec.widthRatio || spec.heightRatio);
  const active = spec.active !== false;
  const vp = {
    id,
    scene: spec.scene || (id === 'main' ? engine?.scene : null),
    camera: spec.camera || (id === 'main' ? engine?.camera : null),
    renderFn: typeof spec.renderFn === 'function' ? spec.renderFn : null,
    rect: spec.rect || null,
    anchor: spec.anchor || 'bottom-right',
    widthRatio: spec.widthRatio,
    heightRatio: spec.heightRatio,
    margin: spec.margin,
    layer: Number.isFinite(spec.layer) ? spec.layer : (isOverlay ? 1 : 0),
    enabled: spec.enabled !== false,
    active,
    interval: Number.isFinite(spec.interval) ? Math.max(0, spec.interval) : (active ? 0 : 100),
    lastRender: 0,
  };
  // 没有相机则建一个独立相机，保证预览视窗与主视窗互不干扰。
  if (!vp.camera) {
    vp.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    vp.camera.position?.set?.(14, 12, 18);
    vp.camera.lookAt?.(0, 1, 0);
  }
  // 相机 layers 掩码实现「场景裁剪」：只有匹配层的物体出现在该视窗。
  if (spec.layerMask != null && vp.camera.layers) {
    vp.camera.layers.mask = spec.layerMask >>> 0;
  }
  viewports.set(id, vp);
  updateCameras();
  return id;
}

export function removeViewport(id) {
  return viewports.delete(id);
}

export function setViewportEnabled(id, enabled) {
  const vp = viewports.get(id);
  if (!vp) return false;
  vp.enabled = !!enabled;
  return vp.enabled;
}

export function setViewportActive(id, active, interval) {
  const vp = viewports.get(id);
  if (!vp) return false;
  vp.active = !!active;
  if (Number.isFinite(interval)) vp.interval = Math.max(0, interval);
  return vp.active;
}

// ---------- 矩形计算 ----------
function ratioRect(vp) {
  const margin = clamp(Number(vp.margin ?? 12) || 0, 0, 200);
  const wRatio = clamp(Number(vp.widthRatio ?? vp.rect?.wRatio ?? 0.24) || 0.24, 0.05, 0.6);
  const hRatio = clamp(Number(vp.heightRatio ?? vp.rect?.hRatio ?? 0.24) || 0.24, 0.05, 0.6);
  const w = Math.max(1, Math.round(canvasW * wRatio));
  const h = Math.max(1, Math.round(canvasH * hRatio));
  let x = canvasW - w - margin;
  let y = canvasH - h - margin;
  switch (vp.anchor) {
    case 'top-left': x = margin; y = margin; break;
    case 'top-right': x = canvasW - w - margin; y = margin; break;
    case 'bottom-left': x = margin; y = canvasH - h - margin; break;
    default: break; // bottom-right
  }
  return {
    x: clamp(Math.round(x), 0, Math.max(0, canvasW - w)),
    y: clamp(Math.round(y), 0, Math.max(0, canvasH - h)),
    w: Math.min(w, canvasW),
    h: Math.min(h, canvasH),
  };
}

// 对外返回 CSS 像素矩形（原点左上），供输入命中测试/截图裁剪使用。
export function getViewportRect(id, asGL = false) {
  const vp = viewports.get(id);
  if (!vp) return null;
  const r = vp.rect && Number.isFinite(vp.rect.x) && Number.isFinite(vp.rect.y)
    && Number.isFinite(vp.rect.w) && Number.isFinite(vp.rect.h)
    ? {
      x: clamp(Math.round(vp.rect.x), 0, canvasW),
      y: clamp(Math.round(vp.rect.y), 0, canvasH),
      w: clamp(Math.round(vp.rect.w), 1, canvasW),
      h: clamp(Math.round(vp.rect.h), 1, canvasH),
    }
    : (id === 'main' ? { x: 0, y: 0, w: canvasW, h: canvasH } : ratioRect(vp));
  // 防止越界
  r.w = Math.min(r.w, canvasW - r.x);
  r.h = Math.min(r.h, canvasH - r.y);
  return asGL ? { x: r.x, y: canvasH - r.y - r.h, w: r.w, h: r.h } : r;
}

export function getViewports() {
  return [...viewports.values()].map(v => ({
    id: v.id, layer: v.layer, enabled: v.enabled, active: v.active,
    interval: v.interval, rect: getViewportRect(v.id),
  }));
}

function updateCameras() {
  viewports.forEach(vp => {
    const cam = vp.camera;
    if (!cam || !cam.isPerspectiveCamera) return;
    const r = getViewportRect(vp.id);
    const aspect = Math.max(1, r.w) / Math.max(1, r.h);
    if (Math.abs((cam.aspect || 1) - aspect) > 0.001) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix?.();
    }
  });
}

// ---------- 渲染 ----------
export function setPaused(value) {
  paused = !!value;
  return paused;
}

export function isPaused() { return paused; }

export function renderViewports() {
  if (!renderer || paused) return;

  const prevAutoClear = renderer.autoClear;
  const prevScissorTest = renderer.getScissorTest();
  const prevViewport = renderer.getViewport(new THREE.Vector4());
  const prevScissor = renderer.getScissor(new THREE.Vector4());

  try {
    // 1) 主视窗：保留原后处理链路（composer.render 或 engine 默认渲染）。
    const main = viewports.get('main');
    if (main && main.enabled) {
      if (renderMain) renderMain();
      else renderer.render(main.scene || engine?.scene, main.camera || engine?.camera);
    } else {
      renderer.clear();
    }

    // 2) 附加视窗：按 layer 顺序叠加，非激活视窗按 interval 降频。
    const overlays = [...viewports.values()]
      .filter(v => v.id !== 'main' && v.enabled)
      .sort((a, b) => a.layer - b.layer);
    if (!overlays.length) return;

    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    renderer.autoClear = false;
    renderer.setScissorTest(true);

    for (const vp of overlays) {
      if (!vp.active && vp.lastRender && (t - vp.lastRender) < vp.interval) continue;
      vp.lastRender = t;
      const g = getViewportRect(vp.id, true);
      if (g.w <= 0 || g.h <= 0) continue;
      renderer.setViewport(g.x, g.y, g.w, g.h);
      renderer.setScissor(g.x, g.y, g.w, g.h);
      renderer.clear(true, true, true);
      if (vp.renderFn) vp.renderFn();
      else if (vp.scene && vp.camera) renderer.render(vp.scene, vp.camera);
    }
  } finally {
    // 3) 无论中途出错都要恢复 renderer 状态，避免污染下一帧/截图。
    renderer.setScissorTest(prevScissorTest);
    renderer.setViewport(prevViewport);
    renderer.setScissor(prevScissor);
    renderer.autoClear = prevAutoClear;
  }
}

// ---------- 尺寸 ----------
export function resize(w, h) {
  const el = renderer?.domElement;
  canvasW = Math.max(1, Math.round(Number(w) || el?.clientWidth || el?.width || canvasW));
  canvasH = Math.max(1, Math.round(Number(h) || el?.clientHeight || el?.height || canvasH));
  if (typeof resizeMain === 'function') resizeMain(canvasW, canvasH);
  else if (renderer) renderer.setSize(canvasW, canvasH);
  updateCameras();
  return { width: canvasW, height: canvasH };
}
