/* ===== refs.js: фильтр глоссария, тренажёр вопросов собеседования, отметки «Знаю/Повторить» ===== */
(function () {
  'use strict';
  const { $, $$ } = U;
  window.CHAPTER_INIT = window.CHAPTER_INIT || {};

  window.CHAPTER_INIT.glossary = (art) => {
    const input = $('[data-gl-filter]', art), count = $('[data-gl-count]', art);
    const items = $$('.gl-item', art), groups = $$('.gl-group', art), letters = $$('[data-gl-letter]', art);
    const total = items.length;
    const run = () => {
      const q = U.norm(input.value.trim());
      let shown = 0;
      for (const it of items) {
        const hay = it.dataset.gl + ' ' + U.norm(it.querySelector('.gl-def').textContent);
        const on = !q || hay.includes(q);
        it.hidden = !on; if (on) shown++;
      }
      for (const g of groups) {
        const any = $$('.gl-item', g).some((x) => !x.hidden);
        g.hidden = !any;
        const l = letters.find((a) => a.dataset.glLetter === g.dataset.glGroup);
        if (l) l.classList.toggle('off', !any);
      }
      count.textContent = q ? `Найдено: ${shown} из ${total}` : `Терминов: ${total}`;
    };
    input.addEventListener('input', U.debounce(run, 80));
    run();
  };

  function marks() { return window.APP ? APP.state.marks : U.store.get('iqmarks', {}); }
  function syncMarks(root) {
    const m = marks();
    for (const d of $$('details.iq', root)) {
      const v = m[d.dataset.iq];
      for (const b of $$('[data-iq-mark]', d)) b.setAttribute('aria-pressed', String(b.dataset.iqMark === v));
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-iq-mark]');
    if (!b) return;
    const id = b.closest('details.iq').dataset.iq, m = marks();
    m[id] = m[id] === b.dataset.iqMark ? undefined : b.dataset.iqMark;
    if (!m[id]) delete m[id];
    U.store.set('iqmarks', m);
    $$(`details.iq[data-iq="${id}"]`).forEach((d) => syncMarks(d.parentElement));
    document.dispatchEvent(new CustomEvent('iqmarks'));
  });
  window.CHAPTER_INIT.__marks = syncMarks;

  window.CHAPTER_INIT.interview = (art) => {
    let level = 'all', show = 'all';
    const topicSel = $('[data-iv-topic]', art), stats = $('[data-iv-stats]', art);
    const qs = $$('details.iq', art), sections = $$('[data-iv-section]', art);
    const run = () => {
      const m = marks(), topic = topicSel.value;
      let shown = 0;
      for (const d of qs) {
        const mk = m[d.dataset.iq];
        const on = (level === 'all' || d.dataset.level === level) && (!topic || d.dataset.topic === topic) &&
          (show === 'all' || (show === 'repeat' && mk === 'repeat') || (show === 'new' && !mk));
        d.hidden = !on; if (on) shown++;
      }
      sections.forEach((s) => { s.hidden = !$$('details.iq', s).some((d) => !d.hidden); });
      const know = qs.filter((d) => m[d.dataset.iq] === 'know').length, rep = qs.filter((d) => m[d.dataset.iq] === 'repeat').length;
      stats.textContent = `Показано ${shown} из ${qs.length}. Отмечено «Знаю»: ${know}, «Повторить»: ${rep}.`;
    };
    $$('[data-iv-level]', art).forEach((b) => b.addEventListener('click', () => { level = b.dataset.ivLevel; $$('[data-iv-level]', art).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); run(); }));
    $$('[data-iv-show]', art).forEach((b) => b.addEventListener('click', () => { show = b.dataset.ivShow; $$('[data-iv-show]', art).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); run(); }));
    const exp = $('[data-iv-expand]', art);
    exp.addEventListener('click', () => { const open = exp.textContent === 'Раскрыть все'; qs.filter((d) => !d.hidden).forEach((d) => (d.open = open)); exp.textContent = open ? 'Свернуть все' : 'Раскрыть все'; });
    topicSel.addEventListener('change', run);
    document.addEventListener('iqmarks', run);
    syncMarks(art);
    run();
  };
  // отметки в главах (вопросы «Что важно для собеседования»)
  document.addEventListener('toggle', (e) => { if (e.target.matches && e.target.matches('details.iq') && e.target.open) syncMarks(e.target.parentElement); }, true);
})();

;
