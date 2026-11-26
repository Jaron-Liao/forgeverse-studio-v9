/* 创作向导引擎 v11 — 交互式路径问答
   - 每次只问 2 题；题目带 when 条件，答完动态裁剪后续路径
   - 选项标「（推荐）」；结束进入审核页，可逐项修改
   - 保留 v10 的 localStorage schema 与全部对外 API
   - 只做增量：不重建既有 DOM、不改旧 ID
*/
import { App, toast } from './state.js';
import {
  CHAPTERS, QUESTIONS, TOTAL, PALETTES, PETS, TONES,
  DEFAULTS, QUALITY_BY_DEVICE, TIME_BY_BAND, PANEL_BY_CORE,
  labelOf, isEmpty
} from './guide-data.js';

const KEY = 'fv.guide.v1';
const ROOT_ID = 'fv-guide';
const NOTE_ID = 'fv-guide-note';
const BATCH = 2;                    // 每次只问两题
const NAME_ID = 'name';             // 名字放到审核页填，不占问答轮次

/* 章节矢量图标：统一 24 网格线性描边，避免彩色 emoji 破坏绿金体系 */
const CH_SVG = {
  who: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/></svg>',
  rooms: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1.2"/><rect x="9.5" y="4" width="5" height="7" rx="1.2"/><rect x="9.5" y="13" width="5" height="7" rx="1.2"/><rect x="16" y="4" width="5" height="16" rx="1.2"/></svg>',
  skin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h2.2c1.6 0 2.4-1.2 2.4-2.4 0-1.4-1-2.1-1-3.2 0-1.2.9-2 2.2-2H20a2 2 0 0 0 2-2A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 10v4M5 12h4M16 11h.01M18.5 13.5h.01"/></svg>',
  tune: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
  start: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/><path d="M5 5v14"/></svg>'
};

let S = { answers: {}, skippedIds: [], done: false, skippedAll: false, hinted: false, introSeen: false, updatedAt: 0 };
let cursor = 0;                     // 当前组在 flow 中的起始下标
let view = 'intro';                 // intro | wizard | review | settings
let open = false;
let locked = false;
let lastFocus = null;
let bound = false;
let autoTimer = null;
let perf = { lastSkipMs: 0, lastFlowLen: 0 };

/* ---------------- 存储 ---------------- */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return;
    S.answers = (p.answers && typeof p.answers === 'object') ? p.answers : {};
    S.skippedIds = Array.isArray(p.skippedIds) ? p.skippedIds : [];
    S.done = !!p.done;
    S.skippedAll = !!p.skippedAll;
    S.hinted = !!p.hinted;
    S.introSeen = !!p.introSeen;
    S.updatedAt = p.updatedAt || 0;
  } catch (_) { /* 隐私模式：用内存态 */ }
}
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* 忽略 */ }
}

/* ---------------- 工具 ---------------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function byId(id) { return document.getElementById(id); }
function answeredOf(q) { return !isEmpty(S.answers[q.id]); }

/* 关键：条件判断只看「用户真正答过的值」，不吞默认值，
   否则 DEFAULTS.scene='all' 会让所有依赖场景的题都被判为需要问。 */
function activeFlow() {
  return QUESTIONS.filter(q =>
    q.id !== NAME_ID && (!q.when || q.when(S.answers) || answeredOf(q)));
}
function flowIndex(id) { return activeFlow().findIndex(q => q.id === id); }
function batchOf() { return activeFlow().slice(cursor, cursor + BATCH); }
function batchDone(list) { return list.every(q => answeredOf(q) || S.skippedIds.indexOf(q.id) > -1); }
function pendingCount() { return activeFlow().filter(q => !answeredOf(q) && S.skippedIds.indexOf(q.id) < 0).length; }

/* 作答 + 安全默认 = 最终配置；永不出现空值 */
function resolve() {
  const out = {};
  QUESTIONS.forEach(q => {
    const v = S.answers[q.id];
    if (isEmpty(v)) {
      out[q.id] = Array.isArray(DEFAULTS[q.id]) ? DEFAULTS[q.id].slice() : DEFAULTS[q.id];
    } else {
      out[q.id] = Array.isArray(v) ? v.slice() : v;
    }
  });
  if (isEmpty(out.name)) out.name = '我的造物世界';
  return out;
}

