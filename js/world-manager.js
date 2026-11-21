// ============================================================
// world-manager.js — 多世界实体、索引、活动指针与云端映射
// 任务：FV-ENG-02（批次 A，只做数据/逻辑层，不碰 UI 文件）
// 依据：design/gdd/WORLD_SYSTEM_GDD.md §3、design/gdd/UX_SPEC.md §3、
//       docs/architecture/ARCHITECTURE.md §6、docs/architecture/ADR.md ADR-01/03/06
//
// 存储键（可检查，对应 GDD A10）：
//   forgeverse.worlds.index      世界索引（仅元数据，管理页只读它）
//   forgeverse.world.<id>        单世界完整实体（独立键，逐个删除）
//   forgeverse.activeWorld       活动指针（仅 id）
//   forgeverse_v1                旧版单存档，迁移后只读保留
// 云端：wb_saves 行，slot = world.id（见 cloud.js）
// ============================================================
import { App, bus } from './state.js';
import { cloudLoad, cloudSave, listCloudWorlds } from './cloud.js';
import {
  emptySnapshot, serialize, serializeWorld, deserialize, deserializeWorld,
  applyWorldConfig, extractSnapshot,
} from './io.js';

const INDEX_KEY = 'forgeverse.worlds.index';
const ACTIVE_KEY = 'forgeverse.activeWorld';
const LEGACY_KEY = 'forgeverse_v1';
const WORLD_KEY = id => `forgeverse.world.${id}`;
const SCHEMA_VERSION = 4;

const BIOMES = ['grass', 'snow', 'desert', 'cyber'];
const WEATHERS = ['clear', 'rain', 'snow', 'storm', 'fog', 'aurora', 'sandstorm', 'sunny', 'mist'];
// 以批次 B 实际落地的控件值为准；设计文档的旧值作为别名接受并归一化。
const QUALITIES = ['low', 'medium', 'high', 'cinema'];
const QUALITY_ALIASES = { smooth: 'low', standard: 'medium', hd: 'high' };
const STARTERS = ['empty', 'basic', 'demo'];
const START_VIEWS = ['top', 'ground', 'roam'];
const START_VIEW_ALIASES = { overview: 'top', spawn: 'roam' };
const INITIAL_PANELS = ['expanded', 'collapsed'];
const INITIAL_MODES = ['select', 'roam'];
const INITIAL_MODE_ALIASES = { explore: 'roam' };

// UI 值已与 engine 画质档对齐；保留旧别名映射以防老配置读不回来。
export const QUALITY_TO_ENGINE = {
  low: 'low', medium: 'medium', high: 'high', cinema: 'cinema',
  smooth: 'low', standard: 'medium', hd: 'high',
};

