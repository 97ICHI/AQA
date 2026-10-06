/* ===== app.js: маршрутизация, оглавление, поиск, термины, квизы, прогресс, режимы, настройки, печать ===== */
(function () {
  'use strict';
  const { $, $$, el } = U;
  const BOOK = JSON.parse(document.getElementById('book-data').textContent);
  window.BOOK = BOOK;
  const CH = BOOK.chapters;
  const byId = Object.fromEntries(CH.map((c) => [c.id, c]));
  const secById = Object.fromEntries(BOOK.sections.map((s) => [s.id, s]));
  const countable = CH.filter((c) => c.countable);
  const state = {
    current: null,
    read: U.store.get('read', {}),
    answers: U.store.get('answers', {}),
    marks: U.store.get('iqmarks', {}),
    settings: Object.assign({ theme: 'dark', fontSize: 'm', motion: 'system', deepOpen: false, brightness: 80, mode: 'learn' }, U.store.get('settings', {})),
  };
  const artOf = (id) => document.getElementById('/' + id);

  // ---------- настройки ----------
  function applySettings() {
    const s = state.settings, root = document.documentElement;
    s.brightness = U.clamp(Number(s.brightness) || 80, 35, 100);
    root.style.setProperty('--background-level', String(s.brightness / 100));
    let t = s.theme;
    if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    root.dataset.theme = t;
    if (s.fontSize === 'm') delete root.dataset.fs; else root.dataset.fs = s.fontSize;
    if (s.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion;
    root.dataset.study = s.mode === 'recall' ? 'recall' : 'learn';
    $$('[data-study-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.studyMode === root.dataset.study)));
  }
  function saveSettings() { U.store.set('settings', state.settings); applySettings(); document.dispatchEvent(new CustomEvent('themechange')); }
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (state.settings.theme === 'auto') saveSettings(); });

  // ---------- прогресс ----------
  function updateProgress() {
    const n = countable.filter((c) => state.read[c.id]).length;
    $('#prog-n').textContent = n;
    $('#prog-total').textContent = countable.length;
    const pct = countable.length ? Math.round((n / countable.length) * 100) : 0;
    $('#prog-fill').style.width = pct + '%';
    $('.tp-bar').setAttribute('aria-valuenow', pct);
    $$('.toc-link').forEach((a) => a.classList.toggle('is-read', !!state.read[a.dataset.id]));
    $$('.toc-sec').forEach((sec) => {
      const s = secById[sec.dataset.section], out = $('.toc-sec-prog', sec);
      if (!s || !out) return;
      const list = s.chapters.filter((id) => byId[id] && byId[id].countable);
      const done = list.filter((id) => state.read[id]).length;
      out.textContent = list.length ? `${done}/${list.length}` : '';
    });
    $$('[data-home-prog]').forEach((x) => {
      const s = secById[x.dataset.homeProg]; if (!s) return;
      const list = s.chapters.filter((id) => byId[id] && byId[id].countable);
      x.textContent = `Изучено ${list.filter((id) => state.read[id]).length} из ${list.length}`;
    });
    $$('[data-read-toggle]').forEach((b) => {
      const id = b.closest('.chapter').dataset.chapter, on = !!state.read[id];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('span').textContent = on ? 'Изучено' : 'Отметить как изученную';
    });
  }

  // ---------- маршрутизация ----------
  function parseHash() {
    let h = location.hash || '';
    try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
    h = h.replace(/^#\/?/, '');
    const [ch, ...rest] = h.split('/');
    const ok = !!byId[ch];
    return { ch: ok ? ch : 'intro', anchor: ok && rest.length ? rest.join('/') : null };
  }
  function route() { const { ch, anchor } = parseHash(); show(ch, anchor); }
  function show(id, anchor) {
    const changed = state.current !== id;
    if (changed) {
      Runner.pauseAll();
      if (state.current) { const old = artOf(state.current); if (old) old.classList.remove('is-active', 'src-open'); }
      const art = artOf(id);
      art.classList.add('is-active');
      prepare(art);
      state.current = id;
      U.store.set('last', id);
      const c = byId[id];
      document.title = `${c.title} — AQA Lab`;
      $$('.toc-link').forEach((a) => (a.dataset.id === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
      const cur = $('.toc-link[aria-current="page"]');
      if (cur && !isNarrow()) cur.scrollIntoView({ block: 'nearest' });
      buildCrumbs(c);
      const i = CH.indexOf(c);
      $('[data-action="prev"]').disabled = i <= 0;
      $('[data-action="next"]').disabled = i >= CH.length - 1;
      closeNav();
    }
    requestAnimationFrame(() => {
      if (anchor) {
        const t = document.getElementById(`/${id}/${anchor}`);
        if (t) {
          if (document.documentElement.dataset.study === 'recall' && t.closest('.prose')) artOf(id).classList.add('src-open'), syncSrcBtn(artOf(id));
          if (t.tagName === 'DETAILS') t.open = true;
          const d = t.parentElement && t.parentElement.closest('details'); if (d) d.open = true;
          t.scrollIntoView({ block: 'start' });
          if (t.classList.contains('gl-item') || t.classList.contains('iq')) { t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); }
          return;
        }
      }
      if (changed) { window.scrollTo(0, 0); const h1 = artOf(id).querySelector('h1'); if (h1) h1.focus({ preventScroll: true }); }
    });
  }
  function buildCrumbs(c) {
    const ol = U.clear($('#crumbs'));
    const sec = secById[c.section];
    ol.appendChild(el('li', {}, [el('a', { href: '#/' + sec.chapters[0], text: sec.nav || sec.title }), U.icon('chevron-right')]));
    ol.appendChild(el('li', { 'aria-current': 'page', text: c.title }));
  }
  function go(d) { const i = CH.indexOf(byId[state.current]); const n = CH[i + d]; if (n) location.hash = '#/' + n.id; }

  // ---------- подготовка главы ----------
  const io = window.IntersectionObserver ? new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); Sim.mount(e.target); }
  }, { rootMargin: '400px 0px' }) : null;
  function prepare(art) {
    if (art.dataset.ready) return;
    art.dataset.ready = '1';
    if (state.settings.deepOpen) art.querySelectorAll('details.deep').forEach((d) => (d.open = true));
    art.querySelectorAll('.quiz-block').forEach(initQuiz);
    art.querySelectorAll('.sim-mount').forEach((n) => (io ? io.observe(n) : Sim.mount(n)));
    if (window.CHAPTER_INIT && window.CHAPTER_INIT[art.dataset.chapter]) { try { window.CHAPTER_INIT[art.dataset.chapter](art); } catch (e) { console.error(e); } }
    updateProgress();
  }
  function mountAll(art) { art.querySelectorAll('.sim-mount').forEach((n) => Sim.mount(n)); }

  // ---------- квизы ----------
  function initQuiz(block) {
    const qs = $$('.quiz', block), score = $('.quiz-score', block);
    const upd = () => {
      const done = qs.filter((q) => state.answers[q.dataset.qid] !== undefined);
      const ok = done.filter((q) => { const b = q.querySelector(`.quiz-opt[data-k="${state.answers[q.dataset.qid]}"]`); return b && b.dataset.ok === '1'; }).length;
      score.textContent = done.length ? `верно ${ok} из ${qs.length}` : '';
      let retry = block.querySelector('.quiz-retry');
      if (done.length === qs.length && !retry) {
        retry = el('button', { type: 'button', class: 'btn btn-sm quiz-retry' }, [U.icon('reset'), el('span', { text: 'Пройти заново' })]);
        retry.addEventListener('click', () => { qs.forEach((q) => { delete state.answers[q.dataset.qid]; reset(q); }); U.store.set('answers', state.answers); retry.remove(); upd(); });
        block.appendChild(retry);
      } else if (done.length < qs.length && retry) retry.remove();
    };
    const reset = (q) => { $$('.quiz-opt', q).forEach((b) => { b.disabled = false; b.classList.remove('chosen', 'bad', 'reveal-ok'); b.removeAttribute('aria-pressed'); }); $('.quiz-expl', q).hidden = true; };
    const apply = (q, k) => {
      const opts = $$('.quiz-opt', q), chosen = opts.find((b) => b.dataset.k === String(k));
      if (!chosen) return;
      const ok = chosen.dataset.ok === '1';
      opts.forEach((b) => { b.disabled = true; if (b.dataset.ok === '1') b.classList.add('reveal-ok'); });
      chosen.classList.add('chosen', ok ? 'ok' : 'bad'); chosen.setAttribute('aria-pressed', 'true');
      const v = $('.quiz-verdict', q);
      v.textContent = ok ? 'Верно.' : 'Не совсем. Правильный вариант отмечен зелёным.';
      v.className = 'quiz-verdict ' + (ok ? 'ok' : 'bad');
      $('.quiz-expl', q).hidden = false;
    };
    qs.forEach((q) => {
      $$('.quiz-opt', q).forEach((b) => b.addEventListener('click', () => { state.answers[q.dataset.qid] = +b.dataset.k; U.store.set('answers', state.answers); apply(q, b.dataset.k); upd(); }));
      if (state.answers[q.dataset.qid] !== undefined) apply(q, state.answers[q.dataset.qid]);
    });
    upd();
  }

  // ---------- термины ----------
  const pop = $('#term-pop');
  let popFor = null, hideT = null, showT = null;
  function openPop(btn) {
    const id = btn.dataset.term, g = BOOK.glossary[id];
    if (!g) return;
    if (popFor && popFor !== btn) popFor.setAttribute('aria-expanded', 'false');
    popFor = btn; btn.setAttribute('aria-expanded', 'true');
    const ch = byId[g.ch];
    pop.innerHTML = `<div><span class="tp-term">${U.esc(g.en)}</span><span class="tp-ru">${U.esc(g.ru)}</span></div><div class="tp-def">${g.def}</div><div class="tp-links"><a href="#/glossary/${id}">В глоссарий →</a>${ch && ch.id !== state.current ? `<a href="#/${ch.id}${g.anchor ? '/' + g.anchor : ''}">${U.esc(ch.title)} →</a>` : ''}</div>`;
    pop.setAttribute('aria-label', `${g.en} — ${g.ru}`);
    pop.hidden = false; pop.tabIndex = -1;
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    const x = Math.min(innerWidth - pw - 12, Math.max(12, r.left + r.width / 2 - pw / 2));
    let y = r.bottom + 8;
    if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function closePop(focus) { if (!popFor) return; const t = popFor; popFor = null; pop.hidden = true; t.setAttribute('aria-expanded', 'false'); if (focus) t.focus(); }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.term');
    if (t) { e.preventDefault(); if (popFor === t && !pop.hidden) closePop(); else { openPop(t); if (e.detail === 0) pop.focus({ preventScroll: true }); } return; }
    if (!e.target.closest('#term-pop') || e.target.closest('#term-pop a')) closePop();
  });
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('.term');
    if (t && matchMedia('(hover: hover)').matches) { clearTimeout(hideT); clearTimeout(showT); showT = setTimeout(() => openPop(t), 300); }
    else if (e.target.closest && e.target.closest('#term-pop')) clearTimeout(hideT);
  });
  document.addEventListener('mouseout', (e) => {
    const t = e.target.closest && (e.target.closest('.term') || e.target.closest('#term-pop'));
    if (t && matchMedia('(hover: hover)').matches) { clearTimeout(showT); hideT = setTimeout(() => closePop(), 260); }
  });
  window.addEventListener('scroll', () => { if (popFor && !pop.contains(document.activeElement)) closePop(); }, { passive: true });
  pop.addEventListener('focusout', (e) => { if (popFor && !pop.contains(e.relatedTarget) && e.relatedTarget !== popFor) closePop(); });

  // ---------- поиск ----------
  let INDEX = null;
  function buildIndex() {
    INDEX = [];
    for (const c of CH) {
      const art = artOf(c.id);
      INDEX.push({ kind: 'head', ch: c.id, text: c.title, norm: U.norm(c.title + ' ' + (c.short || '')), w: 14 });
      art.querySelectorAll('.prose h2[id], .prose h3[id]').forEach((h) => {
        const text = h.textContent.replace(/#$/, '').trim();
        INDEX.push({ kind: 'head', ch: c.id, anchor: h.dataset.anchor, text, norm: U.norm(text), w: 9 });
      });
      if (c.id === 'glossary') continue;
      art.querySelectorAll('.prose p, .prose li, .prose td, .callout-head, .iq-q, .quiz-q, .deep-title, .check summary').forEach((n) => {
        if (n.closest('.sim-mount') || n.closest('.gl-item')) return;
        const text = n.textContent.replace(/\s+/g, ' ').trim();
        if (text.length < 12) return;
        INDEX.push({ kind: 'text', ch: c.id, node: n, text, norm: U.norm(text), w: 1 });
      });
    }
    for (const id in BOOK.glossary) {
      const g = BOOK.glossary[id], def = el('div', { html: g.def }).textContent;
      INDEX.push({ kind: 'term', ch: 'glossary', anchor: id, text: g.en, ru: g.ru, def, norm: U.norm(g.en + ' ' + g.ru + ' ' + (g.aliases || '')), normDef: U.norm(def), w: 12 });
    }
  }
  function search(q) {
    if (!INDEX) buildIndex();
    const words = U.norm(q).split(/[\s,.;:!?()«»"']+/).filter((w) => w.length >= 2);
    const out = { heads: [], terms: [], text: [] };
    if (!words.length) return { out, words };
    const res = [];
    for (const it of INDEX) {
      const hay = it.kind === 'term' ? it.norm + ' ' + it.normDef : it.norm;
      if (!words.every((w) => hay.includes(w))) continue;
      let score = it.w;
      for (const w of words) { if (it.norm.includes(w)) score += it.w; if (it.norm.startsWith(w)) score += 4; }
      res.push({ it, score });
    }
    res.sort((a, b) => b.score - a.score);
    for (const r of res) { const k = r.it.kind === 'term' ? 'terms' : r.it.kind === 'text' ? 'text' : 'heads'; if (out[k].length < (k === 'text' ? 10 : 6)) out[k].push(r.it); }
    return { out, words };
  }
  function highlight(text, words, max) {
    let s = text;
    if (max && s.length > max) {
      const n = U.norm(s); let pos = -1;
      for (const w of words) { const p = n.indexOf(w); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
      const start = Math.max(0, pos - Math.floor(max / 3));
      s = (start > 0 ? '…' : '') + s.slice(start, start + max) + (start + max < text.length ? '…' : '');
    }
    let h = U.esc(s);
    for (const w of words) h = h.replace(new RegExp('(' + U.esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]') + ')', 'gi'), '<mark>$1</mark>');
    return h;
  }
  const sInput = $('#search-input'), sBox = $('#search-results');
  let sItems = [], sSel = -1;
  function renderSearch() {
    const q = sInput.value.trim();
    U.clear(sBox); sItems = []; sSel = -1;
    if (q.length < 2) { sBox.hidden = true; sInput.setAttribute('aria-expanded', 'false'); return; }
    const { out, words } = search(q);
    const add = (title, list, make) => {
      if (!list.length) return;
      sBox.appendChild(el('div', { class: 'sr-group', text: title }));
      for (const it of list) { const b = el('button', { type: 'button', class: 'sr-item', role: 'option', id: U.uid('sr'), html: make(it) }); b.addEventListener('click', () => openResult(it)); sBox.appendChild(b); sItems.push(b); }
    };
    add('Главы и разделы', out.heads, (it) => `<span class="sr-title">${highlight(it.text, words)}</span><span class="sr-where">${U.esc(byId[it.ch].title)}</span>`);
    add('Термины', out.terms, (it) => `<span class="sr-title">${highlight(it.text, words)} <span class="tp-ru">${U.esc(it.ru)}</span></span><span class="sr-snip">${highlight(it.def, words, 110)}</span>`);
    add('В тексте', out.text, (it) => `<span class="sr-where">${U.esc(byId[it.ch].title)}</span><span class="sr-snip">${highlight(it.text, words, 140)}</span>`);
    if (!sItems.length) sBox.appendChild(el('div', { class: 'sr-empty', text: 'Ничего не найдено. Попробуйте другую форму слова или английский термин.' }));
    sBox.hidden = false; sInput.setAttribute('aria-expanded', 'true');
  }
  function openResult(it) {
    sBox.hidden = true; sInput.setAttribute('aria-expanded', 'false');
    if (it.kind === 'text') {
      if (location.hash !== '#/' + it.ch) history.pushState(null, '', '#/' + it.ch);
      show(it.ch);
      const art = artOf(it.ch);
      if (document.documentElement.dataset.study === 'recall' && it.node.closest('.prose')) { art.classList.add('src-open'); syncSrcBtn(art); }
      const d = it.node.closest('details'); if (d) d.open = true;
      setTimeout(() => { it.node.scrollIntoView({ block: 'center' }); it.node.classList.remove('flash'); void it.node.offsetWidth; it.node.classList.add('flash'); }, 40);
    } else location.hash = '#/' + it.ch + (it.anchor ? '/' + it.anchor : '');
    closeNav();
  }
  sInput.addEventListener('input', U.debounce(renderSearch, 120));
  sInput.addEventListener('focus', () => { if (!INDEX) setTimeout(buildIndex, 0); if (sInput.value.trim().length >= 2) renderSearch(); });
  sInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!sItems.length) return;
      e.preventDefault();
      sSel = (sSel + (e.key === 'ArrowDown' ? 1 : -1) + sItems.length) % sItems.length;
      sItems.forEach((b, i) => b.setAttribute('aria-selected', i === sSel ? 'true' : 'false'));
      sItems[sSel].scrollIntoView({ block: 'nearest' });
      sInput.setAttribute('aria-activedescendant', sItems[sSel].id);
    } else if (e.key === 'Enter') { if (sItems[Math.max(0, sSel)]) { e.preventDefault(); sItems[Math.max(0, sSel)].click(); } }
    else if (e.key === 'Escape') { sBox.hidden = true; sInput.blur(); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) { sBox.hidden = true; sInput.setAttribute('aria-expanded', 'false'); } });

  // ---------- мобильное меню ----------
  const isNarrow = () => matchMedia('(max-width: 960px)').matches;
  function openNav() { $('#sidebar').classList.add('open'); $('.backdrop').hidden = false; $('.menu-btn').setAttribute('aria-expanded', 'true'); setTimeout(() => { const c = $('.toc-link[aria-current="page"]') || $('#search-input'); c.focus({ preventScroll: false }); }, 60); }
  function closeNav() { const was = $('#sidebar').classList.contains('open'); $('#sidebar').classList.remove('open'); $('.backdrop').hidden = true; $('.menu-btn').setAttribute('aria-expanded', 'false'); if (was && isNarrow()) $('.menu-btn').focus({ preventScroll: true }); }

  // ---------- режимы ----------
  function setMode(m) { state.settings.mode = m; saveSettings(); }
  function syncSrcBtn(art) { const b = art.querySelector('[data-src-toggle]'); if (b) { const on = art.classList.contains('src-open'); b.setAttribute('aria-expanded', String(on)); b.querySelector('span').textContent = on ? 'Скрыть полный материал' : 'Открыть полный материал'; } }

  // ---------- настройки ----------
  function openSettings() {
    const dlg = $('#settings-modal');
    U.clear(dlg);
    const head = el('div', { class: 'modal-head' }, [el('h2', { id: 'settings-title', text: 'Настройки и прогресс' }), el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Закрыть', onclick: () => dlg.close() }, [U.icon('x')])]);
    const body = el('div', { class: 'modal-body' });
    const row = (label, ctl, hint) => body.appendChild(el('div', { class: 'set-row' }, [el('div', { class: 'set-label', text: label }), ctl, hint ? el('p', { text: hint }) : null]));
    const s = state.settings;
    const seg = (opts, key, aria) => { const box = el('div'); UI.seg(box, { aria, options: opts, value: s[key], onChange: (v) => { s[key] = v; saveSettings(); } }); return box; };
    row('Тема', seg([{ value: 'dark', label: 'Тёмная' }, { value: 'light', label: 'Светлая' }, { value: 'auto', label: 'Как в системе' }], 'theme', 'Тема'));
    const br = el('input', { type: 'range', min: '35', max: '100', step: '1', value: String(s.brightness), 'aria-label': 'Яркость фона' });
    const out = el('output', { text: s.brightness + '%' });
    const paint = () => br.style.setProperty('--fill', ((+br.value - 35) / 65) * 100 + '%');
    paint();
    br.addEventListener('input', () => { s.brightness = +br.value; out.textContent = s.brightness + '%'; paint(); U.store.set('settings', s); applySettings(); });
    row('Яркость фона', el('div', { class: 'range-row' }, [br, out]), 'Приглушает декоративный фон. Цвета текста, кода и графиков не меняются.');
    row('Размер текста', seg([{ value: 's', label: 'Мельче' }, { value: 'm', label: 'Обычный' }, { value: 'l', label: 'Крупнее' }, { value: 'xl', label: 'Крупный' }], 'fontSize', 'Размер текста'));
    row('Анимации', seg([{ value: 'system', label: 'Как в системе' }, { value: 'reduce', label: 'Уменьшить' }], 'motion', 'Анимации'), 'При уменьшении проигрыватели идут медленнее и без плавных переходов.');
    const deep = el('div'); UI.toggle(deep, { label: 'Раскрывать блоки «Глубже» по умолчанию', value: s.deepOpen, onChange: (v) => { s.deepOpen = v; saveSettings(); } });
    row('Детализация', deep);
    const n = countable.filter((c) => state.read[c.id]).length, na = Object.keys(state.answers).length;
    const prog = el('div', { class: 'btn-row' });
    UI.button(prog, { label: 'Печать всего учебника', icon: 'printer', onClick: () => { dlg.close(); printAll(); } });
    UI.button(prog, { label: 'Сбросить прогресс', icon: 'reset', cls: 'danger', onClick: () => {
      if (!confirm('Сбросить отметки глав, ответы на тесты и отметки вопросов собеседования? Настройки сохранятся.')) return;
      state.read = {}; state.answers = {}; state.marks = {};
      U.store.set('read', {}); U.store.set('answers', {}); U.store.set('iqmarks', {});
      dlg.close(); toast('Прогресс сброшен'); setTimeout(() => location.reload(), 600);
    } });
    row(`Прогресс: изучено ${n} из ${countable.length} глав, ответов в тестах: ${na}`, prog, 'Прогресс и настройки хранятся только в этом браузере (localStorage).');
    body.appendChild(el('p', { class: 'set-row', html: '<small>Клавиши: <kbd>Ctrl</kbd>+<kbd>K</kbd> или <kbd>/</kbd> — поиск, <kbd>[</kbd> и <kbd>]</kbd> — предыдущая и следующая глава, <kbd>Esc</kbd> — закрыть подсказку или меню.</small>' }));
    dlg.append(head, body);
    dlg.showModal();
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2400); }

  // ---------- печать ----------
  let printOpened = [];
  window.addEventListener('beforeprint', () => {
    const art = artOf(state.current);
    if (art) { art.classList.add('print-on'); mountAll(art); }
    printOpened = $$('details:not([open])').filter((d) => document.body.classList.contains('print-all') || d.closest('.chapter') === art);
    printOpened.forEach((d) => (d.open = true));
  });
  window.addEventListener('afterprint', () => { printOpened.forEach((d) => (d.open = false)); printOpened = []; $$('.chapter.print-on').forEach((a) => a.classList.remove('print-on')); document.body.classList.remove('print-all'); });
  function printAll() { toast('Готовлю все главы к печати…'); setTimeout(() => { CH.forEach((c) => prepare(artOf(c.id))); document.body.classList.add('print-all'); setTimeout(() => window.print(), 400); }, 50); }

  // ---------- копирование кода ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.code-copy');
    if (!b) return;
    const code = b.closest('.code').querySelector('pre').innerText;
    const done = () => { b.textContent = 'Скопировано'; setTimeout(() => (b.textContent = 'Копировать'), 1400); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(done, () => fallbackCopy(code, done)); else fallbackCopy(code, done);
  });
  function fallbackCopy(text, done) { const t = el('textarea', { style: 'position:fixed;opacity:0' }); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); } t.remove(); }

  // ---------- события ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (a) {
      const act = a.dataset.action;
      if (act === 'prev') go(-1);
      else if (act === 'next') go(1);
      else if (act === 'theme') { state.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; saveSettings(); }
      else if (act === 'open-nav') openNav();
      else if (act === 'close-nav') closeNav();
      else if (act === 'settings') openSettings();
      else if (act === 'print') window.print();
      else if (act === 'search') { openNav(); setTimeout(() => sInput.focus(), 80); }
    }
    const m = e.target.closest('[data-study-mode]');
    if (m) setMode(m.dataset.studyMode);
    const src = e.target.closest('[data-src-toggle]');
    if (src) { const art = src.closest('.chapter'); art.classList.toggle('src-open'); syncSrcBtn(art); }
    const rt = e.target.closest('[data-read-toggle]');
    if (rt) {
      const id = rt.closest('.chapter').dataset.chapter;
      if (state.read[id]) delete state.read[id]; else state.read[id] = true;
      U.store.set('read', state.read); updateProgress();
      if (state.read[id]) toast('Глава отмечена как изученная');
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (isNarrow()) openNav(); sInput.focus(); sInput.select(); return; }
    if (e.key === 'Escape') { if (popFor) closePop(true); else if ($('#sidebar').classList.contains('open')) closeNav(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); if (isNarrow()) openNav(); sInput.focus(); }
    else if (e.key === '[') go(-1);
    else if (e.key === ']') go(1);
  });
  window.addEventListener('hashchange', route);

  // ---------- старт ----------
  applySettings();
  updateProgress();
  if (!location.hash) { const last = U.store.get('last', null); if (last && byId[last]) history.replaceState(null, '', '#/' + last); }
  route();
  window.APP = { show, state, prepare, updateProgress, toast, artOf, byId };
})();

