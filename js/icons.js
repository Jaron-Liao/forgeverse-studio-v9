// ============================================================
// icons.js — Blender 风格单色线性图标（24 网格，stroke=currentColor）
// 只替换视觉，不改按钮文字与 data-* 行为。
// ============================================================

const W = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
const E = '</svg>';

export const ICONS = {
  box:      W + '<path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>' + E,
  sphere:   W + '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="4" ry="8.5"/><path d="M3.5 12h17"/>' + E,
  capsule:  W + '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M6 12h12"/>' + E,
  cone:     W + '<path d="M12 3 20 18H4L12 3Z"/><ellipse cx="12" cy="18" rx="8" ry="2.6"/>' + E,
  cylinder: W + '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v12M19 6v12"/><ellipse cx="12" cy="18" rx="7" ry="2.8"/>' + E,
  torus:    W + '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="3.4" ry="2.1"/>' + E,
  knot:     W + '<path d="M5 6c6-4 14 0 14 6s-8 10-14 6-2-9 4-9 7 6 3 7"/>' + E,
  icosa:    W + '<path d="M12 2.5 21 8v9l-9 5.5L3 17V8l9-5.5Z"/><path d="M3 8l9 5 9-5M12 13v9.5M12 2.5V13"/>' + E,
  dodeca:   W + '<path d="M12 2.5 20.5 7v9L12 21.5 3.5 16V7L12 2.5Z"/><path d="M3.5 7l8.5 6 8.5-6M12 13v8.5"/>' + E,
  octa:     W + '<path d="M12 2.5 20.5 12 12 21.5 3.5 12 12 2.5Z"/><path d="M3.5 12h17M12 2.5v19"/>' + E,
  lathe:    W + '<path d="M9 3c4 3 4 6 1 9s-3 6 1 9M15 3c-4 3-4 6-1 9s3 6-1 9"/><path d="M7 3h10M7 21h10"/>' + E,
  spring:   W + '<path d="M4 8c0-2 3-2 3 0s-3 2-3 0M4 12c0-2 3-2 3 0s-3 2-3 0M4 16c0-2 3-2 3 0s-3 2-3 0"/><path d="M20 12H8"/>' + E,
  tree:     W + '<path d="M12 21v-6"/><path d="M12 3 6 13h12L12 3Z"/><path d="M9 10 5 16h8l-4-6Z"/>' + E,
  rock:     W + '<path d="M4 16 7 7l6-3 6 4 1 8-6 4-10-4Z"/><path d="M7 7l5 5 7-1M12 12v8"/>' + E,
  bush:     W + '<circle cx="8" cy="12" r="4"/><circle cx="15" cy="9" r="4.5"/><circle cx="16" cy="16" r="3.5"/><path d="M9 20h8"/>' + E,
  lamp:     W + '<path d="M9 21h6M12 21V9"/><path d="M7 9h10l-2-5H9L7 9Z"/><path d="M9 4V2h6v2"/>' + E,
  char:     W + '<circle cx="12" cy="5.5" r="2.5"/><path d="M6 21v-6a6 6 0 0 1 12 0v6M9 21v-4M15 21v-4"/>' + E,
  chest:    W + '<path d="M4 10h16v10H4V10Z"/><path d="M3 7h18v3H3V7ZM10 10v10M14 10v10"/><path d="M12 12v3"/>' + E,
};

/** 把 SVG 注入所有带 data-icon 的按钮（幂等） */
export function applyIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (el.querySelector('.bv-ico')) return;
    const svg = ICONS[el.dataset.icon];
    if (!svg) return;
    const span = document.createElement('span');
    span.className = 'bv-ico';
    span.innerHTML = svg;
    el.insertBefore(span, el.firstChild);
    el.classList.add('has-bv-ico');
  });
}