function resolveLight(light) {
  if (light !== 'auto') return light || 'day';
  const h = new Date().getHours();
  return (h >= 7 && h < 18) ? 'day' : (h < 21 ? 'dusk' : 'night');
}

/* ---------------- 应用配置到工作区（沿用 v10） ---------------- */
const THEME_TOKENS = {
  day: null,
  dusk: {
    '--bg': '#F3F5EF', '--panel': 'rgba(255,253,248,.94)', '--panel2': 'rgba(240,244,236,.96)',
    '--txt': '#16261E', '--sub': '#4E6157', '--line': 'rgba(11,107,75,.22)'
  },
  night: {
    '--bg': '#0B1712', '--panel': 'rgba(18,36,28,.94)', '--panel2': 'rgba(14,29,23,.96)',
    '--txt': '#E7F3ED', '--sub': '#9DB6AA', '--line': 'rgba(159,220,198,.22)'
  }
};

function applyConfig(cfg, opts) {
  const options = opts || {};
  const pal = PALETTES[cfg.palette] || PALETTES.emerald;
  const light = resolveLight(cfg.light);
  const root = document.documentElement;

  root.style.setProperty('--acc', pal.accent);
  root.style.setProperty('--gold', pal.accent);
  root.style.setProperty('--gold2', pal.accent2);
  root.style.setProperty('--gold-deep', pal.deep);
  root.style.setProperty('--gold-glow', hexA(pal.accent, .3));
  root.style.setProperty('--mint', pal.accent2);
  root.style.setProperty('--ok', pal.accent);
  root.style.setProperty('--accent-ink', pal.a11y);

  const tokens = THEME_TOKENS[light];
  Object.keys(THEME_TOKENS.dusk).forEach(k => { if (!tokens || !(k in tokens)) root.style.removeProperty(k); });
  if (tokens) Object.keys(tokens).forEach(k => root.style.setProperty(k, tokens[k]));

  document.body.dataset.fvTheme = light;
  document.body.dataset.fvTex = cfg.texture || 'soft';
  document.body.dataset.fvMotion = cfg.motion || 'normal';
  document.body.dataset.fvDensity = cfg.density || 'three';
  document.body.classList.toggle('fv-no-xp', cfg.xp === 'no');
  document.body.classList.toggle('fv-no-badge', cfg.badge === 'no');
  document.body.classList.toggle('fv-no-combo', cfg.combo === 'no');
  document.body.classList.toggle('fv-hud-lite', cfg.statdepth === 'lite');
  document.body.classList.toggle('fv-hud-full', cfg.statdepth === 'full');
  document.body.classList.toggle('fv-task-board', cfg.taskview === 'board');
  document.body.classList.toggle('fv-quiet', cfg.remind === 'none' || cfg.punish === 'none');

  const pet = PETS[cfg.pet] || PETS.dragon;
  const petEl = byId('pet');
  if (petEl) {
    petEl.textContent = pet.emoji;
    petEl.title = pet.name;
    petEl.style.filter = `drop-shadow(0 0 12px ${hexA(pet.glow, .55)})`;
  }
  const petName = document.querySelector('.pet-name');
  if (petName) petName.innerHTML = `${esc(pet.name)} · <span id="petMood">待命</span>`;

  if (cfg.name) {
    App.worldName = cfg.name;
    const wc = byId('wcName');
    if (wc && (!wc.dataset.touched || wc.value === '' || wc.value === '未命名世界')) wc.value = cfg.name;
    const wn = byId('worldName');
    if (wn && (!wn.dataset.touched || wn.value === '' || wn.value === '未命名世界')) wn.value = cfg.name;
  }

  const detail = {
    cfg,
    panels: panelPlan(cfg),
    quality: QUALITY_BY_DEVICE[cfg.device] || 'high',
    time: (TIME_BY_BAND[cfg.timeband] ?? 55) / 100,
    heavy: options.heavy !== false
  };
  if (options.defer) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => emitApply(detail));
    else setTimeout(() => emitApply(detail), 0);
  } else emitApply(detail);
  return cfg;
}

