// ============================================================
// biomes.js — 环境资产分层管理
// 三套环境（沙漠 / 雪地 / 都市），每套分三层：
//   terrain   : 地形高度/配色参数
//   buildings : 建筑模型工厂（可单独替换）
//   decor     : 装饰物件工厂（可单独替换）
// 通过 registerBiome / replaceLayer 支持运行时扩展与热替换。
// ============================================================
import * as THREE from 'three';
import { App, bus, toast } from './state.js';

const STD = (c, r = 0.7, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

function box(w, h, d, color, r, m) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), STD(color, r, m));
  g.castShadow = g.receiveShadow = true;
  return g;
}
function cyl(rt, rb, h, color, seg = 16, r = 0.7, m = 0.05) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), STD(color, r, m));
  g.castShadow = g.receiveShadow = true;
  return g;
}

// ---------- 建筑工厂 ----------
const BUILDINGS = {
  // 沙漠：土坯房 / 清真寺塔 / 石油井架
  adobe() {
    const g = new THREE.Group();
    const b = box(4, 3, 4, 0xd9b98a, 0.95); b.position.y = 1.5;
    const roof = box(4.4, 0.3, 4.4, 0xc4a274, 0.95); roof.position.y = 3.15;
    const door = box(1, 1.8, 0.1, 0x9b6b43, 0.9); door.position.set(0, 0.9, 2.05);
    g.add(b, roof, door); return g;
  },
  minaret() {
    const g = new THREE.Group();
    const base = box(2.4, 1, 2.4, 0xe8d2a6, 0.9); base.position.y = 0.5;
    const tower = cyl(0.9, 1.1, 8, 0xeadabc, 16, 0.9); tower.position.y = 5;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.8, 16), STD(0x7fb8c8, 0.4, 0.4));
    top.position.y = 9.8; top.castShadow = true;
    g.add(base, tower, top); return g;
  },
  derrick() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const leg = box(0.18, 9, 0.18, 0xB8C0CC, 0.5, 0.6);
      leg.position.set(i % 2 ? 1.2 : -1.2, 4.5, i < 2 ? 1.2 : -1.2);
      leg.rotation.z = (i % 2 ? -1 : 1) * 0.12;
      g.add(leg);
    }
    const cap = box(3, 0.3, 3, 0xC8D0DC, 0.5, 0.6); cap.position.y = 9;
    g.add(cap); return g;
  },
  // 雪地：木屋 / 冰屋 / 松木教堂
  cabin() {
    const g = new THREE.Group();
    const b = box(4.5, 3, 4, 0xB8875A, 0.9); b.position.y = 1.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 4), STD(0xe8f0ff, 0.95));
    roof.rotation.y = Math.PI / 4; roof.position.y = 4; roof.castShadow = true;
    const win = box(1, 1, 0.1, 0xffd98a, 0.3); win.material.emissive = new THREE.Color(0xffb84d); win.material.emissiveIntensity = 0.6;
    win.position.set(1.2, 1.6, 2.05);
    g.add(b, roof, win); return g;
  },
  igloo() {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), STD(0xdfeaff, 0.95));
    dome.castShadow = dome.receiveShadow = true;
    const tunnel = cyl(0.7, 0.8, 1.4, 0xdfeaff, 16, 0.95);
    tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 0.7, 2.2);
    g.add(dome, tunnel); return g;
  },
  chapel() {
    const g = new THREE.Group();
    const b = box(3.4, 4.5, 5, 0xB99A74, 0.9); b.position.y = 2.25;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3, 4), STD(0x9b6b43, 0.9));
    roof.rotation.y = Math.PI / 4; roof.position.y = 6; roof.castShadow = true;
    const spire = cyl(0.15, 0.2, 2, 0xc9a86a, 8, 0.5, 0.5); spire.position.y = 8.4;
    g.add(b, roof, spire); return g;
  },
  // 都市：公寓 / 写字楼 / 便利店
  apartment() {
    const g = new THREE.Group();
    const b = box(5, 12, 5, 0xB8C6D8, 0.7, 0.15); b.position.y = 6;
    for (let y = 1; y < 6; y++) for (let x = -1; x <= 1; x++) {
      const w = box(0.8, 1.1, 0.08, 0xA8E4FF, 0.2, 0.3);
      w.material.emissive = new THREE.Color(0x5FB8FF); w.material.emissiveIntensity = 0.35;
      w.position.set(x * 1.5, y * 1.9, 2.55); g.add(w);
    }
    g.add(b); return g;
  },
  office() {
    const g = new THREE.Group();
    const b = box(6, 18, 6, 0x8FA4C0, 0.35, 0.55); b.position.y = 9;
    const glass = box(6.1, 17, 6.1, 0x9EDCFF, 0.1, 0.2);
    glass.material.transparent = true; glass.material.opacity = 0.35; glass.position.y = 9;
    const antenna = cyl(0.06, 0.06, 3, 0xD8E0EC, 8, 0.4, 0.7); antenna.position.y = 19.5;
    g.add(b, glass, antenna); return g;
  },
  store() {
    const g = new THREE.Group();
    const b = box(6, 3.2, 4.5, 0xe8e4d8, 0.8); b.position.y = 1.6;
    const sign = box(5, 0.8, 0.15, 0xff6a6a, 0.5);
    sign.material.emissive = new THREE.Color(0xff3a3a); sign.material.emissiveIntensity = 0.8;
    sign.position.set(0, 2.8, 2.35);
    const door = box(1.6, 2.2, 0.1, 0x6fc8ff, 0.2, 0.3);
    door.material.transparent = true; door.material.opacity = 0.6; door.position.set(0, 1.1, 2.3);
    g.add(b, sign, door); return g;
  },
};

