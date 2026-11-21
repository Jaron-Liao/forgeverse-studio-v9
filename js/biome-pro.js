// ============================================================
// biome-pro.js — 雪地 / 沙漠 / 草原 / 赛博 四生态建模升级包
// 借鉴 PUBG 沙盒写实、和平精英载具地图、QQ飞车霓虹城市的建模思路，
// 用程序化几何 + PBR 材质 + 实例化植被，把「低模方块」升级为
// 有层次、有细节、可运行的准写实场景。
// 保持与 biomes.js 相同的 def 结构，通过 registerBiome 覆盖注册。
// ============================================================
import * as THREE from 'three';
import { App, toast } from './state.js';
import { registerBiome, buildBiome, BIOMES } from './biomes.js';

// ---------- 材质工具 ----------
function mat(c, r = 0.8, m = 0.02, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
}
function mesh(geo, material, cast = true, recv = true) {
  const o = new THREE.Mesh(geo, material);
  o.castShadow = cast; o.receiveShadow = recv;
  return o;
}
// 带顶点色渐变的几何体：让同色物体有明暗层次（3A 感关键）
function shade(geo, top, bottom) {
  const pos = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const c = new Float32Array(pos.count * 3);
  const a = new THREE.Color(bottom), b = new THREE.Color(top), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = maxY === minY ? 1 : (pos.getY(i) - minY) / (maxY - minY);
    t.copy(a).lerp(b, k);
    c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// ============================================================
// 沙漠建筑：借鉴 PUBG 沙漠地图（沙漠小镇 / 军事哨站 / 油井）
// ============================================================
const DESERT_B = {
  // 多层沙岩民居：带拱门、窗洞、平顶、外墙纹理色差
  sandstone() {
    const g = new THREE.Group();
    const body = mesh(shade(new THREE.BoxGeometry(5, 3.4, 4.2, 4, 3, 4), 0xFFE0A3, 0xD9984F), mat(0xffffff, 0.95, 0.02, { vertexColors: true }));
    body.position.y = 1.7; g.add(body);
    // 女儿墙（平顶边缘）
    for (const x of [-2.4, 2.4]) { const w = mesh(new THREE.BoxGeometry(0.3, 0.6, 4.4), mat(0xF5C46B, 0.95)); w.position.set(x, 3.6, 0); g.add(w); }
    for (const z of [-2.0, 2.0]) { const w = mesh(new THREE.BoxGeometry(5, 0.6, 0.3), mat(0xF5C46B, 0.95)); w.position.set(0, 3.6, z); g.add(w); }
    // 拱门（半圆顶 + 门柱）
    const arch = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.25, 16, 1, false, 0, Math.PI), mat(0xB08350, 0.95));
    arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.set(0, 2.1, 2.15); g.add(arch);
    for (const x of [-0.85, 0.85]) { const p = mesh(new THREE.BoxGeometry(0.25, 2.1, 0.25), mat(0xB08350, 0.95)); p.position.set(x, 1.05, 2.15); g.add(p); }
    // 窗洞（深色内凹）
    for (const x of [-1.6, 1.6]) {
      const win = mesh(new THREE.BoxGeometry(0.7, 0.9, 0.12), mat(0x8A6B45, 0.9));
      win.position.set(x, 2.0, 2.12); g.add(win);
      const ledge = mesh(new THREE.BoxGeometry(0.9, 0.1, 0.3), mat(0xF5C46B, 0.95)); ledge.position.set(x, 1.5, 2.2); g.add(ledge);
    }
    return g;
  },
  // 军事哨站：塔楼 + 围栏 + 沙袋
  outpost() {
    const g = new THREE.Group();
    const tower = mesh(shade(new THREE.CylinderGeometry(1.6, 2.1, 6, 12), 0xF5C46B, 0xD9984F), mat(0xffffff, 0.9, 0.05, { vertexColors: true }));
    tower.position.y = 3; g.add(tower);
    const deck = mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 12), mat(0xB08350, 0.9)); deck.position.y = 6.1; g.add(deck);
    // 瞭望窗
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2;
      const w = mesh(new THREE.BoxGeometry(0.6, 0.5, 0.1), mat(0x8A6B45, 0.7, 0.3));
      w.position.set(Math.cos(a) * 2.25, 6.5, Math.sin(a) * 2.25); w.rotation.y = -a; g.add(w);
    }
    // 沙袋墙
    for (let i = 0; i < 8; i++) {
      const bag = mesh(new THREE.SphereGeometry(0.42, 10, 6), mat(0xE8C998, 1));
      bag.scale.set(1.3, 0.6, 0.8); bag.position.set(-2.2 + i * 0.62, 0.28, 2.6); g.add(bag);
    }
    return g;
  },
  // 油井：细化井架 + 储油罐
  oilrig() {
    const g = new THREE.Group();
    const steel = mat(0xB8C0CC, 0.55, 0.65);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
      const leg = mesh(new THREE.BoxGeometry(0.16, 10, 0.16), steel);
      leg.position.set(sx * 1.3, 5, sz * 1.3);
      leg.rotation.z = -sx * 0.13; leg.rotation.x = sz * 0.13; g.add(leg);
    }
    for (let y = 2; y < 10; y += 2.5) {
      const ring = mesh(new THREE.TorusGeometry(1.4 - y * 0.06, 0.06, 6, 4), steel);
      ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.y = y; g.add(ring);
    }
    const cap = mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), steel); cap.position.y = 10; g.add(cap);
    // 储油罐
    const tank = mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 20), mat(0xD8D0C0, 0.7, 0.35));
    tank.position.set(4, 1.2, 1); g.add(tank);
    const dome = mesh(new THREE.SphereGeometry(1.6, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xE0D8C8, 0.7, 0.35));
    dome.position.set(4, 2.4, 1); g.add(dome);
    return g;
  },
};