function emitApply(detail) {
  try { window.dispatchEvent(new CustomEvent('fv:guide-apply', { detail })); } catch (_) { /* 旧浏览器 */ }
}

function panelPlan(cfg) {
  const core = cfg.core || [];
  const show = { left: false, right: false, bottom: false };
  core.forEach(k => { const p = PANEL_BY_CORE[k]; if (p) show[p] = true; });
  if (!show.left && !show.right && !show.bottom) show.bottom = true;
  if (cfg.hero === 'tasks' || cfg.hero === 'stat') show.bottom = true;
  return Object.assign({}, show, {
    minimap: core.indexOf('minimap') > -1 || ['week', 'heat', 'trend', 'full'].indexOf(cfg.statdepth) > -1,
    hud: core.indexOf('hud') > -1 || cfg.statdepth !== 'lite',
    search: core.indexOf('search') > -1
  });
}

/* ---------------- 跳过全部 ---------------- */
function skipAll(reason) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const missing = activeFlow().filter(q => !answeredOf(q)).length;
  const cfg = resolve();
  S.done = true; S.skippedAll = true;
  save();
  applyConfig(cfg, { defer: true });
  closeGuide({ silent: true });
  if (reason !== 'boot') toast(`已用推荐配置进入 · ${missing} 项未答 · 随时可补填`);
  showHint(missing);
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  perf.lastSkipMs = Math.round((t1 - t0) * 100) / 100;
  return cfg;
}

/* ---------------- 轻提示 ---------------- */
function showHint(missing) {
  if (S.hinted) return;
  const host = byId('app');
  if (!host) return;
  let bar = byId(NOTE_ID);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = NOTE_ID;
    bar.className = 'gv-note';
    bar.setAttribute('role', 'status');
    host.appendChild(bar);
  }
  bar.innerHTML = `
    <span class="gv-note-ico" aria-hidden="true">⏭</span>
    <span class="gv-note-txt">已用推荐配置进入${missing > 0 ? `（${missing} 项未答）` : ''}，可随时修改。</span>
    <button type="button" class="gv-note-act" data-act="fill">去查看</button>
    <button type="button" class="gv-note-x" data-act="dismiss" aria-label="关闭提示">✕</button>`;
  bar.hidden = false;
  bar.onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fill') { bar.hidden = true; S.hinted = true; save(); openGuide('review'); }
    if (act === 'dismiss') { bar.hidden = true; S.hinted = true; save(); }
  };
  setTimeout(() => { if (bar && !bar.hidden) bar.classList.add('gv-note--fade'); }, 8000);
}

/* ---------------- 渲染 ---------------- */
function ensureRoot() {
  let root = byId(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'fv-guide';
    root.hidden = true;
    (byId('app') || document.body).appendChild(root);
  }
  if (!bound) {
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    bound = true;
  }
  return root;
}

function frame(bodyHTML, progress, footerHTML) {
  const flowLen = activeFlow().length;
  const ans = activeFlow().filter(answeredOf).length;
  const pct = flowLen ? Math.round(ans / flowLen * 100) : 0;
  const label = view === 'wizard'
    ? `第 ${Math.floor(cursor / BATCH) + 1} / ${Math.ceil(flowLen / BATCH)} 组`
    : `${ans} / ${flowLen} 项`;
  return `
    <div class="gv-shell" role="dialog" aria-modal="true" aria-labelledby="gv-title">
      <header class="gv-head">
        <div class="gv-brand">
          <span class="gv-mark" aria-hidden="true">◆</span>
          <div class="gv-brand-txt">
            <b id="gv-title">创作向导</b>
            <small>按需提问 · 自动跳过无关项</small>
          </div>
        </div>
        ${progress ? `
        <div class="gv-progress">
          <div class="gv-bar"><i style="width:${pct}%"></i></div>
          <span class="gv-count">${label}</span>
        </div>` : '<div class="gv-progress"></div>'}
        <div class="gv-head-actions">
          <button type="button" class="gv-btn gv-btn--skip" data-act="skip-all">跳过全部</button>
          <button type="button" class="gv-icon" data-act="close" aria-label="关闭" title="关闭（Esc）">✕</button>
        </div>
      </header>
      ${bodyHTML}
      ${footerHTML ? `<footer class="gv-foot gv-foot--review">${footerHTML}</footer>` : ''}
    </div>`;
}

