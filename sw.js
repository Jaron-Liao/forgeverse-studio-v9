// ForgeVerse Service Worker：离线缓存核心资源，支持手机安装后离线打开
const CACHE = 'forgeverse-v9';
const ASSETS = [
  './', './index.html', './css/3d.css', './css/guide.css', './css/theme-v11.css', './css/theme-v12.css', './manifest.webmanifest',
  './js/main.js', './js/state.js', './js/engine.js', './js/objects.js',
  './js/guide.js', './js/guide-data.js',
  './js/world.js', './js/biomes.js', './js/biome-pro.js', './js/terrain-edit.js',
  './js/realism.js', './js/environment.js', './js/lighting.js', './js/render-pipeline.js',
  './js/explore.js', './js/infinite-map.js', './js/modeling.js', './js/materials.js',
  './js/textures.js', './js/paint.js', './js/tasks.js', './js/io.js', './js/item-info.js',
  './js/model-import.js', './js/localfile.js', './js/cloud.js',
  './vendor/three/three.module.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // 网络优先，失败回退缓存（保证更新及时且可离线）
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