// ---------- 装饰工厂 ----------
const DECOR = {
  cactus() {
    const g = new THREE.Group();
    const body = cyl(0.45, 0.55, 2.4, 0x5FC24C, 12, 0.95); body.position.y = 1.2;
    const arm = cyl(0.28, 0.3, 1.1, 0x5FC24C, 10, 0.95); arm.position.set(0.55, 1.4, 0); arm.rotation.z = -0.6;
    g.add(body, arm); return g;
  },
  palm() {
    const g = new THREE.Group();
    const trunk = cyl(0.22, 0.35, 4.5, 0xB8875A, 10, 0.95); trunk.position.y = 2.25;
    const crown = new THREE.Group(); crown.position.y = 4.5;
    for (let i = 0; i < 6; i++) {
      const leaf = box(2.6, 0.08, 0.5, 0x8FD96B, 0.95);
      leaf.position.set(1.3, 0, 0); leaf.rotation.y = i / 6 * Math.PI * 2;
      const pivot = new THREE.Group(); pivot.rotation.y = i / 6 * Math.PI * 2;
      pivot.add(leaf); crown.add(pivot);
    }
    g.add(trunk, crown); return g;
  },
  pine() {
    const g = new THREE.Group();
    const trunk = cyl(0.25, 0.35, 2, 0x9b6b43, 10, 0.95); trunk.position.y = 1;
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.35, 2, 10), STD(0x5FC24C, 0.95));
      c.position.y = 2.2 + i * 1.2; c.castShadow = true; g.add(c);
    }
    g.add(trunk); return g;
  },
  snowman() {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), STD(0xf2f7ff, 0.95)); a.position.y = 1;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), STD(0xf2f7ff, 0.95)); b.position.y = 2.1;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), STD(0xff8a3a, 0.8));
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.1, 0.68);
    a.castShadow = b.castShadow = true; g.add(a, b, nose); return g;
  },
  streetlamp() {
    const g = new THREE.Group();
    const pole = cyl(0.09, 0.12, 4.5, 0x9aa6b8, 0.5, 0.7); pole.position.y = 2.25;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffcf6a, emissiveIntensity: 1.5 }));
    head.position.y = 4.6;
    const light = new THREE.PointLight(0xffd98a, 1.1, 12); light.position.y = 4.6;
    g.add(pole, head, light); return g;
  },
  bench() {
    const g = new THREE.Group();
    const seat = box(2, 0.15, 0.7, 0xB8875A, 0.85); seat.position.y = 0.65;
    const back = box(2, 0.8, 0.12, 0xB8875A, 0.85); back.position.set(0, 1.1, -0.3);
    for (const x of [-0.8, 0.8]) { const leg = box(0.12, 0.65, 0.12, 0x9aa6b8, 0.6, 0.4); leg.position.set(x, 0.32, 0); g.add(leg); }
    g.add(seat, back); return g;
  },
  billboard() {
    const g = new THREE.Group();
    const pole = box(0.2, 3, 0.2, 0x9aa6b8, 0.6, 0.4); pole.position.y = 1.5;
    const panel = box(4, 2, 0.15, 0x6A5FE0, 0.5, 0.2); panel.position.y = 4;
    const screen = box(3.7, 1.7, 0.06, 0x6DE0F0, 0.3);
    screen.material.emissive = new THREE.Color(0x3AC5E8); screen.material.emissiveIntensity = 0.9;
    screen.position.set(0, 4, 0.12);
    g.add(pole, panel, screen); return g;
  },
  hydrant() {
    const g = new THREE.Group();
    const body = cyl(0.28, 0.32, 0.9, 0xFF6B7A, 0.6, 0.2); body.position.y = 0.45;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), STD(0xFF6B7A, 0.6, 0.2)); cap.position.y = 0.95;
    g.add(body, cap); return g;
  },
};

// ---------- 公路 ----------
function roadSegment(len = 20, width = 6) {
  const g = new THREE.Group();
  const asphalt = box(width, 0.1, len, 0x8F98A4, 0.95, 0.02); asphalt.position.y = 0.05;
  g.add(asphalt);
  // 虚线
  const dashCount = Math.floor(len / 3);
  for (let i = 0; i < dashCount; i++) {
    const dash = box(0.16, 0.02, 1.4, 0xe8e4d0, 0.8);
    dash.position.set(0, 0.11, -len / 2 + 1.5 + i * 3);
    g.add(dash);
  }
  // 边线
  for (const x of [-width / 2 + 0.3, width / 2 - 0.3]) {
    const line = box(0.12, 0.02, len, 0xd8d4c0, 0.8); line.position.set(x, 0.11, 0); g.add(line);
  }
  return g;
}

