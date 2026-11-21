import * as THREE from 'three';
import { App, bus, uid, toast, addXP, polyCount } from './state.js';

const mat = (c = 0x7cc6ff, rough = 0.6, metal = 0.1) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

function shadowize(obj) {
  obj.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; ensureColors(o); }
  });
}
function ensureColors(mesh) {
  const g = mesh.geometry;
  if (g && !g.getAttribute('color')) {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3).fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
}

const PRIMS = {
  box: () => new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2, 4, 4, 4), mat()),
  sphere: () => new THREE.Mesh(new THREE.SphereGeometry(1.3, 64, 48), mat(0x34D399, 0.35)),
  capsule: () => new THREE.Mesh(new THREE.CapsuleGeometry(1, 1.6, 16, 40), mat(0x6EE7B7)),
  cone: () => new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 48), mat(0xFBBF24)),
  cylinder: () => new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 48), mat(0x7DD3FC)),
  torus: () => new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.45, 32, 80), mat(0xF9A8D4, 0.3, 0.4)),
};

// 主题化模型：用基础体拼装
function buildModel(key) {
  const g = new THREE.Group();
  if (key === 'tree') {
    // 高质量阔叶树：锥形树干 + 分层树冠 + 随机扰动
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, 3.4, 20), mat(0x9b6b43, 0.92));
    trunk.position.y = 1.7;
    g.add(trunk);
    const leafMat = mat(0x5FC24C, 0.85);
    const leafMat2 = mat(0x8FD96B, 0.85);
    // 三层错落树冠
    [[3.3, 2.1, 0], [4.3, 1.75, 0.3], [5.1, 1.3, 0.6]].forEach(([y, r, tilt], idx) => {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3), idx === 1 ? leafMat2 : leafMat);
      // 顶点扰动，制造自然起伏
      const p = crown.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const n = 1 + (Math.sin(i * 12.9898 + idx) * 43758.5453 % 1) * 0.14;
        p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * 0.85, p.getZ(i) * n);
      }
      crown.geometry.computeVertexNormals();
      crown.position.set(tilt, y, -tilt * 0.5);
      g.add(crown);
    });
  } else if (key === 'rock') {
    // 岩石：高细分 + 顶点噪声 + 平面着色保留硬朗感
    const geo = new THREE.IcosahedronGeometry(1.8, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = 0.85 + (Math.sin(i * 78.233) * 43758.5453 % 1) * 0.3;
      p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * 0.8, p.getZ(i) * n);
    }
    geo.computeVertexNormals();
    const r = new THREE.Mesh(geo, mat(0xB8C0CC, 0.9, 0.05));
    r.scale.set(1.3, 1, 1.1); r.position.y = 0.9;
    g.add(r);
  } else if (key === 'bush') {
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + Math.random() * 0.3, 2),
        mat(i % 2 ? 0x5FC24C : 0x8FD96B, 0.9));
      const a = i / 5 * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.7, 0.5 + Math.random() * 0.3, Math.sin(a) * 0.7);
      g.add(b);
    }
  } else if (key === 'lamp') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4, 12), mat(0x9aa6b8, 0.6, 0.6));
    pole.position.y = 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcf5c, emissiveIntensity: 1.4, roughness: 0.4 }));
    head.position.y = 4.1;
    const pl = new THREE.PointLight(0xffd98a, 1.4, 14); pl.position.y = 4.1;
    g.add(pole, head, pl);
  } else if (key === 'char') {
    // 角色：更精细的比例与配色（LOL 风格Q版英雄）
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.3, 16, 32), mat(0x5CC8FF, 0.45, 0.1));
    body.position.y = 1.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 40, 32), mat(0xf2c9a0, 0.6));
    head.position.y = 2.95;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x10B981, 0.7));
    hair.position.y = 3.0;
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.2, metalness: 0.1 });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), eyeMat); e1.position.set(-0.24, 2.98, 0.61);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), eyeMat); e2.position.set(0.24, 2.98, 0.61);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.1, 12, 32), mat(0xFFC85C, 0.3, 0.7));
    belt.rotation.x = Math.PI / 2; belt.position.y = 1.3;
    g.add(body, head, hair, e1, e2, belt);
  } else if (key === 'chest') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.4), mat(0x9b6b43, 0.8));
    base.position.y = 0.6;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.6, 1.45), mat(0xB8875A, 0.8));
    lid.position.y = 1.4;
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 1.5), mat(0xFFC85C, 0.4, 0.7));
    band.position.y = 1.2;
    g.add(base, lid, band);
  }
  return g;
}

const MODEL_INFO = {
  tree: ['🌳 树', 0x5FC24C], rock: ['🪨 巨石', 0xB8C0CC], bush: ['🌿 灌木', 0x5FC24C],
  lamp: ['💡 路灯', 0xffe9a8], char: ['🧍 角色', 0x5CC8FF], chest: ['📦 宝箱', 0x9b6b43],
};

let selBox = null;

export function spawnPrimitive(type) {
  const eng = App.engine;
  const m = PRIMS[type] ? PRIMS[type]() : PRIMS.box();
  m.position.set((Math.random() - 0.5) * 6, 1, (Math.random() - 0.5) * 6);
  shadowize(m);
  register(m, { name: type.toUpperCase(), type, kind: 'prim' });
  addXP(8); toast('已放置 ' + type);
  return App.selected;
}

export function spawnModel(key) {
  const eng = App.engine;
  const g = buildModel(key);
  g.position.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
  shadowize(g);
  const info = MODEL_INFO[key] || ['物件', 0x888888];
  register(g, { name: info[0], type: key, kind: 'model' });
  addXP(12); toast('已放置 ' + info[0]);
  return App.selected;
}