const now = () => new Date().toISOString();
const randomSeed = () => Math.floor(Math.random() * 999999) + 1;
const newId = () => `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const inList = (v, list, fallback) => list.includes(v) ? v : fallback;
const inListAlias = (v, list, aliases, fallback) => {
  const key = aliases[v] || v;
  return list.includes(key) ? key : fallback;
};
const clampNum = (v, d, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

// ---------- 默认配置（UX_SPEC §3，组 A/B/C 全部字段） ----------
export function getDefaultConfig() {
  return {
    // 组 A · 身份与场景
    name: '',
    biome: 'grass',
    seed: randomSeed(),
    weather: 'clear',
    timeOfDay: 0.55,
    // 组 B · 开局设定（取值与 #worldConfig 控件一致）
    quality: 'medium',
    starterKit: 'basic',
    cloudSync: false,
    // 组 C · 高级（高度范围 0..8 对应 #wcTerrainHeight，engine 默认 3）
    terrainHeight: 3,
    terrainSeg: 96,
    startView: 'top',
    initialPanel: 'collapsed',
    initialMode: 'select',
    envDetails: { water: true, grid: true, fog: true, particles: true },
  };
}

export function normalizeConfig(raw = {}) {
  const d = getDefaultConfig();
  const env = raw.envDetails && typeof raw.envDetails === 'object' ? raw.envDetails : {};
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 24) : '';
  return {
    name,
    biome: inList(raw.biome, BIOMES, d.biome),
    seed: Math.round(clampNum(raw.seed ?? d.seed, d.seed, 1, 999999)),
    weather: inList(raw.weather, WEATHERS, d.weather),
    timeOfDay: clampNum(raw.timeOfDay, d.timeOfDay, 0, 1),
    quality: inListAlias(raw.quality, QUALITIES, QUALITY_ALIASES, d.quality),
    starterKit: inList(raw.starterKit, STARTERS, d.starterKit),
    cloudSync: raw.cloudSync === true,
    terrainHeight: clampNum(raw.terrainHeight, d.terrainHeight, 0, 8),
    terrainSeg: Math.round(clampNum(raw.terrainSeg, d.terrainSeg, 32, 160)),
    startView: inListAlias(raw.startView, START_VIEWS, START_VIEW_ALIASES, d.startView),
    initialPanel: inList(raw.initialPanel, INITIAL_PANELS, d.initialPanel),
    initialMode: inListAlias(raw.initialMode, INITIAL_MODES, INITIAL_MODE_ALIASES, d.initialMode),
    envDetails: {
      water: env.water !== false,
      grid: env.grid !== false,
      fog: env.fog !== false,
      particles: env.particles !== false,
    },
  };
}

// ---------- 状态 ----------
let currentWorld = null;
let initialized = false;

function emit(name, detail) {
  try { bus.emit(name, detail); } catch (_) { /* 事件总线故障不影响存档 */ }
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch (_) { /* 非浏览器环境忽略 */ }
}

function fail(code, message, detail) {
  emit('world:error', { code, message, detail: detail || null });
}

function readJSON(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}

function writeJSON(key, value) {
  try {
    if (typeof localStorage === 'undefined') { fail('STORAGE_UNAVAILABLE', '本地存储不可用'); return false; }
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    fail('STORAGE_FULL', '存储已满，请先删除世界或导出备份。');
    return false;
  }
}

function removeKey(key) {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (_) { /* 忽略 */ }
}

function readIndex() {
  const list = readJSON(INDEX_KEY, []);
  return Array.isArray(list) ? list : [];
}
function writeIndex(list) { return writeJSON(INDEX_KEY, list); }

function readActiveId() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ACTIVE_KEY) || null;
  } catch (_) { return null; }
}
function writeActiveId(id) {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY);
    return true;
  } catch (_) { return false; }
}

function readWorldRecord(id) {
  if (!id || typeof id !== 'string') return null;
  const rec = readJSON(WORLD_KEY(id), null);
  return rec && typeof rec === 'object' ? rec : null;
}
function writeWorldRecord(world) {
  if (!world || !world.id) return false;
  return writeJSON(WORLD_KEY(world.id), world);
}

function defaultSync(enabled = false) {
  return {
    enabled: !!enabled,
    provider: 'cloudbase',
    remoteId: null,
    revision: 1,
    lastSyncedAt: null,
    state: enabled ? 'pending' : 'idle',
  };
}

// 索引条目只包含卡片所需字段，不含 snapshot。
function toEntry(world) {
  return {
    id: world.id,
    name: world.name,
    biome: world.config?.biome || 'grass',
    quality: world.config?.quality || 'standard',
    thumbnail: world.thumbnail || null,
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
    openedAt: world.openedAt || null,
    sync: world.sync || defaultSync(),
    source: world.source || 'local',
  };
}

function upsertIndex(world) {
  const list = readIndex();
  const entry = toEntry(world);
  const i = list.findIndex(e => e && e.id === world.id);
  if (i >= 0) list[i] = { ...list[i], ...entry }; else list.push(entry);
  return writeIndex(list);
}

function nextName(index) {
  const used = new Set((index || []).map(e => e && e.name));
  let n = (index || []).length + 1;
  while (used.has(`未命名世界 ${n}`)) n++;
  return `未命名世界 ${n}`;
}

// ---------- 生命周期 ----------

// 幂等初始化：建空索引 + 监听其他标签页改写活动指针（GDD §5.7）。
export function initWorldManager() {
  if (initialized) return true;
  initialized = true;
  const index = readIndex();
  if (!index.length && typeof localStorage !== 'undefined') {
    try { if (localStorage.getItem(INDEX_KEY) === null) writeIndex([]); } catch (_) { /* 忽略 */ }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', e => {
      if (e.key !== ACTIVE_KEY || !e.newValue) return;
      if (currentWorld && e.newValue !== currentWorld.id) {
        emit('world:tab-conflict', { activeId: e.newValue, localId: currentWorld.id });
      }
    });
  }
  return true;
}

// 只读索引，管理页渲染卡片用；不触发云请求。
export function listWorlds() {
  const list = readIndex();
  return list.slice().sort((a, b) => {
    const ta = new Date(a.openedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.openedAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });
}

export function getActiveWorldId() { return currentWorld?.id || readActiveId(); }
export function getCurrentWorld() { return currentWorld; }

// 新建：一次性写入配置快照；snapshot 由 emptySnapshot 构造，不读 App，确保隔离。
export function createWorld(rawConfig = {}) {
  initWorldManager();
  const config = normalizeConfig(rawConfig);
  const index = readIndex();
  const name = config.name || nextName(index);
  config.name = name;
  const stamp = now();
  const world = {
    id: newId(),
    name,
    schemaVersion: SCHEMA_VERSION,
    createdAt: stamp,
    updatedAt: stamp,
    openedAt: null,
    config,
    snapshot: emptySnapshot(config),
    sync: defaultSync(config.cloudSync),
    thumbnail: null,
    source: 'local',
  };
  if (!writeWorldRecord(world)) return null;
  index.push(toEntry(world));
  if (!writeIndex(index)) return null;
  emit('world:create', { id: world.id, name: world.name, config });
  return world;
}

// 从云端 payload 规整为本地 World 实体。
function normalizeWorldPayload(payload, id, fallbackName) {
  const name = payload?.name || fallbackName || payload?.worldName || '未命名世界';
  if (payload && payload.snapshot && Array.isArray(payload.snapshot.objects)) {
    return {
      ...payload,
      id: payload.id || id,
      name,
      schemaVersion: payload.schemaVersion || SCHEMA_VERSION,
      createdAt: payload.createdAt || now(),
      updatedAt: payload.updatedAt || now(),
      openedAt: payload.openedAt || null,
      config: normalizeConfig(payload.config || {}),
      sync: payload.sync || defaultSync(true),
      thumbnail: payload.thumbnail || null,
      source: 'both',
    };
  }
  // 裸 v3（旧 main slot）：把它当成 snapshot 包起来。
  const snap = payload && Array.isArray(payload.objects) ? payload : null;
  if (!snap) return null;
  return {
    id,
    name,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now(),
    updatedAt: now(),
    openedAt: now(),
    config: normalizeConfig({
      name,
      biome: snap.biomeName || snap.theme || 'grass',
      seed: snap.mapSeed ?? snap.terrain?.seed,
      weather: snap.weather,
      timeOfDay: snap.time,
      starterKit: 'empty',
    }),
    snapshot: snap,
    sync: defaultSync(true),
    thumbnail: null,
    legacySlot: id === 'main' ? 'main' : undefined,
    source: 'cloud',
  };
}

// 打开/切换：先保存当前 → 读取目标（本地优先，云端兜底）→ deserialize 灌回 App。
// 任一步失败都保留原活动指针，并尝试把 App 恢复成打开前的场景。
export async function openWorld(id) {
  initWorldManager();
  if (!id || typeof id !== 'string') { fail('WORLD_NOT_FOUND', '找不到这个世界'); return null; }
  if (currentWorld && currentWorld.id === id) return currentWorld;

  const previousId = currentWorld?.id || readActiveId();
  let backup = null;
  try { backup = serialize(); } catch (_) { /* 备份失败不阻断，但会降低回滚能力 */ }

  if (currentWorld && !saveCurrentWorld()) {
    fail('SWITCH_SAVE_FAILED', '切换失败，已留在原世界');
    return null;
  }

  let world = readWorldRecord(id);
  let fromCloud = false;
  if (!world) {
    try {
      const row = await cloudLoad(id);
      if (row?.payload) {
        world = normalizeWorldPayload(row.payload, id, row.world_name);
        fromCloud = !!world;
      }
    } catch (_) { /* 云端不可用走本地 */ }
  }
  if (!world || !extractSnapshot(world)) {
    if (fromCloud) writeActiveId(previousId);
    fail('WORLD_NOT_FOUND', '找不到这个世界');
    return null;
  }

  try {
    if (!deserializeWorld(world)) throw new Error('invalid snapshot');
    applyWorldConfig(world.config || {});
  } catch (_) {
    if (backup) { try { deserialize(backup); } catch (__) { /* 已尽力回滚 */ } }
    writeActiveId(previousId);
    fail('WORLD_LOAD_FAILED', '这个世界打不开了。');
    return null;
  }

  const stamp = now();
  world.openedAt = stamp;
  world.updatedAt = fromCloud ? (world.updatedAt || stamp) : stamp;
  if (!writeWorldRecord(world) || !writeActiveId(id) || !upsertIndex(world)) {
    writeActiveId(previousId);
    fail('SWITCH_FAILED', '切换失败，已留在原世界');
    return null;
  }

  currentWorld = world;
  emit('world:open', { id: world.id, name: world.name, config: world.config, source: fromCloud ? 'cloud' : 'local' });
  // 批次 B 用这个事件应用纯 UI 项（起始视角/侧栏/初始模式/环境细节）。
  emit('world:apply-config', { config: world.config, qualityEngine: QUALITY_TO_ENGINE[world.config?.quality] || 'medium' });
  return world;
}

// 保存当前世界的完整快照到本地；成功才更新 revision 与卡片。
export function saveCurrentWorld() {
  if (!currentWorld) return false;
  const updated = serializeWorld(currentWorld);
  if (!updated) return false;
  updated.sync = {
    ...(currentWorld.sync || defaultSync()),
    revision: (currentWorld.sync?.revision || 1) + 1,
    state: currentWorld.sync?.enabled ? 'pending' : (currentWorld.sync?.state === 'conflict' ? 'conflict' : 'idle'),
  };
  updated.updatedAt = now();
  if (!writeWorldRecord(updated)) return false;
  currentWorld = updated;
  if (!upsertIndex(updated)) return false;
  emit('world:save', { id: updated.id, updatedAt: updated.updatedAt, revision: updated.sync.revision });
  return true;
}

// 本地保存 +（该世界开启同步时）上传云端。
export async function saveWorld(id) {
  const target = id || currentWorld?.id;
  if (!target) { fail('NO_ACTIVE_WORLD', '当前没有打开的世界'); return false; }
  if (currentWorld?.id === target && !saveCurrentWorld()) return false;
  const world = readWorldRecord(target);
  if (!world) return false;
  if (!world.sync?.enabled) return true;
  return syncWorldToCloud(target);
}

export async function syncWorldToCloud(id) {
  const world = id === currentWorld?.id ? currentWorld : readWorldRecord(id);
  if (!world) { fail('WORLD_NOT_FOUND', '找不到这个世界'); return false; }
  if (!world.sync?.enabled) return true;
  let ok = false;
  try { ok = await cloudSave(world, world.name, world.id); } catch (_) { ok = false; }
  if (!ok) {
    const patched = { ...world, sync: { ...world.sync, state: 'error' } };
    writeWorldRecord(patched); upsertIndex(patched);
    if (currentWorld?.id === id) currentWorld = patched;
    fail('CLOUD_SYNC_FAILED', '暂时连不上云端，已保存在本地。');
    emit('world:syncState', { worldId: id, state: 'error' });
    return false;
  }
  const patched = {
    ...world,
    sync: {
      ...world.sync,
      state: 'synced',
      remoteId: world.sync.remoteId || world.id,
      lastSyncedAt: now(),
    },
  };
  if (!writeWorldRecord(patched)) return false;
  upsertIndex(patched);
  if (currentWorld?.id === id) currentWorld = patched;
  emit('world:syncState', { worldId: id, state: 'synced' });
  return true;
}

// 从云端拉取元数据合并进索引（只取元数据，不拉 payload）。
export async function syncWorldListWithCloud() {
  let rows = [];
  try { rows = await listCloudWorlds(); } catch (_) { rows = []; }
  if (!rows.length) return listWorlds();
  const map = new Map(readIndex().map(e => [e.id, e]));
  rows.forEach(r => {
    const old = map.get(r.id) || {
      id: r.id, name: r.name, biome: 'grass', quality: 'standard', thumbnail: null,
      createdAt: r.createdAt, updatedAt: r.updatedAt, openedAt: null,
      sync: defaultSync(true), source: 'cloud',
    };
    map.set(r.id, {
      ...old,
      name: old.name || r.name,
      cloudUpdatedAt: r.updatedAt,
      source: old.source === 'local' ? 'both' : old.source,
      sync: {
        ...(old.sync || defaultSync(true)),
        enabled: true,
        remoteId: r.remoteId || old.sync?.remoteId || r.id,
        state: old.sync?.state === 'conflict' ? 'conflict' : 'synced',
        lastSyncedAt: old.sync?.lastSyncedAt || r.updatedAt,
      },
    });
  });
  writeIndex([...map.values()]);
  emit('world:list', { worlds: listWorlds() });
  return listWorlds();
}

// 关闭：先保存，清空活动指针与瞬态 App 状态；不销毁 renderer/engine。
export function closeWorld() {
  if (!currentWorld) return true;
  const id = currentWorld.id;
  if (!saveCurrentWorld()) return false;
  currentWorld = null;
  writeActiveId(null);
  try {
    App.objects.slice().forEach(r => { try { App.engine?.remove?.(r.root); } catch (_) { /* 忽略 */ } });
    App.objects = [];
    App.selected = null;
    App.tasks = [];
    App.note = '';
    App.bookmarks = [];
    App.terrainEdits = [];
    App.worldName = '未命名世界';
  } catch (_) { /* 忽略：关闭不应因 UI 状态失败 */ }
  emit('world:close', { id });
  // main.js 的撤销栈是模块私有变量，批次 B 用这个事件清空。
  emit('wb:world-close', { id });
  return true;
}

export function deleteWorld(id) {
  if (!id) return false;
  if (currentWorld?.id === id && !closeWorld()) return false;
  const index = readIndex().filter(e => e && e.id !== id);
  removeKey(WORLD_KEY(id));
  if (!writeIndex(index)) return false;
  emit('world:delete', { id });
  return true;
}

// 另存为新世界：冲突三选项的第三项，任何一端的数据都不丢。
export function cloneWorld(id, name) {
  const src = readWorldRecord(id);
  if (!src) { fail('WORLD_NOT_FOUND', '找不到这个世界'); return null; }
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = newId();
  copy.name = (name || `${src.name} 副本`).slice(0, 24);
  copy.createdAt = now();
  copy.updatedAt = copy.createdAt;
  copy.openedAt = null;
  copy.sync = defaultSync(false);
  copy.source = 'local';
  if (!writeWorldRecord(copy)) return null;
  const index = readIndex();
  index.push(toEntry(copy));
  if (!writeIndex(index)) return null;
  emit('world:duplicate', { id: copy.id, from: id });
  return copy;
}

export function updateWorldMeta(id, patch = {}) {
  if (!id || typeof patch !== 'object') return null;
  const world = readWorldRecord(id);
  if (!world) { fail('WORLD_NOT_FOUND', '找不到这个世界'); return null; }
  const next = { ...world };
  if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim().slice(0, 24);
  if ('thumbnail' in patch) next.thumbnail = patch.thumbnail || null;
  if (patch.config && typeof patch.config === 'object') {
    next.config = normalizeConfig({ ...world.config, ...patch.config });
  }
  if (patch.sync && typeof patch.sync === 'object') {
    next.sync = { ...(world.sync || defaultSync()), ...patch.sync };
  }
  next.updatedAt = now();
  if (!writeWorldRecord(next) || !upsertIndex(next)) return null;
  if (currentWorld?.id === id) currentWorld = next;
  emit('world:meta', { id, name: next.name });
  return next;
}

// ---------- 旧存档迁移（GDD §5.5：提示后迁移，原键保留） ----------
export function hasLegacySave() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem(LEGACY_KEY);
  } catch (_) { return false; }
}

export function migrateLegacyWorld() {
  const legacy = readJSON(LEGACY_KEY, null);
  if (!legacy || !Array.isArray(legacy.objects)) return null;
  const name = '我的第一个世界';
  const world = {
    id: newId(),
    name,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now(),
    updatedAt: now(),
    openedAt: null,
    config: normalizeConfig({
      name,
      biome: legacy.biomeName || legacy.theme || 'grass',
      seed: legacy.mapSeed ?? legacy.terrain?.seed,
      weather: legacy.weather,
      timeOfDay: legacy.time,
      starterKit: 'empty',
    }),
    snapshot: legacy,
    sync: defaultSync(false),
    thumbnail: null,
    legacySlot: 'main',
    source: 'local',
  };
  if (!writeWorldRecord(world)) return null;
  const index = readIndex();
  index.push(toEntry(world));
  if (!writeIndex(index)) return null;
  // 原 forgeverse_v1 保留不删，可回滚（GDD §5.5）。
  emit('world:migrate', { id: world.id, legacyKeyKept: true });
  return world;
}

// ============================================================
// 全屏页面显隐（ID 统一驼峰：#worldManager / #worldConfig）
// 批次 B 已锁定 HTML，本模块只切 .hidden，不改 DOM 结构。
// ============================================================
const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

const BIOME_LABEL = {
  grass: '草原', snow: '雪原', desert: '沙漠', cyber: '赛博', urban: '都市',
};
const BIOME_MARK = {
  grass: '草', snow: '雪', desert: '沙', cyber: '霓', urban: '都',
};
const SYNC_LABEL = {
  idle: '未开启', pending: '待同步', syncing: '同步中…',
  synced: '已同步', conflict: '冲突', error: '同步失败',
};

function relTime(iso) {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return '刚刚';
  const d = Math.max(0, Date.now() - t) / 1000;
  if (d < 60) return '刚刚';
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  if (d < 604800) return `${Math.floor(d / 86400)} 天前`;
  return new Date(t).toISOString().slice(0, 10);
}

function updateStorageBar() {
  let used = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        used += (k?.length || 0) + (localStorage.getItem(k)?.length || 0);
      }
    }
  } catch (_) { /* 存储不可用时显示 0 */ }
  const pct = Math.min(100, Math.round(used / (5 * 1024 * 1024) * 100));
  const p = $('wmStoragePct'); if (p) p.textContent = `${pct}%`;
  const fill = $('wmStorageFill'); if (fill) fill.style.width = `${pct}%`;
  const overview = $('wmSyncOverview');
  if (overview) {
    const n = listWorlds().filter(w => w.sync?.enabled).length;
    overview.textContent = n ? `云同步：${n} 个世界已开启` : '云同步：未开启';
  }
}

// 用 #wmCardTpl 渲染卡片；所有用户文本用 textContent，避免存储型 XSS。
export function renderManager() {
  initWorldManager();
  const box = $('wmWorlds');
  if (!box) return [];
  const worlds = listWorlds();
  box.querySelectorAll('[data-world-id]').forEach(el => {
    if (el.id !== 'wmNewCard') el.remove();
  });
  const tpl = $('wmCardTpl');
  worlds.forEach(w => {
    let card = null;
    if (tpl?.content?.firstElementChild) {
      card = tpl.content.firstElementChild.cloneNode(true);
    } else if (typeof document !== 'undefined') {
      card = document.createElement('article');
      card.className = 'wm-card';
      ['thumb', 'name', 'biome', 'opened', 'sync'].forEach(k => {
        const el = document.createElement('div');
        el.dataset[k] = '';
        card.appendChild(el);
      });
    }
    if (!card) return;
    card.dataset.worldId = w.id;
    const set = (sel, text) => { const el = card.querySelector(sel); if (el) el.textContent = text; };
    set('[data-name]', w.name || '未命名世界');
    set('[data-biome]', BIOME_LABEL[w.biome] || w.biome || '草原');
    set('[data-sync]', SYNC_LABEL[w.sync?.state] || '未开启');
    set('[data-thumb]', BIOME_MARK[w.biome] || '◆');
    // 缩略图按生态上色（CSS 里是 .wm-thumb[data-biome=...]，此前未写入导致卡片底色空白）
    const thumbEl = card.querySelector('[data-thumb]');
    if (thumbEl) {
      if (w.biome) thumbEl.dataset.biome = w.biome;
      // 印章文字同时写进属性：theme-v12 用 ::before{content:attr(data-thumb)} 渲染居中印章，
      // 只写 textContent 的话属性值为空，印章会是个白圆（无字）。
      thumbEl.dataset.thumb = BIOME_MARK[w.biome] || '◆';
    }
    const timeEl = card.querySelector('[data-opened]');
    if (timeEl) {
      timeEl.textContent = relTime(w.openedAt || w.updatedAt);
      if (timeEl.tagName === 'TIME') timeEl.dateTime = w.openedAt || w.updatedAt || '';
    }
    box.insertBefore(card, $('wmNewCard') || null);
  });
  const empty = $('wmEmpty');
  if (empty) empty.classList.toggle('hidden', worlds.length > 0);
  updateStorageBar();
  emit('world:list', { worlds });
  return worlds;
}

let actionsBound = false;

// 可选：绑定管理页最小动作（卡片打开 / 新建入口）。
// 若批次 B 已自行绑定，调用 showManager({ bindActions:false }) 即可跳过。
export function bindManagerActions() {
  if (actionsBound || typeof document === 'undefined') return false;
  const box = $('wmWorlds');
  if (!box) return false;
  actionsBound = true;
  box.addEventListener('click', async ev => {
    const target = ev.target?.closest?.('[data-world-id]');
    if (!target || target.id === 'wmNewCard') return;
    if (ev.target?.closest?.('[data-more]')) return; // ⋯ 菜单交给 UI 层
    const id = target.dataset.worldId;
    if (id) await openWorld(id);
  });
  ['wmCreateBtn', 'wmEmptyCreate'].forEach(id => {
    const btn = $(id);
    if (btn) btn.addEventListener('click', () => showConfig());
  });
  return true;
}

// 全屏世界管理页：替代旧 #intro 弹窗。
export function showManager(opts = {}) {
  initWorldManager();
  ['intro', 'worldConfig', 'loading'].forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
  const mgr = $('worldManager');
  if (mgr) mgr.classList.remove('hidden');
  if (opts.render !== false) renderManager();
  if (opts.bindActions !== false) bindManagerActions();
  emit('world:manager', { visible: true });
  return !!mgr;
}

export function showConfig() {
  initWorldManager();
  ['intro', 'worldManager'].forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
  const cfg = $('worldConfig');
  if (cfg) cfg.classList.remove('hidden');
  emit('world:config', { visible: true });
  return !!cfg;
}

export function hideConfig() {
  const cfg = $('worldConfig');
  if (cfg) cfg.classList.add('hidden');
  return true;
}

// 入口别名：boot() 等价于 showManager()。
export function boot() { return showManager(); }
