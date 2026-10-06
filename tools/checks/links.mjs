// Внутренние ссылки, глоссарий, дубли id, ошибки консоли при загрузке.
import { Report, launch, bookUrl } from '../lib/common.mjs';
const r = new Report('links');
const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(bookUrl()); await p.waitForTimeout(500);
const res = await p.evaluate(() => {
  const ids = new Set([...document.querySelectorAll('[id]')].map((e) => e.id));
  const bad = []; let n = 0;
  document.querySelectorAll('a[href^="#/"]').forEach((a) => { n++; const h = decodeURIComponent(a.getAttribute('href').slice(1)); const parts = h.split('/'); if (!ids.has('/' + parts[1])) bad.push('нет главы ' + h); else if (parts[2] && !ids.has(h)) bad.push('нет якоря ' + h); });
  const gl = [];
  for (const [k, v] of Object.entries(BOOK.glossary)) { if (!ids.has('/' + v.ch) || (v.anchor && !ids.has('/' + v.ch + '/' + v.anchor))) gl.push('термин ' + k + ' → ' + v.ch + '/' + v.anchor); if (!ids.has('/glossary/' + k)) gl.push('нет карточки ' + k); }
  const tb = [...document.querySelectorAll('button.term')].filter((t) => !BOOK.glossary[t.dataset.term]).map((t) => t.dataset.term);
  const seen = {}, dup = []; document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) dup.push(e.id); seen[e.id] = 1; });
  const toc = [...document.querySelectorAll('.toc-link')].map((a) => a.dataset.id);
  const bookIds = BOOK.chapters.map((c) => c.id);
  const arts = [...document.querySelectorAll('article.chapter')].map((a) => a.dataset.chapter);
  return { n, bad, gl, tb, dup, tocOk: JSON.stringify(toc) === JSON.stringify(bookIds), artsOk: JSON.stringify(arts) === JSON.stringify(bookIds) };
});
r.ok('есть ссылки', res.n > 1000, String(res.n));
res.bad.forEach((x) => r.ok('ссылка: ' + x, false));
res.gl.forEach((x) => r.ok('глоссарий: ' + x, false));
res.tb.forEach((x) => r.ok('подсказка на неизвестный термин ' + x, false));
res.dup.forEach((x) => r.ok('дубль id ' + x, false));
r.ok('оглавление в меню = список глав в book.json', res.tocOk);
r.ok('порядок глав в разметке = book.json', res.artsOk);
r.ok('нет ошибок JS при загрузке', errs.length === 0, errs.join('; '));
await b.close(); r.done();
