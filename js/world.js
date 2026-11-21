import * as THREE from 'three';
import { App, bus, addXP, toast } from './state.js';
import { paintVertex } from './paint.js';

let terrain = null, water = null, particles = null;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

const THEMES = {
  grass: { low: 0x8FD96B, mid: 0x5FC24C, high: 0xA8C98A, peak: 0xFFFFFF, sky: 0x8FD8FF, water: 0x4FB8E8 },
  snow:  { low: 0xE8F6FF, mid: 0xD2EAFF, high: 0xF4FAFF, peak: 0xFFFFFF, sky: 0xBFE8FF, water: 0x6CC8F0 },
  desert:{ low: 0xFFE0A3, mid: 0xF5C46B, high: 0xD9984F, peak: 0xFFF8E8, sky: 0xFFDCA8, water: 0x5CC8D8 },
  cyber: { low: 0x6A5FE0, mid: 0x8B6BE8, high: 0xC46FD8, peak: 0xFFB0E0, sky: 0x7A6FD8, water: 0x6DE0F0 },
};
let theme = THEMES.grass;

function hash(i, j, s) {
  let n = (i * 374761393 + j * 668265263 + s * 982451653) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, s), b = hash(xi + 1, zi, s);
  const c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, z, s) {
  let h = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 4; o++) { h += vnoise(x * f, z * f, s + o * 17) * amp; amp *= 0.5; f *= 2; }
  return h;
}

export function applyTheme(name) {
  theme = THEMES[name] || THEMES.grass;
  App.engine.scene.background.set(theme.sky);
  App.engine.scene.fog.color.set(theme.sky);
}

function colorByHeight(z, override) {
  if (override) return new THREE.Color(override);
  if (z < 0.25) return new THREE.Color(theme.low);
  if (z < 2.2) return new THREE.Color(theme.mid);
  if (z < 4.5) return new THREE.Color(theme.high);
  return new THREE.Color(theme.peak);
}

export function generateTerrain(opts = {}) {
  const eng = App.engine;
  const seed = opts.seed ?? (App.terrainSeed ?? 7);
  const height = opts.height ?? (App.terrainHeight ?? 3);
  const seg = opts.seg ?? (App.terrainSeg ?? 96);
  const size = 80;
  App.terrainSeed = seed; App.terrainHeight = height; App.terrainSeg = seg;

  if (terrain) { eng.remove(terrain); terrain.geometry.dispose(); }

  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
  g.setAttribute('color', col);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let h = fbm(x * 0.04 + 100, z * 0.04 + 100, seed) * height;
    if (Math.hypot(x, z) > size * 0.46) h *= Math.max(0, 1 - (Math.hypot(x, z) - size * 0.46) / 6);
    pos.setY(i, h);
    const c = colorByHeight(h);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, flatShading: false });
  terrain = new THREE.Mesh(g, m);
  terrain.receiveShadow = true; terrain.castShadow = true;
  terrain.name = 'terrain';
  window.__terrain = terrain;
  eng.add(terrain);
  addXP(15); toast('地形已生成 · 种子 ' + seed);
  bus.emit('terrain');
  return terrain;
}

function terrainHit(ev) {
  if (!terrain) return null;
  const eng = App.engine;
  const rect = eng.renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ndc, eng.camera);
  const hits = ray.intersectObject(terrain, false);
  return hits.length ? hits[0] : null;
}

function sculptAt(ev) {
  const h = terrainHit(ev);
  if (!h) return;
  const g = terrain.geometry;
  const pos = g.attributes.position;
  const local = terrain.worldToLocal(h.point.clone());
  const r = App.sculpt.size, str = App.sculpt.strength * (App.sculpt.mode === 'lower' ? -1 : 1);
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) heights[i] = pos.getY(i);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x - local.x, z - local.z);
    if (d < r) {
      const t = (1 - d / r);
      if (App.sculpt.mode === 'smooth') {
        // 与邻点平均
        let s = 0, c = 0;
        for (let j = 0; j < pos.count; j++) {
          if (Math.hypot(pos.getX(j) - x, pos.getZ(j) - z) < r * 0.5) { s += heights[j]; c++; }
        }
        if (c) pos.setY(i, THREE.MathUtils.lerp(heights[i], s / c, t * 0.5));
      } else {
        pos.setY(i, heights[i] + str * t);
      }
    }
  }
  g.computeVertexNormals();
  // 重涂颜色
  const col = g.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const c = colorByHeight(pos.getY(i));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true; pos.needsUpdate = true;
}

function paintBiomeAt(ev) {
  const h = terrainHit(ev);
  if (!h) return;
  const g = terrain.geometry;
  const local = terrain.worldToLocal(h.point.clone());
  const map = { grass: theme.mid, sand: theme.low, rock: theme.high, snow: theme.peak, path: 0x9b6b43, water: theme.water };
  const hex = map[App.biome] ?? theme.mid;
  paintVertex(terrain, local, App.sculpt.size, hex, 0.8);
  g.computeVertexNormals();
}

export function createWater() {
  const eng = App.engine;
  if (water) { eng.remove(water); }
  const g = new THREE.PlaneGeometry(80, 80, 48, 48);
  g.rotateX(-Math.PI / 2);
  water = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: theme.water, transparent: true, opacity: 0.62, roughness: 0.15, metalness: 0.4,
  }));
  water.position.y = 0.6; water.name = 'water';
  eng.add(water);
  const base = g.attributes.position.array.slice();
  eng.onUpdate((dt, el) => {
    if (!App.settings.water || !water.visible) return;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      p.setY(i, Math.sin(x * 0.3 + el * 1.5) * 0.18 + Math.cos(z * 0.4 + el * 1.2) * 0.18);
    }
    p.needsUpdate = true;
  });
}

export function createParticles() {
  const eng = App.engine;
  if (particles) eng.remove(particles);
  const N = 360;
  const arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 70;
    arr[i * 3 + 1] = Math.random() * 24;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  particles = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xbfe0ff, size: 0.18, transparent: true, opacity: 0.7, depthWrite: false,
  }));
  particles.name = 'particles';
  eng.add(particles);
  eng.onUpdate((dt) => {
    if (!App.settings.particles || !particles.visible) return;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.6;
      if (y > 26) y = 0;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
}

export function setFog(on) { App.engine.scene.fog = on ? new THREE.Fog(theme.sky, 40, 160) : null; }
export function setGrid(on) { App.engine.grid.visible = on; }

export function initWorld() {
  const eng = App.engine;
  const dom = eng.renderer.domElement;
  let active = false;
  dom.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    if (App.mode === 'sculpt') { active = true; sculptAt(ev); }
    else if (App.mode === 'terrain') { active = true; paintBiomeAt(ev); }
  });
  dom.addEventListener('pointermove', ev => {
    if (active && App.mode === 'sculpt') sculptAt(ev);
    else if (active && App.mode === 'terrain') paintBiomeAt(ev);
  });
  window.addEventListener('pointerup', () => {
    if (active && (App.mode === 'sculpt' || App.mode === 'terrain')) { active = false; addXP(4); }
  });
  generateTerrain();
  createWater();
  createParticles();
}
