// Поведение интерфейса: навигация, поиск, клавиши, подсказки, настройки, хранилище.
import { Report, launch, bookUrl } from '../lib/common.mjs';
const r = new Report('behaviour');
const b = await launch();
const mk = async (o = {}, init) => { const c = await b.newContext({ viewport: { width: o.w || 1280, height: o.h || 900 }, ...(o.ctx || {}) }); const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); if (init) await p.addInitScript(init); return p; };
let p = await mk();
await p.goto(bookUrl('#/locators/strict')); await p.waitForTimeout(500);
r.ok('прямой переход в раздел прокручивает к нему', await p.evaluate(() => { const t = document.getElementById('/locators/strict').getBoundingClientRect().top; return t >= 0 && t < 300; }));
await p.keyboard.press('Control+k'); await p.keyboard.type('strict mode'); await p.waitForTimeout(400);
r.ok('поиск находит результаты', (await p.locator('.sr-item').count()) > 0);
await p.goto(bookUrl('#/glossary')); await p.waitForTimeout(300);
await p.click('.gl-tools input'); await p.keyboard.type('[]/');
r.ok('клавиши [ ] / не срабатывают в поле ввода', await p.evaluate(() => location.hash === '#/glossary' && document.querySelector('.gl-tools input').value === '[]/'));
await p.goto(bookUrl('#/async')); await p.waitForTimeout(300);
await p.locator('article.is-active .prose button.term').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
r.ok('подсказка открывается с клавиатуры, фокус внутри', await p.evaluate(() => { const pop = document.getElementById('term-pop'); return !pop.hidden && pop.contains(document.activeElement) || document.activeElement.id === 'term-pop'; }));
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
r.ok('Esc закрывает подсказку и возвращает фокус', await p.evaluate(() => document.getElementById('term-pop').hidden && document.activeElement.classList.contains('term')));
await p.click('[data-action="theme"]'); await p.click('[data-study-mode="recall"]');
r.ok('тема и режим «Кратко» применяются', await p.evaluate(() => document.documentElement.dataset.theme === 'light' && getComputedStyle(document.querySelector('article.is-active .prose')).display === 'none'));
await p.reload(); await p.waitForTimeout(400);
r.ok('настройки сохраняются после перезагрузки', await p.evaluate(() => document.documentElement.dataset.theme === 'light' && document.documentElement.dataset.study === 'recall'));
await p.click('[data-study-mode="learn"]'); await p.click('article.is-active [data-read-toggle]');
r.ok('прогресс отмечается и сохраняется', await p.evaluate(() => document.getElementById('prog-n').textContent === '1'));
await p.reload(); await p.waitForTimeout(300);
r.ok('прогресс виден после перезагрузки', await p.evaluate(() => document.getElementById('prog-n').textContent === '1'));
r.ok('нет ошибок JS', p.errs.length === 0, p.errs.join(';'));
await p.context().close();
// практика и лаборатория DOM
p = await mk(); await p.goto(bookUrl('#/competence')); await p.waitForTimeout(300);
await p.check('[data-practice-step="junior"]'); r.ok('практика: счётчик', (await p.textContent('#practice-summary')).includes('1 из 3'));
await p.reload(); await p.waitForTimeout(300); r.ok('практика: отметка сохраняется', await p.isChecked('[data-practice-step="junior"]'));
await p.click('[data-practice-reset]'); r.ok('практика: сброс', (await p.textContent('#practice-summary')).includes('0 из 3'));
await p.evaluate(() => { location.hash = '#/locators'; }); await p.waitForTimeout(300);
const before = await p.textContent('[data-lab-result]'); await p.click('[data-lab-mutate]');
r.ok('лаборатория DOM: результат меняется', before !== (await p.textContent('[data-lab-result]')));
await p.context().close();
// хранилище недоступно / повреждено
p = await mk({}, () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } }); });
await p.goto(bookUrl('#/sql')); await p.waitForTimeout(500); await p.click('article.is-active [data-read-toggle]').catch(() => {});
r.ok('без localStorage работает', p.errs.length === 0, p.errs.join(';')); await p.context().close();
p = await mk({}, () => { localStorage.setItem('aqalab:settings', '{broken'); localStorage.setItem('aqalab:read', '[1,2'); localStorage.setItem('aqalab:practice', '7'); });
await p.goto(bookUrl('#/competence')); await p.waitForTimeout(500); r.ok('повреждённые данные не ломают', p.errs.length === 0, p.errs.join(';')); await p.context().close();
p = await mk({}, () => localStorage.setItem('aqalab:settings', JSON.stringify({ theme: 'zzz', fontSize: 'q', brightness: 'abc', mode: 5 })));
await p.goto(bookUrl('#/intro')); await p.waitForTimeout(400); r.ok('неверные значения настроек не ломают', p.errs.length === 0, p.errs.join(';')); await p.context().close();
// мобильное меню
p = await mk({ w: 390, h: 800 }); await p.goto(bookUrl('#/intro')); await p.waitForTimeout(400);
await p.click('.menu-btn'); await p.waitForTimeout(400); r.ok('меню открывается', await p.evaluate(() => document.getElementById('sidebar').classList.contains('open')));
await p.keyboard.press('Escape'); await p.waitForTimeout(300); r.ok('Esc закрывает меню', await p.evaluate(() => !document.getElementById('sidebar').classList.contains('open')));
await p.click('.menu-btn'); await p.waitForTimeout(300); await p.click('.toc-link[data-id="sql"]'); await p.waitForTimeout(500);
r.ok('переход из меню закрывает его', await p.evaluate(() => !document.getElementById('sidebar').classList.contains('open') && location.hash === '#/sql'));
// градиент меню не обрывается при прокрутке
const bg = await p.evaluate(() => { const s = document.getElementById('sidebar'); return getComputedStyle(s).backgroundImage; });
r.ok('фон меню задан на самом элементе (без обрыва при прокрутке)', /linear-gradient/.test(bg));
await p.context().close();
// reduced motion
p = await mk({ ctx: { reducedMotion: 'reduce' } }); await p.goto(bookUrl('#/async')); await p.waitForTimeout(300);
r.ok('reduced motion отключает переходы', await p.evaluate(() => getComputedStyle(document.querySelector('.btn')).transitionDuration.startsWith('0')));
await p.context().close();
await b.close(); r.done();