function introHTML() {
  const flowLen = activeFlow().length;
  return frame(`
    <div class="gv-body gv-body--intro">
      <div class="gv-intro">
        <h2 class="gv-intro-h">几步配置你的工作区</h2>
        <p class="gv-intro-p">只问与你有关系的问题。每次 2 题，答完自动跳过无关项，最后可以逐项检查。</p>
        <div class="gv-intro-meta"><span>${flowLen} 个必要问题</span><span>约 30 秒</span><span>可随时修改</span></div>
        <div class="gv-intro-actions">
          <button type="button" class="gv-btn gv-btn--primary gv-btn--lg" data-act="start">开始</button>
          <button type="button" class="gv-btn gv-btn--ghost gv-btn--lg" data-act="skip-all">用推荐配置进入</button>
        </div>
      </div>
    </div>`, false);
}

function miniLayout(cfg) {
  const core = cfg.core || [];
  const on = k => (core.indexOf(k) > -1 ? 'on' : '');
  return `<div class="gv-mini" aria-hidden="true">
    <div class="gv-mini-l ${on('assets')}"></div>
    <div class="gv-mini-c"></div>
    <div class="gv-mini-r ${on('inspector')}"></div>
    <div class="gv-mini-b ${on('console')}"></div>
    <div class="gv-mini-tag">面板预览</div>
  </div>`;
}

function isRecommended(q, v) {
  if (!q.rec) return false;
  return Array.isArray(q.rec) ? q.rec.indexOf(v) > -1 : q.rec === v;
}

function fieldHTML(q) {
  if (q.type === 'text') {
    const val = S.answers[q.id] || '';
    return `<input id="gv-text" class="gv-text" type="text" maxlength="24"
      placeholder="${esc(q.placeholder || DEFAULTS[q.id])}" value="${esc(val)}" autocomplete="off" />`;
  }
  const cur = S.answers[q.id];
  const sel = q.type === 'multi' ? (Array.isArray(cur) ? cur : []) : [cur];
  return `<div class="gv-opts gv-opts--${q.type}">${q.options.map((o, i) => `
    <button type="button" class="gv-opt ${sel.indexOf(o.v) > -1 ? 'on' : ''}"
      data-v="${esc(o.v)}" data-i="${i}" aria-pressed="${sel.indexOf(o.v) > -1}">
      <span class="gv-emo" aria-hidden="true">${o.e}</span>
      <span class="gv-opt-txt"><b>${esc(o.l)}${isRecommended(q, o.v) ? '<em class="gv-rec">（推荐）</em>' : ''}</b></span>
      <span class="gv-tick" aria-hidden="true">${q.type === 'multi' ? '✓' : '●'}</span>
    </button>`).join('')}</div>`;
}

function wizardHTML() {
  const list = batchOf();
  if (!list.length) return reviewHTML();

  const cards = list.map(q => `
    <section class="gv-qcard" data-id="${q.id}">
      <div class="gv-qtop"><span class="gv-qico">${CH_SVG[q.chapter] || CH_SVG.start}</span>
        <span class="gv-qtag">${esc((CHAPTERS.find(c => c.id === q.chapter) || {}).name || '配置')}</span>
        ${q.rec ? '<span class="gv-qrec">有推荐值</span>' : ''}</div>
      <h3 class="gv-q">${esc(q.title)}</h3>
      <div class="gv-field">${fieldHTML(q)}</div>
    </section>`).join('');

  return frame(`
    <div class="gv-body gv-body--wizard">
      <div class="gv-qgroup">${cards}</div>
    </div>`, true, `
      <button type="button" class="gv-btn gv-btn--ghost" data-act="prev" ${cursor === 0 ? 'disabled' : ''}>上一组</button>
      <button type="button" class="gv-btn gv-btn--text" data-act="review">跳到审核</button>
      <button type="button" class="gv-btn gv-btn--ghost" data-act="skip-group">跳过这组</button>
      <button type="button" class="gv-btn gv-btn--primary" data-act="next">下一组 →</button>`);
}