// ---------- 环境注册表 ----------
export const BIOMES = {
  desert: {
    label: '沙漠',
    terrain: { low: 0xFFE0A3, mid: 0xF5C46B, high: 0xD9984F, peak: 0xFFF8E8, sky: 0xFFDCA8, water: 0x5CC8D8, height: 2.6 },
    buildings: [BUILDINGS.adobe, BUILDINGS.minaret, BUILDINGS.derrick],
    decor: [DECOR.cactus, DECOR.palm],
    road: () => roadSegment(24, 7),
  },
  snow: {
    label: '雪地',
    terrain: { low: 0xE8F6FF, mid: 0xD2EAFF, high: 0xF4FAFF, peak: 0xFFFFFF, sky: 0xBFE8FF, water: 0x6CC8F0, height: 3.4 },
    buildings: [BUILDINGS.cabin, BUILDINGS.igloo, BUILDINGS.chapel],
    decor: [DECOR.pine, DECOR.snowman],
    road: () => roadSegment(24, 6),
  },
  urban: {
    label: '都市',
    terrain: { low: 0x9AA8BC, mid: 0xB0BCCE, high: 0xC6D0DE, peak: 0xE2E8F0, sky: 0xBFD8F0, water: 0x6CC8F0, height: 1.2 },
    buildings: [BUILDINGS.apartment, BUILDINGS.office, BUILDINGS.store],
    decor: [DECOR.streetlamp, DECOR.bench, DECOR.billboard, DECOR.hydrant],
    road: () => roadSegment(30, 10),
  },
};

// 当前环境的组装层（每层是 Group，可单独替换）
let layers = null;

function disposeGroup(g) {
  if (!g) return;
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
  App.engine.remove(g);
}

export function buildBiome(name = 'urban') {
  const def = BIOMES[name];
  if (!def) { toast('未知环境：' + name); return; }
  if (layers) { disposeGroup(layers.buildings); disposeGroup(layers.decor); disposeGroup(layers.roads); }
  const buildings = new THREE.Group(); buildings.name = 'layer-buildings';
  const decor = new THREE.Group(); decor.name = 'layer-decor';
  const roads = new THREE.Group(); roads.name = 'layer-roads';

  // 建筑：沿网格摆放
  def.buildings.forEach((factory, k) => {
    for (let i = 0; i < 3; i++) {
      const b = factory();
      b.position.set(-24 + k * 22 + (i % 2) * 4, 0, -18 + i * 18);
      b.rotation.y = (Math.random() - 0.5) * 0.3;
      b.userData.biomeLayer = 'buildings';
      buildings.add(b);
    }
  });
  // 装饰：散布
  def.decor.forEach((factory, k) => {
    for (let i = 0; i < 6; i++) {
      const d = factory();
      d.position.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
      d.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.5; d.scale.setScalar(s);
      d.userData.biomeLayer = 'decor';
      decor.add(d);
    }
  });
  // 公路：十字
  for (let i = -1; i <= 1; i++) {
    const r1 = def.road(); r1.position.set(i * 26, 0, 0); roads.add(r1);
    const r2 = def.road(); r2.rotation.y = Math.PI / 2; r2.position.set(0, 0, i * 26); roads.add(r2);
  }
  App.engine.add(buildings); App.engine.add(decor); App.engine.add(roads);
  layers = { name, buildings, decor, roads, def };
  App.biomeName = name;
  bus.emit('biome', name);
  toast('已构建环境：' + def.label + '（建筑/装饰/公路分层）');
  return layers;
}

// 单独替换某一层：layer = buildings | decor | roads；factory 为新的工厂函数数组或单个
export function replaceLayer(layer, factories) {
  if (!layers) return;
  const old = layers[layer];
  if (!old) return;
  const grp = new THREE.Group(); grp.name = 'layer-' + layer;
  const def = layers.def;
  // 未提供工厂时，用当前环境的默认层工厂重建
  const fallback = ({
    buildings: def.buildings,
    decor: def.decor,
    roads: [def.road],
  })[layer] || [];
  const list = Array.isArray(factories) ? factories : (factories ? [factories] : fallback);
  if (!list.length) return;
  list.forEach((factory, k) => {
    for (let i = 0; i < 4; i++) {
      const o = factory();
      o.position.set((Math.random() - 0.5) * 56, 0, (Math.random() - 0.5) * 56);
      o.rotation.y = Math.random() * Math.PI * 2;
      o.userData.biomeLayer = layer;
      grp.add(o);
    }
  });
  disposeGroup(old);
  App.engine.add(grp);
  layers[layer] = grp;
  toast('已替换层：' + layer);
}

// 注册自定义环境（扩展点）
export function registerBiome(key, def) {
  BIOMES[key] = def;
  toast('已注册环境：' + (def.label || key));
}

export function getBiomeNames() { return Object.keys(BIOMES); }
export function getLayers() { return layers; }
