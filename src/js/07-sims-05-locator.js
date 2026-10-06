/* ===== sims/05-locator.js ===== */
/* ===== Locator Playground: учебная страница + движок локаторов, повторяющий семантику Playwright =====
   Движок поддерживает: getByRole (name, exact, checked, disabled, level, expanded, pressed, selected, includeHidden),
   getByText, getByLabel, getByPlaceholder, getByAltText, getByTitle, getByTestId, locator(css | xpath=…),
   filter({ hasText, hasNotText, has, hasNot, visible }), first, last, nth, and, or и цепочки.
   Поведение сверено с Playwright тестом tests/check_locators.mjs. */
(function (root) {
  'use strict';

  /* ---------- видимость и доступное имя ---------- */
  function isHiddenForA11y(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return true;
      const cs = getComputedStyle(n);
      if (cs.display === 'none') return true;
      if (n === el && cs.visibility === 'hidden') return true;
    }
    return false;
  }
  function isVisible(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { if (n.hidden || getComputedStyle(n).display === 'none') return false; }
    if (getComputedStyle(el).visibility !== 'visible') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  const norm = (s) => String(s).replace(/[​­]/g, '').replace(/\s+/g, ' ').trim();

  const INPUT_ROLE = { button: 'button', submit: 'button', reset: 'button', image: 'button', checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton', search: 'searchbox' };
  function implicitRole(el) {
    const t = el.tagName.toLowerCase();
    switch (t) {
      case 'a': case 'area': return el.hasAttribute('href') ? 'link' : null;
      case 'button': return 'button';
      case 'input': {
        const ty = (el.getAttribute('type') || 'text').toLowerCase();
        if (ty === 'hidden') return null;
        if (INPUT_ROLE[ty]) return INPUT_ROLE[ty];
        if (['email', 'tel', 'text', 'url', ''].includes(ty)) return el.hasAttribute('list') ? 'combobox' : 'textbox';
        return 'textbox';
      }
      case 'textarea': return 'textbox';
      case 'select': return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
      case 'option': return 'option';
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'heading';
      case 'ul': case 'ol': return 'list';
      case 'li': return 'listitem';
      case 'nav': return 'navigation';
      case 'main': return 'main';
      case 'header': return el.closest('article,aside,main,nav,section') ? null : 'banner';
      case 'footer': return el.closest('article,aside,main,nav,section') ? null : 'contentinfo';
      case 'form': return (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) ? 'form' : null;
      case 'section': return (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) ? 'region' : null;
      case 'article': return 'article';
      case 'aside': return 'complementary';
      case 'table': return 'table';
      case 'tr': return 'row';
      case 'td': return 'cell';
      case 'th': { const sc = el.getAttribute('scope'); return sc === 'col' ? 'columnheader' : sc === 'row' ? 'rowheader' : 'cell'; } // как в Playwright: без scope — cell
      case 'thead': case 'tbody': case 'tfoot': return 'rowgroup';
      case 'img': return el.getAttribute('alt') === '' && !el.getAttribute('title') ? 'presentation' : 'img';
      case 'dialog': return 'dialog';
      case 'fieldset': return 'group';
      case 'p': return 'paragraph';
      default: return null;
    }
  }
  function role(el) {
    const ex = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
    if (ex && ex !== 'none' && ex !== 'presentation') return ex;
    if (ex === 'none' || ex === 'presentation') return 'presentation';
    return implicitRole(el);
  }
  const NAME_FROM_CONTENT = new Set(['button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'row', 'rowheader', 'switch', 'tab', 'tooltip', 'treeitem']);
  function textOf(node, visited) {
    // текст для имени: обходит потомков, учитывая их собственные имена (aria-label, alt)
    let out = '';
    for (const c of node.childNodes) {
      if (c.nodeType === 3) out += c.data;
      else if (c.nodeType === 1) {
        if (isHiddenForA11y(c)) continue;
        const cs = getComputedStyle(c);
        const block = cs.display !== 'inline' && cs.display !== 'contents';
        const part = c.getAttribute('aria-label') ? c.getAttribute('aria-label') : c.tagName === 'IMG' ? (c.getAttribute('alt') || '') : textOf(c, visited);
        out += block ? ' ' + part + ' ' : part;
      }
    }
    return out;
  }
  function labelsOf(el) {
    const res = [];
    if (el.labels) for (const l of el.labels) res.push(l);
    return res;
  }
  function accName(el) {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => { const n = el.ownerDocument.getElementById(id); return n ? textOf(n) : ''; }).join(' ');
      if (norm(t)) return norm(t);
    }
    const al = el.getAttribute('aria-label');
    if (al && norm(al)) return norm(al);
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      const ty = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'INPUT' && ['button', 'submit', 'reset'].includes(ty)) return norm(el.value || (ty === 'submit' ? 'Submit' : ty === 'reset' ? 'Reset' : ''));
      const ls = labelsOf(el);
      if (ls.length) return norm(ls.map((l) => textOf(l)).join(' '));
      if (el.getAttribute('title')) return norm(el.getAttribute('title'));
      if (el.getAttribute('placeholder')) return norm(el.getAttribute('placeholder'));
      return '';
    }
    if (tag === 'IMG') { const a = el.getAttribute('alt'); if (a) return norm(a); return norm(el.getAttribute('title') || ''); }
    if (tag === 'TABLE') { const c = el.querySelector('caption'); if (c) return norm(textOf(c)); }
    if (tag === 'FIELDSET') { const lg = el.querySelector('legend'); if (lg) return norm(textOf(lg)); }
    const r = role(el);
    if (NAME_FROM_CONTENT.has(r)) { const t = norm(textOf(el)); if (t) return t; }
    return norm(el.getAttribute('title') || '');
  }

  /* ---------- сравнение строк как в Playwright ---------- */
  function matcher(text, exact) {
    if (text instanceof RegExp) return (s) => { text.lastIndex = 0; return text.test(s); };
    const t = norm(text);
    if (exact) return (s) => norm(s) === t;
    const tl = t.toLowerCase();
    return (s) => norm(s).toLowerCase().includes(tl);
  }
  const fmtText = (t, exact) => (t instanceof RegExp ? String(t) : `'${String(t).replace(/'/g, "\\'")}'` + (exact ? ', { exact: true }' : ''));

  /* ---------- элементы для поиска по тексту ---------- */
  function allElements(scope) { return [...scope.querySelectorAll('*')].filter((e) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD'].includes(e.tagName)); }
  function elementText(el) {
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes((el.getAttribute('type') || '').toLowerCase())) return el.value;
    return el.textContent || '';
  }
  function textMatches(scope, m) {
    const els = allElements(scope);
    const hit = new Set(els.filter((e) => m(elementText(e))));
    // наименьший элемент: исключаем тех, у кого есть потомок-совпадение
    return els.filter((e) => hit.has(e) && ![...e.children].some((c) => hit.has(c) || [...c.querySelectorAll('*')].some((d) => hit.has(d))));
  }

  /* ---------- Locator ---------- */
  function uniq(arr) { return [...new Set(arr)]; }
  function docOrder(arr, rootEl) { const all = [...rootEl.querySelectorAll('*')]; const idx = new Map(all.map((e, i) => [e, i])); return uniq(arr).sort((a, b) => (idx.get(a) ?? -1) - (idx.get(b) ?? -1)); }

  class Locator {
    constructor(page, parent, step, desc) { this._page = page; this._parent = parent; this._step = step; this._desc = desc; }
    _resolve() {
      const scopes = this._parent ? this._parent._resolve() : [this._page._root];
      return docOrder(this._step(scopes), this._page._root);
    }
    toString() { const p = this._parent ? this._parent.toString() : ''; return p ? p + '.' + this._desc : this._desc; }
    _chain(step, desc) { return new Locator(this._page, this, step, desc); }
    _find(fn, desc) { return this._chain((scopes) => scopes.flatMap((s) => fn(s)), desc); }

    getByRole(r, o = {}) {
      if (typeof r !== 'string') throw new TypeError('getByRole: первый аргумент — строка с ролью');
      const m = o.name !== undefined ? matcher(o.name, o.exact) : null;
      const desc = `getByRole('${r}'${Object.keys(o).length ? ', ' + optsStr(o) : ''})`;
      return this._find((s) => [...s.querySelectorAll('*')].filter((e) => {
        if (role(e) !== r) return false;
        if (!o.includeHidden && isHiddenForA11y(e)) return false;
        if (m && !m(accName(e))) return false;
        if (o.checked !== undefined && !!(e.checked || e.getAttribute('aria-checked') === 'true') !== o.checked) return false;
        if (o.disabled !== undefined && !!(e.disabled || e.getAttribute('aria-disabled') === 'true') !== o.disabled) return false;
        if (o.level !== undefined && (+(e.getAttribute('aria-level') || (e.tagName.match(/^H(\d)$/) || [])[1]) !== o.level)) return false;
        if (o.expanded !== undefined && (!e.hasAttribute('aria-expanded') || (e.getAttribute('aria-expanded') === 'true') !== o.expanded)) return false;
        if (o.pressed !== undefined && (e.getAttribute('aria-pressed') === 'true') !== o.pressed) return false;
        if (o.selected !== undefined && !!(e.selected || e.getAttribute('aria-selected') === 'true') !== o.selected) return false;
        return true;
      }), desc);
    }
    getByText(t, o = {}) { const m = matcher(t, o.exact); return this._find((s) => textMatches(s, m), `getByText(${fmtText(t, o.exact)})`); }
    getByLabel(t, o = {}) {
      const m = matcher(t, o.exact);
      return this._find((s) => [...s.querySelectorAll('*')].filter((e) => {
        const al = e.getAttribute('aria-label');
        if (al && m(al)) return true;
        const lb = e.getAttribute('aria-labelledby');
        if (lb && m(lb.split(/\s+/).map((id) => { const n = e.ownerDocument.getElementById(id); return n ? n.textContent : ''; }).join(' '))) return true;
        return labelsOf(e).some((l) => m(l.textContent));
      }), `getByLabel(${fmtText(t, o.exact)})`);
    }
    _attr(name, t, o, label) { const m = matcher(t, o && o.exact); return this._find((s) => [...s.querySelectorAll(`[${name}]`)].filter((e) => m(e.getAttribute(name))), `${label}(${fmtText(t, o && o.exact)})`); }
    getByPlaceholder(t, o) { return this._attr('placeholder', t, o, 'getByPlaceholder'); }
    getByAltText(t, o) { return this._attr('alt', t, o, 'getByAltText'); }
    getByTitle(t, o) { return this._attr('title', t, o, 'getByTitle'); }
    getByTestId(id) {
      const m = id instanceof RegExp ? matcher(id) : (s) => s === id;
      const attr = this._page._testIdAttribute;
      return this._find((s) => [...s.querySelectorAll(`[${attr}]`)].filter((e) => m(e.getAttribute(attr))), `getByTestId(${fmtText(id)})`);
    }
    locator(sel, o) {
      if (sel instanceof Locator) { const inner = sel; return this._find((s) => inner._resolveWithin(s), `locator(${inner})`).filter(o || {}); }
      if (typeof sel !== 'string') throw new TypeError('locator: ожидается строка селектора');
      const isX = /^xpath=/.test(sel) || /^\.?\.?\//.test(sel) || sel.startsWith('(');
      let base;
      if (isX) {
        const xp = sel.replace(/^xpath=/, '');
        base = this._find((s) => {
          const ctxNode = s;
          const expr = xp.startsWith('/') && !xp.startsWith('//') ? '.' + xp : xp.startsWith('//') ? '.' + xp : xp;
          const r = s.ownerDocument.evaluate(expr, ctxNode, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const out = [];
          for (let i = 0; i < r.snapshotLength; i++) { const n = r.snapshotItem(i); if (n.nodeType === 1) out.push(n); }
          return out;
        }, `locator('${sel}')`);
      } else {
        const css = sel.replace(/^css=/, '');
        // проверка синтаксиса заранее, чтобы показать понятную ошибку
        try { document.createDocumentFragment().querySelector(css); } catch (e) { throw new SyntaxError(`Некорректный CSS-селектор: ${css}`); }
        base = this._find((s) => [...s.querySelectorAll(css)], `locator('${sel}')`);
      }
      return o ? base.filter(o) : base;
    }
    _resolveWithin(scopeEl) {
      // разрешить этот локатор, как если бы он был построен от scopeEl (для has / hasNot)
      const chain = [];
      for (let l = this; l; l = l._parent) chain.unshift(l);
      let cur = [scopeEl];
      for (const l of chain) cur = uniq(l._step(cur));
      return cur;
    }
    filter(o = {}) {
      const parts = [];
      if (o.hasText !== undefined) parts.push('hasText: ' + fmtText(o.hasText));
      if (o.hasNotText !== undefined) parts.push('hasNotText: ' + fmtText(o.hasNotText));
      if (o.has) parts.push('has: ' + o.has);
      if (o.hasNot) parts.push('hasNot: ' + o.hasNot);
      if (o.visible !== undefined) parts.push('visible: ' + o.visible);
      if (!parts.length) return this;
      const mt = o.hasText !== undefined ? matcher(o.hasText) : null;
      const mnt = o.hasNotText !== undefined ? matcher(o.hasNotText) : null;
      const self = this;
      const l = new Locator(this._page, this._parent, (scopes) => self._step(scopes).filter((e) => {
        if (mt && !mt(elementText(e))) return false;
        if (mnt && mnt(elementText(e))) return false;
        if (o.has && !o.has._resolveWithin(e).some((x) => x !== e)) return false;
        if (o.hasNot && o.hasNot._resolveWithin(e).some((x) => x !== e)) return false;
        if (o.visible !== undefined && isVisible(e) !== o.visible) return false;
        return true;
      }), `${this._desc}.filter({ ${parts.join(', ')} })`);
      return l;
    }
    _pick(fn, desc) {
      const self = this;
      return new Locator(this._page, null, () => { const all = self._resolve(); const r = fn(all); return r ? [r] : []; }, (self.toString() + '.' + desc).replace(/^\./, ''));
    }
    first() { return this._pick((a) => a[0], 'first()'); }
    last() { return this._pick((a) => a[a.length - 1], 'last()'); }
    nth(i) { if (!Number.isInteger(i)) throw new TypeError('nth: ожидается целое число'); return this._pick((a) => (i < 0 ? a[a.length + i] : a[i]), `nth(${i})`); }
    and(other) { const self = this; return new Locator(this._page, null, () => { const b = new Set(other._resolve()); return self._resolve().filter((e) => b.has(e)); }, `${self}.and(${other})`); }
    or(other) { const self = this; return new Locator(this._page, null, () => self._resolve().concat(other._resolve()), `${self}.or(${other})`); }
    // методы, которые часто пишут по ошибке
    click() { throw new Error('В Playground не нужно вызывать действия: впишите только локатор, без .click()'); }
    fill() { return this.click(); }
  }
  // корень страницы: сам Locator без родителя, разрешается в корневой элемент
  function optsStr(o) {
    return '{ ' + Object.entries(o).map(([k, v]) => `${k}: ${v instanceof RegExp ? String(v) : typeof v === 'string' ? `'${v}'` : v}`).join(', ') + ' }';
  }
  function makePage(rootEl, o = {}) {
    const page = { _root: rootEl, _testIdAttribute: o.testIdAttribute || 'data-testid' };
    const base = new Locator(page, null, (scopes) => scopes, '');
    const api = {};
    ['getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByAltText', 'getByTitle', 'getByTestId', 'locator'].forEach((m) => {
      api[m] = (...a) => base[m](...a);
    });
    api.frameLocator = () => { throw new Error('На учебной странице нет iframe'); };
    api.click = api.fill = () => { throw new Error('В Playground не нужно вызывать действия: впишите только локатор'); };
    return api;
  }
  /** Вычислить выражение вида page.getByRole(...).filter(...) на учебной странице. */
  function evaluate(expr, rootEl, o) {
    const page = makePage(rootEl, o);
    let src = String(expr).trim().replace(/;+\s*$/, '');
    if (/^await\s/.test(src)) src = src.replace(/^await\s+/, '');
    if (!/^page\s*\./.test(src)) throw new Error('Начните выражение с page. — например, page.getByRole(\'button\')');
    if (/\b(?:document|window|globalThis|fetch|eval|Function|import|constructor|__proto__|localStorage)\b/.test(src)) throw new Error('В выражении можно использовать только методы локаторов');
    // eslint-disable-next-line no-new-func
    const fn = new Function('page', '"use strict"; return (' + src + ');');
    const loc = fn(page);
    if (!(loc instanceof Locator)) throw new Error('Выражение должно возвращать Locator');
    return { locator: loc, elements: loc._resolve() };
  }
  /** Рекомендуемый локатор для элемента (как «Pick locator» в codegen). */
  function suggest(el, rootEl, o) {
    const page = makePage(rootEl, o);
    const one = (l) => { try { const r = l._resolve(); return r.length === 1 && r[0] === el; } catch (e) { return false; } };
    const r = role(el), n = accName(el);
    const cands = [];
    if (r && r !== 'presentation' && r !== 'paragraph' && n) {
      cands.push(`page.getByRole('${r}', { name: ${fmtText(n)} })`);
      cands.push(`page.getByRole('${r}', { name: ${fmtText(n)}, exact: true })`);
    }
    if (el.labels && el.labels.length) cands.push(`page.getByLabel(${fmtText(norm(el.labels[0].textContent))})`);
    if (el.getAttribute('placeholder')) cands.push(`page.getByPlaceholder(${fmtText(el.getAttribute('placeholder'))})`);
    if (el.getAttribute('alt')) cands.push(`page.getByAltText(${fmtText(el.getAttribute('alt'))})`);
    const tid = el.getAttribute(page.getByTestId ? (o && o.testIdAttribute) || 'data-testid' : 'data-testid');
    if (tid) cands.push(`page.getByTestId('${tid}')`);
    const own = norm(el.textContent || '');
    if (own && own.length < 40 && !r) cands.push(`page.getByText(${fmtText(own)})`);
    if (own && own.length < 40 && !r) cands.push(`page.getByText(${fmtText(own)}, { exact: true })`);
    if (r && r !== 'presentation' && !n) cands.push(`page.getByRole('${r}')`);
    for (const c of cands) { try { if (one(evaluate(c, rootEl, o).locator)) return { expr: c, unique: true }; } catch (e) { /* пропуск */ } }
    // уточнение контейнером с test id
    const card = el.parentElement && el.parentElement.closest('[data-testid]');
    if (card && r && n) {
      const cardText = norm((card.querySelector('h3, h2, td') || card).textContent).slice(0, 30);
      const c = `page.getByTestId('${card.getAttribute('data-testid')}').filter({ hasText: ${fmtText(cardText)} }).getByRole('${r}', { name: ${fmtText(n)} })`;
      try { if (one(evaluate(c, rootEl, o).locator)) return { expr: c, unique: true }; } catch (e) { /* пропуск */ }
    }
    return { expr: cands[0] || null, unique: false, role: r, name: n };
  }

  root.LocatorEngine = { evaluate, suggest, role, accName, isVisible, Locator };
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------- UI ---------- */
(function () {
  'use strict';
  if (typeof Sim === 'undefined') return;
  const { el } = U;
  const DEMO = `
<header class="lpd-head">
  <a href="#catalog" class="lpd-logo"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Crect width='22' height='22' rx='6' fill='%23f59e0b'/%3E%3C/svg%3E" alt="Логотип ShopLab" width="22" height="22"> ShopLab</a>
  <nav aria-label="Основное меню"><a href="#catalog">Каталог</a> <a href="#cart">Корзина (2)</a> <a href="#login">Войти</a></nav>
</header>
<main>
  <h1>Каталог</h1>
  <div class="lpd-tools">
    <input type="search" aria-label="Поиск" placeholder="Поиск товаров">
    <label><input type="checkbox" checked> Только в наличии</label>
    <label for="lpd-sort">Сортировка</label>
    <select id="lpd-sort"><option>По популярности</option><option>Сначала дешёвые</option><option>Сначала дорогие</option></select>
  </div>
  <ul class="lpd-grid">
    <li data-testid="product-card" data-sku="PULSE-01"><img src="" alt="Наушники Pulse" width="1" height="1"><h3>Наушники Pulse</h3><span data-testid="product-price" class="price">4 990 ₽</span><button type="button" class="btn btn-primary">В корзину</button><button type="button" class="icon-btn" aria-label="В избранное">♡</button></li>
    <li data-testid="product-card" data-sku="BOOM-02"><img src="" alt="Колонка Boom" width="1" height="1"><h3>Колонка Boom</h3><span data-testid="product-price" class="price">7 990 ₽</span><span class="lpd-badge">Нет в наличии</span><button type="button" class="btn btn-primary" disabled>В корзину</button><button type="button" class="icon-btn" aria-label="В избранное">♡</button></li>
    <li data-testid="product-card" data-sku="KEYS-03"><img src="" alt="Клавиатура Keys" width="1" height="1"><h3>Клавиатура Keys</h3><span data-testid="product-price" class="price">3 490 ₽</span><button type="button" class="btn btn-primary">В корзину</button><button type="button" class="icon-btn" aria-label="В избранное">♡</button></li>
    <li data-testid="product-card" data-sku="CLICK-04"><img src="" alt="Мышь Click" width="1" height="1"><h3>Мышь Click</h3><span data-testid="product-price" class="price">1 290 ₽</span><button type="button" class="btn btn-primary">В корзину</button><button type="button" class="icon-btn"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 4h10M5 4V2h4v2M4 4l1 8h4l1-8" stroke="currentColor" fill="none"/></svg></button></li>
  </ul>
  <section aria-label="Корзина" class="lpd-cart">
    <h2>Корзина</h2>
    <table>
      <thead><tr><th scope="col">Товар</th><th scope="col">Кол-во</th><th scope="col">Сумма</th></tr></thead>
      <tbody>
        <tr><td>Наушники Pulse</td><td>2</td><td>9 980 ₽</td></tr>
        <tr><td>Чехол Shell</td><td>1</td><td>590 ₽</td></tr>
      </tbody>
    </table>
    <p>Итого: <span data-testid="cart-total">10 570 ₽</span></p>
    <button type="button" class="btn btn-link" aria-expanded="false">Есть промокод?</button>
    <div class="lpd-promo">
      <label for="lpd-promo">Промокод</label>
      <input id="lpd-promo" type="text" placeholder="Введите промокод">
      <button type="button" class="btn">Применить</button>
    </div>
    <div class="lpd-pay">
      <button type="submit" class="btn btn-primary btn-lg">Оплатить</button>
      <button type="button" class="btn">Оплатить частями</button>
    </div>
    <div role="alert" hidden>Ошибка оплаты: карта отклонена</div>
    <p class="lpd-note" title="Доставка рассчитывается на следующем шаге">Доставка: <b>рассчитается при оформлении</b></p>
  </section>
</main>`;

  const EXAMPLES = [
    ['Роль и имя', "page.getByRole('button', { name: 'В корзину' })"],
    ['Подстрока в имени', "page.getByRole('button', { name: 'Оплатить' })"],
    ['exact: true', "page.getByRole('button', { name: 'Оплатить', exact: true })"],
    ['Регулярное выражение', "page.getByRole('link', { name: /^Корзина \\(\\d+\\)$/ })"],
    ['Заголовок по уровню', "page.getByRole('heading', { level: 1 })"],
    ['Фильтр по тексту + цепочка', "page.getByTestId('product-card').filter({ hasText: 'Наушники Pulse' }).getByRole('button', { name: 'В корзину' })"],
    ['Фильтр has / hasNot', "page.getByTestId('product-card').filter({ hasNot: page.getByText('Нет в наличии') })"],
    ['Отключённые кнопки', "page.getByRole('button', { disabled: true })"],
    ['Поле по подписи', "page.getByLabel('Промокод')"],
    ['Поле по placeholder', "page.getByPlaceholder('Поиск')"],
    ['Чекбокс', "page.getByRole('checkbox', { name: 'Только в наличии' })"],
    ['Список цен (несколько элементов)', "page.getByTestId('product-price')"],
    ['Строка таблицы и ячейка', "page.getByRole('row').filter({ hasText: 'Наушники Pulse' }).getByRole('cell').nth(2)"],
    ['Скрытый alert', "page.getByRole('alert')"],
    ['Скрытый alert c includeHidden', "page.getByRole('alert', { includeHidden: true })"],
    ['Кнопка без доступного имени', "page.getByRole('button', { name: 'Удалить' })"],
    ['getByText: наименьший элемент', "page.getByText('Наушники Pulse')"],
    ['CSS по бизнес-атрибуту', "page.locator('[data-sku=\"PULSE-01\"] .price')"],
    ['Хрупкий CSS', "page.locator('.btn.btn-primary')"],
    ['XPath', "page.locator('xpath=//tr[td[normalize-space()=\"Наушники Pulse\"]]/td[3]')"],
    ['first() — последнее средство', "page.getByRole('button', { name: 'В избранное' }).first()"],
    ['or', "page.getByRole('button', { name: 'Оплатить', exact: true }).or(page.getByRole('button', { name: 'Оплатить частями' }))"],
  ];
  const STABILITY = [
    [/\.locator\('(?:xpath=)?\/html|nth-child|:nth-of-type|xpath=\/[a-z]/i, 'bad', 'Путь по структуре DOM сломается от любой правки вёрстки.'],
    [/\.locator\('[^']*\.(?:btn|css-|sc-|ant-)/i, 'bad', 'Классы оформления меняются при редизайне и часто неуникальны.'],
    [/\.(?:first|last|nth)\(/, 'warn', 'Позиционный выбор ломается при изменении порядка. Оправдан, если порядок — часть проверки или элементы идентичны.'],
    [/\.locator\(/, 'warn', 'CSS/XPath описывают структуру, а не смысл. Допустимы по устойчивым атрибутам (data-sku, data-testid).'],
    [/getByTestId/, 'good', 'Test id — отдельный контракт с разработчиками: устойчив к тексту и вёрстке, но не проверяет то, что видит пользователь.'],
    [/getBy(?:Role|Label|Placeholder|AltText|Title)/, 'good', 'Пользовательский локатор: меняется только при изменении смысла элемента и заодно проверяет доступность.'],
    [/getByText/, 'good', 'Поиск по тексту хорош для неинтерактивного содержимого; для кнопок и ссылок точнее getByRole.'],
  ];

  LocatorEngine.DEMO = DEMO;
  LocatorEngine.EXAMPLES = EXAMPLES;
  Sim.register('locator-playground', (root) => {
    const sh = UI.shell(root, {
      title: 'Locator Playground', icon: 'cursor', kicker: 'Тренажёр', layout: 'two',
      help: 'Впишите выражение локатора, начиная с <code>page.</code>, или выберите пример. Найденные элементы подсвечиваются на учебной странице. Нажмите на элемент страницы — получите рекомендуемый локатор.',
      onReset: () => { inp.value = EXAMPLES[0][1]; exSel.set(0, true); run(); },
      note: 'Локаторы вычисляет учебный движок, повторяющий правила Playwright для этой страницы (роли, доступные имена, сравнение текста, строгий режим); результаты сверены с настоящим Playwright автоматическим тестом. Не поддерживаются iframe, Shadow DOM и полный набор ARIA-правил.',
    });
    const left = sh.col(), right = sh.col();
    const exSel = UI.select(left, { label: 'Пример', value: 0, options: EXAMPLES.map((e, i) => ({ value: i, label: e[0] })), onChange: (v) => { inp.value = EXAMPLES[+v][1]; run(); } });
    const inp = el('textarea', { class: 'inp mono lp-input', rows: 3, spellcheck: 'false', 'aria-label': 'Выражение локатора' });
    inp.value = EXAMPLES[0][1];
    left.appendChild(inp);
    const bar = el('div', { class: 'btn-row' });
    left.appendChild(bar);
    UI.button(bar, { label: 'Найти', icon: 'search', primary: true, onClick: () => run() });
    const status = el('div', { class: 'lp-status', 'aria-live': 'polite' });
    left.appendChild(status);
    const list = el('div', { class: 'lp-list' });
    left.appendChild(list);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } });
    let lastRun = null;
    inp.addEventListener('input', U.debounce(() => { if (inp.value !== lastRun) run(true); }, 350));

    const frame = el('div', { class: 'lp-frame', 'aria-label': 'Учебная страница магазина' });
    const bar2 = el('div', { class: 'lp-url mono' }, [el('span', { text: 'shop.local/catalog' })]);
    const demo = el('div', { class: 'lp-demo' });
    demo.innerHTML = DEMO;
    demo.querySelectorAll('img[src=""]').forEach((im) => im.removeAttribute('src'));
    // ссылки и формы учебной страницы ничего не делают
    demo.addEventListener('click', (e) => {
      e.preventDefault();
      const t = e.target.closest('.lp-demo *');
      if (!t || t === demo) return;
      const pick = t.closest('button, a, input, select, label, h1, h2, h3, td, th, span, p, img, li') || t;
      const s = LocatorEngine.suggest(pick, demo);
      if (s.expr) { inp.value = s.expr; run(); sh.say(`<p>Рекомендуемый локатор для выбранного элемента${s.unique ? '' : ' (не однозначен — уточните фильтром или контейнером)'}: <code>${U.esc(s.expr)}</code>.</p>` + (s.role === 'button' && !s.name ? '<p>У кнопки нет доступного имени: скринридер не скажет, что она делает. Правильное исправление — <code>aria-label</code> в разметке, а не CSS-селектор в тесте.</p>' : '')); }
    });
    frame.append(bar2, demo);
    right.appendChild(frame);
    let marks = [];
    function clearMarks() { marks.forEach((m) => { m.classList.remove('lp-hit'); m.removeAttribute('data-lp-n'); }); marks = []; }
    function run(quiet) {
      lastRun = inp.value;
      clearMarks();
      U.clear(list);
      let res;
      try { res = LocatorEngine.evaluate(inp.value, demo); }
      catch (e) {
        status.innerHTML = `<span class="badge bad">Ошибка</span> <span>${U.esc(e.message)}</span>`;
        if (!quiet) sh.say('<p>Выражение не удалось вычислить. Проверьте кавычки, скобки и имена методов: <code>getByRole</code>, <code>getByText</code>, <code>getByLabel</code>, <code>getByPlaceholder</code>, <code>getByTestId</code>, <code>locator</code>, <code>filter</code>.</p>');
        return;
      }
      const els = res.elements;
      els.forEach((x, i) => { x.classList.add('lp-hit'); x.setAttribute('data-lp-n', i + 1); marks.push(x); });
      const st = STABILITY.find(([re]) => re.test(inp.value));
      const n = els.length;
      status.innerHTML = `<span class="badge ${n === 1 ? 'good' : n === 0 ? 'bad' : 'warn'}">${n} ${U.plural(n, 'элемент', 'элемента', 'элементов')}</span>` + (st ? ` <span class="badge ${st[1]}">${st[1] === 'good' ? 'устойчивый' : st[1] === 'warn' ? 'с оговорками' : 'хрупкий'}</span>` : '');
      els.slice(0, 8).forEach((x, i) => {
        const s = LocatorEngine.suggest(x, demo);
        list.appendChild(el('div', { class: 'lp-item' }, [el('b', { text: `${i + 1})` }), el('code', { text: snippet(x) }), s.expr ? el('span', { class: 'muted-t', text: ' aka ' + s.expr.replace(/^page\./, '') }) : null]));
      });
      let msg;
      if (n === 0) msg = '<p>Ничего не найдено. Действие с таким локатором будет ждать появления элемента до таймаута, а <code>expect(...).toBeVisible()</code> упадёт с «element(s) not found».' + (/includeHidden|alert/.test(inp.value) ? ' Скрытые элементы getByRole по умолчанию не находит.' : '') + '</p>';
      else if (n === 1) msg = '<p>Локатор однозначен: действия и проверки будут работать с этим элементом.</p>';
      else msg = `<p><b>Strict mode violation</b> для действий: <code>click()</code>, <code>fill()</code> и большинство проверок упадут — локатор нашёл ${n} ${U.plural(n, 'элемент', 'элемента', 'элементов')}. Уточните его фильтром или поиском внутри контейнера. Для списков используйте <code>toHaveCount</code>, <code>toHaveText([...])</code>.</p>`;
      if (st) msg += `<p>${st[2]}</p>`;
      sh.say(msg);
    }
    function snippet(x) {
      const c = x.cloneNode(true);
      c.classList.remove('lp-hit'); c.removeAttribute('data-lp-n');
      if (!c.getAttribute('class')) c.removeAttribute('class');
      c.querySelectorAll('.lp-hit').forEach((d) => { d.classList.remove('lp-hit'); d.removeAttribute('data-lp-n'); if (!d.getAttribute('class')) d.removeAttribute('class'); });
      let h = c.outerHTML.replace(/\s+/g, ' ');
      if (h.length > 110) { const open = h.match(/^<[^>]+>/)[0]; h = open + '…'; }
      return h;
    }
    run();
  });
})();

;