/* ---------- 个性化路线 + 推荐回答 ---------- */
function buildRoute(cfg) {
  const scenes = { work: '工作项目', study: '学习创作', life: '生活整理', indie: '独立游戏', team: '团队协作', all: '综合全能' };
  const pains = { delay: '拖延启动', forget: '总是忘事', focus: '容易分心', nofb: '缺少反馈', mess: '场景太杂', noreview: '缺少复盘' };
  const mods = panelPlan(cfg);
  const panels = [mods.left && '资产库', mods.right && '检查器', mods.bottom && '操作台'].filter(Boolean);
  const pal = PALETTES[cfg.palette] || PALETTES.emerald;
  const pet = PETS[cfg.pet] || PETS.dragon;
  const gamified = cfg.xp !== 'no' || cfg.badge !== 'no';

  const steps = [
    { n: '01', k: 'who', t: '定位', d: `${scenes[cfg.scene] || '综合'} · ${pains[cfg.pain] || '专注'}` },
    { n: '02', k: 'rooms', t: '面板', d: panels.join(' + ') || '操作台' },
    { n: '03', k: 'skin', t: '外观', d: `${pal.name} · ${pet.name} · ${labelOf('light', cfg.light)}` },
  ];
  if (gamified) steps.push({ n: '04', k: 'play', t: '反馈', d: `等级 ${cfg.xp === 'yes' ? '开' : '关'} · 徽章 ${cfg.badge === 'yes' ? '开' : '关'}` });
  steps.push({ n: String(steps.length + 1).padStart(2, '0'), k: 'start', t: '开始', d: cfg.name });

  const advice = `建议从「${scenes[cfg.scene] || '综合'}」起步，先打开 ${panels.join('、') || '操作台'}；` +
    `外观用${pal.name}配${pet.name}，${labelOf('light', cfg.light)}光照。` +
    (gamified ? '保留等级与徽章，让进度看得见。' : '先不启用游戏化，把注意力留给场景本身。');

  return { steps, advice };
}

function reviewHTML() {
  const cfg = resolve();
  const flow = activeFlow();
  const route = buildRoute(cfg);
  const CN = ['壹', '贰', '叁', '肆', '伍'];
  const groups = CHAPTERS.map((c, ci) => {
    const qs = flow.filter(q => q.chapter === c.id);
    if (!qs.length) return '';
    return `<section class="gv-set-group">
      <h3 class="gv-set-h"><span class="gv-ch-n" aria-hidden="true">${CN[ci] || ci + 1}</span> ${c.name}<small>${qs.length} 项</small></h3>
      ${qs.map(q => {
        const has = answeredOf(q);
        const raw = cfg[q.id];
        const val = Array.isArray(raw) ? (raw.map(v => labelOf(q.id, v)).join(' · ') || '—') : labelOf(q.id, raw);
        return `<div class="gv-set-row ${has ? '' : 'miss'}">
          <span class="gv-set-k">${esc(q.title.replace(/[？?].*$/, ''))}</span>
          <span class="gv-set-v">${has ? '' : '<em class="gv-badge-miss">推荐</em>'}${esc(val)}</span>
          <button type="button" class="gv-set-btn" data-act="jump" data-id="${q.id}">修改</button>
        </div>`;
      }).join('')}
    </section>`;
  }).join('');

  const skipped = TOTAL - 1 - flow.length;

  return frame(`
    <div class="gv-body gv-body--review">
      <div class="gv-review">
        <div class="gv-rv-head">
          <h2>确认你的配置</h2>
          <p>下面是根据你的回答生成的路线。任何一项都可以点「修改」回到对应问题。</p>
        </div>
        <div class="gv-route">
          ${route.steps.map(s => `<div class="gv-route-step"><span class="gv-ri">${CH_SVG[s.k] || CH_SVG.start}</span><i>${s.n}</i><div><b>${esc(s.t)}</b><span>${esc(s.d)}</span></div></div>`).join('')}
        </div>
        <div class="gv-advice"><span class="gv-advice-tag">推荐方案</span><p>${esc(route.advice)}</p></div>
        <div class="gv-name-row">
          <label for="gv-review-name">世界名称</label>
          <input id="gv-review-name" class="gv-text" type="text" maxlength="24" value="${esc(cfg.name)}" />
        </div>
        <div class="gv-set-list">${groups}</div>
        ${skipped > 0 ? `<p class="gv-skipped">另有 ${skipped} 项与你无关，已自动跳过并采用推荐值。</p>` : ''}
      </div>
    </div>`, true, `
      <button type="button" class="gv-btn gv-btn--primary gv-btn--lg" data-act="build">确认并应用</button>
      <button type="button" class="gv-btn gv-btn--ghost" data-act="export">导出配置</button>
      <button type="button" class="gv-btn gv-btn--text" data-act="restart">重新回答</button>`);
}

