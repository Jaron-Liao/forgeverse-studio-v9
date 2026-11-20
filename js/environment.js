import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { App, addXP, toast } from './state.js';

let sky = null, skySun = new THREE.Vector3();
let weatherPoints = null, weatherType = 'clear';

// ---------- 程序化天空 ----------
export function initSky() {
  const eng = App.engine;
  if (sky) eng.remove(sky);
  sky = new Sky();
  sky.name = 'sky';
  // 天空球必须在相机远裁剪面(far=3000)之内，否则被切掉露出白底
  sky.scale.setScalar(1200);
  const u = sky.material.uniforms;
  u.turbidity.value = 6;
  u.rayleigh.value = 1.8;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
  eng.add(sky);
  updateSky(App.skyTime ?? 0.55);
  // 天空球跟随相机，避免漫游时"走出天空"
  eng.onUpdate(() => { if (sky && sky.visible) sky.position.copy(eng.camera.position); });
}

export function updateSky(t) {
  App.skyTime = t;
  if (!sky) return;
  const phi = THREE.MathUtils.degToRad(90 - t * 180 + 10);
  const theta = THREE.MathUtils.degToRad(120);
  skySun.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.sunPosition.value.copy(skySun);
  // 天空与太阳同步色调
  const day = Math.max(0, Math.sin(t * Math.PI));
  sky.material.uniforms.rayleigh.value = 0.5 + day * 1.1;   // 降低白天瑞利散射，避免天空泛白
  sky.material.uniforms.turbidity.value = 2 + (1 - day) * 10;
}

// ---------- 天气（9 种全球环境） ----------
const WEATHER_CFG = {
  rain:      { n: 1800, color: 0x9fc8ff, size: 0.10, op: 0.45, fall: 28, drift: 0,  fog: 0x6a7f9a },
  snow:      { n: 900,  color: 0xffffff, size: 0.14, op: 0.55, fall: 2.6, drift: 0.7, fog: 0xaab8cc },
  storm:     { n: 2600, color: 0x8fb4ff, size: 0.13, op: 0.55, fall: 34, drift: 0,  fog: 0x3a4a6a, flash: true },
  fog:       { n: 0,    fog: 0x9aa6b4, fogNear: 6, fogFar: 42 },
  mist:      { n: 0,    fog: 0xb8c2d0, fogNear: 20, fogFar: 80 },
  sandstorm: { n: 1500, color: 0xd9b06a, size: 0.22, op: 0.5, fall: 1, drift: 3.5, fog: 0xc9a86a },
  aurora:    { n: 0,    aurora: true },
  sunny:     { n: 0 },
  clear:     { n: 0 },
};
const WEATHER_NAME = { clear:'晴朗', rain:'下雨', snow:'下雪', storm:'雷暴', fog:'浓雾', aurora:'极光', sandstorm:'沙暴', sunny:'多云', mist:'薄雾' };
let auroraMesh = null;