// ============================================================
// 雪地建筑：借鉴 PUBG 雪图（木屋 / 冰洞 / 观测站）
// ============================================================
const SNOW_B = {
  // 北欧木屋：斜屋顶带积雪、原木墙、暖光窗、烟囱
  lodge() {
    const g = new THREE.Group();
    const wall = mesh(shade(new THREE.BoxGeometry(5, 3, 4.4, 4, 3, 4), 0xB8875A, 0x9b6b43), mat(0xffffff, 0.9, 0.02, { vertexColors: true }));
    wall.position.y = 1.5; g.add(wall);
    // 原木横纹
    for (let y = 0.4; y < 3; y += 0.6) {
      const log = mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.05, 8), mat(0x9b6b43, 0.95));
      log.rotation.z = Math.PI / 2; log.position.set(0, y, 2.25); g.add(log);
    }
    // 双坡屋顶
    for (const sx of [-1, 1]) {
      const roof = mesh(new THREE.BoxGeometry(3.1, 0.22, 5), mat(0x8A6A50, 0.9));
      roof.position.set(sx * 1.25, 3.9, 0); roof.rotation.z = -sx * 0.55; g.add(roof);
      // 屋顶积雪
      const snow = mesh(new THREE.BoxGeometry(3.1, 0.12, 5), mat(0xf0f6ff, 0.95));
      snow.position.set(sx * 1.25, 4.02, 0); snow.rotation.z = -sx * 0.55; g.add(snow);
    }
    // 暖光窗
    const win = mesh(new THREE.BoxGeometry(1, 1, 0.1), mat(0xffd68a, 0.3, 0, { emissive: 0xffa93a, emissiveIntensity: 0.8 }));
    win.position.set(-1.3, 1.7, 2.25); g.add(win);
    const win2 = win.clone(); win2.position.x = 1.3; g.add(win2);
    // 烟囱 + 炊烟粒子位
    const chim = mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), mat(0xA89888, 0.9)); chim.position.set(1.4, 4.4, -1); g.add(chim);
    return g;
  },
  // 冰洞：半透明冰穹 + 冰柱
  iceCave() {
    const g = new THREE.Group();
    const dome = mesh(new THREE.SphereGeometry(2.6, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0xcfe6f5, 0.25, 0.05, { transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
    g.add(dome);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.22, 0.9 + Math.random() * 0.6, 6), mat(0xd8ecfa, 0.2, 0.05, { transparent: true, opacity: 0.85 }));
      spike.position.set(Math.cos(a) * 2.5, 0.45, Math.sin(a) * 2.5); g.add(spike);
    }
    const tunnel = mesh(new THREE.CylinderGeometry(0.8, 0.95, 1.6, 16, 1, true), mat(0xcfe6f5, 0.3, 0, { transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 0.8, 2.4); g.add(tunnel);
    return g;
  },
  // 极地观测站：金属塔 + 雷达碟
  station() {
    const g = new THREE.Group();
    const base = mesh(new THREE.BoxGeometry(3.6, 1.2, 3.6), mat(0xB0BCCE, 0.7, 0.3)); base.position.y = 0.6; g.add(base);
    const tower = mesh(new THREE.CylinderGeometry(0.5, 0.7, 4.5, 12), mat(0xC6D0DE, 0.6, 0.4)); tower.position.y = 3.4; g.add(tower);
    const dish = mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(0xd8e2ec, 0.5, 0.3, { side: THREE.DoubleSide }));
    dish.rotation.x = -0.5; dish.position.y = 6; g.add(dish);
    const mast = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), mat(0xD8E0EC, 0.4, 0.6)); mast.position.y = 6.8; g.add(mast);
    // 积雪底座
    const snow = mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.25, 16), mat(0xeef5ff, 0.95)); snow.position.y = 0.12; g.add(snow);
    return g;
  },
};

