/* 创作向导引擎（v10 融合）
   - 30 问分步引导 + 每步可跳过 + 一键「跳过全部」（保留已答，其余落安全默认）
   - localStorage 持久化，设置入口可随时补填
   - 只做增量：不重建 DOM、不改既有 ID，样式全部走 CSS 变量与新增类名
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

let S = { answers: {}, skippedIds: [], done: false, skippedAll: false, hinted: false, introSeen: false, updatedAt: 0 };
let idx = 0;
let view = 'intro';         // intro | wizard | result | settings
let open = false;
let locked = false;
let lastFocus = null;
let bound = false;
let autoTimer = null;
let perf = { lastSkipMs: 0 };

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
  } catch (_) { /* 隐私模式 / 存储不可用 → 用内存态 */ }
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

function countAnswered() {
  return QUESTIONS.filter(q => !isEmpty(S.answers[q.id])).length;
}
function answeredOf(q) { return !isEmpty(S.answers[q.id]); }

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

/* ---------------- 应用配置到工作区 ---------------- */
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

  // 绿色家族：只覆盖强调色变量，变量名与 3d.css 完全一致
  root.style.setProperty('--acc', pal.accent);
  root.style.setProperty('--gold', pal.accent);
  root.style.setProperty('--gold2', pal.accent2);
  root.style.setProperty('--gold-deep', pal.deep);
  root.style.setProperty('--gold-glow', hexA(pal.accent, .3));
  root.style.setProperty('--mint', pal.accent2);
  root.style.setProperty('--ok', pal.accent);
  root.style.setProperty('--accent-ink', pal.a11y);

  // 深浅模式：day 还原 3d.css 原生值，dusk/night 覆写底层面板变量
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

  // 造物精灵：只替换文本与光晕，不改节点结构
  const pet = PETS[cfg.pet] || PETS.dragon;
  const petEl = byId('pet');
  if (petEl) {
    petEl.textContent = pet.emoji;
    petEl.title = pet.name;
    petEl.style.filter = `drop-shadow(0 0 12px ${hexA(pet.glow, .55)})`;
  }
  const petName = document.querySelector('.pet-name');
  if (petName) petName.innerHTML = `${esc(pet.name)} · <span id="petMood">待命</span>`;

  // 世界名：只写默认值，不覆盖用户已改过的输入
  if (cfg.name) {
    App.worldName = cfg.name;
    const wc = byId('wcName');
    if (wc && (!wc.dataset.touched || wc.value === '' || wc.value === '未命名世界')) wc.value = cfg.name;
    const wn = byId('worldName');
    if (wn && (!wn.dataset.touched || wn.value === '' || wn.value === '未命名世界')) wn.value = cfg.name;
  }

  // 轻量部分立即生效；重量级（后处理管线 / 面板 / 灯光）交给主模块异步执行
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
  } else {
    emitApply(detail);
  }
  return cfg;
}

function emitApply(detail) {
  try { window.dispatchEvent(new CustomEvent('fv:guide-apply', { detail })); } catch (_) { /* 老旧浏览器 */ }
}

/* 面板计划：核心面板决定三栏，视野/性能类决定附加块 */
function panelPlan(cfg) {
  const core = cfg.core || [];
  const show = { left: false, right: false, bottom: false };
  core.forEach(k => { const p = PANEL_BY_CORE[k]; if (p) show[p] = true; });
  if (!show.left && !show.right && !show.bottom) show.bottom = true; // 安全默认：至少留一块
  if (cfg.hero === 'tasks' || cfg.hero === 'stat') show.bottom = true;
  return Object.assign({}, show, {
    minimap: core.indexOf('minimap') > -1 || (cfg.statdepth === 'week' || cfg.statdepth === 'heat' || cfg.statdepth === 'trend' || cfg.statdepth === 'full'),
    hud: core.indexOf('hud') > -1 || cfg.statdepth !== 'lite',
    search: core.indexOf('search') > -1
  });
}

