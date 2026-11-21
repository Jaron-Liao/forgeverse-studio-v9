import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { App, setPet, clamp } from './state.js';

export function createEngine(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xE6F5EE);
  scene.fog = new THREE.Fog(0xE6F5EE, 40, 160);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 3000);
  camera.position.set(14, 12, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // 灯光
  const hemi = new THREE.HemisphereLight(0xD6F5E8, 0xFFF4DC, 0.65);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.1);
  sun.position.set(20, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xF0FBF5, 0.5));

  // 网格 + 地面
  const grid = new THREE.GridHelper(120, 60, 0x7FC9A8, 0xDCEEE4);
  grid.material.transparent = true; grid.material.opacity = 0.5;
  scene.add(grid);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ color: 0xE8F4EC, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // 控制器
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 1, 0);

  const tcontrols = new TransformControls(camera, renderer.domElement);
  tcontrols.setSpace('world');
  tcontrols.addEventListener('dragging-changed', e => { controls.enabled = !e.value; });
  tcontrols.addEventListener('objectChange', () => App.selected && refreshInspectorTransform());
  scene.add(tcontrols);

  // 更新回调注册
  const updaters = [];
  const onUpdate = fn => updaters.push(fn);

  // 外部渲染/缩放钩子（后处理管线注入）
  let renderFn = () => renderer.render(scene, camera);
  let resizeFn = null;
  const setRenderFn = fn => { renderFn = fn; };
  const setResizeFn = fn => { resizeFn = fn; };

  // 昼夜
  function setTimeOfDay(t) { // t: 0..1
    const ang = t * Math.PI * 2 - Math.PI / 2;
    sun.position.set(Math.cos(ang) * 40, Math.sin(ang) * 38 + 4, 18);
    const day = clamp(Math.sin(ang) + 0.3, 0, 1);
    sun.intensity = 0.3 + day * 2.2;
    const top = new THREE.Color().setHSL(0.62, 0.5, 0.05 + day * 0.32);
    const bot = new THREE.Color().setHSL(0.62, 0.4, 0.02 + day * 0.12);
    scene.background.copy(top);
    scene.fog.color.copy(bot);
    hemi.intensity = 0.25 + day * 0.6;
    renderer.toneMappingExposure = 0.72 + day * 0.28;
  }

  // 渲染循环
  const clock = new THREE.Clock();
  let frames = 0, lastFps = performance.now();
  function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta();
    const el = clock.elapsedTime;
    controls.update();
    updaters.forEach(u => u(dt, el));
    renderFn();
    frames++;
    const now = performance.now();
    if (now - lastFps > 500) {
      const fps = Math.round(frames * 1000 / (now - lastFps));
      frames = 0; lastFps = now;
      const hf = document.getElementById('hFps');
      if (hf) hf.textContent = fps;
    }
  }
  loop();

  function resize() {
    if (resizeFn) { resizeFn(); return; }
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  function refreshInspectorTransform() {
    const ev = new CustomEvent('wb:transform');
    window.dispatchEvent(ev);
  }

  return {
    scene, camera, renderer, controls, tcontrols, sun, hemi, grid, ground,
    setTimeOfDay, onUpdate, resize, setRenderFn, setResizeFn,
    add: o => scene.add(o),
    remove: o => scene.remove(o),
  };
}