/* settings 入口直接进审核页，避免两套列表 */
function settingsHTML() { return reviewHTML(); }

function paint() {
  if (!open) return;
  const root = ensureRoot();
  root.hidden = false;
  root.dataset.view = view;
  const cfg = resolve();
  root.dataset.light = resolveLight(cfg.light);
  root.dataset.tex = cfg.texture;
  root.dataset.density = cfg.density;
  root.dataset.motion = cfg.motion;
  // 重绘前记住滚动位置：换组 / 跳回审核时不再把用户带回顶部
  const keepScroll = [...root.querySelectorAll('.gv-body, .gv-set-list')].map(el => el.scrollTop);
  root.innerHTML = view === 'intro' ? introHTML()
    : view === 'review' || view === 'settings' ? reviewHTML()
      : wizardHTML();
  [...root.querySelectorAll('.gv-body, .gv-set-list')].forEach((el, i) => {
    if (keepScroll[i] != null) el.scrollTop = keepScroll[i];
  });

  const target = view === 'wizard'
    ? root.querySelector('.gv-opt, #gv-text')
    : root.querySelector('.gv-intro-actions .gv-btn, .gv-rv-actions .gv-btn');
  if (target && open) {
    try { target.focus({ preventScroll: true }); } catch (_) { /* 忽略 */ }
  }
  perf.lastFlowLen = activeFlow().length;
}

/* ---------------- 交互 ---------------- */
function onClick(e) {
  const el = e.target.closest('[data-act], .gv-opt');
  if (!el) return;
  if (el.classList.contains('gv-opt')) { pickOption(el); return; }

  switch (el.dataset.act) {
    case 'start':
      cursor = 0; view = 'wizard'; paint();
      break;
    case 'skip-all':
      skipAll('user');
      break;
    case 'close':
      closeGuide();
      break;
    case 'prev':
      if (cursor >= BATCH) { cursor -= BATCH; paint(); }
      break;
    case 'next':
      advance();
      break;
    case 'skip-group':
      batchOf().forEach(q => {
        delete S.answers[q.id];
        if (S.skippedIds.indexOf(q.id) < 0) S.skippedIds.push(q.id);
      });
      save(); advance();
      break;
    case 'review':
      syncName(); view = 'review'; paint();
      break;
    case 'restart':
      S.answers = {}; S.skippedIds = []; S.done = false; S.skippedAll = false;
      save(); cursor = 0; view = 'wizard'; paint();
      break;
    case 'jump':
      jumpTo(el.dataset.id);
      break;
    case 'build':
      buildWorld();
      break;
    case 'export':
      exportConfig();
      break;
    default: break;
  }
}

