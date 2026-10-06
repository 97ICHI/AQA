/* ===== sims/04-tech.js ===== */
/* ===== Раздел III: путь запроса, API Playground, SQL Playground, Git workflow ===== */
(function () {
  'use strict';
  const { el } = U;

  /* ---------- Путь запроса ---------- */
  Sim.register('request-journey', (root) => {
    const D0 = { target: 'orders', dnsCache: false, dnsOk: true, https: true, certOk: true, appUp: true, session: true, role: 'customer', dbUp: true };
    const s = Object.assign({}, D0);
    const TARGETS = {
      catalog: { label: 'GET /catalog (публичная страница)', auth: false, admin: false },
      orders: { label: 'GET /api/orders (мои заказы)', auth: true, admin: false },
      reports: { label: 'GET /api/admin/reports (только админ)', auth: true, admin: true },
    };
    const sh = UI.shell(root, {
      title: 'Путь запроса через веб-приложение', icon: 'globe', kicker: 'Визуализация',
      help: 'Выберите запрос и включайте или выключайте условия. Схема покажет, какие звенья пройдены, где запрос остановился, с каким результатом и сколько времени заняло каждое звено.',
      onReset: () => { Object.assign(s, D0); build(); update(); },
      note: 'Времена условные, порядок звеньев и коды ответов соответствуют типичному веб-приложению с балансировщиком и сессией.',
    });
    const left = sh.col(), right = sh.col();
    const flow = el('div', { class: 'flow rj-flow' });
    left.appendChild(flow);
    const result = el('div', { class: 'rj-result' });
    left.appendChild(result);
    const ctlBox = el('div', { class: 'ctl-stack' });
    right.appendChild(ctlBox);
    function build() {
      U.clear(ctlBox);
      UI.select(ctlBox, { label: 'Запрос', value: s.target, options: Object.entries(TARGETS).map(([k, t]) => ({ value: k, label: t.label })), onChange: (v) => { s.target = v; update(); } });
      const tg = (key, label) => UI.toggle(ctlBox, { label, value: s[key], onChange: (v) => { s[key] = v; update(); } });
      tg('dnsCache', 'IP домена уже в кэше DNS');
      tg('dnsOk', 'Домен существует (DNS отвечает)');
      tg('https', 'HTTPS');
      tg('certOk', 'Сертификат сервера валиден');
      tg('appUp', 'Бэкенд запущен');
      tg('session', 'Есть cookie сессии (вошёл в систему)');
      UI.seg(ctlBox, { label: 'Роль пользователя', value: s.role, options: [{ value: 'customer', label: 'Покупатель' }, { value: 'admin', label: 'Администратор' }], onChange: (v) => { s.role = v; update(); } });
      tg('dbUp', 'База данных доступна');
    }
    function update() {
      const t = TARGETS[s.target];
      const steps = [];
      let stop = null;
      const add = (name, sub, ms, ok, fail) => { if (stop) { steps.push({ name, sub, state: 'off' }); return; } if (ok) steps.push({ name, sub, ms, state: 'ok' }); else { steps.push({ name, sub, ms, state: 'bad' }); stop = fail; } };
      add('Браузер', 'формирует запрос, добавляет cookies', 1, true);
      add('DNS', s.dnsCache ? 'ответ из кэша' : 'запрос к резолверу', s.dnsCache ? 0 : 28, s.dnsOk || s.dnsCache, { code: 'net::ERR_NAME_NOT_RESOLVED', text: 'Имя домена не разрешилось в IP-адрес. В тесте: проверить адрес стенда, VPN, имя сервиса в Docker.' });
      add('TCP', 'рукопожатие SYN → SYN-ACK → ACK, порт ' + (s.https ? 443 : 80), 18, true);
      if (s.https) add('TLS', 'шифрование и проверка сертификата', 32, s.certOk, { code: 'net::ERR_CERT_AUTHORITY_INVALID', text: 'Браузер не доверяет сертификату. Для тестового стенда — осознанно ignoreHTTPSErrors или исправить сертификат.' });
      add('Балансировщик', 'выбирает экземпляр бэкенда', 3, s.appUp, { code: '502 Bad Gateway', text: 'Балансировщик жив, но бэкенд не отвечает: упал, перезапускается или деплоится.' });
      if (t.auth) add('Аутентификация', 'сессия по cookie', 6, s.session, { code: s.target === 'catalog' ? '302 → /login' : '401 Unauthorized', text: 'Нет действующей сессии — сервер не знает, кто вы. Для API — 401, для страницы — обычно редирект на вход.' });
      if (t.admin) add('Авторизация', 'проверка роли', 2, s.role === 'admin', { code: '403 Forbidden', text: 'Пользователь известен, но прав на ресурс нет. Это проверяют API-тестами для каждой роли.' });
      add('База данных', 'чтение данных', 24, s.dbUp, { code: '503 Service Unavailable', text: 'Бэкенд не смог получить данные. Хороший сервис отвечает 503 с понятной ошибкой, а не 500 со стек-трейсом.' });
      add('Ответ', s.target === 'catalog' ? 'HTML, затем CSS/JS и запросы к API' : 'JSON', 9, true);
      U.clear(flow);
      steps.forEach((st, i) => {
        if (i) flow.appendChild(el('span', { class: 'flow-arrow', text: '→', 'aria-hidden': 'true' }));
        flow.appendChild(el('div', { class: 'flow-node ' + (st.state === 'ok' ? 'is-good' : st.state === 'bad' ? 'is-bad' : 'is-off') }, [el('b', { text: st.name }), el('span', { class: 'sub', text: st.sub }), st.ms !== undefined ? el('span', { class: 'sub mono', text: st.state === 'off' ? '' : `${st.ms} мс` }) : null]));
      });
      const total = steps.filter((x) => x.ms !== undefined && x.state !== 'off').reduce((a, x) => a + x.ms, 0);
      const code = stop ? stop.code : '200 OK';
      result.innerHTML = `<div class="rj-code ${stop ? 'bad-t' : 'ok-t'}">${code}</div><div class="muted-t">≈ ${total} мс до результата</div>`;
      sh.say(stop ? `<p>Запрос остановился на звене <b>${steps.find((x) => x.state === 'bad').name}</b>: ${stop.text}</p>` : `<p>Все звенья пройдены, ответ 200 за ≈ ${total} мс. ${s.dnsCache ? '' : 'Включите кэш DNS — первое звено станет бесплатным. '}Теперь выключите любое условие и посмотрите, как одна и та же «ошибка теста» выглядит на разных звеньях.</p>`);
    }
    build(); update();
  });

  /* ---------- API Playground ---------- */
  const PRESETS = {
    http: [
      ['Каталог: первая страница', 'GET', '/api/products?limit=3', '', ''],
      ['Каталог: фильтр и вторая страница', 'GET', '/api/products?category=computers&page=2&limit=2', '', ''],
      ['Каталог: некорректный limit', 'GET', '/api/products?limit=500', '', ''],
      ['Товар по id', 'GET', '/api/products/1', '', ''],
      ['Несуществующий товар', 'GET', '/api/products/999', '', ''],
      ['Вход', 'POST', '/api/auth/login', 'Content-Type: application/json', '{\n  "email": "anna@example.com",\n  "password": "Anna2025!"\n}'],
      ['Вход: неверный пароль', 'POST', '/api/auth/login', 'Content-Type: application/json', '{\n  "email": "anna@example.com",\n  "password": "wrong"\n}'],
      ['Мои заказы', 'GET', '/api/orders', 'Authorization: Bearer anna-token', ''],
      ['Заказы без токена', 'GET', '/api/orders', '', ''],
      ['Истёкший токен', 'GET', '/api/orders', 'Authorization: Bearer expired-token', ''],
      ['Чужой заказ (IDOR)', 'GET', '/api/orders/104', 'Authorization: Bearer anna-token', ''],
      ['Создать заказ', 'POST', '/api/orders', 'Authorization: Bearer anna-token\nContent-Type: application/json\nIdempotency-Key: demo-key-1', '{\n  "items": [{ "productId": 1, "qty": 2 }]\n}'],
      ['Создать заказ: ошибка валидации', 'POST', '/api/orders', 'Authorization: Bearer anna-token\nContent-Type: application/json', '{\n  "items": [{ "productId": 1, "qty": 0 }]\n}'],
      ['Создать заказ: нет на складе', 'POST', '/api/orders', 'Authorization: Bearer anna-token\nContent-Type: application/json', '{\n  "items": [{ "productId": 2, "qty": 1 }]\n}'],
      ['Создать заказ: битый JSON', 'POST', '/api/orders', 'Authorization: Bearer anna-token\nContent-Type: application/json', '{ "items": [ }'],
      ['Создать заказ: без Content-Type', 'POST', '/api/orders', 'Authorization: Bearer anna-token', '{"items":[{"productId":1,"qty":1}]}'],
      ['Отменить оплаченный заказ', 'PATCH', '/api/orders/102', 'Authorization: Bearer anna-token\nContent-Type: application/json', '{\n  "status": "cancelled"\n}'],
      ['Недопустимый переход статуса', 'PATCH', '/api/orders/101', 'Authorization: Bearer anna-token\nContent-Type: application/json', '{\n  "status": "cancelled"\n}'],
      ['Удалить заказ 102 (сначала отмените, затем повторите DELETE)', 'DELETE', '/api/orders/102', 'Authorization: Bearer anna-token', ''],
      ['Неподдерживаемый метод', 'DELETE', '/api/products', '', ''],
      ['Rate limit: отправьте 13 раз подряд', 'GET', '/api/health', 'Authorization: Bearer boris-token', ''],
    ],
    mock: [
      ['1. Создать заказ для оплаты', 'POST', '/api/orders', 'Authorization: Bearer anna-token\nContent-Type: application/json', '{\n  "items": [{ "productId": 4, "qty": 1 }]\n}'],
      ['2. Оплатить созданный заказ', 'POST', '/api/orders/{id}/pay', 'Authorization: Bearer anna-token\nContent-Type: application/json', '{\n  "cardToken": "tok_visa"\n}'],
      ['3. Проверить статус заказа', 'GET', '/api/orders/{id}', 'Authorization: Bearer anna-token', ''],
      ['Стоимость доставки', 'GET', '/api/delivery/quote?city=Москва', '', ''],
      ['Стоимость доставки без города', 'GET', '/api/delivery/quote', '', ''],
    ],
  };
  const EXPLAIN = {
    200: 'Успех с телом ответа. Проверьте не только код, но и содержимое: нужные поля и значения.',
    201: 'Ресурс создан. Проверьте заголовок Location и что ресурс действительно доступен по нему (побочный эффект).',
    204: 'Успех без тела — типично для DELETE. Повторный DELETE того же ресурса вернёт 404: состояние то же, операция идемпотентна.',
    400: 'Запрос некорректен синтаксически: неверный тип параметра, битый JSON, недопустимое значение параметра.',
    401: 'Не удалось установить, кто вы: нет токена, он неверный или истёк.',
    402: 'Платёж отклонён. Важно, что заказ остался неоплаченным — проверьте это отдельным запросом.',
    403: 'Пользователь известен, но действие ему запрещено.',
    404: 'Ресурс не найден. Для чужих заказов API тоже отвечает 404, чтобы не раскрывать их существование.',
    405: 'Метод не поддерживается для этого пути; заголовок Allow перечисляет допустимые.',
    409: 'Конфликт с текущим состоянием: нет на складе, недопустимый переход статуса, повторная оплата.',
    415: 'Тело есть, но Content-Type не application/json — сервер не знает, как его разобрать.',
    422: 'Формат верный, но данные нарушают правила. details указывает поле и причину — проверьте и их.',
    429: 'Превышен лимит запросов. Retry-After говорит, через сколько секунд повторить.',
    502: 'Ошибка зависимости (шлюза). Сервис корректно сообщает о проблеме соседа, не роняя себя.',
    503: 'Сервис или его зависимость временно недоступны; Retry-After подсказывает, когда повторить.',
    504: 'Зависимость не ответила вовремя. Тест должен проверить, что состояние не изменилось (заказ не оплачен).',
  };
  function parseHeaders(txt) {
    const h = {};
    String(txt).split('\n').forEach((ln) => { const i = ln.indexOf(':'); if (i > 0) h[ln.slice(0, i).trim().toLowerCase()] = ln.slice(i + 1).trim(); });
    return h;
  }
  Sim.register('api-playground', (root, data) => {
    const preset = data.preset === 'mock' ? 'mock' : 'http';
    const api = new ShopApi();
    const history = [];
    const sh = UI.shell(root, {
      title: preset === 'mock' ? 'API Playground: подмена внешних зависимостей' : 'API Playground: HTTP-запросы и ответы',
      icon: 'api', kicker: 'Тренажёр', layout: 'one',
      help: preset === 'mock'
        ? 'Учебный API магазина вызывает платёжный шлюз и службу доставки. Переключайте поведение этих зависимостей, как мок-сервер в тестовом окружении, и выполняйте сценарий 1 → 2 → 3.'
        : 'Составьте запрос к учебному API магазина или выберите пример. Токены для заголовка Authorization: <code>anna-token</code>, <code>boris-token</code>, <code>admin-token</code>, <code>expired-token</code>.',
      onReset: () => { api.reset(); lastId = null; history.length = 0; if (depSegs) depSegs.forEach((d) => d.set(d.def, true)); load(PRESETS[preset][0]); out.innerHTML = ''; renderHist(); sh.say('База учебного API восстановлена.'); },
      note: 'API работает в браузере на учебных данных: товары, три пользователя, несколько заказов. Сеть не используется.',
    });
    const col = sh.col();
    // зависимости
    let depSegs = null;
    if (preset === 'mock') {
      const deps = el('div', { class: 'ap-deps' });
      col.appendChild(deps);
      depSegs = [
        Object.assign(UI.seg(deps, { label: 'Платёжный шлюз', value: 'approve', options: [{ value: 'approve', label: 'Одобряет' }, { value: 'decline', label: 'Отклоняет' }, { value: 'timeout', label: 'Таймаут' }, { value: 'error', label: 'Ошибка 500' }], onChange: (v) => { api.deps.gateway = v; } }), { def: 'approve' }),
        Object.assign(UI.seg(deps, { label: 'Служба доставки', value: 'ok', options: [{ value: 'ok', label: 'Работает' }, { value: 'slow', label: 'Медленная' }, { value: 'down', label: 'Недоступна' }], onChange: (v) => { api.deps.delivery = v; } }), { def: 'ok' }),
      ];
    }
    const form = el('div', { class: 'ap-form' });
    col.appendChild(form);
    const presetSel = UI.select(form, { label: 'Пример', value: 0, options: PRESETS[preset].map((p, i) => ({ value: i, label: p[0] })), onChange: (v) => load(PRESETS[preset][+v]) });
    presetSel.el.classList.add('ap-preset');
    const line = el('div', { class: 'ap-line' });
    const method = el('select', { class: 'inp ap-method', 'aria-label': 'HTTP-метод' }, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => el('option', { value: m, text: m })));
    const pathIn = el('input', { class: 'inp mono ap-path', 'aria-label': 'Путь и query-параметры', spellcheck: 'false' });
    const send = UI.button(null, { label: 'Отправить', icon: 'play', primary: true, onClick: () => doSend() });
    line.append(method, pathIn, send);
    form.appendChild(line);
    const areas = el('div', { class: 'ap-areas' });
    const hdrs = el('textarea', { class: 'inp mono', rows: 4, 'aria-label': 'Заголовки: по одному на строке', placeholder: 'Authorization: Bearer anna-token\nContent-Type: application/json', spellcheck: 'false' });
    const bodyIn = el('textarea', { class: 'inp mono', rows: 4, 'aria-label': 'Тело запроса (JSON)', placeholder: '{ }', spellcheck: 'false' });
    areas.append(el('label', { class: 'sel' }, [el('span', { text: 'Заголовки' }), hdrs]), el('label', { class: 'sel' }, [el('span', { text: 'Тело запроса' }), bodyIn]));
    form.appendChild(areas);
    pathIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
    [hdrs, bodyIn].forEach((t) => t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSend(); }));
    const out = el('div', { class: 'ap-out', 'aria-live': 'polite' });
    col.appendChild(out);
    const histBox = el('div', { class: 'ap-hist' });
    col.appendChild(histBox);
    let lastId = null;
    function load(p) { method.value = p[1]; pathIn.value = p[2].replace('{id}', lastId || 110); hdrs.value = p[3]; bodyIn.value = p[4]; }
    function rawReq(m, p, h, b) { return `${m} ${p} HTTP/1.1\nHost: shop.local\n` + Object.entries(h).map(([k, v]) => `${k.replace(/(^|-)([a-z])/g, (x, a, c) => a + c.toUpperCase())}: ${v}`).join('\n') + (b ? `\n\n${b}` : ''); }
    function rawRes(r) { return `HTTP/1.1 ${r.status} ${r.statusText}\n` + Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join('\n') + (r.body !== null ? '\n\n' + JSON.stringify(r.body, null, 2) : ''); }
    function asserts(m, p, r) {
      const lines = [`const res = await request.${m.toLowerCase() === 'delete' ? 'delete' : m.toLowerCase()}('${p}'${m === 'GET' || m === 'DELETE' ? '' : ', { data }'});`, `expect(res.status()).toBe(${r.status});`];
      if (r.headers.location) lines.push(`expect(res.headers()['location']).toMatch(/^\\/api\\/orders\\/\\d+$/);`);
      if (r.headers['retry-after']) lines.push(`expect(Number(res.headers()['retry-after'])).toBeGreaterThan(0);`);
      if (r.body && r.body.code) lines.push(`expect(await res.json()).toMatchObject({ code: '${r.body.code}' });`);
      else if (r.body && r.body.status) lines.push(`expect(await res.json()).toMatchObject({ status: '${r.body.status}' });`);
      else if (r.body && Array.isArray(r.body.items)) lines.push(`expect((await res.json()).items.length).toBe(${r.body.items.length});`);
      return lines.join('\n');
    }
    function doSend() {
      const m = method.value, p = pathIn.value.trim() || '/', h = parseHeaders(hdrs.value), b = bodyIn.value;
      const r = api.handle({ method: m, path: p, headers: h, body: m === 'GET' || m === 'DELETE' ? '' : b });
      if (r.status === 201 && r.body && r.body.id) lastId = r.body.id;
      history.unshift({ m, p, h: hdrs.value, b, status: r.status });
      if (history.length > 6) history.pop();
      const cls = r.status < 300 ? 'good' : r.status < 500 ? 'warn' : 'bad';
      out.innerHTML = '';
      out.appendChild(el('div', { class: 'ap-status' }, [el('span', { class: 'badge ' + cls, text: `${r.status} ${r.statusText}` }), el('span', { class: 'muted-t', text: `${U.fmt(r.timeMs)} мс` }), r.headers['idempotent-replayed'] ? el('span', { class: 'badge vio', text: 'повтор по Idempotency-Key' }) : null]));
      const grid = el('div', { class: 'ap-grid' });
      grid.append(
        el('div', {}, [el('div', { class: 'card-sub', text: 'Сырой запрос' }), el('pre', { class: 'out-box', html: U.hl(rawReq(m, p, h, m === 'GET' || m === 'DELETE' ? '' : b), 'http') })]),
        el('div', {}, [el('div', { class: 'card-sub', text: 'Сырой ответ' }), el('pre', { class: 'out-box', html: U.hl(rawRes(r), 'http') })]),
      );
      out.appendChild(grid);
      if (r.deps && r.deps.length) out.appendChild(el('div', {}, [el('div', { class: 'card-sub', text: 'Вызовы зависимостей (то, что записал бы spy мок-сервера)' }), el('pre', { class: 'out-box', text: r.deps.join('\n') })]));
      out.appendChild(el('div', {}, [el('div', { class: 'card-sub', text: 'Проверки для автотеста' }), el('pre', { class: 'out-box', html: U.hl(asserts(m, p, r), 'ts') })]));
      sh.say(`<p><b>${r.status} ${r.statusText}.</b> ${EXPLAIN[r.status] || ''}</p>`);
      renderHist();
    }
    function renderHist() {
      U.clear(histBox);
      if (!history.length) return;
      histBox.appendChild(el('div', { class: 'card-sub', text: 'История' }));
      const row = el('div', { class: 'btn-row' });
      history.forEach((x) => UI.button(row, { label: `${x.m} ${x.p} → ${x.status}`, cls: 'ap-hbtn', onClick: () => { method.value = x.m; pathIn.value = x.p; hdrs.value = x.h; bodyIn.value = x.b; } }));
      histBox.appendChild(row);
    }
    load(PRESETS[preset][0]);
    sh.say(preset === 'mock' ? 'Выполните сценарий по шагам 1 → 2 → 3. Затем переключите шлюз на «Отклоняет» или «Таймаут» и пройдите шаги ещё раз: путь оплаты подставит id нового заказа, а заказ должен остаться неоплаченным.' : 'Нажмите «Отправить» или выберите другой пример. Ctrl+Enter в полях заголовков и тела тоже отправляет запрос.');
  });

  /* ---------- SQL Playground ---------- */
  const SQL_EXAMPLES = [
    ['Товары дороже 3000 ₽ в наличии', "SELECT id, title, price, stock\nFROM products\nWHERE price > 3000 AND stock > 0\nORDER BY price DESC;"],
    ['Ловушка NULL: = NULL', "-- 0 строк: сравнение с NULL никогда не истинно\nSELECT name FROM customers WHERE city = NULL;\n-- правильно:\nSELECT name FROM customers WHERE city IS NULL;"],
    ['Ловушка NOT IN с NULL', "SELECT name FROM customers\nWHERE city NOT IN (SELECT city FROM customers WHERE is_vip = FALSE);"],
    ['INNER и LEFT JOIN', "SELECT c.name, COUNT(o.id) AS orders_count\nFROM customers AS c\nLEFT JOIN orders AS o ON o.customer_id = c.id\nGROUP BY c.id, c.name\nORDER BY orders_count DESC, c.name;"],
    ['Товары без заказов', "SELECT p.id, p.title\nFROM products AS p\nLEFT JOIN order_items AS oi ON oi.product_id = p.id\nWHERE oi.product_id IS NULL;"],
    ['GROUP BY и HAVING', "SELECT c.name, SUM(oi.qty * oi.price) AS spent\nFROM customers AS c\nJOIN orders AS o ON o.customer_id = c.id\nJOIN order_items AS oi ON oi.order_id = o.id\nWHERE o.status <> 'cancelled'\nGROUP BY c.id, c.name\nHAVING SUM(oi.qty * oi.price) > 15000\nORDER BY spent DESC;"],
    ['Подзапрос EXISTS', "SELECT c.name\nFROM customers AS c\nWHERE EXISTS (\n  SELECT 1 FROM orders AS o\n  WHERE o.customer_id = c.id AND o.status = 'paid'\n)\nORDER BY c.name;"],
    ['CTE WITH', "WITH order_totals AS (\n  SELECT order_id, SUM(qty * price) AS total\n  FROM order_items\n  GROUP BY order_id\n)\nSELECT o.id, o.status, t.total\nFROM orders AS o\nJOIN order_totals AS t ON t.order_id = o.id\nWHERE t.total > 10000\nORDER BY t.total DESC;"],
    ['Подготовка данных: INSERT … RETURNING', "INSERT INTO customers (id, email, name, city, registered_at)\nVALUES (1001, 'qa+1001@example.com', 'QA Тест', 'Москва', CURRENT_DATE)\nRETURNING id, email, is_vip;"],
    ['Нарушение UNIQUE', "INSERT INTO customers (id, email, name, registered_at)\nVALUES (2001, 'anna@example.com', 'Дубль', CURRENT_DATE);"],
    ['Нарушение FOREIGN KEY', "DELETE FROM customers WHERE id = 1;"],
    ['Транзакция и ROLLBACK', "BEGIN;\nDELETE FROM order_items WHERE order_id = 101;\nSELECT COUNT(*) FROM order_items WHERE order_id = 101;\nROLLBACK;\nSELECT COUNT(*) FROM order_items WHERE order_id = 101;"],
    ['Ошибка внутри транзакции', "BEGIN;\nUPDATE products SET stock = stock - 50 WHERE id = 1;\n-- команда нарушит CHECK (stock >= 0), выполнение остановится,\n-- транзакция станет прерванной. Затем выполните отдельно: ROLLBACK;"],
  ];
  Sim.register('sql-playground', (root) => {
    const engine = new MiniSQL.Engine();
    engine.reset(window.SHOP_SQL);
    const sh = UI.shell(root, {
      title: 'SQL Playground: учебная база магазина', icon: 'database', kicker: 'Тренажёр', layout: 'side-left',
      help: 'Пишите запросы и нажимайте «Выполнить» (или Ctrl+Enter). Можно выполнить несколько команд через «;» — выполнение останавливается на первой ошибке, как в psql с ON_ERROR_STOP. Изменения сохраняются до кнопки «Сбросить».',
      onReset: () => { engine.reset(window.SHOP_SQL); txState(); out.innerHTML = ''; schema(); sh.say('Учебная база восстановлена.'); },
      note: 'Запросы выполняет учебный движок MiniSQL в браузере. Поддерживаются SELECT, JOIN, GROUP BY/HAVING, подзапросы, CTE, UNION, INSERT/UPDATE/DELETE с RETURNING, транзакции и ограничения; результаты сверены с PostgreSQL 16. Не поддерживаются оконные функции, ALTER/DROP, индексы и типы, кроме простых.',
    });
    const side = sh.col(), main = sh.col();
    const schemaCard = UI.card(side, { title: 'Схема', sub: 'нажмите на таблицу, чтобы вставить запрос' });
    const exCard = UI.card(side, { title: 'Примеры' });
    const exSel = UI.select(exCard.body, { label: 'Выберите пример', value: 0, options: SQL_EXAMPLES.map((x, i) => ({ value: i, label: x[0] })), onChange: (v) => { ta.value = SQL_EXAMPLES[+v][1]; } });
    const ta = el('textarea', { class: 'inp mono sql-editor', rows: 9, spellcheck: 'false', 'aria-label': 'SQL-запрос' });
    ta.value = SQL_EXAMPLES[0][1];
    main.appendChild(ta);
    const bar = el('div', { class: 'btn-row' });
    main.appendChild(bar);
    UI.button(bar, { label: 'Выполнить', icon: 'play', primary: true, onClick: () => run() });
    const txBadge = el('span', { class: 'badge', style: 'align-self:center' });
    bar.appendChild(txBadge);
    const out = el('div', { class: 'sql-out', 'aria-live': 'polite' });
    main.appendChild(out);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
    function schema() {
      U.clear(schemaCard.body);
      Object.values(engine.tables).forEach((t) => {
        const b = el('button', { type: 'button', class: 'sql-table' }, [el('b', { text: t.name }), el('span', { class: 'muted-t', text: ` · ${t.rows.length} строк` })]);
        b.addEventListener('click', () => { ta.value = `SELECT *\nFROM ${t.name}\nLIMIT 20;`; ta.focus(); });
        schemaCard.body.appendChild(b);
        schemaCard.body.appendChild(el('div', { class: 'sql-cols' }, t.cols.map((c) => el('span', { class: 'sql-col' + (t.pk.includes(c.name) ? ' pk' : '') + (t.fks.some((f) => f.col === c.name) ? ' fk' : ''), title: c.type + (c.notNull ? ' NOT NULL' : ''), text: c.name }))));
      });
    }
    function txState() {
      txBadge.textContent = engine.tx ? (engine.aborted ? 'транзакция прервана — нужен ROLLBACK' : 'открыта транзакция') : 'автофиксация';
      txBadge.className = 'badge ' + (engine.tx ? (engine.aborted ? 'bad' : 'warn') : '');
    }
    function run() {
      const t0 = performance.now();
      let res;
      try { res = engine.exec(ta.value); } catch (e) { res = [{ kind: 'error', error: 'Внутренняя ошибка учебного движка: ' + e.message }]; }
      const ms = performance.now() - t0;
      U.clear(out);
      if (!res.length) out.appendChild(el('p', { class: 'muted-t', text: 'Нет команд для выполнения.' }));
      res.forEach((r) => {
        const box = el('div', { class: 'sql-res' });
        if (r.sql && res.length > 1) box.appendChild(el('div', { class: 'card-sub mono', text: r.sql.length > 90 ? r.sql.slice(0, 90) + '…' : r.sql }));
        if (r.kind === 'error') box.appendChild(el('pre', { class: 'out-box sql-err', text: r.error }));
        else if (r.kind === 'rows') {
          UI.table(box, r.columns.map(U.esc), r.rows.map((row) => row.map((v) => (v === null ? '<span class="null">NULL</span>' : U.esc(MiniSQL.fmtVal(v))))));
          box.appendChild(el('div', { class: 'muted-t sql-meta', text: `${r.rows.length} ${U.plural(r.rows.length, 'строка', 'строки', 'строк')}${r.tag ? ' · ' + r.tag : ''}` }));
        } else box.appendChild(el('div', { class: 'mono sql-tag', text: r.msg ? r.msg + '\n' + r.tag : r.tag }));
        out.appendChild(box);
      });
      txState(); schema();
      const errR = res.find((r) => r.kind === 'error');
      const sel = res.filter((r) => r.kind === 'rows');
      sh.say(errR ? `<p>Команда завершилась ошибкой, как в PostgreSQL. ${/foreign key|duplicate key|check constraint|not-null/.test(errR.error) ? 'Это ограничение целостности: база не дала сохранить некорректные данные — в API такой случай должен превращаться в 409 или 422, а не в 500.' : /aborted/.test(errR.error) ? 'После ошибки внутри транзакции PostgreSQL игнорирует команды до ROLLBACK.' : 'Проверьте имя столбца или таблицы в схеме слева.'}</p>`
        : `<p>Выполнено команд: ${res.length}${sel.length ? `, строк в последнем результате: ${sel[sel.length - 1].rows.length}` : ''} (${U.fmt(ms, 1)} мс в браузере).</p>`);
    }
    schema(); txState(); run();
  });

  /* ---------- Git workflow ---------- */
  const GIT_STEPS = [
    { cmd: 'git switch main && git pull', note: 'Начинаем со свежего main: в нём коммиты коллег M1–M2.', graph: { main: ['M1', 'M2'] }, head: 'main' },
    { cmd: 'git switch -c feature/QA-142-cart-tests', note: 'Новая ветка указывает на тот же коммит, что и main. HEAD теперь на ветке задачи.', graph: { main: ['M1', 'M2'], feature: [] }, head: 'feature' },
    { cmd: 'git add tests/cart.spec.ts && git commit -m "test(cart): пересчёт суммы"', note: 'Первый коммит в ветке F1: только ваша ветка сдвинулась вперёд.', graph: { main: ['M1', 'M2'], feature: ['F1'] }, head: 'feature' },
    { cmd: 'git commit -am "test(cart): удаление позиции"', note: 'Второй коммит F2. Тем временем коллега влил в main коммит M3, где переименован data-testid.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1', 'F2'] }, head: 'feature' },
    { cmd: 'git fetch origin && git rebase origin/main', note: 'Rebase переносит F1 и F2 поверх M3. На F2 возникает конфликт: вы использовали cart-total, а в main его переименовали в order-total.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1′'] }, head: 'feature', conflict: true },
    { cmd: '# правим файл, убираем маркеры\ngit add tests/cart.spec.ts && git rebase --continue', note: 'Конфликт разрешён осмысленно: тест использует новый order-total. Коммиты пересозданы как F1′ и F2′ — у них новые хеши.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1′', 'F2′'] }, head: 'feature' },
    { cmd: 'npx playwright test tests/cart.spec.ts --repeat-each=5', note: 'Перед публикацией — прогон затронутых тестов с повтором: разрешённый конфликт легко оставляет нерабочий код.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1′', 'F2′'] }, head: 'feature', ok: true },
    { cmd: 'git push -u origin feature/QA-142-cart-tests\n# создать Merge Request', note: 'Ветка опубликована, создан Merge Request. Pipeline запускает линтер, проверку типов и тесты; коллега проводит ревью.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1′', 'F2′'] }, head: 'feature', mr: true },
    { cmd: '# MR одобрен, pipeline зелёный → Merge', note: 'Слияние в main. Благодаря rebase история линейная: M1 → M2 → M3 → F1′ → F2′.', graph: { main: ['M1', 'M2', 'M3', 'F1′', 'F2′'] }, head: 'main', merged: true },
  ];
  const GIT_STEPS_MERGE = GIT_STEPS.slice(0, 4).concat([
    { cmd: 'git fetch origin && git merge origin/main', note: 'Merge объединяет истории коммитом слияния. Конфликт тот же: cart-total против order-total.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1', 'F2'] }, head: 'feature', conflict: true },
    { cmd: '# правим файл, убираем маркеры\ngit add tests/cart.spec.ts && git commit', note: 'Создан коммит слияния X с двумя родителями (F2 и M3). Старые коммиты F1, F2 не изменились.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1', 'F2', 'X'] }, head: 'feature', mergeCommit: true },
    { cmd: 'npx playwright test tests/cart.spec.ts --repeat-each=5', note: 'Прогон затронутых тестов перед публикацией.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1', 'F2', 'X'] }, head: 'feature', ok: true, mergeCommit: true },
    { cmd: 'git push -u origin feature/QA-142-cart-tests\n# создать Merge Request → Merge', note: 'После слияния указатель main перемещается на коммит X (fast-forward), а история остаётся ветвистой: видно, что работа шла параллельно. Это нормально; выбор между merge и rebase — договорённость команды.', graph: { main: ['M1', 'M2', 'M3'], feature: ['F1', 'F2', 'X'] }, head: 'mainAtFeature', merged: true, mergeCommit: true },
  ]);
  Sim.register('git-flow', (root) => {
    let mode = 'rebase', k = 0;
    const steps = () => (mode === 'rebase' ? GIT_STEPS : GIT_STEPS_MERGE);
    const sh = UI.shell(root, {
      title: 'Изменение тестов через ветку и Merge Request', icon: 'branch', kicker: 'Пошагово', layout: 'one',
      help: 'Проходите по шагам типичного рабочего процесса. Выберите стратегию обновления ветки — rebase или merge — и сравните итоговый граф.',
      onReset: () => { k = 0; runner.pause(); draw(); },
    });
    const runner = new Runner({ interval: 2200, back: () => { if (k > 0) { k--; draw(); } }, tick: () => { if (k < steps().length - 1) { k++; draw(); return true; } return false; } }).attach(sh.toolbar);
    const col = sh.col();
    UI.seg(col, { label: 'Как обновить ветку от main', value: 'rebase', options: [{ value: 'rebase', label: 'rebase' }, { value: 'merge', label: 'merge' }], onChange: (v) => { mode = v; k = Math.min(k, steps().length - 1); draw(); } });
    const cmd = el('pre', { class: 'out-box git-cmd' });
    const svgWrap = el('div', { class: 'git-graph' });
    const conflict = el('pre', { class: 'out-box git-conflict' });
    const prog = el('div', { class: 'el-progress' });
    col.append(cmd, svgWrap, conflict, prog);
    function draw() {
      const st = steps()[k];
      cmd.innerHTML = '<span class="muted-t">$ </span>' + U.esc(st.cmd);
      const svg = U.svg('svg', { viewBox: '0 0 640 150', role: 'img', 'aria-label': 'Граф коммитов' });
      const X = (i) => 40 + i * 92;
      const mainY = 50, featY = 115;
      const main = st.graph.main, feat = st.graph.feature;
      // линия main
      svg.appendChild(U.svg('text', { x: 4, y: mainY - 18, class: 'p-muted', text: 'main' }));
      main.forEach((c, i) => {
        if (i) svg.appendChild(U.svg('line', { x1: X(i - 1), y1: mainY, x2: X(i), y2: mainY, stroke: 'var(--blue)', 'stroke-width': 3 }));
      });
      // ветка
      if (feat) {
        const base = mode === 'rebase' && /′/.test(feat.join('')) ? main.length - 1 : 1;
        svg.appendChild(U.svg('text', { x: 4, y: featY + 30, class: 'p-muted', text: 'feature' }));
        let px = X(base), py = mainY;
        feat.forEach((c, i) => {
          const x = X(base + 1 + i);
          svg.appendChild(U.svg('path', { d: `M${px},${py} C${px + 40},${py} ${x - 40},${featY} ${x},${featY}`.replace(/C.*/, i === 0 ? `C${px + 40},${py} ${x - 40},${featY} ${x},${featY}` : `L${x},${featY}`), stroke: 'var(--accent)', 'stroke-width': 3, fill: 'none' }));
          px = x; py = featY;
          if (c === 'X') svg.appendChild(U.svg('path', { d: `M${X(main.length - 1)},${mainY} C${X(main.length - 1) + 40},${mainY} ${x - 40},${featY} ${x},${featY}`, stroke: 'var(--blue)', 'stroke-width': 2, 'stroke-dasharray': '5 4', fill: 'none' }));
        });
        feat.forEach((c, i) => { const x = X(base + 1 + i); svg.appendChild(U.svg('circle', { cx: x, cy: featY, r: 14, fill: c === 'X' ? 'var(--violet)' : 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 3 })); svg.appendChild(U.svg('text', { x, y: featY + 4, 'text-anchor': 'middle', class: 'git-c', text: c })); });
        if (st.head === 'mainAtFeature') { const x = X(base + feat.length); svg.appendChild(U.svg('text', { x: x + 20, y: featY + 4, class: 'p-strong', text: 'main, HEAD' })); }
        if (st.head === 'feature' && feat.length) { const x = X(base + feat.length); svg.appendChild(U.svg('text', { x: x + 20, y: featY + 4, class: 'p-strong', text: 'HEAD' })); }
        if (st.head === 'feature' && !feat.length) svg.appendChild(U.svg('text', { x: X(base) + 20, y: featY - 20, class: 'p-strong', text: 'HEAD (feature)' }));
      }
      main.forEach((c, i) => { svg.appendChild(U.svg('circle', { cx: X(i), cy: mainY, r: 14, fill: /F/.test(c) ? 'var(--accent)' : 'var(--blue)', stroke: 'var(--surface)', 'stroke-width': 3 })); svg.appendChild(U.svg('text', { x: X(i), y: mainY + 4, 'text-anchor': 'middle', class: 'git-c', text: c })); });
      if (st.head === 'main') svg.appendChild(U.svg('text', { x: X(main.length - 1) + 20, y: mainY - 18, class: 'p-strong', text: 'HEAD' }));
      U.clear(svgWrap); svgWrap.appendChild(svg);
      conflict.hidden = !st.conflict;
      if (st.conflict) conflict.innerHTML = U.hl("  test('итог корзины', async ({ page }) => {\n<<<<<<< HEAD\n    await expect(page.getByTestId('order-total')).toHaveText('9 980 ₽');\n=======\n    await expect(page.getByTestId('cart-total')).toHaveText('9 980 ₽');\n>>>>>>> F2 (test(cart): удаление позиции)\n  });", 'ts');
      prog.textContent = `Шаг ${k + 1} из ${steps().length}`;
      runner.backBtn.disabled = k === 0; runner.stepBtn.disabled = k >= steps().length - 1;
      sh.say(`<p>${st.note}</p>`);
    }
    draw();
  });
})();

;
