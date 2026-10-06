// Горизонтальное переполнение: все главы × ширины × темы (интерактивы смонтированы). FULL=1 — все пять ширин (локально, долго).
import { Report, launch, bookUrl, chapterIds } from '../lib/common.mjs';
const r = new Report('layout');
const widths = process.env.FULL ? [360, 390, 768, 1024, 1440] : [360, 768, 1440];
const b = await launch();
for (const theme of ['dark', 'light']) {
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    await p.addInitScript((t) => localStorage.setItem('aqalab:settings', JSON.stringify({ theme: t })), theme);
    await p.goto(bookUrl()); await p.waitForTimeout(300);
    for (const id of await chapterIds(p)) {
      await p.evaluate((i) => { location.hash = '#/' + i; }, id); await p.waitForTimeout(100);
      await p.evaluate(() => { APP.prepare(document.querySelector('article.is-active')); document.querySelectorAll('article.is-active .sim-mount').forEach((n) => n.scrollIntoView()); });
      await p.waitForTimeout(120);
      const res = await p.evaluate(() => {
        const W = document.documentElement.clientWidth; const bad = [];
        document.querySelectorAll('article.is-active *').forEach((e) => {
          const rc = e.getBoundingClientRect(); if (rc.width === 0 || rc.right <= W + 1) return;
          for (let a = e.parentElement; a && a.tagName !== 'ARTICLE'; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return; }
          if (e.closest('svg') && e.tagName !== 'svg') return;
          bad.push(e.tagName + '.' + (e.getAttribute('class') || ''));
        });
        return { over: document.documentElement.scrollWidth - W, bad: [...new Set(bad)].slice(0, 3) };
      });
      r.ok(`${theme} ${w}px ${id}: нет горизонтальной прокрутки`, res.over <= 0 && res.bad.length === 0, `over=${res.over} ${res.bad}`);
    }
    await ctx.close();
  }
}
await b.close(); r.done();