// ============================================================
// 装饰：沙丘层、雪堆、岩石、冰裂、旗杆
// ============================================================
const PRO_DECOR = {
  // 层叠沙丘（用于地表起伏装饰）
  dune() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const d = mesh(shade(new THREE.SphereGeometry(3 - i * 0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        i === 0 ? 0xFFE0A3 : 0xF5C46B, 0xD9984F), mat(0xffffff, 1, 0, { vertexColors: true }));
      d.scale.set(1.6, 0.35, 1); d.position.set(i * 1.8 - 1.8, 0, i * 0.6); g.add(d);
    }
    return g;
  },
  // 沙漠岩层（风蚀岩）
  mesa() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const layer = mesh(new THREE.CylinderGeometry(1.5 - i * 0.25, 1.7 - i * 0.2, 0.9, 7),
        mat([0xE0A878, 0xD9984F, 0xC08450][i], 0.98));
      layer.position.y = 0.45 + i * 0.88; layer.rotation.y = i * 0.3; g.add(layer);
    }
    return g;
  },
  // 雪堆
  snowdrift() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const d = mesh(new THREE.SphereGeometry(1.4 - i * 0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf2f8ff, 0.95));
      d.scale.set(1.4, 0.4, 1); d.position.set(i * 1.2 - 1, 0, i * 0.4); g.add(d);
    }
    return g;
  },
  // 冰裂（发光裂纹地面）
  icecrack() {
    const g = new THREE.Group();
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * (0.8 + Math.random() * 1.5), 0.02, Math.sin(a) * (0.8 + Math.random() * 1.5)));
    }
    pts.push(pts[0].clone());
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 40, 0.04, 5, false);
    const line = mesh(geo, mat(0x7FD4F5, 0.2, 0, { emissive: 0x06B6D4, emissiveIntensity: 1.2 }), false, false);
    g.add(line); return g;
  },
  // 帐篷营地（沙漠/雪地通用）
  tent(color = 0xD8945F) {
    const g = new THREE.Group();
    const t = mesh(new THREE.ConeGeometry(1.4, 2, 4), mat(color, 0.95));
    t.rotation.y = Math.PI / 4; t.position.y = 1; g.add(t);
    const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), mat(0x9b6b43, 0.9)); pole.position.y = 1.15; g.add(pole);
    return g;
  },
  // 旗杆（地标）
  flag() {
    const g = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.07, 5, 8), mat(0xB8C0CC, 0.5, 0.6)); pole.position.y = 2.5; g.add(pole);
    const cloth = mesh(new THREE.PlaneGeometry(1.6, 0.9), mat(0xFF6B7A, 0.9, 0, { side: THREE.DoubleSide }));
    cloth.position.set(0.8, 4.3, 0); g.add(cloth);
    return g;
  },
};

// 高品质松树（雪地主力植被，多层锥形 + 积雪帽）
function snowPine() {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 10), mat(0x9b6b43, 0.95)); trunk.position.y = 1.2; g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const r = 1.7 - i * 0.34;
    const cone = mesh(new THREE.ConeGeometry(r, 2.2, 10), mat(i % 2 ? 0x8FD96B : 0x5FC24C, 0.95));
    cone.position.y = 2.4 + i * 1.15; g.add(cone);
    const cap = mesh(new THREE.ConeGeometry(r * 0.75, 0.8, 10), mat(0xeef6ff, 0.95));
    cap.position.y = 2.9 + i * 1.15; g.add(cap);
  }
  return g;
}