/* ---------------- 跳过全部（同步、可测速） ---------------- */
function skipAll(reason) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const missing = QUESTIONS.filter(q => !answeredOf(q)).length;
  const cfg = resolve();
  S.done = true;
  S.skippedAll = true;
  save();
  applyConfig(cfg, { defer: true });   // 重的部分放下一帧，保证点击即返回
  closeGuide({ silent: true });
  if (reason !== 'boot') {
    toast(`已按默认设定跳过 ${missing} 个问题 · 随时可在「向导」补填`);
  }
  showHint(missing);
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  perf.lastSkipMs = Math.round((t1 - t0) * 100) / 100;
  return cfg;
}

/* ---------------- 可关闭的轻提示 ---------------- */
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
    <span class="gv-note-txt">已用默认设定进入工作区${missing > 0 ? `（${missing} 项未填）` : ''}，可随时补填。</span>
    <button type="button" class="gv-note-act" data-act="fill">去补填</button>
    <button type="button" class="gv-note-x" data-act="dismiss" aria-label="关闭提示">✕</button>`;
  bar.hidden = false;
  bar.onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fill') { bar.hidden = true; S.hinted = true; save(); openGuide('settings'); }
    if (act === 'dismiss') { bar.hidden = true; S.hinted = true; save(); }
  };
  // 8 秒后自动淡出，但不写入「已读」，下次仍可提示
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
    root.addEventListener('change', onChange);
    bound = true;
  }
  return root;
}

function frame(bodyHTML, showProgress) {
  const answered = countAnswered();
  const pct = Math.round(answered / TOTAL * 100);
  return `
    <div class="gv-shell" role="dialog" aria-modal="true" aria-labelledby="gv-title">
      <header class="gv-head">
        <div class="gv-brand">
          <span class="gv-mark" aria-hidden="true">◆</span>
          <div class="gv-brand-txt">
            <b id="gv-title">创作向导</b>
            <small>30 问 · 拼出你的 3D 工作区</small>
          </div>
        </div>
        ${showProgress ? `
        <div class="gv-progress">
          <div class="gv-bar"><i style="width:${pct}%"></i></div>
          <span class="gv-count">已答 <b>${answered}</b>/${TOTAL}</span>
        </div>` : '<div class="gv-progress"></div>'}
        <div class="gv-head-actions">
          <button type="button" class="gv-btn gv-btn--skip" data-act="skip-all">
            <span aria-hidden="true">⏭</span> 跳过全部
          </button>
          <button type="button" class="gv-icon" data-act="close" aria-label="关闭向导" title="关闭（Esc）">✕</button>
        </div>
      </header>
      ${bodyHTML}
    </div>`;
}

function introHTML() {
  const cfg = resolve();
  const pet = PETS[cfg.pet] || PETS.dragon;
  return frame(`
    <div class="gv-body gv-body--intro">
      <div class="gv-intro">
        <div class="gv-intro-pet" aria-hidden="true">${pet.emoji}</div>
        <h2 class="gv-intro-h">先花 <em>30 秒</em>，让工作区长成你的样子</h2>
        <p class="gv-intro-p">场景、面板、绿系皮肤、玩法开关。全答完会生成一套配置；
          不想答也没关系——点「跳过全部」立刻用一套安全默认值进入，之后在任何时候补填。</p>
        <div class="gv-chips">
          <span class="gv-chip">30 道问答题</span>
          <span class="gv-chip">6 类面板</span>
          <span class="gv-chip">6 套绿系皮肤</span>
          <span class="gv-chip">6 只造物精灵</span>
        </div>
        <div class="gv-steps">
          <div class="gv-step"><i>1</i><div><b>认识你</b><span>场景、痛点、设备、投入时间</span></div></div>
          <div class="gv-step"><i>2</i><div><b>工作区</b><span>选面板、定统计深度</span></div></div>
          <div class="gv-step"><i>3</i><div><b>外观</b><span>绿系配色、精灵、质感、明暗</span></div></div>
          <div class="gv-step"><i>4</i><div><b>玩法</b><span>等级、徽章、连击、奖励</span></div></div>
        </div>
        <div class="gv-intro-actions">
          <button type="button" class="gv-btn gv-btn--primary gv-btn--lg" data-act="start">
            <span aria-hidden="true">▶</span> 开始第 1 问
          </button>
          <button type="button" class="gv-btn gv-btn--ghost gv-btn--lg" data-act="skip-all">⏭ 跳过全部问题</button>
          ${S.done ? '<button type="button" class="gv-btn gv-btn--ghost gv-btn--lg" data-act="settings">⚙ 查看 / 补填</button>' : ''}
        </div>
        <p class="gv-note-line">跳过不会丢数据：已答的保留，未答的用安全默认值兜底。</p>
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

