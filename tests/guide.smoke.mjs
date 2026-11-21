/* 创作向导冒烟测试（jsdom）
   运行：npm i --no-save jsdom && node tests/guide.smoke.mjs
   覆盖：数据完整性 / 跳过全部（含 <0.5s 计时）/ 持久化 / 补填页 / 单步跳过 / 蓝图结算 / Esc 关闭 */
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="app">
    <div id="toast"></div>
    <div id="pet">🐲</div>
    <div class="pet-name">造物精灵 · <span id="petMood">待命</span></div>
    <button id="fv-guide-open" class="ghost">向导</button>
    <button id="wmSettings">⚙</button>
    <input id="wcName" value="未命名世界" />
    <input id="worldName" value="未命名世界" />
    <input id="timeSlider" type="range" value="55" />
    <button id="btnQuality">🎬 高清</button>
    <div id="wcBiomes">
      <button data-biome-switch="grass" class="active"></button>
      <button data-biome-switch="snow"></button>
      <button data-biome-switch="desert"></button>
      <button data-biome-switch="cyber"></button>
    </div>
    <div id="wcQuality">
      <button data-quality="low"></button><button data-quality="medium" class="active"></button>
      <button data-quality="high"></button><button data-quality="cinema"></button>
    </div>
    <input id="wcTimeOfDay" type="range" value="55" /><output id="wcTimeOut">正午</output>
  </div>