export function register(root, meta) {
  const rec = { id: uid(), name: meta.name, root, type: meta.type, kind: meta.kind, baseColor: 0x7cc6ff };
  root.userData.recId = rec.id;
  App.engine.add(root);
  App.objects.push(rec);
  selectObject(rec);
  bus.emit('objects');
  updateHUD();
}

export function selectFromMesh(mesh) {
  let o = mesh;
  while (o && !o.userData.recId) o = o.parent;
  if (!o) return;
  const rec = App.objects.find(r => r.id === o.userData.recId);
  if (rec) selectObject(rec);
}

export function selectObject(rec) {
  App.selected = rec;
  const eng = App.engine;
  if (selBox) { eng.remove(selBox); selBox = null; }
  if (rec) {
    selBox = new THREE.BoxHelper(rec.root, 0x5cc8ff);
    selBox.material.depthTest = false;
    eng.add(selBox);
    if (App.mode === 'select') eng.tcontrols.attach(rec.root);
    updateInspector();
  } else {
    eng.tcontrols.detach();
    document.getElementById('objBody').hidden = true;
    document.getElementById('objEmpty').hidden = false;
  }
  bus.emit('select', rec);
  renderTree();
}

function detachIfSelected() {
  if (App.selected) { App.engine.tcontrols.detach(); }
}

export function deleteSelected() {
  const rec = App.selected;
  if (!rec) return;
  detachIfSelected();
  App.engine.remove(rec.root);
  if (selBox) { App.engine.remove(selBox); selBox = null; }
  App.objects = App.objects.filter(r => r !== rec);
  App.selected = null;
  addXP(2);
  bus.emit('objects'); renderTree(); updateHUD();
  document.getElementById('objBody').hidden = true;
  document.getElementById('objEmpty').hidden = false;
  toast('已删除');
}

export function duplicateSelected() {
  const rec = App.selected;
  if (!rec) return;
  const clone = rec.root.clone(true);
  clone.position.x += 2;
  clone.traverse(o => { if (o.isMesh) ensureColors(o); });
  clone.userData.recId = uid();
  App.engine.add(clone);
  const nrec = { id: clone.userData.recId, name: rec.name + ' 副本', root: clone, type: rec.type, kind: rec.kind };
  App.objects.push(nrec);
  selectObject(nrec);
  bus.emit('objects'); updateHUD(); addXP(6); toast('已复制');
}

export function applyMaterial(prop, value) {
  const rec = App.selected;
  if (!rec) return;
  rec.root.traverse(o => {
    if (o.isMesh && o.material) {
      if (prop === 'color' || prop === 'emissive') o.material[prop].set(value);
      else o.material[prop] = value;
      o.material.needsUpdate = true;
    }
  });
}

export function toggleHideSelected() {
  const rec = App.selected;
  if (!rec) return;
  rec.root.visible = !rec.root.visible;
  renderTree();
  toast(rec.root.visible ? '已显示' : '已隐藏');
}

export function updateInspector() {
  const rec = App.selected;
  if (!rec) return;
  document.getElementById('objEmpty').hidden = true;
  document.getElementById('objBody').hidden = false;
  const r = rec.root;
  document.getElementById('objName').value = rec.name;
  document.getElementById('px').value = r.position.x.toFixed(2);
  document.getElementById('py').value = r.position.y.toFixed(2);
  document.getElementById('pz').value = r.position.z.toFixed(2);
  const d = THREE.MathUtils.radToDeg;
  document.getElementById('rx').value = d(r.rotation.x).toFixed(0);
  document.getElementById('ry').value = d(r.rotation.y).toFixed(0);
  document.getElementById('rz').value = d(r.rotation.z).toFixed(0);
  document.getElementById('sx').value = r.scale.x.toFixed(2);
  document.getElementById('sy').value = r.scale.y.toFixed(2);
  document.getElementById('sz').value = r.scale.z.toFixed(2);
  // 材质（取第一个 mesh）
  let m = null; r.traverse(o => { if (!m && o.isMesh) m = o.material; });
  if (m) {
    document.getElementById('mColor').value = '#' + m.color.getHexString();
    document.getElementById('mRough').value = m.roughness ?? 0.6;
    document.getElementById('mMetal').value = m.metalness ?? 0.1;
    document.getElementById('mEmissive').value = '#' + (m.emissive ? m.emissive.getHexString() : '000000');
    document.getElementById('mOpacity').value = m.opacity ?? 1;
    document.getElementById('mWire').checked = !!m.wireframe;
  }
}

export function refreshSelBox() {
  if (selBox) selBox.update();
}

export function renderTree() {
  const t = document.getElementById('sceneTree');
  if (!t) return;
  t.innerHTML = '';
  App.objects.forEach(rec => {
    const n = document.createElement('div');
    n.className = 'node' + (App.selected === rec ? ' sel' : '') + (rec.root.visible ? '' : ' hidden');
    n.innerHTML = `<span>${rec.kind === 'model' ? '🌟' : '⬛'}</span><span>${rec.name}</span><span class="x">✕</span>`;
    n.onclick = e => { if (e.target.classList.contains('x')) { App.selected = rec; deleteSelected(); } else selectObject(rec); };
    t.appendChild(n);
  });
}

export function updateHUD() {
  const ho = document.getElementById('hObj'), hp = document.getElementById('hPoly');
  if (ho) ho.textContent = App.objects.length;
  if (hp) hp.textContent = polyCount().toLocaleString();
}