function wizardHTML() {
  const q = QUESTIONS[idx];
  if (!q) return resultHTML();
  const cfg = resolve();
  const pet = PETS[cfg.pet] || PETS.dragon;
  const pal = PALETTES[cfg.palette] || PALETTES.emerald;
  const chapter = CHAPTERS.find(c => c.id === q.chapter) || CHAPTERS[0];

  // 章节序号用汉字数字：比 emoji 更贴「纸面 / 出版」的调性，也不会往绿系里塞红橙蓝
  const CN_NUM = ['壹', '贰', '叁', '肆', '伍'];
  const chapters = CHAPTERS.map((c, ci) => {
    const qs = QUESTIONS.filter(x => x.chapter === c.id);
    const ok = qs.every(x => answeredOf(x));
    const skipped = qs.some(x => S.skippedIds.indexOf(x.id) > -1) && !ok;
    return `<button type="button" class="gv-ch ${c.id === q.chapter ? 'on' : ''} ${ok ? 'done' : ''} ${skipped ? 'skip' : ''}"
      data-ch="${c.id}" aria-pressed="${c.id === q.chapter}">
      <span class="gv-ch-n" aria-hidden="true">${CN_NUM[ci] || ci + 1}</span> ${c.name}${ok ? '<em aria-label="已完成">✓</em>' : skipped ? '<em class="q" aria-label="有跳过">·</em>' : ''}
    </button>`;
  }).join('');

  return frame(`
    <nav class="gv-chapters" aria-label="章节">${chapters}</nav>
    <div class="gv-body">
      <aside class="gv-side">
        <div class="gv-pet" aria-hidden="true">${pet.emoji}</div>
        <div class="gv-bubble">${esc(TONES[cfg.role] ? rnd(TONES[cfg.role]) : chapter.hint)}</div>
        ${miniLayout(cfg)}
        <div class="gv-side-meta">
          <span>${pal.name}</span><span>${esc(labelOf('light', cfg.light))}</span><span>${esc(labelOf('density', cfg.density))}</span>
        </div>
      </aside>
      <section class="gv-card" aria-live="polite">
        <div class="gv-qno">Q${idx + 1} / ${TOTAL}${q.type === 'multi' ? ' · 可多选' : ''}${q.max ? `（最多 ${q.max}）` : ''}</div>
        <h2 class="gv-q">${esc(q.title)}</h2>
        <p class="gv-sub">${esc(q.sub)}</p>
        <div class="gv-field">${fieldHTML(q)}</div>
        <p class="gv-req">${q.required ? '必填项 · 可跳过，未作答时自动取安全默认值' : '可跳过 · 未作答时自动取安全默认值'}</p>
      </section>
    </div>
    <footer class="gv-foot">
      <button type="button" class="gv-btn gv-btn--ghost" data-act="prev" ${idx === 0 ? 'disabled' : ''}>← 上一问</button>
      <div class="gv-kbd-hint"><kbd>1</kbd>-<kbd>9</kbd> 选择 · <kbd>Enter</kbd> 下一步 · <kbd>←</kbd> 返回</div>
      <button type="button" class="gv-btn gv-btn--ghost" data-act="skip-one">跳过这题</button>
      <button type="button" class="gv-btn gv-btn--primary" data-act="next">
        ${idx === TOTAL - 1 ? '完成 ✓' : '下一步 →'}
      </button>
    </footer>`, true);
}

