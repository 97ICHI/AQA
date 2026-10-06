// Автономность: без сети, без JavaScript, печать главы.
import { Report, launch, bookUrl } from '../lib/common.mjs';
const r = new Report('offline');
const b = await launch();
let ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, offline: true }); let p = await ctx.newPage();
const ext = []; p.on('request', (q) => { if (!/^(file|data|blob|about):/.test(q.url())) ext.push(q.url()); }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(bookUrl('#/intro')); await p.waitForTimeout(400);
for (const h of ['sql', 'locators', 'docker', 'glossary']) { await p.evaluate((x) => { location.hash = '#/' + x; }, h); await p.waitForTimeout(250); }
r.ok('офлайн: нет внешних запросов', ext.length === 0, ext.join(','));
r.ok('офлайн: нет ошибок JS', errs.length === 0, errs.join(';'));
await ctx.close();
ctx = await b.newContext({ viewport: { width: 390, height: 800 }, javaScriptEnabled: false }); p = await ctx.newPage();
await p.goto(bookUrl()); await p.waitForTimeout(500);
const info = await p.evaluate(() => ({ arts: document.querySelectorAll('article.chapter').length, vis: [...document.querySelectorAll('article.chapter')].filter((a) => a.offsetHeight > 0).length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, closeBtn: getComputedStyle(document.querySelector('.sidebar-close')).display }));
r.ok('без JS: все главы видны подряд', info.arts === info.vis && info.arts > 30, JSON.stringify(info));
r.ok('без JS: нет горизонтальной прокрутки', info.over <= 0);
r.ok('без JS: нет бесполезных кнопок меню', info.closeBtn === 'none');
await ctx.close();
ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); p = await ctx.newPage();
await p.goto(bookUrl('#/async')); await p.waitForTimeout(400); await p.emulateMedia({ media: 'print' });
const vis = await p.evaluate(() => ({ s: getComputedStyle(document.querySelector('.sidebar')).display, t: getComputedStyle(document.querySelector('.topbar')).display, bg: getComputedStyle(document.body).backgroundColor }));
r.ok('печать главы: меню скрыто, фон белый', vis.s === 'none' && vis.t === 'none' && vis.bg === 'rgb(255, 255, 255)', JSON.stringify(vis));
// печать всего учебника: все главы видны
await p.evaluate(() => { BOOK.chapters.forEach((c) => APP.prepare(APP.artOf(c.id))); document.body.classList.add('print-all'); });
const shown = await p.evaluate(() => [...document.querySelectorAll('article.chapter')].filter((a) => getComputedStyle(a).display !== 'none').length);
r.ok('печать всего учебника: видны все главы', shown === (await p.evaluate(() => BOOK.chapters.length)), String(shown));
await ctx.close(); await b.close(); r.done();