function onInput(e) {
  if (!e.target) return;
  if (e.target.id === 'gv-text') {
    const list = batchOf();
    const q = list.find(x => x.type === 'text');
    if (!q) return;
    const v = e.target.value.trim();
    if (v) S.answers[q.id] = v; else delete S.answers[q.id];
    save();
    return;
  }
  if (e.target.id === 'gv-review-name') {
    const v = e.target.value.trim();
    if (v) S.answers[NAME_ID] = v; else delete S.answers[NAME_ID];
    save();
  }
}

function syncName() {
  const el = byId('gv-review-name');
  if (!el) return;
  const v = el.value.trim();
  if (v) S.answers[NAME_ID] = v; else delete S.answers[NAME_ID];
  save();
}

/* 只更新进度条文案，不重建 DOM —— 避免滚动位置被重置 */
function refreshProgress() {
  const host = byId(ROOT_ID);
  if (!host) return;
  const flow = activeFlow();
  const ans = flow.filter(answeredOf).length;
  const pct = flow.length ? Math.round(ans / flow.length * 100) : 0;
  const bar = host.querySelector('.gv-bar i');
  if (bar) bar.style.width = pct + '%';
  const label = view === 'wizard'
    ? `第 ${Math.floor(cursor / BATCH) + 1} / ${Math.ceil(flow.length / BATCH)} 组`
    : `${ans} / ${flow.length} 项`;
  const cnt = host.querySelector('.gv-count');
  if (cnt) cnt.textContent = label;
}

function pickOption(btn) {
  if (locked) return;
  const card = btn.closest('[data-id]');
  const q = batchOf().find(x => x.id === card?.dataset.id);
  if (!q || !q.options) return;
  const v = btn.dataset.v;
  let cur = [];

  if (q.type === 'multi') {
    cur = Array.isArray(S.answers[q.id]) ? S.answers[q.id].slice() : [];
    const at = cur.indexOf(v);
    if (at > -1) cur.splice(at, 1);
    else if (q.max && cur.length >= q.max) {
      if (v === 'none') cur = ['none'];
      else {
        cur = cur.filter(x => x !== 'none');
        if (cur.length >= q.max) cur.shift();
        cur.push(v);
      }
    } else cur.push(v);
    if (cur.length) S.answers[q.id] = cur; else delete S.answers[q.id];
  } else {
    S.answers[q.id] = v;
    cur = [v];
  }
  S.skippedIds = S.skippedIds.filter(x => x !== q.id);
  save();

  // 局部更新选中态：整棵 innerHTML 重建会让滚动容器 scrollTop 归零，
  // 表现为「下滑一点就自动弹回顶部」，必须避免。
  if (q.type === 'multi') {
    const on = cur.indexOf(v) > -1;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  } else if (card) {
    card.querySelectorAll('.gv-opt').forEach(o => {
      const on = o === btn;
      o.classList.toggle('on', on);
      o.setAttribute('aria-pressed', String(on));
    });
  }
  refreshProgress();
}

function advance() {
  // 文本题在离开本组前收口
  batchOf().forEach(q => {
    if (q.type !== 'text') return;
    const t = document.querySelector(`[data-id="${q.id}"] #gv-text`);
    const v = t ? t.value.trim() : (S.answers[q.id] || '');
    if (v) S.answers[q.id] = v;
  });
  const flow = activeFlow();
  cursor += BATCH;
  if (cursor >= flow.length) { syncName(); view = 'review'; }
  save();
  paint();
}

function jumpTo(id) {
  const at = flowIndex(id);
  if (at < 0) { toast('该项已按推荐值处理'); return; }
  cursor = Math.floor(at / BATCH) * BATCH;
  view = 'wizard';
  paint();
}

function buildWorld() {
  syncName();
  const cfg = resolve();
  S.done = true; S.skippedAll = false;
  save();
  applyConfig(cfg, { defer: true });
  closeGuide({ silent: true });
  toast('配置已生效 · 可在顶栏「向导」修改');
}

function exportConfig() {
  syncName();
  const cfg = resolve();
  const data = {
    app: 'ForgeVerse', version: 'v11', exportedAt: new Date().toISOString(),
    raw: S.answers, resolved: cfg, flow: activeFlow().map(q => q.id)
  };
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'forgeverse-guide-config.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('已导出配置文件');
  } catch (_) { toast('当前环境不支持导出'); }
}

