/* ===== core.js: утилиты DOM, хранилище, каркас интерактивов (UI, Sim, Runner), SVG-график ===== */
(function () {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const U = {};
  U.$ = (s, r) => (r || document).querySelector(s);
  U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function attrs(node, a) {
    if (!a) return node;
    for (const k in a) {
      const v = a[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.setAttribute('class', v);
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    return node;
  }
  function kids(node, k) {
    if (k === undefined || k === null) return node;
    if (!Array.isArray(k)) k = [k];
    for (const c of k) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
  }
  U.el = (t, a, k) => kids(attrs(document.createElement(t), a), k);
  U.svg = (t, a, k) => kids(attrs(document.createElementNS(SVGNS, t), a), k);
  U.icon = (name, cls) => {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', cls || 'ico'); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.innerHTML = (window.ICONS && window.ICONS[name]) || '';
    return s;
  };
  U.clear = (n) => { while (n && n.firstChild) n.removeChild(n.firstChild); return n; };
  U.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  U.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  U.norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
  U.fmt = (x, d = 0) => {
    if (x === null || x === undefined || Number.isNaN(x)) return '—';
    if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
    let s = Number(x).toFixed(d);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    const [i, f] = s.split('.');
    const neg = i.startsWith('-');
    const g = (neg ? i.slice(1) : i).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '−' : '') + g + (f !== undefined ? ',' + f : '');
  };
  U.pct = (x, d = 0) => (Number.isFinite(x) ? U.fmt(x * 100, d) + '%' : '—');
  U.dur = (ms) => {
    if (!Number.isFinite(ms)) return '—';
    const s = ms / 1000;
    if (s < 60) return U.fmt(s, s < 10 ? 1 : 0) + ' с';
    const m = Math.floor(s / 60), r = Math.round(s - m * 60);
    if (m < 60) return m + ' мин' + (r ? ' ' + r + ' с' : '');
    const h = Math.floor(m / 60);
    return h + ' ч ' + (m - h * 60) + ' мин';
  };
  U.plural = (n, one, few, many) => {
    const a = Math.abs(Math.round(n)) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  };
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  let uidN = 0;
  U.uid = (p = 'u') => `${p}${++uidN}`;
  U.reducedMotion = () => document.documentElement.dataset.motion === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PREFIX = 'aqalab:';
  U.store = {
    get(k, f) { try { const v = localStorage.getItem(PREFIX + k); if (v === null) return f; const parsed = JSON.parse(v); if (f && typeof f === 'object' && !Array.isArray(f)) return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : f; return parsed; } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    clearAll() { try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ } },
  };
  /** Детерминированный генератор (mulberry32): учебные данные воспроизводимы. */
  U.rng = (seed) => {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  /** Мини-подсветка кода для динамических фрагментов (TS/JS/YAML). Статический код подсвечивается при сборке. */
  U.hl = (code, lang) => {
    const src = String(code);
    const KW = /\b(await|async|const|let|var|function|return|if|else|for|of|in|while|new|import|from|export|default|class|extends|implements|interface|type|try|catch|finally|throw|true|false|null|undefined|this|test|expect)\b/;
    const rules = lang === 'yaml'
      ? [[/#[^\n]*/y, 'c1'], [/"(?:[^"\\]|\\.)*"|'[^']*'/y, 's'], [/[\w.-]+(?=\s*:)/y, 'na'], [/\b\d+\b/y, 'mi']]
      : lang === 'http'
        ? [[/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/my, 'k'], [/HTTP\/\d(\.\d)?/y, 'kt'], [/^[\w-]+(?=:)/my, 'na'], [/"(?:[^"\\]|\\.)*"/y, 's'], [/\b\d+(\.\d+)?\b/y, 'mi']]
        : [[/\/\/[^\n]*/y, 'c1'], [/`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/y, 's'], [new RegExp(KW.source, 'y'), 'k'], [/\b[A-Z][A-Za-z0-9_]*\b/y, 'kt'], [/\b\d+(\.\d+)?\b/y, 'mi'], [/\b[a-zA-Z_$][\w$]*(?=\()/y, 'nf']];
    let out = '', i = 0;
    outer: while (i < src.length) {
      for (const [re, cls] of rules) {
        re.lastIndex = i;
        const m = re.exec(src);
        if (m && m.index === i && m[0].length) { out += `<span class="${cls}">${U.esc(m[0])}</span>`; i += m[0].length; continue outer; }
      }
      out += U.esc(src[i]); i++;
    }
    return out;
  };
  window.U = U;

  /* ---------- Каркас интерактивов ---------- */
  const el = U.el;
  const UI = {};
  /** Оболочка: заголовок, инструкция, тулбар, сетка, подпись «Что происходит». */
  UI.shell = (root, o) => {
    U.clear(root);
    const wrap = el('section', { class: 'sim', 'aria-label': o.title });
    const titleBox = el('div', { style: 'min-width:0;flex:1 1 18rem' }, [
      el('div', { class: 'sim-kicker' }, [U.icon(o.icon || 'play'), o.kicker || 'Интерактив']),
      el('h3', { class: 'sim-title', text: o.title }),
      o.help ? el('p', { class: 'sim-help', html: o.help }) : null,
    ]);
    const toolbar = el('div', { class: 'sim-toolbar', role: 'toolbar', 'aria-label': 'Управление' });
    const head = el('div', { class: 'sim-head' }, [titleBox, toolbar]);
    const grid = el('div', { class: 'sim-grid ' + (o.layout || '') });
    wrap.append(head, grid);
    const capBody = el('div', { class: 'sim-caption-body', 'aria-live': 'polite' });
    const caption = el('div', { class: 'sim-caption' }, [el('div', { class: 'sim-caption-head' }, [U.icon('eye'), o.captionTitle || 'Что происходит']), capBody]);
    if (o.caption !== false) wrap.append(caption);
    if (o.note) wrap.append(el('div', { class: 'sim-note' }, [U.icon('info'), el('span', { html: o.note })]));
    root.appendChild(wrap);
    const sh = {
      root: wrap, head, toolbar, grid, caption, capBody,
      col(cls) { return grid.appendChild(el('div', { class: 'sim-col ' + (cls || '') })); },
      say(html) { capBody.innerHTML = html; },
      button(b) { return UI.button(toolbar, b); },
    };
    if (o.onReset) sh.resetBtn = UI.button(toolbar, { label: 'Сбросить', icon: 'reset', onClick: o.onReset, title: 'Вернуть исходное состояние' });
    return sh;
  };
  UI.button = (parent, b) => {
    const btn = el('button', { type: 'button', class: 'btn btn-sm' + (b.primary ? ' btn-primary' : '') + (b.cls ? ' ' + b.cls : ''), title: b.title || undefined, 'aria-label': b.aria || undefined });
    if (b.icon) btn.appendChild(U.icon(b.icon));
    const lab = el('span', { text: b.label });
    btn.appendChild(lab);
    btn.addEventListener('click', (e) => b.onClick && b.onClick(e));
    btn.setLabel = (t, icon) => { lab.textContent = t; if (icon) { const old = btn.querySelector('svg'); const n = U.icon(icon); if (old) old.replaceWith(n); else btn.prepend(n); } };
    if (parent) parent.appendChild(btn);
    return btn;
  };
  UI.card = (parent, o = {}) => {
    const card = el('div', { class: 'card' + (o.cls ? ' ' + o.cls : '') });
    if (o.title || o.legend || o.sub) {
      const h = el('div', { class: 'card-head' }, [el('div', {}, [el('div', { class: 'card-title', html: o.title || '' }), o.sub ? el('div', { class: 'card-sub', html: o.sub }) : null])]);
      if (o.legend) h.appendChild(UI.legend(o.legend));
      card.appendChild(h);
    }
    const body = el('div', { class: 'card-body' });
    card.appendChild(body); card.body = body;
    if (parent) parent.appendChild(card);
    return card;
  };
  UI.legend = (items) => el('div', { class: 'legend' }, items.map((it) => el('span', {}, [el('i', { class: it.dot ? 'dot' : '', style: `background:${it.color}` }), el('span', { html: it.label })])));
  UI.slider = (parent, o) => {
    const id = U.uid('s');
    const wrap = el('div', { class: 'ctl' });
    const color = o.color || 'var(--accent)';
    const lab = el('label', { class: 'ctl-label', for: id, html: o.label });
    const num = el('input', { class: 'ctl-num', type: 'number', step: 'any', min: o.min, max: o.max, 'aria-label': o.label.replace(/<[^>]+>/g, '') + ' — точное значение', style: `--c:${color}` });
    const range = el('input', { type: 'range', id, min: o.min, max: o.max, step: o.step || 1, style: `--c:${color}` });
    const fmt = o.fmt || ((v) => String(v));
    wrap.append(lab, num, el('div', { class: 'ctl-range' }, [el('span', { class: 'mm', text: o.minLabel ?? fmt(o.min) }), range, el('span', { class: 'mm', text: o.maxLabel ?? fmt(o.max) })]));
    if (o.hint) wrap.appendChild(el('div', { class: 'ctl-hint', html: o.hint }));
    let value = o.value;
    const snap = (v) => { const st = o.step || 1; return +(Math.round((v - o.min) / st) * st + o.min).toFixed(6); };
    const sync = () => {
      range.value = String(value);
      range.style.setProperty('--fill', ((value - o.min) / (o.max - o.min || 1)) * 100 + '%');
      range.setAttribute('aria-valuetext', fmt(value) + (o.unit ? ' ' + o.unit : ''));
      if (document.activeElement !== num) num.value = String(value);
    };
    const api = {
      el: wrap, get: () => value,
      set(v, silent) { if (!Number.isFinite(v)) return; value = snap(U.clamp(v, o.min, o.max)); sync(); if (!silent && o.onInput) o.onInput(value); },
    };
    range.addEventListener('input', () => { value = +range.value; sync(); if (o.onInput) o.onInput(value); });
    const commit = () => { const v = parseFloat(String(num.value).replace(',', '.').replace('−', '-')); if (Number.isFinite(v)) api.set(v); num.value = String(value); };
    num.addEventListener('change', commit);
    num.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
    num.addEventListener('blur', () => { num.value = String(value); });
    sync();
    if (parent) parent.appendChild(wrap);
    return api;
  };
  UI.seg = (parent, o) => {
    const name = U.uid('g');
    const wrap = el('div', { class: 'seg-wrap' });
    if (o.label) wrap.appendChild(el('div', { class: 'seg-label', id: name + 'l', html: o.label }));
    const box = el('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': o.label ? name + 'l' : undefined, 'aria-label': o.label ? undefined : o.aria });
    let value = o.value;
    const inputs = [];
    for (const op of o.options) {
      const inp = el('input', { type: 'radio', name, value: String(op.value) });
      if (String(op.value) === String(value)) inp.checked = true;
      inp.addEventListener('change', () => { if (inp.checked) { value = op.value; if (o.onChange) o.onChange(value); } });
      inputs.push([inp, op]);
      box.appendChild(el('label', { title: op.title || undefined }, [inp, el('span', { html: op.label })]));
    }
    wrap.appendChild(box);
    if (parent) parent.appendChild(wrap);
    return { el: wrap, get: () => value, set(v, silent) { value = v; for (const [inp, op] of inputs) inp.checked = String(op.value) === String(v); if (!silent && o.onChange) o.onChange(v); } };
  };
  UI.toggle = (parent, o) => {
    const inp = el('input', { type: 'checkbox', role: 'switch' });
    inp.checked = !!o.value;
    const lab = el('label', { class: 'tgl' }, [inp, el('span', { html: o.label })]);
    inp.addEventListener('change', () => o.onChange && o.onChange(inp.checked));
    if (parent) parent.appendChild(lab);
    return { el: lab, input: inp, get: () => inp.checked, set(v, silent) { inp.checked = !!v; if (!silent && o.onChange) o.onChange(!!v); } };
  };
  UI.select = (parent, o) => {
    const id = U.uid('sel');
    const sel = el('select', { id }, o.options.map((op) => el('option', { value: String(op.value), text: op.label })));
    sel.value = String(o.value);
    const wrap = el('div', { class: 'sel' }, [el('label', { for: id, html: o.label }), sel]);
    const find = () => { const op = o.options.find((x) => String(x.value) === sel.value); return op ? op.value : sel.value; };
    sel.addEventListener('change', () => o.onChange && o.onChange(find()));
    if (parent) parent.appendChild(wrap);
    return { el: wrap, select: sel, get: find, set(v, silent) { sel.value = String(v); if (!silent && o.onChange) o.onChange(v); } };
  };
  UI.readout = (parent, items) => {
    const box = el('div', { class: 'readout' });
    const vals = {};
    for (const it of items) {
      const v = el('span', { class: 'ro-value', text: '—' });
      box.appendChild(el('div', { class: 'ro', title: it.title || undefined }, [el('span', { class: 'ro-label', html: it.label }), v]));
      vals[it.key] = v;
    }
    if (parent) parent.appendChild(box);
    return { el: box, set(k, text, tone) { const v = vals[k]; if (!v) return; v.textContent = text; v.className = 'ro-value' + (tone ? ' ' + tone : ''); } };
  };
  UI.stack = (parent) => parent.appendChild(el('div', { class: 'ctl-stack' }));
  UI.row = (parent) => parent.appendChild(el('div', { class: 'btn-row' }));
  UI.table = (parent, heads, rows, o = {}) => {
    const wrap = el('div', { class: 'dt-wrap' });
    const t = el('table', { class: 'dt' });
    t.appendChild(el('thead', {}, el('tr', {}, heads.map((h) => el('th', { html: h })))));
    const tb = el('tbody');
    rows.forEach((r, i) => tb.appendChild(el('tr', { class: o.rowClass ? o.rowClass(r, i) : '' }, r.map((c) => (c && typeof c === 'object' && c.nodeType ? el('td', {}, c) : el('td', { html: c === null || c === undefined ? '' : String(c) }))))));
    t.appendChild(tb); wrap.appendChild(t);
    if (parent) parent.appendChild(wrap);
    return wrap;
  };

  /** Проигрыватель шагов: Шаг / Запуск / Пауза; пауза вне экрана и на скрытой вкладке. */
  class Runner {
    constructor(o) { this.o = Object.assign({ interval: 700 }, o); this.running = false; this.timer = null; Runner.all.add(this); }
    attach(toolbar) {
      this.backBtn = this.o.back ? UI.button(toolbar, { label: 'Назад', icon: 'chevron-left', onClick: () => { this.pause(); this.o.back(); }, title: 'Предыдущий шаг' }) : null;
      this.stepBtn = UI.button(toolbar, { label: this.o.stepLabel || 'Шаг', icon: 'step', onClick: () => this.step(), title: 'Выполнить один шаг' });
      this.runBtn = UI.button(toolbar, { label: 'Запуск', icon: 'play', primary: true, onClick: () => this.toggle(), title: 'Запустить или поставить на паузу' });
      this.runBtn.setAttribute('aria-pressed', 'false');
      this.root = toolbar.closest('.sim');
      return this;
    }
    interval() { return (U.reducedMotion() ? 2 : 1) * (typeof this.o.interval === 'function' ? this.o.interval() : this.o.interval); }
    loop() {
      if (!this.running) return;
      if (this.root) { const r = this.root.getBoundingClientRect(); if (document.hidden || !r.width || r.bottom < 0 || r.top > innerHeight) { this.pause(); return; } }
      let cont;
      try { cont = this.o.tick(); } catch (e) { console.error(e); cont = false; }
      if (cont === false) { this.pause(); return; }
      this.timer = setTimeout(() => this.loop(), this.interval());
    }
    start() {
      if (this.running) return;
      if (this.o.canStart && this.o.canStart() === false) return;
      this.running = true;
      if (this.runBtn) { this.runBtn.setLabel('Пауза', 'pause'); this.runBtn.setAttribute('aria-pressed', 'true'); }
      this.loop();
    }
    pause() { this.running = false; clearTimeout(this.timer); if (this.runBtn) { this.runBtn.setLabel('Запуск', 'play'); this.runBtn.setAttribute('aria-pressed', 'false'); } }
    toggle() { if (this.running) this.pause(); else this.start(); }
    step() { this.pause(); try { this.o.tick(true); } catch (e) { console.error(e); } }
  }
  Runner.all = new Set();
  Runner.pauseAll = () => Runner.all.forEach((r) => r.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Runner.pauseAll(); });

  /** Реестр интерактивов: каждый монтируется изолированно; ошибка не ломает страницу. */
  const Sim = {
    registry: {},
    register(name, fn) { this.registry[name] = fn; },
    mount(node) {
      if (node.dataset.mounted) return;
      node.dataset.mounted = '1';
      const fn = this.registry[node.dataset.sim];
      const fallback = node.innerHTML;
      if (!fn) { console.warn('Нет интерактива', node.dataset.sim); return; }
      try { U.clear(node); fn(node, node.dataset); } catch (e) {
        console.error('Ошибка интерактива', node.dataset.sim, e);
        node.innerHTML = fallback;
        node.prepend(el('div', { class: 'sim-error' }, [el('strong', { text: 'Интерактив не запустился. ' }), el('span', { text: 'Остальная глава работает. Ошибка: ' + (e && e.message) })]));
      }
    },
  };
  window.UI = UI; window.Sim = Sim; window.Runner = Runner;

  /* ---------- Простой SVG-график: оси, сетка, линии, столбцы, области ---------- */
  class Plot {
    constructor(container, o = {}) {
      this.o = Object.assign({ aspect: 0.5, minH: 200, maxH: 360 }, o);
      this.m = Object.assign({ t: 14, r: 16, b: 44, l: 56 }, o.margin || {});
      this.x = Object.assign({ domain: [0, 1] }, o.x || {});
      this.y = Object.assign({ domain: [0, 1] }, o.y || {});
      this.el = el('div', { class: 'plot' });
      container.appendChild(this.el);
      this.svg = U.svg('svg', { role: 'img', 'aria-label': o.label || 'График' });
      this.el.appendChild(this.svg);
      this.W = 0; this.H = 0; this.fn = null;
      const measure = () => { const w = Math.round(this.el.clientWidth); if (w > 0 && w !== this.W) { this.size(w); this.redraw(); } };
      if (window.ResizeObserver) { this.ro = new ResizeObserver(measure); this.ro.observe(this.el); } else window.addEventListener('resize', measure);
      requestAnimationFrame(measure);
    }
    size(w) { this.W = w; this.H = Math.round(U.clamp(w * this.o.aspect, this.o.minH, this.o.maxH)); this.svg.setAttribute('viewBox', `0 0 ${w} ${this.H}`); this.svg.setAttribute('width', w); this.svg.setAttribute('height', this.H); }
    get iw() { return Math.max(10, this.W - this.m.l - this.m.r); }
    get ih() { return Math.max(10, this.H - this.m.t - this.m.b); }
    X(v) { const [a, b] = this.x.domain; return this.m.l + ((v - a) / (b - a || 1)) * this.iw; }
    Y(v) { const [a, b] = this.y.domain; return this.m.t + (1 - (v - a) / (b - a || 1)) * this.ih; }
    onRender(fn) { this.fn = fn; if (this.W) this.redraw(); return this; }
    redraw() { if (!this.W) return; U.clear(this.svg); this.axes(); if (this.fn) this.fn(this); }
    ticks(ax, n) {
      if (ax.ticks) return ax.ticks;
      const [a, b] = ax.domain, span = b - a, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
      const st = [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => span / k <= n) || p * 10;
      const out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
      return out;
    }
    axes() {
      const g = this.svg.appendChild(U.svg('g', { class: 'ax' }));
      const xs = this.ticks(this.x, Math.max(2, Math.floor(this.iw / 80))), ys = this.ticks(this.y, Math.max(2, Math.floor(this.ih / 45)));
      const fx = this.x.fmt || ((v) => U.fmt(v, 0)), fy = this.y.fmt || ((v) => U.fmt(v, 0));
      for (const v of ys) { g.appendChild(U.svg('line', { class: 'gridline', x1: this.m.l, x2: this.m.l + this.iw, y1: this.Y(v), y2: this.Y(v) })); g.appendChild(U.svg('text', { x: this.m.l - 8, y: this.Y(v) + 4, 'text-anchor': 'end', text: fy(v) })); }
      for (const v of xs) g.appendChild(U.svg('text', { x: this.X(v), y: this.m.t + this.ih + 18, 'text-anchor': 'middle', text: fx(v) }));
      g.appendChild(U.svg('line', { x1: this.m.l, x2: this.m.l + this.iw, y1: this.m.t + this.ih, y2: this.m.t + this.ih }));
      if (this.x.label) this.svg.appendChild(U.svg('text', { class: 'ax-label', x: this.m.l + this.iw / 2, y: this.H - 6, 'text-anchor': 'middle', text: this.x.label }));
      if (this.y.label) this.svg.appendChild(U.svg('text', { class: 'ax-label', x: 12, y: this.m.t + this.ih / 2, 'text-anchor': 'middle', transform: `rotate(-90 12 ${this.m.t + this.ih / 2})`, text: this.y.label }));
    }
    line(pts, st = {}) { if (!pts.length) return null; const d = pts.map((p, i) => (i ? 'L' : 'M') + this.X(p[0]).toFixed(1) + ',' + this.Y(p[1]).toFixed(1)).join(''); return this.svg.appendChild(U.svg('path', { d, fill: 'none', stroke: st.color || 'var(--accent)', 'stroke-width': st.w || 2.4, 'stroke-dasharray': st.dash || null, 'stroke-linejoin': 'round' })); }
    area(pts, st = {}) { if (!pts.length) return null; const base = this.Y(this.y.domain[0]); const d = 'M' + this.X(pts[0][0]) + ',' + base + pts.map((p) => 'L' + this.X(p[0]).toFixed(1) + ',' + this.Y(p[1]).toFixed(1)).join('') + 'L' + this.X(pts[pts.length - 1][0]) + ',' + base + 'Z'; return this.svg.appendChild(U.svg('path', { d, fill: st.color || 'var(--accent)', opacity: st.opacity ?? 0.15 })); }
    rect(x0, y0, x1, y1, st = {}) { return this.svg.appendChild(U.svg('rect', { x: Math.min(this.X(x0), this.X(x1)), y: Math.min(this.Y(y0), this.Y(y1)), width: Math.abs(this.X(x1) - this.X(x0)), height: Math.abs(this.Y(y1) - this.Y(y0)), rx: st.rx ?? 3, fill: st.fill || 'var(--accent)', opacity: st.opacity ?? 1, stroke: st.stroke || null })); }
    dot(x, y, st = {}) { return this.svg.appendChild(U.svg('circle', { cx: this.X(x), cy: this.Y(y), r: st.r || 4.5, fill: st.color || 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1.5 })); }
    vline(x, st = {}) { return this.svg.appendChild(U.svg('line', { x1: this.X(x), x2: this.X(x), y1: this.m.t, y2: this.m.t + this.ih, stroke: st.color || 'var(--text-muted)', 'stroke-width': st.w || 1.4, 'stroke-dasharray': st.dash || '4 4' })); }
    text(x, y, t, st = {}) { return this.svg.appendChild(U.svg('text', { x: this.X(x) + (st.dx || 0), y: this.Y(y) + (st.dy || 0), 'text-anchor': st.anchor || 'start', class: (st.cls || 'p-label') + ' halo', text: t })); }
  }
  window.Plot = Plot;
})();

;
window.SHOP_SQL = "-- Учебная база интернет-магазина. Единый источник для главы SQL, SQL Playground и проверки примеров в PostgreSQL.\nCREATE TABLE customers (\n  id INTEGER PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  name TEXT NOT NULL,\n  city TEXT,\n  is_vip BOOLEAN NOT NULL DEFAULT FALSE,\n  registered_at DATE NOT NULL\n);\n\nCREATE TABLE products (\n  id INTEGER PRIMARY KEY,\n  title TEXT NOT NULL,\n  category TEXT NOT NULL,\n  price INTEGER NOT NULL CHECK (price >= 0),\n  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)\n);\n\nCREATE TABLE orders (\n  id INTEGER PRIMARY KEY,\n  customer_id INTEGER NOT NULL REFERENCES customers (id),\n  status TEXT NOT NULL CHECK (status IN ('created', 'paid', 'shipped', 'delivered', 'cancelled')),\n  created_at DATE NOT NULL,\n  promo_code TEXT\n);\n\nCREATE TABLE order_items (\n  order_id INTEGER NOT NULL REFERENCES orders (id),\n  product_id INTEGER NOT NULL REFERENCES products (id),\n  qty INTEGER NOT NULL CHECK (qty > 0),\n  price INTEGER NOT NULL,\n  PRIMARY KEY (order_id, product_id)\n);\n\nINSERT INTO customers (id, email, name, city, is_vip, registered_at) VALUES\n  (1, 'anna@example.com', 'Анна', 'Москва', TRUE, '2025-01-10'),\n  (2, 'boris@example.com', 'Борис', 'Казань', FALSE, '2025-03-02'),\n  (3, 'vera@example.com', 'Вера', NULL, FALSE, '2025-04-15'),\n  (4, 'gleb@example.com', 'Глеб', 'Москва', FALSE, '2025-06-21'),\n  (5, 'dina@example.com', 'Дина', 'Омск', TRUE, '2025-07-30'),\n  (6, 'egor@example.com', 'Егор', 'Казань', FALSE, '2025-09-05');\n\nINSERT INTO products (id, title, category, price, stock) VALUES\n  (1, 'Наушники Pulse', 'audio', 4990, 12),\n  (2, 'Колонка Boom', 'audio', 7990, 0),\n  (3, 'Клавиатура Keys', 'computers', 3490, 25),\n  (4, 'Мышь Click', 'computers', 1290, 40),\n  (5, 'Монитор View 27', 'computers', 21990, 3),\n  (6, 'Чехол Shell', 'accessories', 590, 100),\n  (7, 'Кабель USB-C', 'accessories', 390, 0),\n  (8, 'Смарт-часы Tick', 'wearables', 12990, 7);\n\nINSERT INTO orders (id, customer_id, status, created_at, promo_code) VALUES\n  (101, 1, 'delivered', '2025-08-01', NULL),\n  (102, 1, 'paid', '2025-09-12', 'SALE10'),\n  (103, 2, 'cancelled', '2025-09-14', NULL),\n  (104, 2, 'shipped', '2025-09-20', NULL),\n  (105, 3, 'created', '2025-09-25', 'WELCOME'),\n  (106, 4, 'paid', '2025-09-26', NULL),\n  (107, 5, 'delivered', '2025-08-18', 'SALE10'),\n  (108, 5, 'paid', '2025-09-28', NULL),\n  (109, 1, 'created', '2025-09-30', NULL);\n\nINSERT INTO order_items (order_id, product_id, qty, price) VALUES\n  (101, 1, 1, 4990),\n  (101, 6, 2, 590),\n  (102, 5, 1, 21990),\n  (103, 2, 1, 7990),\n  (104, 3, 1, 3490),\n  (104, 4, 2, 1290),\n  (105, 8, 1, 12990),\n  (106, 4, 1, 1290),\n  (106, 6, 3, 590),\n  (107, 1, 2, 4990),\n  (107, 3, 1, 3490),\n  (108, 8, 1, 12990),\n  (108, 6, 1, 590),\n  (109, 3, 1, 3490);\n";
;