</body></html>`, { url: 'https://example.test/', pretendToBeVisual: true, runScripts: 'outside-only' });

const { window } = dom;
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.CustomEvent = window.CustomEvent;
global.requestAnimationFrame = window.requestAnimationFrame;
global.Blob = window.Blob;

const fails = [];
const ok = (name, cond, extra) => {
  if (cond) console.log('  PASS', name);
  else { fails.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL', name, extra || ''); }
};

const applied = [];
window.addEventListener('fv:guide-apply', e => applied.push(e.detail));

const mod = await import(pathToFileURL(path.join(ROOT, 'js/guide.js')).href);
const data = await import(pathToFileURL(path.join(ROOT, 'js/guide-data.js')).href);

console.log('== 1. 数据完整性 ==');
ok('30 题', data.QUESTIONS.length === 30, data.QUESTIONS.length);
ok('5 章', data.CHAPTERS.length === 5);
const ids = new Set(data.QUESTIONS.map(q => q.id));
ok('题目 id 唯一', ids.size === 30);
const missingDefaults = data.QUESTIONS.filter(q => !(q.id in data.DEFAULTS));
ok('每题都有安全默认值', missingDefaults.length === 0, missingDefaults.map(q => q.id).join(','));
const badOpts = data.QUESTIONS.filter(q => q.type !== 'text' && (!q.options || q.options.length < 2));
ok('选项题至少 2 个选项', badOpts.length === 0, badOpts.map(q => q.id).join(','));
const requiredNoFallback = data.QUESTIONS.filter(q => q.required && q.type === 'single' && !data.DEFAULTS[q.id]);
ok('必填项均有默认值', requiredNoFallback.length === 0);
const badDefault = data.QUESTIONS.filter(q => {
  const d = data.DEFAULTS[q.id];
  if (q.type === 'text') return typeof d !== 'string';
  if (q.type === 'multi') return !Array.isArray(d) || d.some(v => !q.options.some(o => o.v === v));
  return !q.options.some(o => o.v === d);
});
ok('默认值均命中真实选项', badDefault.length === 0, badDefault.map(q => q.id + '=' + data.DEFAULTS[q.id]).join(','));
const badLabel = data.QUESTIONS.filter(q => q.type !== 'text' && q.options.some(o => !data.LABELS[q.id] || !(o.v in data.LABELS[q.id])));
ok('每个选项都有中文标签', badLabel.length === 0, badLabel.map(q => q.id).join(','));
const paletteGreen = Object.values(data.PALETTES).every(p => /^#[0-9A-Fa-f]{6}$/.test(p.accent) && /^#[0-9A-Fa-f]{6}$/.test(p.a11y));
ok('配色表格式正确', paletteGreen);

console.log('== 2. 初始化 ==');
mod.initGuide();
await new Promise(r => setTimeout(r, 40));
ok('根节点存在且隐藏', document.getElementById('fv-guide') && document.getElementById('fv-guide').hidden);

console.log('== 3. 跳过全部 ==');
mod.openGuide('intro');
await new Promise(r => setTimeout(r, 20));
const root = document.getElementById('fv-guide');
ok('开场页渲染', !root.hidden && root.querySelector('.gv-intro'));
const skipBtn = root.querySelector('[data-act="skip-all"]');
ok('开场有「跳过全部」按钮', !!skipBtn);

const t0 = performance.now();
skipBtn.click();
const t1 = performance.now();
const skipMs = t1 - t0;
ok('跳过耗时 < 500ms', skipMs < 500, skipMs.toFixed(1) + 'ms');
console.log('  实测跳过耗时:', skipMs.toFixed(2), 'ms');

ok('引导层已关闭', root.hidden === true);
const saved = JSON.parse(window.localStorage.getItem('fv.guide.v1') || '{}');
ok('状态已持久化 done=true', saved.done === true);
ok('已答为 0、未答题记入 skippedAll', Object.keys(saved.answers || {}).length === 0 && saved.skippedAll === true);
ok('可关闭轻提示出现', !!document.getElementById('fv-guide-note'));
const note = document.getElementById('fv-guide-note');
ok('轻提示含「去补填」', /去补填/.test(note.textContent));
note.querySelector('[data-act="dismiss"]').click();
ok('轻提示可关闭', note.hidden === true);

ok('主题档位写入 body', document.body.dataset.fvTex === 'soft' && document.body.dataset.fvDensity === 'three');
// 断言不再写死色值：主题会随设计迭代调整，测试只校验「与数据层一致」
const EMERALD = (await import(new URL('../js/guide-data.js', import.meta.url).href)).PALETTES.emerald;
ok('绿色强调色覆盖 --acc', document.documentElement.style.getPropertyValue('--acc').trim().toLowerCase() === EMERALD.accent.toLowerCase());
ok('精灵 emoji 已应用', document.getElementById('pet').textContent === '🐲');

await new Promise(r => setTimeout(r, 60));
ok('配置事件已派发', applied.length > 0, applied.length);
const d0 = applied[applied.length - 1] || {};
ok('面板计划含 bottom', d0.panels && d0.panels.bottom === true, JSON.stringify(d0.panels));
ok('画质来自设备', d0.quality === 'high', d0.quality);
ok('时段来自时段题', typeof d0.time === 'number' && d0.time > 0.4 && d0.time < 0.5, d0.time);

console.log('== 4. 设置 / 补填 ==');
mod.openGuide('settings');
await new Promise(r => setTimeout(r, 20));
const rows = document.querySelectorAll('#fv-guide .gv-set-row');
ok('补填页列出 30 行', rows.length === 30, rows.length);
ok('未答项标记「默认」', document.querySelectorAll('#fv-guide .gv-set-row .gv-badge-miss').length === 30);
const jump = rows[0].querySelector('[data-act="jump"]');
jump.click();
await new Promise(r => setTimeout(r, 20));
ok('点「修改」跳到题目', !!document.querySelector('#fv-guide .gv-card') && /Q1 \/ 30/.test(document.querySelector('#fv-guide .gv-qno').textContent));

console.log('== 5. 单步跳过与作答 ==');
const before = document.querySelector('#fv-guide .gv-qno').textContent;
document.querySelector('#fv-guide [data-act="skip-one"]').click();
await new Promise(r => setTimeout(r, 20));
const after = document.querySelector('#fv-guide .gv-qno').textContent;
ok('单步跳过推进一题', before !== after, before + ' -> ' + after);
ok('跳过项记入 skippedIds', (JSON.parse(window.localStorage.getItem('fv.guide.v1')).skippedIds || []).includes('scene'));

const opt = document.querySelector('#fv-guide .gv-opt');
opt.click();
await new Promise(r => setTimeout(r, 320));
const saved2 = JSON.parse(window.localStorage.getItem('fv.guide.v1'));
ok('选项写入 answers', !!saved2.answers.timeband || !!saved2.answers.pain, JSON.stringify(saved2.answers));

console.log('== 6. 答完 30 题进入蓝图 ==');
// 直接用键盘路径把剩余题答完：每题点第一个选项 / 文本输入
for (let i = 0; i < 60; i++) {
  const card = document.querySelector('#fv-guide .gv-card');
  if (!card) break;
  const o = card.querySelector('.gv-opt');
  if (o) {
    o.click();
    // 多选题不会自动前进，手动点下一步
    if (card.querySelector('.gv-opts--multi')) document.querySelector('#fv-guide [data-act="next"]').click();
    await new Promise(r => setTimeout(r, 260));
    continue;
  }
  const t = card.querySelector('#gv-text');
  if (t) { t.value = '测试工作区'; t.dispatchEvent(new window.Event('input', { bubbles: true })); document.querySelector('#fv-guide [data-act="next"]').click(); await new Promise(r => setTimeout(r, 30)); continue; }
  break;
}
const result = document.querySelector('#fv-guide .gv-result');
ok('进入蓝图结算页', !!result);
if (result) {
  ok('蓝图列出 18 项', result.querySelectorAll('.gv-bp-item').length === 18, result.querySelectorAll('.gv-bp-item').length);
  ok('蓝图显示名字', /测试工作区/.test(result.textContent));
  const build = result.querySelector('[data-act="build"]');
  build.click();
  await new Promise(r => setTimeout(r, 30));
  ok('生成后关闭并落库', document.getElementById('fv-guide').hidden === true && JSON.parse(window.localStorage.getItem('fv.guide.v1')).done === true);
}

console.log('== 7. 打开/关闭与 Esc ==');
mod.openGuide('settings');
await new Promise(r => setTimeout(r, 20));
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await new Promise(r => setTimeout(r, 20));
ok('Esc 关闭引导', document.getElementById('fv-guide').hidden === true);

console.log('\n结果：' + (fails.length ? 'FAIL ' + fails.length : 'ALL PASS'));
if (fails.length) { fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