function fieldHTML(q) {
  if (q.type === 'text') {
    const val = S.answers[q.id] || '';
    return `<input id="gv-text" class="gv-text" type="text" maxlength="24"
      placeholder="${esc(q.placeholder || '')}" value="${esc(val)}" autocomplete="off" />
      <div class="gv-hint">留白就用默认名：<b>${esc(q.fallback || DEFAULTS.name)}</b></div>`;
  }
  const cur = S.answers[q.id];
  const sel = q.type === 'multi' ? (Array.isArray(cur) ? cur : []) : [cur];
  return `<div class="gv-opts gv-opts--${q.type}">${q.options.map((o, i) => `
    <button type="button" class="gv-opt ${sel.indexOf(o.v) > -1 ? 'on' : ''}"
      data-v="${esc(o.v)}" data-i="${i}" aria-pressed="${sel.indexOf(o.v) > -1}">
      <span class="gv-emo" aria-hidden="true">${o.e}</span>
      <span class="gv-opt-txt"><b>${esc(o.l)}</b><small>${esc(o.d)}</small></span>
      <span class="gv-tick" aria-hidden="true">${q.type === 'multi' ? '✓' : '●'}</span>
    </button>`).join('')}</div>`;
}

function resultHTML() {
  const cfg = resolve();
  const pal = PALETTES[cfg.palette] || PALETTES.emerald;
  const pet = PETS[cfg.pet] || PETS.dragon;
  const many = (k, arr) => (arr || []).map(v => labelOf(k, v)).join(' · ') || '—';
  const mods = (cfg.core || []).concat(cfg.extra || []);

  const items = [
    ['主战场', labelOf('scene', cfg.scene)],
    ['核心痛点', labelOf('pain', cfg.pain)],
    ['搭档性格', labelOf('role', cfg.role)],
    ['造物精灵', labelOf('pet', cfg.pet)],
    ['核心面板', many('core', cfg.core)],
    ['附加能力', many('extra', cfg.extra)],
    ['首屏 C 位', labelOf('hero', cfg.hero)],
    ['任务视图', labelOf('taskview', cfg.taskview)],
    ['优先级', labelOf('priority', cfg.priority)],
    ['专注节奏', labelOf('pomolen', cfg.pomolen)],
    ['统计深度', labelOf('statdepth', cfg.statdepth)],
    ['配色 / 质感', `${labelOf('palette', cfg.palette)} · ${labelOf('texture', cfg.texture)} · ${labelOf('light', cfg.light)}`],
    ['游戏化', [labelOf('xp', cfg.xp), labelOf('badge', cfg.badge), labelOf('combo', cfg.combo)].join(' / ')],
    ['奖励', many('reward', cfg.reward)],
    ['提醒', labelOf('remind', cfg.remind)],
    ['信息密度', labelOf('density', cfg.density)],
    ['起始生态', labelOf('biome', cfg.biome)],
    ['画质', QUALITY_BY_DEVICE[cfg.device] ? ({ low: '流畅', medium: '标准', high: '高清', cinema: '电影级' })[QUALITY_BY_DEVICE[cfg.device]] : '高清']
  ];

  return frame(`
    <div class="gv-body gv-body--result">
      <div class="gv-result">
        <div class="gv-bp-head">
          <div class="gv-bp-pet" aria-hidden="true">${pet.emoji}</div>
          <div>
            <div class="gv-bp-tag">蓝图已生成 · ${countAnswered()}/${TOTAL} 已答 · 其余用默认值</div>
            <h2 class="gv-bp-name">${esc(cfg.name)}</h2>
            <div class="gv-bp-sub">${mods.length} 个模块 · ${pal.name} · ${labelOf('role', cfg.role)}陪你</div>
          </div>
        </div>
        <div class="gv-bp-grid">
          ${items.map(([k, v]) => `<div class="gv-bp-item"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}
        </div>
        <div class="gv-bp-actions">
          <button type="button" class="gv-btn gv-btn--primary gv-btn--lg" data-act="build">🚀 生成工作区，开始用</button>
          <button type="button" class="gv-btn gv-btn--ghost" data-act="restart">↺ 重新回答</button>
          <button type="button" class="gv-btn gv-btn--ghost" data-act="settings">⚙ 单项补填</button>
          <button type="button" class="gv-btn gv-btn--ghost" data-act="export">⬇ 导出配置</button>
        </div>
        <p class="gv-note-line">配置写进 localStorage（键 <code>${KEY}</code>），换设备可导入 JSON。</p>
      </div>
    </div>`, true);
}

function settingsHTML() {
  const cfg = resolve();
  const CN = ['壹', '贰', '叁', '肆', '伍'];
  const rows = CHAPTERS.map((c, ci) => {
    const qs = QUESTIONS.filter(x => x.chapter === c.id);
    return `
      <section class="gv-set-group">
        <h3 class="gv-set-h"><span class="gv-ch-n" aria-hidden="true">${CN[ci] || ci + 1}</span> ${c.name}<small>${qs.length} 题</small></h3>
        ${qs.map(q => {
          const has = answeredOf(q);
          const raw = cfg[q.id];
          const val = Array.isArray(raw) ? (raw.map(v => labelOf(q.id, v)).join(' · ') || '—') : labelOf(q.id, raw);
          return `<div class="gv-set-row ${has ? '' : 'miss'}">
            <span class="gv-set-k">${esc(q.title.replace(/[？?].*$/, ''))}</span>
            <span class="gv-set-v">${has ? '' : '<em class="gv-badge-miss">默认</em>'}${esc(val)}</span>
            <button type="button" class="gv-set-btn" data-act="jump" data-id="${q.id}">修改</button>
          </div>`;
        }).join('')}
      </section>`;
  }).join('');

  return frame(`
    <div class="gv-body gv-body--settings">
      <div class="gv-set">
        <div class="gv-set-head">
          <div>
            <h2 class="gv-set-title">配置补填</h2>
            <p class="gv-set-sub">点「修改」跳到对应问题；带 <em class="gv-badge-miss">默认</em> 的是还没答、正在用安全默认值的项。</p>
          </div>
          <div class="gv-set-actions">
            <button type="button" class="gv-btn gv-btn--ghost" data-act="restart">↺ 重跑 30 问</button>
            <button type="button" class="gv-btn gv-btn--ghost" data-act="export">⬇ 导出</button>
            <button type="button" class="gv-btn gv-btn--primary" data-act="build">应用并关闭</button>
          </div>
        </div>
        <div class="gv-set-list">${rows}</div>
      </div>
    </div>`, true);
}

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
  root.innerHTML = view === 'intro' ? introHTML()
    : view === 'settings' ? settingsHTML()
      : view === 'result' ? resultHTML()
        : wizardHTML();

  // 焦点：首个选项 / 文本 / 主按钮（补填页聚焦顶部按钮，避免自动滚动把标题顶出视野）
  const target = view === 'settings'
    ? root.querySelector('.gv-set-actions .gv-btn--primary')
    : root.querySelector('.gv-opt, #gv-text, .gv-intro-actions .gv-btn, .gv-bp-actions .gv-btn');
  if (target && open) {
    try { target.focus({ preventScroll: true }); } catch (_) { /* 忽略 */ }
  }
}

/* ---------------- 交互 ---------------- */
function onClick(e) {
  const el = e.target.closest('[data-act], [data-ch], .gv-opt');
  if (!el) return;
  const act = el.dataset.act;

  if (el.classList.contains('gv-opt')) { pickOption(el); return; }
  if (el.dataset.ch) { jumpChapter(el.dataset.ch); return; }

  switch (act) {
    case 'start':
      idx = firstUnanswered();
      view = 'wizard';
      paint();
      break;
    case 'skip-all':
      skipAll('user');
      break;
    case 'close':
      closeGuide();
      break;
    case 'prev':
      if (idx > 0) { idx--; paint(); }
      break;
    case 'next':
      commit(true);
      break;
    case 'skip-one':
      skipOne();
      break;
    case 'restart':
      S.answers = {}; S.skippedIds = []; S.done = false; S.skippedAll = false;
      save();
      idx = 0; view = 'wizard'; paint();
      break;
    case 'settings':
      view = 'settings'; paint();
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
    default:
      break;
  }
}

function onInput(e) {
  if (e.target && e.target.id === 'gv-text') {
    const q = QUESTIONS[idx];
    if (!q || q.type !== 'text') return;
    const v = e.target.value.trim();
    if (v) S.answers[q.id] = v;
    else delete S.answers[q.id];
    save();
  }
}
function onChange() { /* 预留：未来若加 select / checkbox */ }

function pickOption(btn) {
  if (locked) return;
  const q = QUESTIONS[idx];
  if (!q || !q.options) return;
  const v = btn.dataset.v;

  if (q.type === 'multi') {
    let cur = Array.isArray(S.answers[q.id]) ? S.answers[q.id].slice() : [];
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
    S.skippedIds = S.skippedIds.filter(x => x !== q.id);
    save();
    paint();
    return;
  }

  S.answers[q.id] = v;
  S.skippedIds = S.skippedIds.filter(x => x !== q.id);
  save();
  paint();
  // 单选自动前进（最后一题停在原地等「完成」）
  if (idx < TOTAL - 1) {
    locked = true;
    setTimeout(() => { locked = false; commit(true); }, 220);
  }
}

function commit(forward) {
  const q = QUESTIONS[idx];
  if (!q) return;
  if (q.type === 'text') {
    const t = byId('gv-text');
    const v = t ? t.value.trim() : (S.answers[q.id] || '');
    S.answers[q.id] = v || q.fallback || DEFAULTS.name;
  }
  if (!forward) { paint(); return; }
  if (idx < TOTAL - 1) { idx++; paint(); }
  else { view = 'result'; paint(); }
}

function skipOne() {
  const q = QUESTIONS[idx];
  if (!q) return;
  delete S.answers[q.id];
  if (S.skippedIds.indexOf(q.id) === -1) S.skippedIds.push(q.id);
  save();
  if (idx < TOTAL - 1) { idx++; paint(); }
  else { view = 'result'; paint(); }
}

function jumpChapter(chId) {
  const at = QUESTIONS.findIndex(q => q.chapter === chId);
  if (at > -1) { idx = at; view = 'wizard'; paint(); }
}
function jumpTo(id) {
  const at = QUESTIONS.findIndex(q => q.id === id);
  if (at > -1) { idx = at; view = 'wizard'; paint(); }
}
function firstUnanswered() {
  const at = QUESTIONS.findIndex(q => !answeredOf(q));
  return at > -1 ? at : 0;
}

function buildWorld() {
  const cfg = resolve();
  S.done = true;
  S.skippedAll = false;
  save();
  applyConfig(cfg, { defer: true });
  closeGuide({ silent: true });
  toast('配置已生效 · 可在顶栏「向导」继续补填');
}

function exportConfig() {
  const cfg = resolve();
  const data = { app: 'ForgeVerse', version: 'v10', exportedAt: new Date().toISOString(), raw: S.answers, resolved: cfg };
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
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }  // 显式打开时取消待触发的自动开场
  load();
  const root = ensureRoot();
  lastFocus = document.activeElement;
  open = true;
  document.body.classList.add('fv-guide-open');
  if (mode === 'settings') view = 'settings';
  else if (mode === 'wizard') { idx = firstUnanswered(); view = 'wizard'; }
  else view = S.done ? 'settings' : 'intro';
  paint();
  root.hidden = false;
  refreshEntry();
  // 关闭提示条
  const bar = byId(NOTE_ID); if (bar) bar.hidden = true;
}

export function closeGuide(opts) {
  const options = opts || {};
  open = false;
  if (!S.done) S.introSeen = true;   // 主动关掉开场后，下次刷新不再自动弹
  save();
  const root = byId(ROOT_ID);
  if (root) { root.hidden = true; root.innerHTML = ''; }
  document.body.classList.remove('fv-guide-open');
  refreshEntry();
  if (lastFocus && typeof lastFocus.focus === 'function') {
    try { lastFocus.focus({ preventScroll: true }); } catch (_) { /* 忽略 */ }
  }
  if (!options.silent) {
    const missing = QUESTIONS.filter(q => !answeredOf(q)).length;
    if (missing > 0) showHint(missing);
  }
}

function refreshEntry() {
  const btn = byId('fv-guide-open');
  if (btn) btn.classList.toggle('has-new', !S.done);
}

export function getGuideConfig() { return resolve(); }
export function isGuideDone() { return !!S.done; }

/* ---------------- 键盘：打开时接管，避免触发场景快捷键 ---------------- */
function onKeyDown(e) {
  if (!open) return;
  const tag = (e.target && e.target.tagName) || '';
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';

  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeGuide(); return; }

  if (view !== 'wizard' || typing) return;
  const q = QUESTIONS[idx];
  if (!q) return;

  if (e.key === 'Enter' || e.key === 'ArrowRight') {
    e.preventDefault(); e.stopPropagation(); commit(true); return;
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault(); e.stopPropagation();
    if (idx > 0) { idx--; paint(); }
    return;
  }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9 && q.options && q.options[n - 1]) {
    e.preventDefault(); e.stopPropagation();
    const btn = document.querySelector(`#${ROOT_ID} .gv-opt[data-i="${n - 1}"]`);
    if (btn) btn.click();
    return;
  }
  // 阻断其余按键，避免 W/E/R/Delete 改动场景
  if (['w', 'W', 'e', 'E', 'r', 'R', 'Delete', 'Backspace'].indexOf(e.key) > -1) e.stopPropagation();
}