/* ---------------- 开关 ---------------- */
export function openGuide(mode) {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  load();
  const root = ensureRoot();
  lastFocus = document.activeElement;
  open = true;
  document.body.classList.add('fv-guide-open');
  if (mode === 'review' || mode === 'settings') view = 'review';
  else if (mode === 'wizard') { cursor = Math.floor(Math.max(0, flowIndex(firstPending())) / BATCH) * BATCH; view = 'wizard'; }
  else view = S.done ? 'review' : 'intro';
  paint();
  root.hidden = false;
  refreshEntry();
  const bar = byId(NOTE_ID); if (bar) bar.hidden = true;
}

function firstPending() {
  const q = activeFlow().find(x => !answeredOf(x) && S.skippedIds.indexOf(x.id) < 0);
  return q ? q.id : '';
}

export function closeGuide(opts) {
  const options = opts || {};
  open = false;
  if (!S.done) S.introSeen = true;
  save();
  const root = byId(ROOT_ID);
  if (root) { root.hidden = true; root.innerHTML = ''; }
  document.body.classList.remove('fv-guide-open');
  refreshEntry();
  if (lastFocus && typeof lastFocus.focus === 'function') {
    try { lastFocus.focus({ preventScroll: true }); } catch (_) { /* 忽略 */ }
  }
  if (!options.silent) {
    const missing = pendingCount();
    if (missing > 0) showHint(missing);
  }
}

function refreshEntry() {
  const btn = byId('fv-guide-open');
  if (btn) btn.classList.toggle('has-new', !S.done);
}

export function getGuideConfig() { return resolve(); }
export function isGuideDone() { return !!S.done; }

/* ---------------- 键盘 ---------------- */
function onKeyDown(e) {
  if (!open) return;
  const tag = (e.target && e.target.tagName) || '';
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeGuide(); return; }
  if (view !== 'wizard' || typing) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9 && byId(ROOT_ID)?.querySelector(`.gv-opt[data-i="${n - 1}"]`)) {
    e.preventDefault(); e.stopPropagation();
    byId(ROOT_ID).querySelector(`.gv-opt[data-i="${n - 1}"]`).click();
    return;
  }
  if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); advance(); return; }
  if (e.key === 'ArrowLeft' && cursor >= BATCH) { e.preventDefault(); e.stopPropagation(); cursor -= BATCH; paint(); return; }
  if (['w', 'W', 'e', 'E', 'r', 'R', 'Delete', 'Backspace'].indexOf(e.key) > -1) e.stopPropagation();
}

/* ---------------- 初始化 ---------------- */
export function initGuide() {
  load();
  ensureRoot();
  const touched = Object.keys(S.answers).length > 0 || S.done;
  if (touched) {
    try { applyConfig(resolve(), { defer: true }); } catch (err) { console.warn('[guide] 恢复配置失败', err); }
  }

  const openBtn = byId('fv-guide-open');
  if (openBtn) {
    openBtn.onclick = () => openGuide();
    openBtn.classList.toggle('has-new', !S.done);
  }
  const wmSettings = byId('wmSettings');
  if (wmSettings && !wmSettings.dataset.guideBound) {
    wmSettings.dataset.guideBound = '1';
    wmSettings.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); openGuide('review'); }, true);
  }
  ['wcName', 'worldName'].forEach(id => {
    const el = byId(id);
    if (el && !el.dataset.guideBound) {
      el.dataset.guideBound = '1';
      el.addEventListener('input', () => { el.dataset.touched = '1'; });
    }
  });

  document.addEventListener('keydown', onKeyDown, true);
  const auto = !S.done && !S.skippedAll && !S.introSeen;
  if (auto) {
    let focused = false;
    try { focused = localStorage.getItem('v10.focus') === '1'; } catch (_) {}
    if (!focused) autoTimer = setTimeout(() => { autoTimer = null; if (!S.done) openGuide('intro'); }, 700);
  }

  window.__fvGuidePerf = perf;
  return { open: openGuide, close: closeGuide, getConfig: getGuideConfig, perf };
}
