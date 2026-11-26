/* 交互式向导冒烟测试（jsdom）
   覆盖：数据完整性 / 动态路径 / 推荐标记 / 批量问答 / 审核页 / 跳过全部 / 持久化 / Esc */
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

const applied = [];
window.addEventListener('fv:guide-apply', e => applied.push(e.detail));

const mod = await import(pathToFileURL(path.join(ROOT, 'js/guide.js')).href);
const data = await import(pathToFileURL(path.join(ROOT, 'js/guide-data.js')).href);
const root = () => document.getElementById('fv-guide');

console.log('== 1. 数据完整性 ==');
ok('30 题', data.QUESTIONS.length === 30, data.QUESTIONS.length);
ok('5 章', data.CHAPTERS.length === 5);
const ids = new Set(data.QUESTIONS.map(q => q.id));
ok('题目 id 唯一', ids.size === 30);
const missingDefaults = data.QUESTIONS.filter(q => !(q.id in data.DEFAULTS));
ok('每题都有安全默认值', missingDefaults.length === 0, missingDefaults.map(q => q.id).join(','));
const badDefault = data.QUESTIONS.filter(q => {
  const d = data.DEFAULTS[q.id];
  if (q.type === 'text') return typeof d !== 'string';
  if (q.type === 'multi') return !Array.isArray(d) || d.some(v => !q.options.some(o => o.v === v));
  return !q.options.some(o => o.v === d);
});
ok('默认值均命中真实选项', badDefault.length === 0, badDefault.map(q => q.id).join(','));
const noRec = data.QUESTIONS.filter(q => !q.rec);
ok('每题都有推荐值', noRec.length === 0, noRec.map(q => q.id).join(','));
const badRec = data.QUESTIONS.filter(q => {
  const r = q.rec;
  if (q.type === 'text') return typeof r !== 'string';
  if (q.type === 'multi') return !Array.isArray(r) || r.some(v => !q.options.some(o => o.v === v));
  return !q.options.some(o => o.v === r);
});
ok('推荐值均命中真实选项', badRec.length === 0, badRec.map(q => q.id).join(','));
const conditional = data.QUESTIONS.filter(q => typeof q.when === 'function');
ok('存在条件题（动态路径）', conditional.length >= 15, conditional.length);
const paletteGreen = Object.values(data.PALETTES).every(p => /^#[0-9A-Fa-f]{6}$/.test(p.accent) && /^#[0-9A-Fa-f]{6}$/.test(p.a11y));
ok('配色表格式正确', paletteGreen);

console.log('== 2. 初始化与动态路径 ==');
mod.initGuide();
await sleep(40);
ok('根节点存在且隐藏', root() && root().hidden === true);

// 空答案时的必要题数
window.localStorage.removeItem('fv.guide.v1');
mod.openGuide('intro');
await sleep(20);
const meta0 = root().querySelector('.gv-intro-meta').textContent;
const flow0 = parseInt(meta0.match(/(\d+) 个必要问题/)[1], 10);
ok('空答案问题数 < 30（动态裁剪）', flow0 > 0 && flow0 < 30, flow0);

// 选 scene=work 后，依赖场景的题（时段/设备/生态）被加入；空答案时这些题默认跳过
window.localStorage.setItem('fv.guide.v1', JSON.stringify({ answers: { scene: 'work' }, skippedIds: [], done: false }));
mod.openGuide('intro');
await sleep(20);
const flowWork = parseInt(root().querySelector('.gv-intro-meta').textContent.match(/(\d+) 个必要问题/)[1], 10);
ok('选「工作项目」后按需追加相关题', flowWork > flow0, `${flow0} -> ${flowWork}`);
// 选 life 则这些题不出现
window.localStorage.setItem('fv.guide.v1', JSON.stringify({ answers: { scene: 'life' }, skippedIds: [], done: false }));
mod.openGuide('intro');
await sleep(20);
const flowLife = parseInt(root().querySelector('.gv-intro-meta').textContent.match(/(\d+) 个必要问题/)[1], 10);
ok('选「生活整理」不会追加无关题', flowLife < flowWork, `${flowWork} -> ${flowLife}`);

console.log('== 3. 批量提问 ==');
window.localStorage.removeItem('fv.guide.v1');
mod.openGuide('intro');
await sleep(20);
root().querySelector('[data-act="start"]').click();
await sleep(20);
const cards = root().querySelectorAll('.gv-qcard');
ok('每屏只出 2 题', cards.length === 2, cards.length);
ok('旧单题卡已移除', root().querySelector('.gv-card') === null);
ok('推荐标记已渲染', root().querySelectorAll('.gv-rec').length >= 1);
ok('副标题冗余已删除', /gv-sub|必填项 · 可跳过/.test(root().innerHTML) === false);

console.log('== 4. 答一组 → 下一组 ==');
const firstId = cards[0].dataset.id;
cards[0].querySelector('.gv-opt').click();
await sleep(20);
const savedA = JSON.parse(window.localStorage.getItem('fv.guide.v1'));
ok('选项写入 answers', !!savedA.answers[firstId], firstId);
const beforeGroup = root().querySelector('.gv-progress .gv-count').textContent;
root().querySelector('[data-act="next"]').click();
await sleep(20);
const afterGroup = root().querySelector('.gv-progress .gv-count').textContent;
ok('推进到下一组', beforeGroup !== afterGroup, `${beforeGroup} -> ${afterGroup}`);
ok('上一组可用', !root().querySelector('[data-act="prev"]').disabled);

console.log('== 5. 跳过这一组 ==');
const skippedIdsBefore = JSON.parse(window.localStorage.getItem('fv.guide.v1')).skippedIds.length;
root().querySelector('[data-act="skip-group"]').click();
await sleep(20);
const skippedIdsAfter = JSON.parse(window.localStorage.getItem('fv.guide.v1')).skippedIds.length;
ok('整组跳过记入 skippedIds', skippedIdsAfter > skippedIdsBefore, `${skippedIdsBefore} -> ${skippedIdsAfter}`);

console.log('== 6. 审核 / 确认界面 ==');
root().querySelector('[data-act="review"]').click();
await sleep(20);
ok('进入审核页', !!root().querySelector('.gv-review'));
ok('生成个性化路线', root().querySelectorAll('.gv-route-step').length >= 3);
ok('生成推荐方案文案', /推荐方案/.test(root().textContent));
ok('列出可修改项', root().querySelectorAll('.gv-set-row').length > 0);
ok('世界名可编辑', !!document.getElementById('gv-review-name'));
ok('未答项标「推荐」', root().querySelectorAll('.gv-badge-miss').length > 0);
const jump = root().querySelector('[data-act="jump"]');
jump.click();
await sleep(20);
ok('点修改跳回对应题组', root().dataset.view === 'wizard' && !!root().querySelector('.gv-qcard'));

console.log('== 7. 跳过全部（<500ms）==');
mod.openGuide('intro');
await sleep(20);
const skipBtn = root().querySelector('[data-act="skip-all"]');
ok('开场保留跳过入口', !!skipBtn);
const t0 = performance.now();
skipBtn.click();
const t1 = performance.now();
ok('跳过耗时 < 500ms', (t1 - t0) < 500, (t1 - t0).toFixed(1) + 'ms');
ok('引导层已关闭', root().hidden === true);
const saved = JSON.parse(window.localStorage.getItem('fv.guide.v1') || '{}');
ok('状态已持久化 done=true', saved.done === true);
ok('轻提示出现且可关闭', !!document.getElementById('fv-guide-note'));
document.getElementById('fv-guide-note').querySelector('[data-act="dismiss"]').click();
ok('轻提示已关闭', document.getElementById('fv-guide-note').hidden === true);

ok('主题档位写入 body', document.body.dataset.fvTex === 'soft' && document.body.dataset.fvDensity === 'three');
const EMERALD = data.PALETTES.emerald;
ok('绿色强调色与数据层一致', document.documentElement.style.getPropertyValue('--acc').trim().toLowerCase() === EMERALD.accent.toLowerCase());
ok('精灵 emoji 已应用', document.getElementById('pet').textContent === '🐲');
await sleep(60);
ok('配置事件已派发', applied.length > 0, applied.length);
const d0 = applied[applied.length - 1] || {};
ok('面板计划含 bottom', d0.panels && d0.panels.bottom === true, JSON.stringify(d0.panels));

console.log('== 8. 审核页修改并应用 ==');
mod.openGuide('review');
await sleep(20);
const nameInput = document.getElementById('gv-review-name');
nameInput.value = '测试工作区';
nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
const build = root().querySelector('[data-act="build"]');
build.click();
await sleep(30);
ok('确认后关闭并落库', root().hidden === true && JSON.parse(window.localStorage.getItem('fv.guide.v1')).done === true);
ok('世界名已写入配置', mod.getGuideConfig().name === '测试工作区', mod.getGuideConfig().name);

console.log('== 9. Esc 关闭 ==');
mod.openGuide('review');
await sleep(20);
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await sleep(20);
ok('Esc 关闭引导', root().hidden === true);

console.log('\n结果：' + (fails.length ? 'FAIL ' + fails.length : 'ALL PASS'));
if (fails.length) { fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
