/* ===== sims/06-ui.js ===== */
/* ===== Раздел IV: архитектура Playwright, Assertion Builder, ожидания, фикстуры, POM, перехват сети ===== */
(function () {
  'use strict';
  const { el } = U;
  const code = (src, lang = 'ts') => el('pre', { class: 'out-box', html: U.hl(src, lang) });

  /* ---------- Архитектура Playwright ---------- */
  const PWA = {
    runner: { t: 'Test Runner', life: 'весь прогон', d: 'Главный процесс Node.js, запущенный командой <code>npx playwright test</code>. Читает конфиг, собирает список тестов, запускает воркеры, раздаёт им тесты, собирает результаты и решает, повторять ли упавшие тесты.', tip: 'Код внутри <code>test()</code> раннер не выполняет — только импортирует файлы, чтобы узнать список тестов. Поэтому побочные эффекты на верхнем уровне spec-файла выполняются и в раннере, и в каждом воркере.' },
    config: { t: 'playwright.config.ts', life: 'весь прогон', d: 'Конфигурация: <code>testDir</code>, <code>timeout</code>, <code>retries</code>, <code>workers</code>, <code>reporter</code>, <code>use</code> (baseURL, trace, screenshot) и <code>projects</code> (браузеры и устройства).', tip: 'Конфиг загружается и раннером, и каждым воркером. Значения, вычисленные при загрузке (например, время или случайное число), могут различаться между процессами.' },
    reporter: { t: 'Reporter', life: 'весь прогон', d: 'Получает события от раннера: начало и конец теста, шаги, вложения. Пишет вывод в консоль, HTML-отчёт, JUnit XML, Allure-результаты.', tip: 'Репортеры работают в процессе раннера, а не в воркерах; вложения (скриншоты, trace) воркер передаёт раннеру.' },
    worker: { t: 'Worker', life: 'пока не упадёт тест или не закончатся тесты', d: 'Отдельный процесс ОС. Выполняет тесты по одному. Число воркеров задаётся <code>workers</code>; по умолчанию — половина логических ядер.', tip: 'После падения теста воркер завершается, и следующие тесты идут в новом воркере с новым <code>workerIndex</code>, но тем же <code>parallelIndex</code>.' },
    wfix: { t: 'Worker fixtures', life: 'весь воркер', d: 'Фикстуры со <code>{ scope: \'worker\' }</code> и встроенная <code>browser</code>. Создаются один раз на воркер при первом использовании.', tip: 'Подходят для дорогих неизменяемых ресурсов: пул соединений с БД, мок-сервер, аккаунт только для чтения. Изменяемое состояние здесь связывает тесты между собой.' },
    driver: { t: 'Playwright driver', life: 'весь воркер', d: 'Серверная часть Playwright внутри воркера. Принимает команды клиента и общается с браузером по постоянному соединению: CDP для Chromium, собственные протоколы для Firefox и WebKit.', tip: 'Соединение постоянное, поэтому события браузера (запросы, консоль, диалоги) приходят сразу, без опроса.' },
    browser: { t: 'Browser', life: 'весь воркер', d: 'Процесс браузера. Запуск стоит сотни миллисекунд, поэтому браузер запускается один раз на воркер и переиспользуется всеми его тестами.', tip: 'Изоляция обеспечивается не новым браузером, а новым контекстом на каждый тест.' },
    context: { t: 'BrowserContext', life: 'один тест', d: 'Изолированная сессия, как профиль инкогнито: cookies, localStorage, кэш, разрешения. Встроенная фикстура <code>context</code> создаётся для каждого теста и закрывается после него.', tip: 'Создаётся за миллисекунды. Для входа без UI в контекст загружают <code>storageState</code>.' },
    page: { t: 'Page', life: 'один тест', d: 'Вкладка внутри контекста. Через неё — навигация, действия, локаторы, перехват сети.', tip: 'Фикстура <code>page</code> зависит от <code>context</code>: запросив её, тест получает и новый контекст.' },
    tfix: { t: 'Test fixtures', life: 'один тест', d: 'Фикстуры по умолчанию (<code>scope: \'test\'</code>): <code>page</code>, <code>context</code>, <code>request</code> и ваши — пользователь, корзина, Page Objects. Код до <code>use()</code> — подготовка, после — очистка.', tip: 'Создаются только для тех тестов, которые их запросили, и очищаются даже при падении теста.' },
  };
  Sim.register('pw-architecture', (root) => {
    let sel = 'context', workers = 2;
    const sh = UI.shell(root, {
      title: 'Из чего состоит запуск Playwright', icon: 'layers', kicker: 'Схема', layout: 'two',
      help: 'Нажимайте на блоки схемы. Ниже — шкала времени прогона четырёх тестов: видно, какие компоненты живут весь прогон, какие весь воркер, а какие создаются заново для каждого теста.',
      onReset: () => { sel = 'context'; workers = 2; wSeg.set(2, true); draw(); },
    });
    const left = sh.col(), right = sh.col();
    const wSeg = UI.seg(left, { label: 'Воркеров (workers)', value: 2, options: [1, 2, 3].map((v) => ({ value: v, label: String(v) })), onChange: (v) => { workers = +v; draw(); } });
    const diag = el('div', { class: 'pwa' });
    left.appendChild(diag);
    const info = el('div', { class: 'pwa-info' });
    right.appendChild(info);
    const tl = el('div', { class: 'pwa-tl' });
    right.appendChild(tl);
    const node = (key, extra, kids) => {
      const b = el('div', { class: 'pwa-box pwa-' + key + (sel === key ? ' is-sel' : '') + (extra ? ' ' + extra : '') });
      const h = el('button', { type: 'button', class: 'pwa-h', 'aria-pressed': String(sel === key) }, [el('b', { text: PWA[key].t })]);
      h.addEventListener('click', () => { sel = key; draw(); });
      b.appendChild(h);
      (kids || []).forEach((k) => k && b.appendChild(k));
      return b;
    };
    function draw() {
      U.clear(diag);
      const ws = [];
      for (let w = 0; w < workers; w++) {
        const tests = [0, 1, 2, 3].filter((t) => t % workers === w);
        ws.push(node('worker', '', [
          el('div', { class: 'pwa-sub', text: `workerIndex ${w} · тесты ${tests.map((t) => 'T' + (t + 1)).join(', ')}` }),
          node('wfix', 'pwa-sm'),
          node('driver', 'pwa-sm'),
          node('browser', '', tests.slice(0, 2).map((t) => node('context', 'pwa-sm', [el('div', { class: 'pwa-sub', text: `тест T${t + 1}` }), node('page', 'pwa-sm')]))),
          node('tfix', 'pwa-sm'),
        ]));
      }
      diag.appendChild(node('runner', '', [el('div', { class: 'pwa-row' }, [node('config', 'pwa-sm'), node('reporter', 'pwa-sm')]), el('div', { class: 'pwa-workers' }, ws)]));
      const c = PWA[sel];
      info.innerHTML = '';
      info.append(el('h4', { text: c.t }), el('div', { class: 'badge acc', text: 'Живёт: ' + c.life }), el('p', { html: c.d }), el('p', { class: 'muted-t', html: c.tip }));
      timeline();
      sh.say(`<p><b>${c.t}</b> — живёт ${c.life}. ${sel === 'context' || sel === 'page' || sel === 'tfix' ? 'Новый экземпляр на каждый тест — основа изоляции.' : sel === 'worker' || sel === 'browser' || sel === 'wfix' || sel === 'driver' ? 'Один экземпляр на все тесты воркера: состояние здесь может «перетечь» между тестами.' : 'Один экземпляр на весь прогон.'}</p>`);
    }
    function timeline() {
      const dur = [3, 2, 4, 2];
      const W = 420, rowH = 16, pad = 84;
      const lanes = [];
      const ends = Array(workers).fill(0.4);
      const tests = dur.map((d, i) => { const w = i % workers; const s = ends[w]; ends[w] += d + 0.2; return { w, s, e: s + d, i }; });
      const total = Math.max(...ends) + 0.3;
      const x = (t) => pad + (t / total) * (W - pad - 8);
      lanes.push({ label: 'Runner', key: 'runner', bars: [[0, total]] });
      for (let w = 0; w < workers; w++) {
        const ts = tests.filter((t) => t.w === w);
        lanes.push({ label: `Worker ${w}`, key: 'worker', bars: [[0.2, ends[w]]] });
        lanes.push({ label: '  browser', key: 'browser', bars: [[0.3, ends[w] - 0.05]] });
        lanes.push({ label: '  context/page', key: 'context', bars: ts.map((t) => [t.s, t.e, 'T' + (t.i + 1)]) });
      }
      const H = lanes.length * (rowH + 5) + 22;
      const svg = U.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Время жизни компонентов' });
      const map = { runner: ['runner', 'config', 'reporter'], worker: ['worker', 'wfix', 'driver'], browser: ['browser'], context: ['context', 'page', 'tfix'] };
      lanes.forEach((ln, i) => {
        const y = 6 + i * (rowH + 5);
        const on = map[ln.key].includes(sel);
        svg.appendChild(U.svg('text', { x: 4, y: y + 12, class: 'p-muted', text: ln.label.trim() }));
        ln.bars.forEach(([a, b, lab]) => {
          svg.appendChild(U.svg('rect', { x: x(a), y, width: Math.max(2, x(b) - x(a)), height: rowH, rx: 4, fill: on ? 'var(--accent)' : 'var(--surface-3)', stroke: on ? 'var(--accent)' : 'var(--border-2)' }));
          if (lab) svg.appendChild(U.svg('text', { x: (x(a) + x(b)) / 2, y: y + 12, 'text-anchor': 'middle', class: on ? 'pwa-tl-on' : 'p-muted', text: lab }));
        });
      });
      svg.appendChild(U.svg('text', { x: W - 8, y: H - 4, 'text-anchor': 'end', class: 'p-muted', text: 'время прогона →' }));
      U.clear(tl); tl.appendChild(svg);
    }
    draw();
  });

  /* ---------- Assertion Builder ---------- */
  const AB_TARGETS = {
    alert: { label: 'Сообщение «Заказ оформлен»', loc: "page.getByRole('alert')", states: ['visible', 'hidden', 'text', 'contain'] },
    pay: { label: 'Кнопка «Оплатить»', loc: "page.getByRole('button', { name: 'Оплатить', exact: true })", states: ['visible', 'enabled', 'disabled'] },
    email: { label: 'Поле Email', loc: "page.getByLabel('Email')", states: ['value', 'empty', 'editable', 'focused'] },
    agree: { label: 'Чекбокс «Согласен с условиями»', loc: "page.getByRole('checkbox', { name: 'Согласен с условиями' })", states: ['checked', 'unchecked'] },
    cards: { label: 'Карточки товаров (список)', loc: "page.getByTestId('product-card')", states: ['count', 'texts'] },
    total: { label: 'Итог корзины', loc: "page.getByTestId('cart-total')", states: ['text', 'contain'] },
    link: { label: 'Ссылка «Корзина»', loc: "page.getByRole('link', { name: 'Корзина' })", states: ['visible', 'attr'] },
    page: { label: 'Страница целиком', loc: 'page', states: ['url', 'title'] },
  };
  const AB_STATES = {
    visible: { label: 'видим', m: 'toBeVisible()', bad: 'expect(await L.isVisible()).toBe(true);', exp: 'visible', err: 'element(s) not found' },
    hidden: { label: 'скрыт или отсутствует', m: 'toBeHidden()', bad: 'expect(await L.isHidden()).toBe(true);', exp: 'hidden', err: 'element is visible' },
    text: { label: 'точный текст', m: { alert: "toHaveText('Заказ оформлен')", total: "toHaveText('9 980 ₽')" }, bad: { alert: "expect(await L.textContent()).toBe('Заказ оформлен');", total: "expect(await L.textContent()).toBe('9 980 ₽');" }, exp: 'text', err: 'unexpected value' },
    contain: { label: 'содержит текст', m: { alert: "toContainText('оформлен')", total: "toContainText('9 980')" }, bad: { alert: "expect(await L.innerText()).toContain('оформлен');", total: "expect(await L.innerText()).toContain('9 980');" }, exp: 'text', err: 'unexpected value' },
    enabled: { label: 'доступна для нажатия', m: 'toBeEnabled()', bad: 'expect(await L.isEnabled()).toBe(true);', exp: 'enabled', err: 'element is disabled' },
    disabled: { label: 'заблокирована', m: 'toBeDisabled()', bad: 'expect(await L.isDisabled()).toBe(true);', exp: 'disabled', err: 'element is enabled' },
    value: { label: 'значение поля', m: "toHaveValue('qa@example.com')", bad: "expect(await L.inputValue()).toBe('qa@example.com');", exp: 'value', err: 'unexpected value ""' },
    empty: { label: 'пустое', m: 'toBeEmpty()', bad: "expect(await L.inputValue()).toBe('');", exp: 'empty', err: 'element is not empty' },
    editable: { label: 'доступно для ввода', m: 'toBeEditable()', bad: 'expect(await L.isEditable()).toBe(true);', exp: 'editable', err: 'element is readonly' },
    focused: { label: 'в фокусе', m: 'toBeFocused()', bad: "expect(await L.evaluate((el) => el === document.activeElement)).toBe(true);", exp: 'focused', err: 'element is not focused' },
    checked: { label: 'отмечен', m: 'toBeChecked()', bad: 'expect(await L.isChecked()).toBe(true);', exp: 'checked', err: 'element is not checked' },
    unchecked: { label: 'не отмечен', m: 'not.toBeChecked()', bad: 'expect(await L.isChecked()).toBe(false);', exp: 'not checked', err: 'element is checked' },
    count: { label: 'количество элементов', m: 'toHaveCount(4)', bad: 'expect(await L.count()).toBe(4);', exp: '4', err: 'unexpected value "0"' },
    texts: { label: 'тексты всех элементов по порядку', m: "toHaveText(['Наушники Pulse', 'Колонка Boom', 'Клавиатура Keys', 'Мышь Click'])", bad: "expect(await L.allInnerTexts()).toEqual(['Наушники Pulse', 'Колонка Boom', 'Клавиатура Keys', 'Мышь Click']);", exp: 'array of texts', err: 'unexpected value []' },
    attr: { label: 'атрибут', m: "toHaveAttribute('href', '/cart')", bad: "expect(await L.getAttribute('href')).toBe('/cart');", exp: '"/cart"', err: 'unexpected value null' },
    url: { label: 'адрес страницы', m: 'toHaveURL(/\\/orders\\/\\d+$/)', bad: 'expect(page.url()).toMatch(/\\/orders\\/\\d+$/);', exp: '/\\/orders\\/\\d+$/', err: 'unexpected value "https://shop.local/checkout"' },
    title: { label: 'заголовок вкладки', m: "toHaveTitle('Заказ оформлен — ShopLab')", bad: "expect(await page.title()).toBe('Заказ оформлен — ShopLab');", exp: '"Заказ оформлен — ShopLab"', err: 'unexpected value "Оформление заказа — ShopLab"' },
  };
  const POLLS = [0, 100, 250, 500, 1000];
  function pollTimes(timeout) { const t = POLLS.slice(); while (t[t.length - 1] + 1000 <= timeout) t.push(t[t.length - 1] + 1000); return t.filter((x) => x <= timeout); }
  Sim.register('assertion-builder', (root) => {
    const s = { target: 'alert', state: 'visible', at: 1200, timeout: 5000 };
    const sh = UI.shell(root, {
      title: 'Assertion Builder', icon: 'check', kicker: 'Тренажёр', layout: 'side-left',
      help: 'Выберите элемент и состояние — получите web-first проверку. Затем задайте, когда приложение придёт в нужное состояние, и сравните на шкале времени с однократной проверкой.',
      onReset: () => { Object.assign(s, { target: 'alert', state: 'visible', at: 1200, timeout: 5000 }); build(); },
      note: 'Моменты повторных проверок на шкале условные: Playwright повторяет проверку с нарастающими интервалами до таймаута expect (по умолчанию 5 с).',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const out = el('div', { class: 'ab-out' });
    main.appendChild(out);
    function build() {
      U.clear(box);
      UI.select(box, { label: 'Элемент', value: s.target, options: Object.entries(AB_TARGETS).map(([k, t]) => ({ value: k, label: t.label })), onChange: (v) => { s.target = v; if (!AB_TARGETS[v].states.includes(s.state)) s.state = AB_TARGETS[v].states[0]; build(); } });
      UI.select(box, { label: 'Проверяемое состояние', value: s.state, options: AB_TARGETS[s.target].states.map((k) => ({ value: k, label: AB_STATES[k].label })), onChange: (v) => { s.state = v; update(); } });
      UI.slider(box, { label: 'Состояние наступает через', min: 0, max: 8000, step: 100, value: s.at, fmt: (v) => U.fmt(v) + ' мс', onInput: (v) => { s.at = v; update(); } });
      UI.seg(box, { label: 'Таймаут expect', value: s.timeout, options: [{ value: 5000, label: '5 с (по умолчанию)' }, { value: 10000, label: '10 с' }], onChange: (v) => { s.timeout = +v; update(); } });
      update();
    }
    function update() {
      const t = AB_TARGETS[s.target], st = AB_STATES[s.state];
      const m = typeof st.m === 'string' ? st.m : st.m[s.target];
      const bad = (typeof st.bad === 'string' ? st.bad : st.bad[s.target]).replace(/\bL\b/g, t.loc);
      const good = `await expect(${t.loc}).${m};`;
      const polls = pollTimes(s.timeout);
      const hit = polls.find((p) => p >= s.at);
      const okWeb = hit !== undefined;
      const okSnap = s.at === 0;
      U.clear(out);
      out.append(el('div', { class: 'card-sub', text: 'Web-first проверка — ждёт нужного состояния' }), code(good));
      out.append(el('div', { class: 'card-sub', text: 'Однократная проверка — читает значение один раз' }), code(bad));
      // шкала времени
      const W = 560, H = 112, max = Math.max(8000, s.timeout) + 300;
      const x = (ms) => 96 + (ms / max) * (W - 112);
      const svg = U.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Шкала времени проверок' });
      svg.appendChild(U.svg('rect', { x: x(s.at), y: 8, width: Math.max(0, x(max) - x(s.at)), height: 90, fill: 'color-mix(in srgb, var(--good) 10%, transparent)' }));
      svg.appendChild(U.svg('line', { x1: x(s.at), x2: x(s.at), y1: 6, y2: 100, stroke: 'var(--good)', 'stroke-width': 2 }));
      svg.appendChild(U.svg('text', { x: Math.min(x(s.at) + 4, W - 150), y: 18, class: 'p-muted', text: `состояние наступило: ${U.fmt(s.at)} мс` }));
      svg.appendChild(U.svg('line', { x1: x(s.timeout), x2: x(s.timeout), y1: 6, y2: 100, stroke: 'var(--bad)', 'stroke-dasharray': '4 3' }));
      svg.appendChild(U.svg('text', { x: x(s.timeout) - 4, y: 108, 'text-anchor': 'end', class: 'p-muted', text: `таймаут ${s.timeout / 1000} с` }));
      svg.appendChild(U.svg('text', { x: 16, y: 44, class: 'p-strong', text: 'web-first' }));
      polls.forEach((p) => { if (hit !== undefined && p > hit) return; const pass = p === hit; svg.appendChild(U.svg('circle', { cx: x(p), cy: 56, r: pass ? 6 : 4, fill: pass ? 'var(--good)' : 'var(--text-faint)' })); });
      if (!okWeb) svg.appendChild(U.svg('text', { x: x(s.timeout), y: 60, 'text-anchor': 'middle', class: 'ab-x', text: '✕' }));
      svg.appendChild(U.svg('text', { x: 16, y: 80, class: 'p-strong', text: 'однократно' }));
      svg.appendChild(U.svg('circle', { cx: x(0), cy: 90, r: 6, fill: okSnap ? 'var(--good)' : 'var(--bad)' }));
      const wrap = el('div', { class: 'ab-tl' }); wrap.appendChild(svg); out.appendChild(wrap);
      const ro = UI.readout(out, [{ key: 'w', label: 'Web-first' }, { key: 's', label: 'Однократная' }]);
      ro.set('w', okWeb ? `пройдена (≈ ${U.fmt(hit)} мс)` : 'упала по таймауту', okWeb ? 'ok-t' : 'bad-t');
      ro.set('s', okSnap ? 'пройдена' : 'упала сразу', okSnap ? 'ok-t' : 'bad-t');
      if (!okWeb) out.appendChild(el('pre', { class: 'out-box sql-err', text: `Error: expect(${t.loc === 'page' ? 'page' : 'locator'}).${m.replace(/\(.*$/, '')}() failed\n\n${t.loc === 'page' ? '' : `Locator:  ${t.loc.replace(/^page\./, '')}\n`}Expected: ${st.exp}\nTimeout:  ${s.timeout}ms\nError: ${st.err}\n\n(сообщение сокращено)` }));
      sh.say(okWeb && !okSnap
        ? `<p>Web-first проверка повторяется, пока состояние не наступит, и проходит через ${U.fmt(hit)} мс. Однократная проверка прочитала значение в момент 0 — до изменения — и упала. Именно так появляются flaky-тесты: на быстрой машине состояние успевает наступить, на медленной в CI — нет.</p>`
        : okWeb ? '<p>Состояние уже наступило — обе проверки проходят. Но однократная проверка зависит от удачи: чуть более медленный ответ сервера — и она упадёт.</p>'
          : `<p>Состояние наступает позже таймаута expect (${s.timeout / 1000} с) — проверка честно падает. Если такая задержка нормальна для этого сценария, увеличьте таймаут точечно: <code>${good.replace(/\)\.(\w+)\((.*)\);$/, (a, mm, args) => `).${mm}(${args ? args + ', ' : ''}{ timeout: ${Math.ceil((s.at + 1000) / 1000) * 1000} });`)}</code>; если нет — это дефект производительности, а не теста.</p>`);
    }
    build();
  });

  /* ---------- Фиксированная пауза против ожидания состояния ---------- */
  Sim.register('wait-strategies', (root) => {
    const D = { mean: 900, cv: 0.5, pause: 1500, seed: 7 };
    const s = Object.assign({}, D);
    const RUNS = 50, TIMEOUT = 5000;
    const sh = UI.shell(root, {
      title: 'waitForTimeout против ожидания состояния', icon: 'clock', kicker: 'Модель', layout: 'side-left',
      help: 'Время ответа приложения меняется от прогона к прогону. Сравните тест с фиксированной паузой и тест с web-first проверкой на 50 прогонах.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Время ответа моделируется логнормальным распределением с заданными средним и разбросом. Накладные расходы на опрос состояния не учитываются.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const chart = el('div', { class: 'ws-chart' });
    main.appendChild(chart);
    const roBox = el('div');
    main.appendChild(roBox);
    function build() {
      U.clear(box);
      UI.slider(box, { label: 'Среднее время ответа', min: 200, max: 3000, step: 50, value: s.mean, fmt: (v) => U.fmt(v) + ' мс', onInput: (v) => { s.mean = v; update(); } });
      UI.slider(box, { label: 'Разброс (коэффициент вариации)', min: 0.1, max: 1.2, step: 0.05, value: s.cv, fmt: (v) => U.fmt(v * 100) + '%', onInput: (v) => { s.cv = v; update(); } });
      UI.slider(box, { label: 'Фиксированная пауза waitForTimeout', min: 300, max: 6000, step: 100, value: s.pause, fmt: (v) => U.fmt(v) + ' мс', onInput: (v) => { s.pause = v; update(); } });
      UI.button(box, { label: 'Новая выборка', icon: 'repeat', onClick: () => { s.seed++; update(); } });
      update();
    }
    function sample() {
      const rnd = U.rng(s.seed);
      const sig2 = Math.log(1 + s.cv * s.cv), mu = Math.log(s.mean) - sig2 / 2, sig = Math.sqrt(sig2);
      const out = [];
      for (let i = 0; i < RUNS; i++) { const u1 = Math.max(1e-9, rnd()), u2 = rnd(); const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); out.push(Math.exp(mu + sig * z)); }
      return out;
    }
    function update() {
      const T = sample();
      const failFixed = T.filter((t) => t > s.pause).length;
      const failState = T.filter((t) => t > TIMEOUT).length;
      const timeFixed = RUNS * s.pause;
      const timeState = T.reduce((a, t) => a + Math.min(t, TIMEOUT), 0);
      const W = 560, H = 210, top = 10, bot = 26, maxY = Math.max(TIMEOUT, s.pause, ...T) * 1.05;
      const y = (v) => H - bot - (v / maxY) * (H - top - bot);
      const bw = (W - 40) / RUNS;
      const svg = U.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Время ответа в 50 прогонах' });
      T.forEach((t, i) => { const xx = 36 + i * bw; svg.appendChild(U.svg('rect', { x: xx + 1, y: y(t), width: Math.max(1, bw - 2), height: H - bot - y(t), rx: 2, fill: t > TIMEOUT ? 'var(--bad)' : t > s.pause ? 'var(--warn)' : 'var(--blue)' })); });
      const hline = (v, color, label, dash) => { svg.appendChild(U.svg('line', { x1: 34, x2: W - 2, y1: y(v), y2: y(v), stroke: color, 'stroke-width': 2, 'stroke-dasharray': dash || '' })); svg.appendChild(U.svg('text', { x: W - 4, y: y(v) - 4, 'text-anchor': 'end', class: 'p-muted', text: label })); };
      hline(s.pause, 'var(--accent)', `пауза ${U.fmt(s.pause)} мс`);
      hline(TIMEOUT, 'var(--bad)', 'таймаут expect 5 с', '5 4');
      svg.appendChild(U.svg('text', { x: 36, y: H - 8, class: 'p-muted', text: 'прогоны 1…50 (высота столбца — время ответа)' }));
      U.clear(chart); chart.appendChild(svg);
      chart.appendChild(UI.legend([{ color: 'var(--blue)', label: 'успел до паузы' }, { color: 'var(--warn)', label: 'позже паузы: тест с паузой падает' }, { color: 'var(--bad)', label: 'позже 5 с: падают оба' }]));
      U.clear(roBox);
      const ro = UI.readout(roBox, [{ key: 'ff', label: 'Падений с паузой' }, { key: 'fs', label: 'Падений с ожиданием состояния' }, { key: 'tf', label: 'Время ожиданий: пауза' }, { key: 'ts', label: 'Время ожиданий: состояние' }]);
      ro.set('ff', `${failFixed} из ${RUNS}`, failFixed ? 'bad-t' : 'ok-t');
      ro.set('fs', `${failState} из ${RUNS}`, failState ? 'bad-t' : 'ok-t');
      ro.set('tf', U.dur(timeFixed));
      ro.set('ts', U.dur(timeState));
      const wasted = timeFixed - T.filter((t) => t <= s.pause).reduce((a, t) => a + t, 0) - T.filter((t) => t > s.pause).length * s.pause;
      sh.say(`<p>${failFixed ? `Пауза ${U.fmt(s.pause)} мс слишком мала для ${failFixed} прогонов из ${RUNS} — это ложные падения, которые выглядят как flaky-тест.` : `Падений нет, но пауза потратила впустую ≈ ${U.dur(Math.max(0, wasted))} ожидания, когда приложение уже было готово.`} Ожидание состояния ${failState ? `упало ${failState} раз: ответ дольше таймаута — это сигнал о производительности, а не о тесте` : 'не упало ни разу'} и потратило ${U.dur(timeState)} против ${U.dur(timeFixed)}. Увеличение паузы снижает падения, но растит время всех прогонов; ожидание состояния выигрывает по обоим параметрам.</p>`);
    }
    build();
  });

  /* ---------- Порядок хуков и фикстур ---------- */
  Sim.register('fixtures-order', (root) => {
    const D = { workers: 2, failA: false, shared: false, onlyB: false, retries: 0 };
    const s = Object.assign({}, D);
    const sh = UI.shell(root, {
      title: 'Порядок хуков и фикстур в воркерах', icon: 'list', kicker: 'Модель выполнения', layout: 'side-left',
      help: 'Файл <code>cart.spec.ts</code>: <code>beforeAll</code>, <code>beforeEach</code>, тесты A и B, <code>afterAll</code>. Файл <code>catalog.spec.ts</code>: тест C. Фикстура <code>db</code> — worker, <code>cartPage</code> — test. Меняйте условия и сравнивайте журналы воркеров.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Модель повторяет поведение Playwright Test без fullyParallel: файлы распределяются по воркерам, тесты файла идут в одном воркере по порядку, после падения воркер перезапускается.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const srcBox = el('div');
    ctl.appendChild(srcBox);
    const lanes = el('div', { class: 'fo-lanes' });
    main.appendChild(lanes);
    function build() {
      U.clear(box);
      UI.seg(box, { label: 'workers', value: s.workers, options: [{ value: 1, label: '1' }, { value: 2, label: '2' }], onChange: (v) => { s.workers = +v; update(); } });
      UI.toggle(box, { label: 'Тест A падает', value: s.failA, onChange: (v) => { s.failA = v; update(); } });
      UI.toggle(box, { label: 'Корзина создаётся в beforeAll и общая для A и B', value: s.shared, onChange: (v) => { s.shared = v; update(); } });
      UI.toggle(box, { label: 'Запустить только тест B (--grep)', value: s.onlyB, onChange: (v) => { s.onlyB = v; update(); } });
      UI.seg(box, { label: 'retries', value: s.retries, options: [{ value: 0, label: '0' }, { value: 1, label: '1' }], onChange: (v) => { s.retries = +v; update(); } });
      update();
    }
    function simulate() {
      const files = [{ name: 'cart.spec.ts', tests: s.onlyB ? ['B'] : ['A', 'B'], hooks: true }, { name: 'catalog.spec.ts', tests: s.onlyB ? [] : ['C'], hooks: false }].filter((f) => f.tests.length);
      const queues = Array.from({ length: s.workers }, () => []);
      files.forEach((f, i) => queues[i % s.workers].push(f));
      let nextIndex = s.workers;
      const out = [];
      const results = {};
      queues.forEach((q, pi) => {
        const jobs = q.map((f) => ({ file: f, tests: f.tests.map((t) => ({ t, attempt: 0 })) }));
        let wi = pi;
        let lane = { title: `Воркер ${wi} (parallelIndex ${pi})`, ev: [] };
        out.push(lane);
        let dbUp = false, cartState = null, fileOpen = null;
        const startWorker = () => { lane.ev.push(['w', `Запуск процесса воркера, workerIndex ${wi}`]); dbUp = false; fileOpen = null; };
        const ensureDb = () => { if (!dbUp) { lane.ev.push(['wf', 'db: setup (worker-фикстура, один раз на воркер)']); dbUp = true; } };
        const stopWorker = (why) => { if (fileOpen && fileOpen.hooks) lane.ev.push(['h', 'afterAll']); if (dbUp) lane.ev.push(['wf', 'db: teardown']); lane.ev.push(['w', why]); };
        startWorker();
        const pending = [];
        jobs.forEach((j) => j.tests.forEach((t) => pending.push({ file: j.file, t: t.t, attempt: 0 })));
        while (pending.length) {
          const job = pending.shift();
          const f = job.file;
          if (fileOpen !== f) {
            if (fileOpen && fileOpen.hooks) lane.ev.push(['h', 'afterAll']);
            fileOpen = f;
            lane.ev.push(['file', f.name]);
            if (f.hooks) { ensureDb(); lane.ev.push(['h', s.shared ? 'beforeAll: создать пользователя и общую корзину' : 'beforeAll: создать пользователя через db']); cartState = s.shared ? [] : null; }
          }
          const label = `Тест ${job.t}${job.attempt ? ` (retry #${job.attempt})` : ''}`;
          if (f.hooks || job.t !== 'C') ensureDb();
          lane.ev.push(['tf', 'page, context: setup (новый BrowserContext)']);
          if (f.hooks) lane.ev.push(['h', 'beforeEach({ page }): page.goto(\'/cart\')']);
          if (job.t !== 'C') lane.ev.push(['tf', s.shared ? 'cartPage: setup (использует общую корзину)' : 'cartPage: setup (своя корзина через API)']);
          let fail = null;
          if (job.t === 'A') { if (s.failA) fail = 'expect(...).toHaveText: итог не совпал'; else if (s.shared) cartState.push('Наушники'); }
          if (job.t === 'B' && s.shared && !(cartState && cartState.length)) fail = 'B ожидал товар, добавленный тестом A: корзина пуста';
          lane.ev.push([fail ? 'fail' : 'test', label + (fail ? ' — упал: ' + fail : ' — пройден')]);
          if (f.hooks) lane.ev.push(['h', 'afterEach']);
          if (job.t !== 'C') lane.ev.push(['tf', 'cartPage: teardown']);
          lane.ev.push(['tf', 'page, context: teardown (контекст закрыт)']);
          results[job.t] = fail ? (job.attempt < s.retries ? 'retry' : 'failed') : job.attempt ? 'flaky' : 'passed';
          if (fail) {
            stopWorker('Воркер остановлен после падения теста');
            if (job.attempt < s.retries) pending.unshift({ file: f, t: job.t, attempt: job.attempt + 1 });
            if (pending.length) {
              wi = nextIndex++;
              lane = { title: `Воркер ${wi} (parallelIndex ${pi}) — новый процесс`, ev: [] };
              out.push(lane);
              startWorker();
            }
          }
        }
        if (lane.ev.length && lane.ev[lane.ev.length - 1][1].indexOf('остановлен') < 0) stopWorker('Тесты закончились, воркер завершён');
      });
      return { lanes: out, results };
    }
    function update() {
      const { lanes: ls, results } = simulate();
      U.clear(lanes);
      const cols = el('div', { class: 'fo-cols' });
      ls.forEach((ln) => {
        const c = el('div', { class: 'fo-lane' }, [el('div', { class: 'fo-title', text: ln.title })]);
        ln.ev.forEach(([k, t]) => c.appendChild(el('div', { class: 'fo-ev fo-' + k, text: t })));
        cols.appendChild(c);
      });
      lanes.appendChild(cols);
      lanes.appendChild(UI.legend([{ color: 'var(--violet)', label: 'worker-фикстура' }, { color: 'var(--blue)', label: 'test-фикстура' }, { color: 'var(--accent)', label: 'хук' }, { color: 'var(--good)', label: 'тест' }, { color: 'var(--bad)', label: 'падение' }]));
      U.clear(srcBox);
      srcBox.appendChild(el('div', { class: 'card-sub', text: 'Итог прогона' }));
      const ro = UI.readout(srcBox, Object.keys(results).map((k) => ({ key: k, label: 'Тест ' + k })));
      const tone = { passed: 'ok-t', flaky: 'warn-t', failed: 'bad-t' };
      const ru = { passed: 'passed', flaky: 'flaky (прошёл на ретрае)', failed: 'failed' };
      Object.entries(results).forEach(([k, v]) => ro.set(k, ru[v], tone[v]));
      const msgs = [];
      if (s.failA) msgs.push('После падения A воркер завершается: выполняются afterEach, teardown фикстур и afterAll, затем стартует новый процесс — worker-фикстура db и beforeAll выполняются заново.');
      if (s.shared) msgs.push(results.B === 'failed' ? 'Тест B зависит от состояния, которое оставил тест A. Когда A упал, запущен отдельно или B повторён в новом воркере, общая корзина пуста — B падает, хотя функциональность может быть исправна.' : 'B проходит только потому, что A выполнился раньше в том же воркере и положил товар в общую корзину. Это скрытая зависимость: запустите B отдельно или сделайте A падающим.');
      else if (s.onlyB) msgs.push('Каждый тест готовит свою корзину в test-фикстуре, поэтому B работает и отдельно, и в любом порядке.');
      if (!s.failA && !s.shared && !s.onlyB) msgs.push(`Фикстуры создаются лениво — перед первой функцией, которая их запросила: <code>page</code> нужна beforeEach, <code>cartPage</code> — только тесту. После теста: afterEach, затем teardown фикстур в обратном порядке. beforeAll и worker-фикстура выполняются один раз на воркер${s.workers === 2 ? '; файлы разошлись по двум воркерам' : ''}.`);
      sh.say(msgs.map((m) => `<p>${m}</p>`).join(''));
    }
    build();
  });

  /* ---------- Стоимость изменения UI: POM ---------- */
  const POM_CHANGES = {
    button: { label: 'Переименовали кнопку «Оформить заказ» → «Перейти к оплате»', share: 0.3, lines: 1, pages: 1, comp: 1, where: 'CheckoutPage', whereC: 'CheckoutPage' },
    login: { label: 'Форма входа: email и пароль заменили на телефон и код', share: 0.6, lines: 3, pages: 1, comp: 1, where: 'LoginPage', whereC: 'LoginPage' },
    header: { label: 'Новая шапка: поиск и корзина переехали в меню', share: 0.5, lines: 2, pages: 6, comp: 1, where: '6 Page Objects (копии шапки)', whereC: 'компонент Header' },
    testid: { label: 'Test id цены: product-price → price', share: 0.25, lines: 1, pages: 3, comp: 1, where: 'CatalogPage, CartPage, ProductPage', whereC: 'компонент ProductCard' },
  };
  Sim.register('pom-impact', (root) => {
    const D = { change: 'header', n: 120 };
    const s = Object.assign({}, D);
    const sh = UI.shell(root, {
      title: 'Сколько мест править после изменения интерфейса', icon: 'puzzle', kicker: 'Модель', layout: 'side-left',
      help: 'Выберите изменение интерфейса и размер набора. Модель считает места в коде, которые придётся исправить в трёх вариантах организации тестов.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Упрощённая модель: доля тестов, затронутых изменением, задана для каждого сценария; без POM локатор продублирован в каждом таком тесте. Начальная стоимость POM — порядка 6 классов страниц и 2 компонентов.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const out = el('div');
    main.appendChild(out);
    function build() {
      U.clear(box);
      UI.select(box, { label: 'Изменение интерфейса', value: s.change, options: Object.entries(POM_CHANGES).map(([k, c]) => ({ value: k, label: c.label })), onChange: (v) => { s.change = v; update(); } });
      UI.slider(box, { label: 'Тестов в наборе', min: 5, max: 400, step: 5, value: s.n, fmt: (v) => String(v), onInput: (v) => { s.n = v; update(); } });
      update();
    }
    function update() {
      const c = POM_CHANGES[s.change];
      const tests = Math.max(1, Math.round(s.n * c.share));
      const v = [
        { k: 'Без POM', files: tests, lines: tests * c.lines, where: `${tests} ${U.plural(tests, 'тест', 'теста', 'тестов')}` },
        { k: 'POM', files: c.pages, lines: c.pages * c.lines, where: c.where },
        { k: 'POM + компоненты', files: c.comp, lines: c.comp * c.lines, where: c.whereC },
      ];
      U.clear(out);
      const max = Math.max(...v.map((x) => x.files));
      const bars = el('div', { class: 'pom-bars' });
      v.forEach((x, i) => bars.appendChild(el('div', { class: 'pom-row' }, [el('span', { class: 'pom-k', text: x.k }), el('div', { class: 'pom-track' }, el('div', { class: 'pom-fill f' + i, style: `width:${Math.max(1.5, (x.files / max) * 100)}%` })), el('span', { class: 'pom-v mono', text: `${x.files} ${U.plural(x.files, 'файл', 'файла', 'файлов')}` })])));
      out.appendChild(bars);
      UI.table(out, ['Вариант', 'Где править', 'Строк'], v.map((x) => [x.k, U.esc(x.where), String(x.lines)]));
      const infra = 6 * 40 + 2 * 25;
      let msg = `<p>Изменение затрагивает ≈ ${tests} ${U.plural(tests, 'тест', 'теста', 'тестов')}. Без POM правка размазана по ним всем; с POM — ${c.pages === 1 ? 'один класс' : c.pages + ' ' + U.plural(c.pages, 'класс', 'класса', 'классов')}${c.comp < c.pages ? ', а повторяющаяся часть интерфейса, вынесенная в компонент, правится в одном месте' : ''}.</p>`;
      if (s.n <= 15) msg += `<p>При ${s.n} тестах выигрыш скромный, а инфраструктура классов (≈ ${infra} строк) стоит дороже самих правок. Для маленького набора достаточно общих хелперов; POM вводят, когда появляется дублирование.</p>`;
      else msg += '<p>Важно не только число правок: в варианте без POM легко пропустить одно место, и часть тестов продолжит падать после «исправления».</p>';
      sh.say(msg);
    }
    build();
  });

  /* ---------- Перехват сети ---------- */
  const NI = {
    continue: { label: 'Без перехвата (реальный API)', code: "await page.goto('/catalog');", ui: 'list4', ms: 320, net: 'GET /api/products → сервер → 200 (4 товара)', check: "await expect(page.getByTestId('product-card')).toHaveCount(4);", note: 'Тест проверяет фронтенд вместе с настоящим бэкендом и его данными. Результат зависит от состояния стенда.' },
    fulfill: { label: 'route.fulfill: свои данные 200', code: "await page.route('**/api/products*', (route) =>\n  route.fulfill({ json: { items: [{ id: 1, title: 'Тестовый товар', price: 100 }], total: 1 } }),\n);\nawait page.goto('/catalog');", ui: 'list1', ms: 5, net: 'GET /api/products → route.fulfill → 200 (подмена, до сервера не дошёл)', check: "await expect(page.getByTestId('product-card')).toHaveCount(1);\nawait expect(page.getByTestId('product-card')).toContainText('Тестовый товар');", note: 'Фронтенд изолирован от бэкенда: данные полностью под контролем теста. Контракт с настоящим API такой тест не проверяет — для этого нужны API- или контрактные тесты.' },
    s500: { label: 'route.fulfill: 500', code: "await page.route('**/api/products*', (route) =>\n  route.fulfill({ status: 500, json: { code: 'INTERNAL' } }),\n);\nawait page.goto('/catalog');", ui: 'error', ms: 5, net: 'GET /api/products → route.fulfill → 500', check: "await expect(page.getByRole('alert')).toHaveText('Не удалось загрузить каталог. Попробуйте позже');", note: 'Редкое состояние, которое на реальном стенде воспроизвести трудно. Проверяем, что пользователь видит понятное сообщение, а не пустую страницу.' },
    empty: { label: 'route.fulfill: пустой список', code: "await page.route('**/api/products*', (route) =>\n  route.fulfill({ json: { items: [], total: 0 } }),\n);\nawait page.goto('/catalog');", ui: 'empty', ms: 5, net: 'GET /api/products → route.fulfill → 200 (пустой список)', check: "await expect(page.getByText('Товары не найдены')).toBeVisible();", note: 'Граничный случай «нет данных» без очистки настоящей базы.' },
    delay: { label: 'Задержка ответа', code: "await page.route('**/api/products*', async (route) => {\n  await new Promise((r) => setTimeout(r, DELAY));\n  await route.continue();\n});\nawait page.goto('/catalog');", ui: 'list4', ms: 0, net: 'GET /api/products → задержка → сервер → 200', check: "await expect(page.getByRole('progressbar')).toBeVisible();\nawait expect(page.getByTestId('product-card')).toHaveCount(4);", note: 'Проверяем индикатор загрузки и то, что тест не зависит от скорости ответа.' },
    abort: { label: 'route.abort: обрыв соединения', code: "await page.route('**/api/products*', (route) => route.abort('internetdisconnected'));\nawait page.goto('/catalog');", ui: 'offline', ms: 2, net: 'GET /api/products → route.abort → net::ERR_INTERNET_DISCONNECTED', check: "await expect(page.getByRole('alert')).toContainText('Нет соединения');", note: 'Сетевую ошибку нельзя получить через fulfill: запрос не получает никакого ответа, и фронтенд обрабатывает исключение fetch.' },
  };
  Sim.register('network-interception', (root) => {
    const D = { mode: 'fulfill', late: false, delay: 2000 };
    const s = Object.assign({}, D);
    const sh = UI.shell(root, {
      title: 'Перехват запроса каталога', icon: 'globe', kicker: 'Визуализация', layout: 'two',
      help: 'Выберите, что сделать с запросом <code>GET /api/products</code>. Справа — что увидит пользователь, ниже — код теста и проверка.',
      onReset: () => { Object.assign(s, D); build(); },
    });
    const left = sh.col(), right = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    left.appendChild(box);
    const codeBox = el('div');
    left.appendChild(codeBox);
    const view = el('div', { class: 'ni-view' });
    right.appendChild(view);
    const net = el('pre', { class: 'out-box ni-net' });
    right.appendChild(net);
    function build() {
      U.clear(box);
      UI.select(box, { label: 'Стратегия', value: s.mode, options: Object.entries(NI).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => { s.mode = v; build(); } });
      if (s.mode === 'delay') UI.slider(box, { label: 'Задержка', min: 500, max: 8000, step: 250, value: s.delay, fmt: (v) => U.fmt(v) + ' мс', onInput: (v) => { s.delay = v; update(); } });
      if (s.mode !== 'continue') UI.toggle(box, { label: 'Ошибка: page.route вызван после page.goto', value: s.late, onChange: (v) => { s.late = v; update(); } });
      update();
    }
    function render(kind, loading) {
      const items = kind === 'list1' ? [['Тестовый товар', '100 ₽']] : [['Наушники Pulse', '4 990 ₽'], ['Колонка Boom', '7 990 ₽'], ['Клавиатура Keys', '3 490 ₽'], ['Мышь Click', '1 290 ₽']];
      const v = el('div', { class: 'ni-page' }, [el('div', { class: 'lp-url mono', text: 'shop.local/catalog' }), el('div', { class: 'ni-h', text: 'Каталог' })]);
      if (loading) v.appendChild(el('div', { class: 'ni-spin', text: 'Загрузка…' }));
      if (kind === 'list1' || kind === 'list4') v.appendChild(el('div', { class: 'ni-grid' }, items.map(([t, p]) => el('div', { class: 'ni-card' }, [el('b', { text: t }), el('span', { text: p })]))));
      if (kind === 'error') v.appendChild(el('div', { class: 'ni-alert', text: 'Не удалось загрузить каталог. Попробуйте позже' }));
      if (kind === 'empty') v.appendChild(el('div', { class: 'ni-empty', text: 'Товары не найдены' }));
      if (kind === 'offline') v.appendChild(el('div', { class: 'ni-alert', text: 'Нет соединения с интернетом' }));
      return v;
    }
    function update() {
      const m = NI[s.mode];
      const late = s.late && s.mode !== 'continue';
      let src = m.code.replace('DELAY', String(s.delay));
      if (late) src = src.replace(/\nawait page\.goto\('\/catalog'\);$/, '').replace(/^/, "await page.goto('/catalog');   // запрос каталога уже ушёл\n");
      U.clear(codeBox);
      codeBox.append(el('div', { class: 'card-sub', text: 'Код теста' }), code(src + '\n' + m.check));
      U.clear(view);
      let pass = true, msg;
      if (late) {
        view.appendChild(render('list4'));
        net.textContent = 'GET /api/products → сервер → 200 (4 товара)\n# обработчик route зарегистрирован позже — запрос не перехвачен';
        pass = false;
        msg = '<p>Обработчик зарегистрирован после навигации: запрос каталога уже ушёл на настоящий сервер, подмена не сработала. Проверка, рассчитанная на подменённые данные, упадёт или — хуже — пройдёт случайно. Регистрируйте <code>page.route</code> до <code>page.goto</code>.</p>';
      } else if (s.mode === 'delay') {
        const total = s.delay + 320;
        view.appendChild(render('list4', true));
        net.textContent = `${m.net}\n# ответ через ≈ ${U.fmt(total)} мс`;
        pass = total <= 5000;
        msg = `<p>Пользователь ≈ ${U.fmt(total)} мс видит индикатор загрузки. ${pass ? 'Web-first проверка дождётся карточек в пределах таймаута expect (5 с).' : `Ответ приходит позже таймаута expect (5 с) — проверка количества карточек упадёт. Если такая задержка ожидаема, нужен явный <code>{ timeout }</code>; если нет — это дефект производительности.`}</p>`;
      } else {
        view.appendChild(render(m.ui));
        net.textContent = m.net;
        msg = `<p>${m.note}</p>`;
      }
      view.appendChild(el('div', { class: 'ni-res ' + (pass ? 'ok-t' : 'bad-t'), text: pass ? '✓ проверка проходит' : '✕ проверка падает' }));
      sh.say(msg);
    }
    build();
  });
})();

;