// 沙漠棕榈（弯曲树干 + 分层叶片）
function desertPalm() {
  const g = new THREE.Group();
  const trunk = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const seg = mesh(new THREE.CylinderGeometry(0.22 - i * 0.02, 0.26 - i * 0.02, 0.85, 8), mat(0xB8875A, 0.95));
    seg.position.set(i * 0.08, 0.42 + i * 0.8, 0); seg.rotation.z = -0.06 * i; trunk.add(seg);
  }
  g.add(trunk);
  const crown = new THREE.Group(); crown.position.set(0.45, 5.1, 0);
  for (let i = 0; i < 8; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.35, 2.6, 5), mat(0x8FD96B, 0.9));
    leaf.rotation.z = Math.PI / 2.4; leaf.position.set(1.1, 0, 0);
    const pivot = new THREE.Group(); pivot.rotation.y = i / 8 * Math.PI * 2;
    pivot.add(leaf); crown.add(pivot);
  }
  g.add(crown); return g;
}

// 绿洲水面装饰
function oasis() {
  const g = new THREE.Group();
  const water = mesh(new THREE.CircleGeometry(3.2, 32).rotateX(-Math.PI / 2),
    mat(0x6DE0F0, 0.15, 0.3, { transparent: true, opacity: 0.85, emissive: 0x2A9BB8, emissiveIntensity: 0.3 }), false, true);
  water.position.y = 0.05; g.add(water);
  const ring = mesh(new THREE.TorusGeometry(3.2, 0.25, 8, 32).rotateX(-Math.PI / 2), mat(0xF5C46B, 0.95));
  ring.position.y = 0.08; g.add(ring);
  return g;
}

// ============================================================
// 草原：绿意村落与林地（补齐 UI 键 grass）
// 复用 mat/mesh/shade 与 PRO_DECOR 的帐篷/旗杆工厂。
// ============================================================
function meadowCottage() {
  const g = new THREE.Group();
  const wall = mesh(shade(new THREE.BoxGeometry(4.6, 3, 4, 4, 3, 4), 0xFFF3D6, 0xDEC79A),
    mat(0xffffff, 0.95, 0.02, { vertexColors: true }));
  wall.position.y = 1.5; g.add(wall);
  const roof = mesh(new THREE.ConeGeometry(3.4, 2.2, 4), mat(0x5FC24C, 0.95));
  roof.rotation.y = Math.PI / 4; roof.position.y = 4; g.add(roof);
  const door = mesh(new THREE.BoxGeometry(1, 1.8, 0.1), mat(0x9b6b43, 0.95));
  door.position.set(-1, 0.9, 2.05); g.add(door);
  const win = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1),
    mat(0xffe6a8, 0.3, 0, { emissive: 0xffb84d, emissiveIntensity: 0.35 }));
  win.position.set(1.1, 1.7, 2.05); g.add(win);
  return g;
}

function meadowBarn() {
  const g = new THREE.Group();
  const body = mesh(shade(new THREE.BoxGeometry(5.4, 3.4, 5, 4, 3, 4), 0xF08A6B, 0xCE6A50),
    mat(0xffffff, 0.95, 0.02, { vertexColors: true }));
  body.position.y = 1.7; g.add(body);
  for (const sx of [-1, 1]) {
    const roof = mesh(new THREE.BoxGeometry(3.2, 0.22, 5.2), mat(0x9b6b43, 0.95));
    roof.position.set(sx * 1.3, 4.1, 0); roof.rotation.z = -sx * 0.55; g.add(roof);
  }
  return g;
}

function meadowTree() {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.2, 10), mat(0x9b6b43, 0.95));
  trunk.position.y = 1.1; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = mesh(new THREE.ConeGeometry(1.6 - i * 0.32, 2, 10),
      mat(i % 2 ? 0x5FC24C : 0x8FD96B, 0.95));
    cone.position.y = 2.3 + i * 1.1; g.add(cone);
  }
  return g;
}

