import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { App, toast } from './state.js';

// 电影级光照：PMREM 环境反射 + 主光/补光/轮廓光 + 高质量阴影
export function setupLighting(eng) {
  const { renderer, scene, sun, hemi } = eng;

  // 1) PMREM 环境贴图：让 PBR 金属/玻璃有真实环境反射
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.75;   // v9.2 明亮：提升环境反射，材质更通透精致
  pmrem.dispose();

  // 2) 主光（太阳）—— 柔和阴影
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;

  // 3) 半球光：天空冷色 / 地面暖色，提升层次
  hemi.color.set(0xD6F5E8);      // v9.2 亮天蓝
  hemi.groundColor.set(0xFFF4DC); // 暖反射，去暗紫
  hemi.intensity = 0.9;

  // 4) 轮廓补光（冷色，从侧后打亮边缘，LOL 常用手法）
  const rim = new THREE.DirectionalLight(0xBFE8F0, 0.42);  // v9.2 冷色轮廓光，强度降避免亮底过曝
  rim.position.set(-18, 14, -16);
  scene.add(rim);

  // 5) 暖色补光（模拟环境反射暖调）
  const fill = new THREE.DirectionalLight(0xFFE8C0, 0.26);  // v9.2 暖补光，轻描即可
  fill.position.set(12, 6, -10);
  scene.add(fill);

  // 6) 接触阴影增强：地面接收软阴影
  eng.ground.receiveShadow = true;
  if (eng.ground.material) {
    eng.ground.material.roughness = 0.9;
    eng.ground.material.metalness = 0.05;
  }

  // 7) 全局色调映射
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90;

  toast('电影级光照已启用（环境反射 + 轮廓光）');
}
