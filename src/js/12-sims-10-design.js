/* ===== sims/10-design.js ===== */
/* ===== AQA System Design: интерактивная Process Timeline (данные — src/data/design.yaml через BOOK.design) ===== */
(function () {
  'use strict';
  const { el } = U;
  const PHASE_COLOR = { understand: 'var(--blue)', strategy: 'var(--violet)', build: 'var(--accent)', operate: 'var(--good)' };

  Sim.register('design-timeline', (root) => {
    const book = window.BOOK || JSON.parse(document.getElementById('book-data').textContent);
    const D = book.design;
    const chapters = Object.fromEntries(book.chapters.map((c) => [c.id, c]));
    const stages = D.stages;
    const idx = Object.fromEntries(stages.map((s, i) => [s.id, i]));
    const phaseTitle = Object.fromEntries(D.phases.map((p) => [p.id, p.title]));
    const fromHash = () => { const m = /\/aqa-design\/stage-([\w-]+)/.exec(decodeURIComponent(location.hash)); return m && idx[m[1]] !== undefined ? idx[m[1]] : null; };
    let cur = fromHash() ?? 0, loops = true;
    const article = root.closest('.chapter');
    if (article) article.classList.add('ds-live');
    const sh = UI.shell(root, {
      title: 'Process Timeline: организация AQA на новом проекте', icon: 'map', kicker: 'Карта процесса', layout: 'one',
      help: 'Нажмите на этап или используйте стрелки ← →. Дуги над шкалой — обратные связи: результаты поздних этапов возвращают к ранним решениям.',
      onReset: () => { cur = 0; loops = true; loopTgl.set(true, true); draw(); },
      captionTitle: 'Место этапа в процессе',
    });
    const col = sh.col();
    const loopTgl = UI.toggle(col, { label: 'Показывать обратные связи', value: true, onChange: (v) => { loops = v; draw(); } });
    const line = el('div', { class: 'dt-line', role: 'tablist', 'aria-label': 'Этапы' });
    const svgWrap = el('div', { class: 'dt-arcs', 'aria-hidden': 'true' });
    const track = el('div', { class: 'dt-track' }, [svgWrap, line]);
    const scroller = el('div', { class: 'dt-scroll' }, track);
    const detail = el('div', { class: 'dt-detail', role: 'tabpanel' });
    const nav = el('div', { class: 'btn-row dt-nav' });
    col.append(scroller, nav, detail);
    const prev = UI.button(nav, { label: 'Предыдущий этап', icon: 'chevron-left', onClick: () => go(cur - 1) });
    const next = UI.button(nav, { label: 'Следующий этап', icon: 'chevron-right', onClick: () => go(cur + 1) });
    function go(i) { if (i < 0 || i >= stages.length) return; cur = i; draw(); const b = line.children[cur]; if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); }
    line.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(cur + 1); line.children[cur].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(cur - 1); line.children[cur].focus(); }
      if (e.key === 'Home') { e.preventDefault(); go(0); line.children[cur].focus(); }
      if (e.key === 'End') { e.preventDefault(); go(stages.length - 1); line.children[cur].focus(); }
    });
    const NODE = 96; // ширина ячейки этапа
    function arcs() {
      U.clear(svgWrap);
      if (!loops) return;
      const W = stages.length * NODE, H = 64;
      const svg = U.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
      const cx = (i) => i * NODE + NODE / 2;
      stages.forEach((st, i) => st.links.forEach((l) => {
        const j = idx[l];
        if (j >= i - 1) return; // соседние и прямые связи не рисуем — только возвраты назад
        const on = i === cur || j === cur;
        const h = Math.min(H - 6, 14 + (i - j) * 5);
        svg.appendChild(U.svg('path', { d: `M${cx(i)},${H} C${cx(i)},${H - h} ${cx(j)},${H - h} ${cx(j)},${H}`, fill: 'none', stroke: on ? 'var(--accent)' : 'var(--border-2)', 'stroke-width': on ? 2.2 : 1.2, 'stroke-dasharray': on ? '' : '4 3', 'marker-end': 'url(#dt-arrow)' }));
      }));
      const defs = U.svg('defs', {}, U.svg('marker', { id: 'dt-arrow', viewBox: '0 0 8 8', refX: 4, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, U.svg('path', { d: 'M0,0 L8,4 L0,8 z', fill: 'var(--text-faint)' })));
      svg.prepend(defs);
      svgWrap.appendChild(svg);
    }
    function draw() {
      U.clear(line);
      let lastPhase = null;
      stages.forEach((st, i) => {
        const b = el('button', { type: 'button', role: 'tab', class: 'dt-node' + (i === cur ? ' is-sel' : '') + (st.links.includes(stages[cur].id) || stages[cur].links.includes(st.id) ? ' is-rel' : ''), 'aria-selected': String(i === cur), tabindex: i === cur ? '0' : '-1', style: `--pc:${PHASE_COLOR[st.phase]}`, title: st.title }, [
          el('span', { class: 'dt-ph' + (st.phase !== lastPhase ? ' first' : ''), text: st.phase !== lastPhase ? phaseTitle[st.phase] : '' }),
          el('span', { class: 'dt-dot', text: String(i + 1) }),
          el('span', { class: 'dt-name', text: st.title }),
        ]);
        lastPhase = st.phase;
        b.addEventListener('click', () => go(i));
        line.appendChild(b);
      });
      arcs();
      prev.disabled = cur === 0; next.disabled = cur === stages.length - 1;
      const st = stages[cur];
      const list = (xs) => el('ul', {}, xs.map((x) => el('li', { text: x })));
      U.clear(detail);
      detail.append(
        el('div', { class: 'dt-head' }, [el('span', { class: 'badge', style: `color:${PHASE_COLOR[st.phase]}`, text: `${String(cur + 1).padStart(2, '0')} · ${phaseTitle[st.phase]}` }), el('h4', { text: st.title })]),
        el('p', { class: 'dt-goal' }, [el('b', { text: 'Цель. ' }), st.goal]),
        el('div', { class: 'dt-cols' }, [
          el('div', {}, [el('div', { class: 'card-sub', text: 'Входные данные' }), list(st.inputs), el('div', { class: 'card-sub', text: 'Основные действия' }), list(st.actions)]),
          el('div', {}, [el('div', { class: 'card-sub', text: 'Инструменты' }), list(st.tools), el('div', { class: 'card-sub', text: 'Инженерные решения' }), list(st.decisions), el('div', { class: 'card-sub', text: 'Типичные проблемы' }), list(st.problems)]),
        ]),
        el('p', { class: 'dt-result' }, [el('b', { text: 'Ожидаемый результат. ' }), st.result]),
      );
      const rel = el('div', { class: 'btn-row' });
      st.links.forEach((l) => UI.button(rel, { label: `${idx[l] + 1}. ${stages[idx[l]].title}`, cls: idx[l] < cur ? 'dt-back' : '', title: idx[l] < cur ? 'Возврат к более раннему этапу' : 'Следующий связанный этап', onClick: () => go(idx[l]) }));
      detail.append(el('div', { class: 'card-sub', text: 'Связанные этапы' }), rel);
      const chs = el('div', { class: 'dt-ch' });
      st.chapters.forEach((ref) => { const [cid, anchor] = ref.split('/'); const c = chapters[cid]; chs.appendChild(el('a', { href: `#/${cid}${anchor ? '/' + anchor : ''}`, class: 'chip', text: c ? (c.short || c.title) : cid })); });
      detail.append(el('div', { class: 'card-sub', text: 'Главы учебника' }), chs);
      const back = st.links.filter((l) => idx[l] < cur).map((l) => `${idx[l] + 1}. ${stages[idx[l]].title}`);
      const fwd = st.links.filter((l) => idx[l] > cur).map((l) => `${idx[l] + 1}. ${stages[idx[l]].title}`);
      sh.say(`<p>${fwd.length ? `Результат этапа — вход для «${fwd.join('», «')}».` : 'Это завершающий этап цикла.'}${back.length ? ` Обратная связь: находки этого этапа возвращают к «${back.join('», «')}» — процесс итеративный.` : ''}</p>`);
    }
    window.addEventListener('hashchange', () => { const h = fromHash(); if (h !== null && h !== cur) { cur = h; draw(); root.scrollIntoView({ block: 'start' }); } });
    draw();
  });
})();

;