function meadowBush() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = mesh(new THREE.SphereGeometry(0.7 - i * 0.12, 12, 8), mat(0x8FD96B, 0.95));
    s.position.set(i * 0.6 - 0.6, 0.5, (i % 2) * 0.4); g.add(s);
  }
  return g;
}

// ============================================================
// 赛博：霓虹夜景（补齐 UI 键 cyber）
// 复用 biomes.js 已注册的都市建筑/路灯/广告牌工厂。
// ============================================================
function neonTower() {
  const g = new THREE.Group();
  const body = mesh(shade(new THREE.BoxGeometry(5, 16, 5, 3, 6, 3), 0x6FD8C8, 0x3F9E8C),
    mat(0xffffff, 0.4, 0.5, { vertexColors: true }));
  body.position.y = 8; g.add(body);
  const stripColors = [0x06B6D4, 0x6EE7B7, 0x6DE0F0];
  for (let i = 0; i < 6; i++) {
    const strip = mesh(new THREE.BoxGeometry(5.12, 0.18, 0.12),
      mat(stripColors[i % 3], 0.2, 0.1, { emissive: stripColors[i % 3], emissiveIntensity: 1.4 }), false, false);
    strip.position.set(0, 2 + i * 2.4, 2.56); g.add(strip);
  }
  const crown = mesh(new THREE.BoxGeometry(3.4, 0.5, 3.4),
    mat(0x6EE7B7, 0.2, 0.3, { emissive: 0x6EE7B7, emissiveIntensity: 1.2 }));
  crown.position.y = 16.3; g.add(crown);
  return g;
}

function neonSign() {
  const g = new THREE.Group();
  const pole = mesh(new THREE.BoxGeometry(0.16, 3, 0.16), mat(0x4FB8A8, 0.5, 0.7));
  pole.position.y = 1.5; g.add(pole);
  const panel = mesh(new THREE.BoxGeometry(2.4, 1.3, 0.12),
    mat(0x3F9E8C, 0.3, 0.2, { emissive: 0x6FD8C8, emissiveIntensity: 0.9 }));
  panel.position.y = 3.4; g.add(panel);
  const glow = mesh(new THREE.BoxGeometry(2.1, 0.16, 0.14),
    mat(0x6DE0F0, 0.2, 0.1, { emissive: 0x6DE0F0, emissiveIntensity: 1.6 }), false, false);
  glow.position.set(0, 3.4, 0.1); g.add(glow);
  return g;
}

function holoPillar() {
  const g = new THREE.Group();
  const beam = mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 16, 1, true),
    mat(0x6DE0F0, 0.15, 0, { transparent: true, opacity: 0.35, emissive: 0x06B6D4, emissiveIntensity: 1.1, side: THREE.DoubleSide }), false, false);
  beam.position.y = 2.5; g.add(beam);
  const base = mesh(new THREE.CylinderGeometry(0.8, 1, 0.4, 16), mat(0x3F9E8C, 0.5, 0.6));
  base.position.y = 0.2; g.add(base);
  return g;
}

function neonRoad() {
  const g = new THREE.Group();
  const road = mesh(new THREE.BoxGeometry(9, 0.12, 28), mat(0x2A7A6E, 0.4, 0.3));
  road.position.y = 0.06; g.add(road);
  for (const x of [-4.2, 4.2]) {
    const line = mesh(new THREE.BoxGeometry(0.16, 0.03, 28),
      mat(0x6DE0F0, 0.2, 0.1, { emissive: 0x6DE0F0, emissiveIntensity: 1.5 }), false, false);
    line.position.set(x, 0.14, 0); g.add(line);
  }
  for (let i = 0; i < 9; i++) {
    const dash = mesh(new THREE.BoxGeometry(0.14, 0.03, 1.5),
      mat(0x6EE7B7, 0.2, 0.1, { emissive: 0x6EE7B7, emissiveIntensity: 1.2 }), false, false);
    dash.position.set(0, 0.14, -12 + i * 3); g.add(dash);
  }
  return g;
}

