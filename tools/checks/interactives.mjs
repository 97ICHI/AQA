// Интерактивы: крайние значения ползунков и полей, все кнопки, сброс. Ошибки JS и NaN/Infinity недопустимы.
import { Report, launch, bookUrl, chapterIds } from '../lib/common.mjs';
const r = new Report('interactives');
const ALLOWED_UNDEFINED = new Set(['isolation/config-resolver', 'flaky/flaky-debugger']); // слово undefined — часть учебного примера
const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(bookUrl()); await p.waitForTimeout(300);
let sims = 0;
for (const ch of await chapterIds(p)) {
  await p.evaluate((id) => { location.hash = '#/' + id; }, ch); await p.waitForTimeout(150);
  for (const m of await p.$$('article.is-active .sim-mount')) {
    await m.scrollIntoViewIfNeeded(); await p.waitForTimeout(120); sims++;
    const name = await m.getAttribute('data-sim');
    const check = async (tag) => { const t = await m.evaluate((n) => n.innerText); const bad = (t.match(/NaN|Infinity|\[object/g) || []).concat(ALLOWED_UNDEFINED.has(`${ch}/${name}`) ? [] : (t.match(/undefined/g) || [])); r.ok(`${ch}/${name} [${tag}]`, bad.length === 0, [...new Set(bad)].join(',')); };
    await check('init');
    for (const rg of await m.$$('input[type=range]')) for (const w of ['min', 'max', 'mid']) { await rg.evaluate((el, w) => { const mn = +el.min, mx = +el.max; el.value = w === 'min' ? mn : w === 'max' ? mx : (mn + mx) / 2; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, w); await check('range ' + w); }
    for (const nu of await m.$$('input[type=number]')) for (const v of ['0', '-1', '1e9', '']) { await nu.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v); await check('number ' + JSON.stringify(v)); }
    const n = (await m.$$('button')).length;
    for (let k = 0; k < n; k++) {
      const btn = (await m.$$('button'))[k]; if (!btn) continue;
      const txt = (await btn.innerText()).trim().slice(0, 30);
      if ((await btn.evaluate((e) => e.disabled)) || /Копировать|Скачать/.test(txt)) continue;
      await btn.click({ timeout: 1500, force: true }).catch(() => {}); await p.waitForTimeout(40); await check('button ' + txt);
    }
  }
}
r.ok('интерактивов проверено не меньше 30', sims >= 30, String(sims));
r.ok('нет ошибок JS', errs.length === 0, errs.join('; '));
await b.close(); r.done();
