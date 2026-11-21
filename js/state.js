// 全局状态 + 事件总线 + 小工具
export const App = {
  engine: null,
  mode: 'select',          // select | paint | sculpt | terrain
  selected: null,          // 当前选中对象（记录节点）
  objects: [],             // [{id,name,root,type,kind}]
  tasks: [],
  xp: 0,
  level: 1,
  worldName: '未命名世界',
  theme: 'grass',
  settings: { grid: true, fog: true, particles: true, water: true, autoDay: false },
  brush: { color: '#ff5577', size: 1.4, strength: 0.6, erase: false, shape: 'round', soft: true },
  paintMode: 'vertex',       // vertex | texture
  texture: { size: 512, drawColor: '#5cc8ff', drawSize: 16 },
  sculpt: { mode: 'raise', size: 3, strength: 1.2 },
  biome: 'grass',
  petMood: 'idle',
  boolTarget: null,          // 布尔运算目标物体（B）
  pickingBool: false,        // 是否处于拾取布尔目标状态
  firstPerson: false,
  weather: 'clear',          // clear | rain | snow
  skyPreset: true,
};

export const bus = (() => {
  const m = new Map();
  return {
    on(e, fn) { (m.get(e) || m.set(e, []).get(e)).push(fn); },
    emit(e, ...a) { (m.get(e) || []).forEach(fn => fn(...a)); },
  };
})();

export const uid = () => 'o' + Math.random().toString(36).slice(2, 9);

// v10 专注模式：一次性跳过所有提示。状态持久化，toast 全局静默。
const FOCUS_KEY = 'v10.focus';
export function isFocusMode() {
  try { return localStorage.getItem(FOCUS_KEY) === '1'; } catch (_) { return false; }
}
export function setFocusMode(on) {
  try { on ? localStorage.setItem(FOCUS_KEY, '1') : localStorage.removeItem(FOCUS_KEY); } catch (_) {}
  bus.emit('focus:change', { on: !!on });
  return !!on;
}

export function toast(msg, ms = 1800) {
  if (isFocusMode()) return;              // v10 专注模式：静默所有提示
  const box = document.getElementById('toast');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast-i';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function addXP(n) {
  App.xp += n;
  let need = App.level * 100;
  while (App.xp >= need) {
    App.xp -= need;
    App.level++;
    need = App.level * 100;
    bus.emit('levelup', App.level);
  }
  bus.emit('xp', App.xp, App.level);
}

export function setPet(mood, text) {
  App.petMood = mood;
  const el = document.getElementById('petMood');
  const b = document.getElementById('petBubble');
  if (el) el.textContent = ({ idle: '待命', work: '建造中', happy: '超开心', warn: '提醒你' })[mood] || mood;
  if (b && text) b.textContent = text;
}

export function polyCount() {
  let n = 0;
  App.objects.forEach(o => o.root.traverse(c => {
    if (c.geometry && c.geometry.index) n += c.geometry.index.count / 3;
    else if (c.geometry) n += c.geometry.attributes.position.count / 3;
  }));
  return Math.round(n);
}

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
