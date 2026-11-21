import * as THREE from 'three';
import { App, addXP, toast, bus } from './state.js';

// PBR 材质预设库
export const PRESETS = {
  gold:     { color: 0xFFC85C, roughness: 0.18, metalness: 1.0 },
  silver:   { color: 0xF2F6FC, roughness: 0.12, metalness: 1.0 },
  copper:   { color: 0xF0A878, roughness: 0.3, metalness: 0.9 },
  glass:    { color: 0xD2F0FF, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.35 },
  ceramic:  { color: 0xFFFDF4, roughness: 0.25, metalness: 0.0 },
  plastic:  { color: 0x7FD4F5, roughness: 0.45, metalness: 0.0 },
  wood:     { color: 0xB5835A, roughness: 0.8, metalness: 0.0 },
  rubber:   { color: 0x6B6B78, roughness: 0.95, metalness: 0.0 },
  lava:     { color: 0xFF7040, roughness: 0.6, metalness: 0.1, emissive: 0xFF5A20, emissiveIntensity: 0.8 },
  neon:     { color: 0x5FFFD8, roughness: 0.3, metalness: 0.2, emissive: 0x3AEFC0, emissiveIntensity: 1.2 },
  marble:   { color: 0xFBF8F2, roughness: 0.3, metalness: 0.05 },
  chocolate:{ color: 0x8A5A38, roughness: 0.55, metalness: 0.0 },
};

export function applyPreset(key) {
  const rec = App.selected;
  if (!rec) { toast('先选中一个物体'); return; }
  const p = PRESETS[key];
  if (!p) return;
  rec.root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (m.color) m.color.set(p.color);
    m.roughness = p.roughness; m.metalness = p.metalness;
    if (p.emissive && m.emissive) { m.emissive.set(p.emissive); m.emissiveIntensity = p.emissiveIntensity || 1; }
    else if (m.emissive) m.emissive.set(0x000000);
    m.transparent = !!p.transparent; m.opacity = p.opacity ?? 1;
    m.needsUpdate = true;
  });
  addXP(6); toast('已应用材质：' + key);
  bus.emit('material');
}

// ---------- 纹理画布：在 2D Canvas 上绘制，实时贴到模型 ----------
let texCanvas = null, texCtx = null, texTexture = null, drawingTex = false;

export function initTextureCanvas(canvasEl) {
  texCanvas = canvasEl;
  texCtx = texCanvas.getContext('2d');
  const s = App.texture.size;
  texCanvas.width = s; texCanvas.height = s;
  texCtx.fillStyle = '#dddddd'; texCtx.fillRect(0, 0, s, s);
  texTexture = new THREE.CanvasTexture(texCanvas);
  texTexture.colorSpace = THREE.SRGBColorSpace;
  texTexture.wrapS = texTexture.wrapT = THREE.RepeatWrapping;

  const pos = e => {
    const r = texCanvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * s, y: (e.clientY - r.top) / r.height * s };
  };
  texCanvas.addEventListener('pointerdown', e => {
    drawingTex = true;
    const p = pos(e);
    texCtx.beginPath(); texCtx.moveTo(p.x, p.y);
    texCtx.strokeStyle = App.texture.drawColor;
    texCtx.fillStyle = App.texture.drawColor;
    texCtx.lineWidth = App.texture.drawSize;
    texCtx.lineCap = 'round'; texCtx.lineJoin = 'round';
    texCtx.arc(p.x, p.y, App.texture.drawSize / 2, 0, Math.PI * 2); texCtx.fill();
    texCtx.beginPath(); texCtx.moveTo(p.x, p.y);
  });
  texCanvas.addEventListener('pointermove', e => {
    if (!drawingTex) return;
    const p = pos(e);
    texCtx.lineTo(p.x, p.y); texCtx.stroke();
    texCtx.beginPath(); texCtx.moveTo(p.x, p.y);
    texTexture.needsUpdate = true;
  });
  window.addEventListener('pointerup', () => { if (drawingTex) { drawingTex = false; addXP(2); } });
  return texTexture;
}

export function clearTexture() {
  if (!texCtx) return;
  texCtx.fillStyle = '#dddddd'; texCtx.fillRect(0, 0, App.texture.size, App.texture.size);
  texTexture.needsUpdate = true;
}

export function applyTextureToSelected() {
  const rec = App.selected;
  if (!rec || !texTexture) { toast('先选中一个物体'); return; }
  rec.root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    // 确保有 UV2/UV
    if (!o.geometry.attributes.uv) {
      const n = o.geometry.attributes.position.count;
      o.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    o.material.map = texTexture.clone();
    o.material.map.needsUpdate = true;
    o.material.vertexColors = false;
    o.material.needsUpdate = true;
  });
  addXP(10); toast('纹理已贴到所选物体');
  bus.emit('material');
}

export function exportTexture() {
  if (!texCanvas) return;
  const a = document.createElement('a');
  a.href = texCanvas.toDataURL('image/png');
  a.download = 'forgeverse_texture.png'; a.click();
  toast('纹理已导出 PNG');
}