function makeAurora() {
  const eng = App.engine;
  if (auroraMesh) { eng.remove(auroraMesh); auroraMesh.geometry.dispose(); auroraMesh.material.dispose(); auroraMesh = null; }
  const g = new THREE.PlaneGeometry(160, 60, 40, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.05) * 8 + Math.cos(x * 0.02 + y * 0.05) * 6);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshBasicMaterial({ color: 0x4de1a0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  auroraMesh = new THREE.Mesh(g, m);
  auroraMesh.position.set(0, 34, -50);
  eng.add(auroraMesh);
  eng.onUpdate((dt, el) => { if (auroraMesh && App.weather === 'aurora') { auroraMesh.material.opacity = 0.16 + Math.abs(Math.sin(el * 0.6)) * 0.18; auroraMesh.rotation.y = Math.sin(el * 0.1) * 0.1; } });
}

function makeWeather(type) {
  const eng = App.engine;
  if (weatherPoints) { eng.remove(weatherPoints); weatherPoints.geometry.dispose(); weatherPoints.material.dispose(); weatherPoints = null; }
  if (auroraMesh) { eng.remove(auroraMesh); auroraMesh.geometry.dispose(); auroraMesh.material.dispose(); auroraMesh = null; }
  const cfg = WEATHER_CFG[type] || WEATHER_CFG.clear;
  // 雾/天空色调
  const fog = eng.scene.fog;
  if (fog && cfg.fog) { fog.color.set(cfg.fog); if (cfg.fogNear != null) { fog.near = cfg.fogNear; fog.far = cfg.fogFar; } }
  else if (fog) { fog.near = 40; fog.far = 160; }
  if (cfg.aurora) makeAurora();
  if (!cfg.n) return;
  const arr = new Float32Array(cfg.n * 3);
  const spread = 50;
  for (let i = 0; i < cfg.n; i++) {
    arr[i * 3] = (Math.random() - 0.5) * spread;
    arr[i * 3 + 1] = Math.random() * 30;
    arr[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const m = new THREE.PointsMaterial({ color: cfg.color, size: cfg.size, transparent: true, opacity: cfg.op, depthWrite: false });
  weatherPoints = new THREE.Points(g, m);
  weatherPoints.frustumCulled = false;
  eng.add(weatherPoints);
  eng.onUpdate((dt, el) => {
    if (!weatherPoints || App.weather !== type) return;
    if (cfg.flash && eng.sun) eng.sun.intensity = 2 + Math.random() * 3; // 雷暴闪光
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - cfg.fall * dt;
      let x = p.getX(i) + (cfg.drift ? Math.sin(y * 0.3 + i) * dt * cfg.drift * 0.3 : 0);
      if (y < 0) { y = 30; x = (Math.random() - 0.5) * spread; }
      p.setY(i, y); p.setX(i, x);
    }
    p.needsUpdate = true;
  });
}

export function setWeather(type) {
  App.weather = type;
  weatherType = type;
  makeWeather(type);
  toast('天气：' + (WEATHER_NAME[type] || type));
}

export function getWeather() { return weatherType; }

// ---------- 植被散布 ----------
function terrainHeightAt(x, z) {
  const t = window.__terrain;
  if (!t) return 0;
  const g = t.geometry;
  const pos = g.attributes.position;
  const size = 80, seg = Math.sqrt(pos.count) - 1;
  const gx = (x + size / 2) / size, gz = (z + size / 2) / size;
  if (gx < 0 || gx > 1 || gz < 0 || gz > 1) return 0;
  const ix = Math.round(gx * seg), iz = Math.round(gz * seg);
  const idx = iz * (seg + 1) + ix;
  return idx < pos.count ? pos.getY(idx) : 0;
}

function scatterGrass(count, color) {
  const g = new THREE.ConeGeometry(0.12, 0.6, 4);
  g.translate(0, 0.3, 0);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide });
  const inst = new THREE.InstancedMesh(g, m, count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const x = (Math.random() - 0.5) * 72, z = (Math.random() - 0.5) * 72;
    const h = terrainHeightAt(x, z);
    if (h < 0.3 || h > 4.2) continue;
    dummy.position.set(x, h, z);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.8;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    inst.setMatrixAt(placed++, dummy.matrix);
  }
  inst.count = placed;
  inst.castShadow = false; inst.receiveShadow = true;
  return inst;
}

function scatterRocks(count, color) {
  const g = new THREE.DodecahedronGeometry(0.5, 0);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
  const inst = new THREE.InstancedMesh(g, m, count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const x = (Math.random() - 0.5) * 72, z = (Math.random() - 0.5) * 72;
    const h = terrainHeightAt(x, z);
    if (h < 0.15) continue;
    dummy.position.set(x, h + 0.2, z);
    dummy.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
    const s = 0.4 + Math.random() * 1.3;
    dummy.scale.set(s, s * 0.7, s);
    dummy.updateMatrix();
    inst.setMatrixAt(placed++, dummy.matrix);
  }
  inst.count = placed;
  inst.castShadow = true; inst.receiveShadow = true;
  return inst;
}

let scatterGroup = null;
export function scatterVegetation(density = 1) {
  const eng = App.engine;
  if (scatterGroup) { eng.remove(scatterGroup); }
  scatterGroup = new THREE.Group();
  scatterGroup.name = 'vegetation';
  const grassColors = { grass: 0x5fa84f, snow: 0xdfeaf5, desert: 0xc7b06a, cyber: 0x00e6b0 };
  const rockColors = { grass: 0x8a8f9c, snow: 0xcdd7e5, desert: 0xb08f5f, cyber: 0x4a3a6e };
  scatterGroup.add(scatterGrass(Math.round(1400 * density), grassColors[App.theme] || 0x5fa84f));
  scatterGroup.add(scatterRocks(Math.round(220 * density), rockColors[App.theme] || 0x8a8f9c));
  eng.add(scatterGroup);
  addXP(20); toast('植被已散布（密度 ' + density + '×）');
}

export function clearVegetation() {
  if (scatterGroup) { App.engine.remove(scatterGroup); scatterGroup = null; toast('已清除植被'); }
}