// ============================================================
// 覆盖注册：用 Pro 版本替换默认 snow / desert，并补齐 grass / cyber
// ============================================================
export function registerProBiomes() {
  registerBiome('desert', {
    label: '沙漠·PUBG沙盒',
    terrain: { low: 0xFFE0A3, mid: 0xF5C46B, high: 0xD9984F, peak: 0xFFF8E8, sky: 0xFFDCA8, water: 0x5CC8D8, height: 3.2 },
    buildings: [DESERT_B.sandstone, DESERT_B.outpost, DESERT_B.oilrig],
    decor: [PRO_DECOR.dune, PRO_DECOR.mesa, desertPalm, oasis, () => PRO_DECOR.tent(0xD8945F), PRO_DECOR.flag],
    road: () => desertRoad(),
  });
  registerBiome('snow', {
    label: '雪地·极地战场',
    terrain: { low: 0xE8F6FF, mid: 0xD2EAFF, high: 0xF4FAFF, peak: 0xFFFFFF, sky: 0xBFE8FF, water: 0x6CC8F0, height: 4.2 },
    buildings: [SNOW_B.lodge, SNOW_B.iceCave, SNOW_B.station],
    decor: [snowPine, PRO_DECOR.snowdrift, PRO_DECOR.icecrack, () => PRO_DECOR.tent(0xB0BCCE), PRO_DECOR.flag],
    road: () => snowRoad(),
  });
  // 草原：绿意地形 + 村舍/谷仓 + 林地装饰；公路复用 biomes.js 的 roadSegment。
  registerBiome('grass', {
    label: '草原·绿意村落',
    terrain: { low: 0x6EE7A8, mid: 0x34C47A, high: 0x8FD8A8, peak: 0xFFFFFF, sky: 0xA7E8F5, water: 0x38BDF8, height: 2.2 },
    buildings: [meadowCottage, meadowBarn, meadowCottage],
    decor: [meadowTree, meadowBush, () => PRO_DECOR.tent(0x8FD96B), PRO_DECOR.flag],
    road: () => BIOMES.urban.road(),
  });
  // 赛博：霓虹夜景；复用都市建筑的写字楼/便利店与路灯/广告牌工厂。
  registerBiome('cyber', {
    label: '赛博·霓虹夜城',
    terrain: { low: 0x3F9E8C, mid: 0x4FB8A8, high: 0x6FD8C8, peak: 0xA8F0E0, sky: 0x2A7A6E, water: 0x6DE0F0, height: 1.6 },
    buildings: [BIOMES.urban.buildings[1], neonTower, BIOMES.urban.buildings[2]],
    decor: [BIOMES.urban.decor[2], neonSign, holoPillar, BIOMES.urban.decor[0]],
    road: () => neonRoad(),
  });
  toast('画质升级：雪地 / 沙漠 / 草原 / 赛博 四生态已就绪');
}

// 沙漠公路：带沙埋路肩
function desertRoad() {
  const g = new THREE.Group();
  const road = mesh(new THREE.BoxGeometry(7, 0.12, 26), mat(0xC8A878, 0.98));
  road.position.y = 0.06; g.add(road);
  for (let i = 0; i < 9; i++) {
    const dash = mesh(new THREE.BoxGeometry(0.16, 0.02, 1.5), mat(0xe8dcc0, 0.85));
    dash.position.set(0, 0.13, -11 + i * 2.8); g.add(dash);
  }
  for (const x of [-3.4, 3.4]) {
    const sand = mesh(new THREE.SphereGeometry(1.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xF5C46B, 1));
    sand.scale.set(1, 0.25, 6); sand.position.set(x, 0.05, 0); g.add(sand);
  }
  return g;
}

// 雪地公路：带积雪路肩
function snowRoad() {
  const g = new THREE.Group();
  const road = mesh(new THREE.BoxGeometry(6, 0.12, 26), mat(0xA8B4C2, 0.95));
  road.position.y = 0.06; g.add(road);
  for (let i = 0; i < 9; i++) {
    const dash = mesh(new THREE.BoxGeometry(0.16, 0.02, 1.5), mat(0xe8f0f8, 0.85));
    dash.position.set(0, 0.13, -11 + i * 2.8); g.add(dash);
  }
  for (const x of [-2.9, 2.9]) {
    const snow = mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf0f7ff, 0.95));
    snow.scale.set(1, 0.3, 6); snow.position.set(x, 0.1, 0); g.add(snow);
  }
  return g;
}

export function rebuildProBiome(name) {
  registerProBiomes();
  return buildBiome(name);
}
