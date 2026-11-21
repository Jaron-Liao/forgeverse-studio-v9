// ============================================================
// realism.js — 真实感渲染增强
// 太阳高度角驱动的天空/光照色温、地表微细节、性能档位。
// 全部参数可运行时调节，避免写死在引擎里。
// ============================================================
import * as THREE from 'three';
import { App, clamp, toast } from './state.js';

let realismOn = true;
let detailOverlay = null;

// 天空色随太阳高度角：日出暖橙 → 正午蓝 → 日落金 → 夜深蓝
function skyGradient(t) {
  const ang = t * Math.PI * 2 - Math.PI / 2;
  const sunY = Math.sin(ang);              // -1..1
  const day = clamp(sunY * 1.4 + 0.25, 0, 1);
  // v10 WorkBuddy 绿：青绿天空，清爽专业，与品牌绿协调
  const horizon = new THREE.Color().setHSL(
    sunY < 0.1 ? 0.10 : 0.47,             // 低角度暖橙 / 白天青绿
    0.52, 0.46 + day * 0.34
  );
  const zenith = new THREE.Color().setHSL(
    0.44, 0.50, 0.16 + day * 0.36          // 青蓝天顶
  );
  const sunColor = new THREE.Color().setHSL(
    clamp(0.09 + sunY * 0.04, 0.08, 0.14), 0.65 - day * 0.45, 0.55 + day * 0.35
  );
  return { day, sunY, horizon, zenith, sunColor };
}

export function applyRealisticTime(t) {
  const eng = App.engine;
  const g = skyGradient(t);
  const ang = t * Math.PI * 2 - Math.PI / 2;
  // 太阳位置
  eng.sun.position.set(Math.cos(ang) * 70, Math.sin(ang) * 60 + 6, 24);
  eng.sun.color.copy(g.sunColor);
  eng.sun.intensity = 0.25 + g.day * 2.6;
  // 环境光
  if (eng.hemi) {
    eng.hemi.intensity = 0.45 + g.day * 0.55;              // 亮底抬基础环境光，减少死黑阴影
    eng.hemi.color.copy(g.zenith);
    eng.hemi.groundColor.set(0xFFF4DC);                     // 浅暖反射，WorkBuddy 清爽感
  }
  // 背景与雾（地平线色）
  if (eng.scene.background?.isColor) eng.scene.background.copy(g.zenith);
  if (eng.scene.fog) { eng.scene.fog.color.copy(g.horizon); eng.scene.fog.near = 45; eng.scene.fog.far = 190; }
  eng.renderer.toneMappingExposure = 0.70 + g.day * 0.20;   // v10 WorkBuddy：上限 0.90，清爽不刺眼
  return g;
}

// 给地形材质注入细节法线扰动（在现有 normalMap 基础上增强高频）
export function enableSurfaceDetail(on = true) {
  const t = window.__terrain;
  if (!t || !t.material) return;
  const m = t.material;
  if (on) {
    m.roughness = 0.98;
    m.metalness = 0.0;
    if (m.normalScale) m.normalScale.set(0.9, 0.9);
    if (detailOverlay == null) detailOverlay = 0.9;
  } else {
    if (m.normalScale) m.normalScale.set(0.4, 0.4);
  }
  m.needsUpdate = true;
}

// 性能档位：按画质档调整阴影/后处理/粒子
const PRESETS = {
  low:    { shadow: 512,  particles: 0.4, dpr: 1.0 },
  medium: { shadow: 1024, particles: 0.7, dpr: 1.25 },
  high:   { shadow: 2048, particles: 1.0, dpr: 1.5 },
  cinema: { shadow: 2048, particles: 1.0, dpr: 2.0 },
};
export function applyPerfProfile(q) {
  const p = PRESETS[q] || PRESETS.high;
  const eng = App.engine;
  eng.sun.shadow.mapSize.set(p.shadow, p.shadow);
  if (eng.sun.shadow.map) { eng.sun.shadow.map.dispose(); eng.sun.shadow.map = null; }
  eng.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.dpr));
  App.perfProfile = p;
}

export function setRealism(on) { realismOn = on; toast(on ? '真实感渲染：开' : '真实感渲染：关'); }
export function isRealismOn() { return realismOn; }

// 天气氛围：雾色与光照随天气联动（由 main 调用）
export function applyWeatherMood(weather) {
  const eng = App.engine;
  if (!eng.scene.fog) return;
  const moods = {
    clear: { fog: 0xbcd4e6, sun: 2.5, amb: 0.7 },
    rain:  { fog: 0x7d90a4, sun: 1.2, amb: 0.55 },
    snow:  { fog: 0xd6e2ec, sun: 1.6, amb: 0.8 },
    storm: { fog: 0x4a5a72, sun: 0.8, amb: 0.4 },
    fog:   { fog: 0xa8b2bd, sun: 1.0, amb: 0.65 },
    mist:  { fog: 0xc0c9d4, sun: 1.6, amb: 0.7 },
    sandstorm: { fog: 0xcbb081, sun: 1.4, amb: 0.75 },
    aurora: { fog: 0x1a2340, sun: 0.5, amb: 0.4 },
    sunny: { fog: 0xcfe0ee, sun: 2.2, amb: 0.75 },
  };
  const m = moods[weather] || moods.clear;
  eng.scene.fog.color.set(m.fog);
  if (eng.hemi) eng.hemi.intensity = m.amb;
}
