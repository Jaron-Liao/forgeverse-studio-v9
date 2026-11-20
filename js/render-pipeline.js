import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { App, toast } from './state.js';

// 画质档位：low / medium / high / cinema
export const QUALITY = {
  low:    { label: '流畅', bloom: false, ssao: false, smaa: false, pr: 1.0 },
  medium: { label: '标准', bloom: false, ssao: false, smaa: true,  pr: 1.25 },
  high:   { label: '高清', bloom: true,  ssao: false, smaa: true,  pr: 1.5 },
  cinema: { label: '电影级', bloom: true, ssao: true, smaa: true, pr: 1.75 },
};

let composer = null, bloomPass = null, ssaoPass = null, smaaPass = null, outputPass = null;
let engine = null, currentQuality = 'high';

export function createPipeline(eng, quality = 'high') {
  engine = eng;
  const { renderer, scene, camera } = eng;
  const w = eng.renderer.domElement.clientWidth || 1280;
  const h = eng.renderer.domElement.clientHeight || 720;

  composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // SSAO 环境光遮蔽（最贵，仅电影级）
  ssaoPass = new SSAOPass(scene, camera, w, h);
  ssaoPass.kernelRadius = 12;      // 更自然的接触阴影过渡
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.12;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  ssaoPass.enabled = false;
  composer.addPass(ssaoPass);

  // Bloom 辉光（金属高光、霓虹、灯光发光）
  // threshold 抬高到 1.35：只让真正的高光泛光，避免天空/白墙大面积过曝
  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.4, 1.35);
  bloomPass.enabled = false;
  composer.addPass(bloomPass);

  // SMAA 抗锯齿
  smaaPass = new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  smaaPass.enabled = false;
  composer.addPass(smaaPass);

  // 输出：tone mapping + 色彩空间
  outputPass = new OutputPass();
  composer.addPass(outputPass);

  setQuality(quality);
  return { composer, setQuality, render, resize };
}

export function setQuality(q) {
  if (!QUALITY[q] || !composer) return;
  currentQuality = q;
  const cfg = QUALITY[q];
  const pr = Math.min(window.devicePixelRatio || 1, cfg.pr);
  engine.renderer.setPixelRatio(pr);

  if (bloomPass) bloomPass.enabled = cfg.bloom;
  if (ssaoPass) ssaoPass.enabled = cfg.ssao;
  if (smaaPass) smaaPass.enabled = cfg.smaa;

  resize();
  App.quality = q;
  const hq = document.getElementById('hQuality');
  if (hq) hq.textContent = cfg.label;
  toast('画质已切换：' + cfg.label);
}

// 微调辉光/曝光（供 UI 调用）
export function tuneBloom(strength, radius, threshold) {
  if (!bloomPass) return;
  if (strength != null) bloomPass.strength = strength;
  if (radius != null) bloomPass.radius = radius;
  if (threshold != null) bloomPass.threshold = threshold;
}

export function render() {
  if (composer) composer.render();
  else if (engine) engine.renderer.render(engine.scene, engine.camera);
}

export function resize() {
  const { renderer, camera } = engine;
  const w = renderer.domElement.clientWidth || 1280;
  const h = renderer.domElement.clientHeight || 720;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
}

export function getQuality() { return currentQuality; }