// ---------- 面板内通用图标：右栏 / 底栏的彩色 emoji 统一线性化 ----------
const P = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
const Q = '</svg>';
const PANEL_ICONS = {
  dot:     P + '<circle cx="12" cy="12" r="3.5"/>' + Q,
  weather: P + '<path d="M6 16a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.4 1.5A3.5 3.5 0 0 1 17 16H6Z"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/>' + Q,
  note:    P + '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>' + Q,
  user:    P + '<circle cx="12" cy="8" r="3"/><path d="M6 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/>' + Q,
  tasks:   P + '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>' + Q,
  brush:   P + '<path d="M14 4l6 6-8 8-6-6 8-8Z"/><path d="M6 12c-2 2-2 5 0 7 2 2 5 2 7 0"/>' + Q,
  terrain: P + '<path d="M3 18l6-8 4 5 3-4 5 7H3Z"/><path d="M3 18h18"/>' + Q,
  water:   P + '<path d="M12 3c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10Z"/>' + Q,
  gear:    P + '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>' + Q,
  star:    P + '<path d="m12 3 2.7 5.7 6.3.9-4.5 4.4 1 6.3L12 17.3 6.5 20.3l1-6.3L3 9.6l6.3-.9L12 3Z"/>' + Q,
  heart:   P + '<path d="M12 20S4 15 4 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20Z"/>' + Q,
  save:    P + '<path d="M4 4h13l3 3v13H4V4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>' + Q,
  folder:  P + '<path d="M3 6h6l2 2h10v11H3V6Z"/>' + Q,
  locate:  P + '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>' + Q,
  list:    P + '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>' + Q,
  sun:     P + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>' + Q,
  up:      P + '<path d="M12 20V5M7 10l5-5 5 5"/>' + Q,
  down:    P + '<path d="M12 4v15M7 14l5 5 5-5"/>' + Q,
};

const EMOJI_RE = /^\s*([\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\u2190-\u21FF\u25A0-\u25FF])\s*/u;

function guessIcon(text, el) {
  const t = (text || '').toLowerCase();
  if (/雨|雪|雾|雷|云|晴|极光|沙暴|多云|薄雾|天气/.test(t)) return 'weather';
  if (/笔记|信息台/.test(t)) return 'note';
  if (/个人信息|未登录/.test(t)) return 'user';
  if (/任务台|任务/.test(t)) return 'tasks';
  if (/草地|岩石|树皮|沙地|材质|绘画|上色/.test(t)) return 'brush';
  if (/隆起|上移|升高/.test(t)) return 'up';
  if (/下沉|降低/.test(t)) return 'down';
  if (/水源|水|挖地|地貌|地形/.test(t)) return 'terrain';
  if (/星/.test(t)) return 'star';
  if (/齿轮/.test(t)) return 'gear';
  if (/心/.test(t)) return 'heart';
  if (/保存|导出|读取|文件/.test(t)) return el.id === 'btnLoadLocalFile' ? 'folder' : 'save';
  if (/定位/.test(t)) return 'locate';
  if (/列表/.test(t)) return 'list';
  if (/选择/.test(t)) return 'dot';
  return 'dot';
}

/** 把右栏/底栏按钮与标题开头的 emoji 换成单色线性图标（幂等、不改文字） */
export function normalizePanelIcons(root = document) {
  const sel = '#rightbar button, #bottombar button, #bottombar h4, #bottombar .t-head span, #topbar button';
  root.querySelectorAll(sel).forEach(el => {
    if (el.closest('.v9-panel-close, .ic-close')) return;
    if (el.querySelector('.bv-ico')) return;
    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    const m = EMOJI_RE.exec(node.textContent);
    if (!m) return;
    const rest = node.textContent.slice(m[0].length);
    // 纯图标按钮（无文字）保留原符号、只做单色化，避免清空成空白方块
    if (!rest.trim()) { el.classList.add('bv-mono'); return; }
    node.textContent = rest;
    const span = document.createElement('span');
    span.className = 'bv-ico';
    span.innerHTML = PANEL_ICONS[guessIcon(rest, el)] || PANEL_ICONS.dot;
    el.insertBefore(span, el.firstChild);
    el.classList.add('has-bv-ico');
  });
}