/* ---------------- 初始化 ---------------- */
export function initGuide() {
  load();
  ensureRoot();

  // 恢复上次配置（轻量部分立即，重量部分下一帧）
  const touched = Object.keys(S.answers).length > 0 || S.done;
  if (touched) {
    try { applyConfig(resolve(), { defer: true }); } catch (err) { console.warn('[guide] 恢复配置失败', err); }
  }

  // 顶栏入口 + 设置入口
  const openBtn = byId('fv-guide-open');
  if (openBtn) {
    openBtn.onclick = () => openGuide();
    openBtn.classList.toggle('has-new', !S.done);
  }
  const wmSettings = byId('wmSettings');
  if (wmSettings && !wmSettings.dataset.guideBound) {
    wmSettings.dataset.guideBound = '1';
    wmSettings.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); openGuide('settings'); }, true);
  }

  // 世界名输入：用户手动改过就不再被向导默认值覆盖
  ['wcName', 'worldName'].forEach(id => {
    const el = byId(id);
    if (el && !el.dataset.guideBound) {
      el.dataset.guideBound = '1';
      el.addEventListener('input', () => { el.dataset.touched = '1'; });
    }
  });

  document.addEventListener('keydown', onKeyDown, true);

  // 首次进入自动打开（专注模式 / 已完成 / 已跳过 / 已主动关掉 不打扰）
  const auto = !S.done && !S.skippedAll && !S.introSeen;
  if (auto) {
    let focused = false;
    try { focused = localStorage.getItem('v10.focus') === '1'; } catch (_) {}
    if (!focused) autoTimer = setTimeout(() => { autoTimer = null; if (!S.done) openGuide('intro'); }, 700);
  }

  window.__fvGuidePerf = perf;
  return { open: openGuide, close: closeGuide, getConfig: getGuideConfig, perf };
}
