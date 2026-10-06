/* ===== sims/08-arch.js ===== */
/* ===== Раздел VI: Test Architecture Explorer, конфигурация, Test Execution Visualizer, разбор trace ===== */
(function () {
  'use strict';
  const { el } = U;

  /* ---------- Test Architecture Explorer ---------- */
  // layer: tests | fixtures | domain | base | root
  const F = [
    ['playwright.config.ts', 'root', 'Проекты (setup, api, ui), репортеры, use: baseURL и trace, webServer. Точка входа раннера.', ['src/config/env.ts'], "export default defineConfig({\n  testDir: './tests',\n  use: { baseURL: config.baseURL, trace: 'on-first-retry' },\n  projects: [\n    { name: 'setup', testMatch: /setup\\/.*\\.setup\\.ts/ },\n    { name: 'api', testDir: './tests/api', use: { baseURL: config.apiURL } },\n    { name: 'ui', testDir: './tests/ui', dependencies: ['setup'] },\n  ],\n});", 'Добавился проект, браузер, репортер; изменились таймауты или политика trace.'],
    ['package.json', 'root', 'Зависимости с зафиксированными версиями и скрипты запуска: test, test:api, test:ui, lint, typecheck.', [], '"scripts": {\n  "test": "playwright test",\n  "test:api": "playwright test --project=api",\n  "typecheck": "tsc --noEmit",\n  "lint": "eslint ."\n}', 'Обновление Playwright (вместе с образом Docker в CI) или новые скрипты.'],
    ['tsconfig.json', 'root', 'Строгий режим TypeScript и алиасы путей @src/*.', [], '{ "compilerOptions": { "strict": true, "paths": { "@src/*": ["src/*"] } } }', 'Редко: смена target, новые алиасы.'],
    ['.env.example', 'root', 'Список переменных окружения без секретных значений. Документация конфигурации.', [], 'TEST_ENV=local\nBASE_URL=http://localhost:3000\nAPI_URL=http://localhost:8080\nADMIN_PASSWORD=', 'Появилась новая переменная — сразу с описанием.'],
    ['.gitlab-ci.yml', 'root', 'Pipeline: проверки, тестовые задачи, шарды, артефакты, отчёты.', ['package.json', 'playwright.config.ts'], 'e2e-tests:\n  parallel: 4\n  script:\n    - npx playwright test --project=ui --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL', 'Изменились стадии, правила запуска, число шардов.'],
    ['src/config/env.ts', 'base', 'Единственное место, где читается process.env. Валидирует переменные и падает с понятной ошибкой, если секрет не задан.', [], "export const config = {\n  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',\n  apiURL: process.env.API_URL ?? 'http://localhost:8080',\n  admin: { get password() { return required('ADMIN_PASSWORD'); } },\n} as const;", 'Новое окружение или переменная.'],
    ['src/utils/money.ts', 'base', 'Чистые функции без зависимостей: форматирование и разбор сумм «9 980 ₽».', [], "export const formatRub = (n: number) =>\n  new Intl.NumberFormat('ru-RU').format(n).replace(/\\s/g, ' ') + ' ₽';", 'Меняется формат денег в интерфейсе.'],
    ['src/utils/random.ts', 'base', 'Генераторы уникальных значений с меткой прогона и воспроизводимым seed.', [], "export const uniqueEmail = (tag: string) =>\n  `autotest-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;", 'Почти никогда.'],
    ['src/api/ApiClient.ts', 'domain', 'Базовый клиент: APIRequestContext, авторизация, логирование запросов, понятные ошибки при неожиданном статусе.', ['src/config/env.ts'], 'export class ApiClient {\n  constructor(protected request: APIRequestContext) {}\n  protected async json<T>(res: APIResponse, expected = 200): Promise<T> { … }\n}', 'Меняется схема авторизации или формат ошибок API.'],
    ['src/api/OrdersApi.ts', 'domain', 'Клиент ресурса «Заказы»: create, get, cancel, remove. Тесты вызывают методы, а не собирают URL вручную.', ['src/api/ApiClient.ts', 'src/schemas/order.schema.json'], "export class OrdersApi extends ApiClient {\n  create(data: NewOrder) { return this.post<Order>('/api/orders', data, 201); }\n  remove(id: number) { return this.delete(`/api/orders/${id}`, 204); }\n}", 'Изменился контракт эндпоинтов заказов.'],
    ['src/api/UsersApi.ts', 'domain', 'Клиент ресурса «Пользователи» для подготовки данных.', ['src/api/ApiClient.ts'], "export class UsersApi extends ApiClient {\n  create(u: NewUser) { return this.post<User>('/api/users', u, 201); }\n}", 'Изменился контракт пользователей.'],
    ['src/schemas/order.schema.json', 'domain', 'JSON Schema заказа, сгенерированная из OpenAPI. Используется в API-тестах и клиенте.', [], '{ "type": "object", "required": ["id", "status", "items", "total"], … }', 'Обновилась спецификация API.'],
    ['src/components/Header.ts', 'domain', 'Компонент шапки: поиск, ссылка на корзину, меню пользователя. Используется всеми страницами.', [], "export class Header {\n  constructor(private root: Locator) {}\n  cartLink() { return this.root.getByRole('link', { name: /Корзина/ }); }\n}", 'Редизайн шапки — правка в одном месте.'],
    ['src/components/ProductCard.ts', 'domain', 'Компонент карточки товара: название, цена, кнопка «В корзину».', ['src/utils/money.ts'], "export class ProductCard {\n  constructor(private root: Locator) {}\n  addToCart() { return this.root.getByRole('button', { name: 'В корзину' }).click(); }\n}", 'Меняется карточка товара.'],
    ['src/pages/CatalogPage.ts', 'domain', 'Страница каталога: открыть, искать, получить карточку товара по названию.', ['src/components/Header.ts', 'src/components/ProductCard.ts'], "export class CatalogPage {\n  readonly header = new Header(this.page.getByRole('banner'));\n  card(title: string) { return new ProductCard(this.page.getByTestId('product-card').filter({ hasText: title })); }\n}", 'Меняется страница каталога.'],
    ['src/pages/CartPage.ts', 'domain', 'Страница корзины: позиции, промокод, итог.', ['src/components/Header.ts', 'src/utils/money.ts'], "export class CartPage {\n  readonly total = this.page.getByTestId('cart-total');\n  async applyPromo(code: string) { … }\n}", 'Меняется корзина.'],
    ['src/data/factories.ts', 'domain', 'Фабрики тестовых данных: makeUser, makeOrder — корректные значения по умолчанию с уникальной меткой и переопределением полей.', ['src/utils/random.ts'], "export const makeUser = (o: Partial<NewUser> = {}): NewUser => ({\n  email: uniqueEmail('user'), name: 'QA Тест', ...o,\n});", 'Появились новые обязательные поля сущностей.'],
    ['src/data/shipping-cases.json', 'domain', 'Таблица случаев для data-driven теста стоимости доставки.', [], '[{ "sum": 2999, "member": false, "express": false, "cost": 300 }, …]', 'Меняются правила доставки.'],
    ['src/fixtures/api.fixtures.ts', 'fixtures', 'Фикстуры клиентов и сущностей: user, order — создаются через API и удаляются в teardown.', ['src/api/OrdersApi.ts', 'src/api/UsersApi.ts', 'src/data/factories.ts'], "export const test = base.extend<ApiFixtures>({\n  user: async ({ usersApi }, use) => {\n    const user = await usersApi.create(makeUser());\n    await use(user);\n    await usersApi.remove(user.id);\n  },\n});", 'Новый вид тестовых сущностей.'],
    ['src/fixtures/pages.fixtures.ts', 'fixtures', 'Фикстуры Page Objects: catalogPage, cartPage.', ['src/pages/CatalogPage.ts', 'src/pages/CartPage.ts'], 'export const test = base.extend<Pages>({\n  cartPage: async ({ page }, use) => { await use(new CartPage(page)); },\n});', 'Новая страница.'],
    ['src/fixtures/index.ts', 'fixtures', 'mergeTests объединяет фикстуры в один test, который импортируют все спецификации.', ['src/fixtures/api.fixtures.ts', 'src/fixtures/pages.fixtures.ts'], "export const test = mergeTests(apiTest, pagesTest);\nexport { expect } from '@playwright/test';", 'Подключается новый набор фикстур.'],
    ['tests/setup/auth.setup.ts', 'tests', 'Setup-проект: входит под тестовыми ролями через API и сохраняет storageState.', ['src/config/env.ts', 'src/api/ApiClient.ts'], "setup('вход покупателя', async ({ request }) => {\n  …\n  await request.storageState({ path: 'playwright/.auth/customer.json' });\n});", 'Меняется способ аутентификации.'],
    ['tests/api/orders/create.spec.ts', 'tests', 'API-тесты создания заказа: позитивные, валидация, права, схема.', ['src/fixtures/index.ts', 'src/schemas/order.schema.json'], "test('201 и заказ доступен по Location', async ({ ordersApi, user }) => { … });", 'Меняются требования к заказам.'],
    ['tests/ui/cart/promo.spec.ts', 'tests', 'UI-тесты корзины: промокоды и пересчёт суммы.', ['src/fixtures/index.ts'], "test('SALE10 уменьшает сумму на 10%', async ({ cartPage, productInCart }) => { … });", 'Меняются требования к корзине.'],
    ['tests/e2e/checkout.spec.ts', 'tests', 'Немногочисленные сквозные сценарии: от каталога до оплаченного заказа.', ['src/fixtures/index.ts'], "test('покупка от каталога до оплаты', async ({ catalogPage, cartPage, ordersApi }) => { … });", 'Меняется ключевой пользовательский путь.'],
  ];
  const LAYERS = { root: ['Корень', 'var(--text-muted)'], base: ['config / utils', 'var(--violet)'], domain: ['api / pages / components / data / schemas', 'var(--blue)'], fixtures: ['fixtures', 'var(--accent)'], tests: ['tests', 'var(--good)'] };
  Sim.register('architecture-explorer', (root) => {
    let sel = 'src/pages/CartPage.ts';
    const byPath = new Map(F.map((f) => [f[0], f]));
    const usedBy = (p) => F.filter((f) => f[3].includes(p)).map((f) => f[0]);
    const impact = (p) => { const seen = new Set(); const q = [p]; while (q.length) { const c = q.shift(); usedBy(c).forEach((u) => { if (!seen.has(u)) { seen.add(u); q.push(u); } }); } return seen; };
    const sh = UI.shell(root, {
      title: 'Test Architecture Explorer', icon: 'folder', kicker: 'Схема', layout: 'two',
      help: 'Выберите файл учебного проекта. Справа — назначение, пример содержимого, зависимости и те, кто зависит от файла. Подсвеченные в дереве файлы затронет изменение выбранного.',
      onReset: () => { sel = 'src/pages/CartPage.ts'; draw(); },
      note: 'Дерево соответствует структуре из этой главы; содержимое файлов показано фрагментами.',
    });
    const left = sh.col(), right = sh.col();
    const tree = el('div', { class: 'ae-tree', role: 'tree', 'aria-label': 'Файлы проекта' });
    left.appendChild(tree);
    left.appendChild(UI.legend(Object.values(LAYERS).map(([l, c]) => ({ color: c, label: l }))));
    const info = el('div', { class: 'ae-info' });
    right.appendChild(info);
    function draw() {
      U.clear(tree);
      const imp = impact(sel), deps = new Set(byPath.get(sel)[3]);
      let lastDir = null;
      F.forEach((f) => {
        const parts = f[0].split('/');
        const dir = parts.slice(0, -1).join('/');
        if (dir !== lastDir) { if (dir) tree.appendChild(el('div', { class: 'ae-dir', style: `padding-left:${(parts.length - 2) * 14}px`, text: dir.split('/').pop() + '/' })); lastDir = dir; }
        const b = el('button', { type: 'button', role: 'treeitem', class: 'ae-file' + (f[0] === sel ? ' is-sel' : '') + (imp.has(f[0]) ? ' is-imp' : '') + (deps.has(f[0]) ? ' is-dep' : ''), style: `padding-left:${(parts.length - 1) * 14 + 8}px; --lc:${LAYERS[f[1]][1]}`, 'aria-selected': String(f[0] === sel) }, [el('i', { class: 'ae-dot' }), el('span', { text: parts[parts.length - 1] })]);
        b.addEventListener('click', () => { sel = f[0]; draw(); });
        tree.appendChild(b);
      });
      const f = byPath.get(sel);
      U.clear(info);
      info.append(el('h4', { class: 'mono', text: f[0] }), el('span', { class: 'badge', style: `color:${LAYERS[f[1]][1]}`, text: 'слой: ' + LAYERS[f[1]][0] }), el('p', { text: f[2] }));
      info.append(el('div', { class: 'card-sub', text: 'Фрагмент' }), el('pre', { class: 'out-box', html: U.hl(f[4], /\.json$/.test(f[0]) ? 'json' : /\.yml$/.test(f[0]) ? 'yaml' : 'ts') }));
      const lst = (title, arr) => { info.appendChild(el('div', { class: 'card-sub', text: title })); const row = el('div', { class: 'btn-row' }); if (!arr.length) row.appendChild(el('span', { class: 'muted-t', text: '—' })); arr.forEach((p) => UI.button(row, { label: p.split('/').pop(), cls: 'ae-link', title: p, onClick: () => { sel = p; draw(); } })); info.appendChild(row); };
      lst('Зависит от', f[3]);
      lst('Используется в', usedBy(sel));
      info.append(el('div', { class: 'card-sub', text: 'Когда меняется' }), el('p', { class: 'muted-t', text: f[5] }));
      const n = imp.size;
      sh.say(`<p>Изменение <code>${f[0].split('/').pop()}</code> ${n ? `затрагивает ${n} ${U.plural(n, 'файл', 'файла', 'файлов')} выше по зависимостям (подсвечены).` : 'не затрагивает других файлов проекта.'} Зависимости направлены «вниз»: tests → fixtures → api / pages / components / data → config / utils, поэтому изменение нижнего слоя видно сразу всем верхним, а тесты не зависят друг от друга.</p>`);
    }
    draw();
  });

  /* ---------- Источники конфигурации ---------- */
  Sim.register('config-resolver', (root) => {
    const D = { dotenv: true, ci: false, cli: false, masked: true, log: false };
    const s = Object.assign({}, D);
    const sh = UI.shell(root, {
      title: 'Откуда берётся значение конфигурации', icon: 'key', kicker: 'Модель', layout: 'side-left',
      help: 'Конфигурация читается в <code>src/config/env.ts</code> и <code>playwright.config.ts</code>. Включайте источники значений и смотрите итог.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Приоритеты: флаг командной строки Playwright → переменная окружения процесса (CI, shell) → файл .env (dotenv не перезаписывает существующие переменные) → значение по умолчанию в коде.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const out = el('div');
    main.appendChild(out);
    function build() {
      U.clear(box);
      UI.toggle(box, { label: 'Файл .env существует (локальная машина)', value: s.dotenv, onChange: (v) => { s.dotenv = v; update(); } });
      UI.toggle(box, { label: 'Переменные окружения CI заданы', value: s.ci, onChange: (v) => { s.ci = v; update(); } });
      UI.toggle(box, { label: 'Флаги CLI: --workers=2 --retries=0', value: s.cli, onChange: (v) => { s.cli = v; update(); } });
      UI.toggle(box, { label: 'ADMIN_PASSWORD помечена в CI как masked', value: s.masked, onChange: (v) => { s.masked = v; update(); } });
      UI.toggle(box, { label: 'Тест печатает config в лог', value: s.log, onChange: (v) => { s.log = v; update(); } });
      update();
    }
    function resolve() {
      const env = {}, srcOf = {};
      if (s.ci) Object.assign(env, { CI: 'true', TEST_ENV: 'ci', BASE_URL: 'https://staging.shop.example.com', ADMIN_PASSWORD: 'Xq7!pR2v' });
      Object.keys(env).forEach((k) => { srcOf[k] = 'переменная CI'; });
      if (s.dotenv) Object.entries({ TEST_ENV: 'local', BASE_URL: 'http://localhost:5173', ADMIN_PASSWORD: 'local-admin-1' }).forEach(([k, v]) => { if (env[k] === undefined) { env[k] = v; srcOf[k] = '.env'; } });
      const rows = [];
      const pick = (key, label, def, secret) => {
        if (env[key] !== undefined) rows.push({ k: label, v: env[key], src: srcOf[key], secret });
        else if (def !== undefined) rows.push({ k: label, v: def, src: 'по умолчанию в коде', secret });
        else rows.push({ k: label, v: null, src: '—', secret, err: `Не задана переменная окружения ${key} (см. .env.example)` });
      };
      pick('TEST_ENV', 'TEST_ENV', 'local');
      pick('BASE_URL', 'baseURL', 'http://localhost:3000');
      pick('ADMIN_PASSWORD', 'admin.password', undefined, true);
      const isCI = !!env.CI;
      rows.push(s.cli ? { k: 'workers', v: '2', src: 'флаг --workers' } : { k: 'workers', v: isCI ? '4' : 'половина ядер', src: isCI ? 'конфиг: process.env.CI ? 4' : 'конфиг: undefined → по умолчанию' });
      rows.push(s.cli ? { k: 'retries', v: '0', src: 'флаг --retries' } : { k: 'retries', v: isCI ? '2' : '0', src: isCI ? 'конфиг: process.env.CI ? 2 : 0' : 'конфиг: process.env.CI ? 2 : 0' });
      return { rows, env, isCI };
    }
    function update() {
      const { rows, isCI } = resolve();
      U.clear(out);
      UI.table(out, ['Параметр', 'Значение', 'Источник'], rows.map((r) => [r.k, r.err ? '<span class="bad-t">ошибка</span>' : U.esc(r.secret ? '•'.repeat(8) : r.v), U.esc(r.src)]));
      const err = rows.find((r) => r.err);
      const pw = rows.find((r) => r.k === 'admin.password');
      const log = [];
      log.push(`$ npx playwright test${s.cli ? ' --workers=2 --retries=0' : ''}`);
      if (err) log.push(`Error: ${err.err}\n    at required (src/config/env.ts:4:21)\n    at get password (src/config/env.ts:19:36)`);
      else if (s.log) log.push(`[config] ${JSON.stringify({ env: rows[0].v, baseURL: rows[1].v, admin: { email: 'admin@example.com', password: isCI && s.masked ? '[MASKED]' : pw.v } })}`);
      if (!err) log.push(`Running 48 tests using ${rows[3].v === 'половина ядер' ? '4' : rows[3].v} workers`);
      out.appendChild(el('div', { class: 'card-sub', text: isCI ? 'Лог задачи CI' : 'Терминал' }));
      out.appendChild(el('pre', { class: 'out-box' + (err ? ' sql-err' : ''), text: log.join('\n') }));
      const msgs = [];
      if (err) msgs.push('Секрет не задан ни в окружении, ни в .env, и у него нет значения по умолчанию — тесты падают сразу с понятной ошибкой. Это правильно: хуже, если тест молча возьмёт пустой пароль и упадёт через 30 секунд на странице входа.');
      if (s.ci && s.dotenv) msgs.push('В CI и .env заданы одни и те же переменные: побеждает окружение процесса — dotenv не перезаписывает уже существующие значения.');
      if (s.log && !err) msgs.push(isCI && s.masked ? 'GitLab заменил значение masked-переменной на [MASKED] в логе задачи. Но маскирование работает только для лога: в trace, скриншоте или HTML-отчёте значение, введённое через fill, сохранится как есть.' : 'Пароль попал в лог открытым текстом. Не печатайте конфигурацию с секретами; в CI помечайте секреты masked/protected и проверяйте, что они не попадают в артефакты.');
      if (s.cli) msgs.push('Флаги командной строки переопределяют значения из конфига — удобно для локального прогона без правки файлов.');
      if (!msgs.length) msgs.push(`Сейчас значения берутся из ${s.dotenv ? 'файла .env и значений по умолчанию' : 'значений по умолчанию'}. Включите переменные CI, чтобы увидеть приоритеты.`);
      sh.say(msgs.map((m) => `<p>${m}</p>`).join(''));
    }
    build();
  });

  /* ---------- Test Execution Visualizer ---------- */
  const TESTS = [
    // файл, тест, длительность (с), общий ресурс
    ['auth.spec', 'вход по паролю', 4, null], ['auth.spec', 'неверный пароль', 3, null], ['auth.spec', 'сброс пароля', 6, null],
    ['cart.spec', 'добавить товар', 5, null], ['cart.spec', 'промокод SALE10', 4, 'promo'], ['cart.spec', 'удалить позицию', 3, null],
    ['checkout.spec', 'оплата картой', 9, null], ['checkout.spec', 'оплата с промокодом', 8, 'promo'], ['checkout.spec', 'доставка курьером', 7, null],
    ['admin.spec', 'включить фича-флаг', 4, 'flag'], ['admin.spec', 'отчёт по заказам', 6, null], ['admin.spec', 'проверка флага в каталоге', 5, 'flag'],
  ];
  const RES = { promo: ['лимит промокода SALE10', 'var(--pink)'], flag: ['глобальный фича-флаг', 'var(--violet)'] };
  Sim.register('execution-visualizer', (root) => {
    const D = { mode: 'files', workers: 3, isolate: false };
    const s = Object.assign({}, D);
    const sh = UI.shell(root, {
      title: 'Test Execution Visualizer', icon: 'cpu', kicker: 'Визуализация', layout: 'one',
      help: '12 тестов в 4 файлах. Выберите режим распределения и число воркеров. Тесты с общим ресурсом отмечены цветом: если они идут одновременно, возможен конфликт.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Длительности условные. Свободный воркер берёт следующий файл (режим по умолчанию) или следующий тест (fullyParallel) в порядке объявления.',
    });
    const col = sh.col();
    const box = el('div', { class: 'ev-ctl' });
    col.appendChild(box);
    const chart = el('div', { class: 'ev-chart' });
    col.appendChild(chart);
    const roBox = el('div');
    col.appendChild(roBox);
    function build() {
      U.clear(box);
      UI.seg(box, { label: 'Режим', value: s.mode, options: [{ value: 'serial', label: 'workers: 1' }, { value: 'files', label: 'По файлам (по умолчанию)' }, { value: 'full', label: 'fullyParallel' }], onChange: (v) => { s.mode = v; build(); } });
      if (s.mode !== 'serial') UI.slider(box, { label: 'Воркеров', min: 1, max: 6, value: s.workers, onInput: (v) => { s.workers = v; update(); } });
      UI.toggle(box, { label: 'Тесты с общим ресурсом — в отдельном проекте с workers: 1', value: s.isolate, onChange: (v) => { s.isolate = v; update(); } });
      update();
    }
    function schedule() {
      const W = s.mode === 'serial' ? 1 : s.workers;
      const free = Array(W).fill(0);
      const out = [];
      const units = s.mode === 'full' ? TESTS.map((t, i) => [i]) : [...new Set(TESTS.map((t) => t[0]))].map((f) => TESTS.map((t, i) => (t[0] === f ? i : -1)).filter((i) => i >= 0));
      // ресурсный проект: тесты с ресурсом выносятся и выполняются по одному
      let iso = [];
      let main = units;
      if (s.isolate) { iso = TESTS.map((t, i) => (t[3] ? i : -1)).filter((i) => i >= 0); main = units.map((u) => u.filter((i) => !TESTS[i][3])).filter((u) => u.length); }
      const queue = main.map((u) => ({ tests: u, iso: false })).concat(iso.map((i) => ({ tests: [i], iso: true })));
      let isoBusyUntil = 0;
      while (queue.length) {
        const w = free.indexOf(Math.min(...free));
        let qi = 0;
        if (queue[0].iso || queue.some((q) => q.iso)) {
          // проект с workers: 1 — следующий тест ресурса не стартует, пока идёт предыдущий
          qi = queue.findIndex((q) => !q.iso || isoBusyUntil <= free[w]);
          if (qi < 0) { free[w] = isoBusyUntil; continue; }
        }
        const u = queue.splice(qi, 1)[0];
        let t = free[w];
        u.tests.forEach((i) => { out.push({ i, w, s: t, e: t + TESTS[i][2] }); t += TESTS[i][2]; });
        if (u.iso) isoBusyUntil = t;
        free[w] = t;
      }
      return { out, W, total: Math.max(...out.map((x) => x.e)) };
    }
    function update() {
      const { out, W, total } = schedule();
      const conflicts = [];
      out.forEach((a, x) => out.forEach((b, y) => { if (y > x && TESTS[a.i][3] && TESTS[a.i][3] === TESTS[b.i][3] && a.s < b.e && b.s < a.e) conflicts.push([a, b]); }));
      const confSet = new Set(conflicts.flat());
      const Wd = 620, rowH = 30, l = 62, H = W * (rowH + 8) + 34;
      const sum = TESTS.reduce((a, t) => a + t[2], 0);
      const maxT = Math.max(sum, 10);
      const x = (t) => l + (t / maxT) * (Wd - l - 10);
      const svg = U.svg('svg', { viewBox: `0 0 ${Wd} ${H}`, role: 'img', 'aria-label': 'Распределение тестов по воркерам' });
      for (let w = 0; w < W; w++) svg.appendChild(U.svg('text', { x: 4, y: 10 + w * (rowH + 8) + rowH / 2 + 4, class: 'p-muted', text: `воркер ${w}` }));
      out.forEach((r) => {
        const y = 10 + r.w * (rowH + 8);
        const t = TESTS[r.i];
        const fill = t[3] ? RES[t[3]][1] : 'var(--surface-3)';
        const g = U.svg('g', {});
        g.appendChild(U.svg('rect', { x: x(r.s) + 1, y, width: Math.max(2, x(r.e) - x(r.s) - 2), height: rowH, rx: 5, fill, stroke: confSet.has(r) ? 'var(--bad)' : 'var(--border-2)', 'stroke-width': confSet.has(r) ? 3 : 1 }));
        if (x(r.e) - x(r.s) > 20) g.appendChild(U.svg('text', { x: (x(r.s) + x(r.e)) / 2, y: y + rowH / 2 + 4, 'text-anchor': 'middle', class: t[3] ? 'ev-t' : 'ev-t plain', text: 'T' + (r.i + 1) }));
        g.appendChild(U.svg('title', { text: `${t[0]} › ${t[1]} (${t[2]} с)` }));
        svg.appendChild(g);
      });
      const yA = H - 16;
      svg.appendChild(U.svg('line', { x1: l, x2: x(total), y1: yA, y2: yA, stroke: 'var(--accent)', 'stroke-width': 2 }));
      svg.appendChild(U.svg('text', { x: x(total) + 4, y: yA + 4, class: 'p-strong', text: `${total} с` }));
      U.clear(chart); chart.appendChild(svg);
      chart.appendChild(UI.legend([{ color: RES.promo[1], label: RES.promo[0] }, { color: RES.flag[1], label: RES.flag[0] }, { color: 'var(--bad)', label: 'одновременно с тестом того же ресурса' }]));
      chart.appendChild(el('div', { class: 'muted-t ev-key', text: 'auth.spec — T1–T3, cart.spec — T4–T6, checkout.spec — T7–T9, admin.spec — T10–T12. Наведите на блок, чтобы увидеть название теста.' }));
      U.clear(roBox);
      const ro = UI.readout(roBox, [{ key: 't', label: 'Время прогона' }, { key: 'sp', label: 'Ускорение' }, { key: 'u', label: 'Загрузка воркеров' }, { key: 'c', label: 'Пересечений ресурса' }]);
      ro.set('t', total + ' с');
      ro.set('sp', '×' + U.fmt(sum / total, 1));
      ro.set('u', U.pct(sum / (total * W)));
      ro.set('c', String(conflicts.length), conflicts.length ? 'bad-t' : 'ok-t');
      const lf = Math.max(...[...new Set(TESTS.map((t) => t[0]))].map((f) => TESTS.filter((t) => t[0] === f).reduce((a, t) => a + t[2], 0)));
      const msgs = [];
      if (s.mode === 'serial') msgs.push(`Последовательно: ${sum} с, конфликтов нет, но и параллельности нет.`);
      if (s.mode === 'files') msgs.push(`По файлам: тесты одного файла идут по порядку в одном воркере, поэтому время не может быть меньше самого длинного файла (${lf} с)${s.workers >= 4 ? ' — добавление воркеров дальше не помогает' : ''}.`);
      if (s.mode === 'full') msgs.push('fullyParallel распределяет отдельные тесты: загрузка выше, предел — самый долгий тест. Но тесты одного файла теперь идут одновременно и должны быть полностью независимыми.');
      if (conflicts.length) msgs.push(`${conflicts.length} ${U.plural(conflicts.length, 'пара', 'пары', 'пар')} тестов с общим ресурсом выполняются одновременно — если ресурс изменяемый (лимит промокода, глобальный флаг), падение зависит от случайного расписания: типичный flaky-тест.`);
      else if (s.isolate) msgs.push('Тесты с общим ресурсом вынесены в проект с workers: 1 — они не пересекаются, остальные идут параллельно. Лучше ещё — дать каждому тесту свой промокод и флаг на уровне пользователя.');
      sh.say(msgs.map((m) => `<p>${m}</p>`).join(''));
    }
    build();
  });

  /* ---------- Разбор trace ---------- */
  const TRACES = {
    promo: {
      title: 'tests/ui/cart/promo.spec.ts › SALE10 уменьшает сумму на 10%',
      error: "Error: expect(locator).toHaveText(expected) failed\n\nLocator:  getByTestId('cart-total')\nExpected: \"8 982 ₽\"\nReceived: \"9 980 ₽\"\nTimeout:  5000ms",
      actions: [
        { a: "page.goto('/cart')", ms: 412, snap: { total: '9 980 ₽' } },
        { a: "getByRole('button', { name: 'Есть промокод?' }).click()", ms: 64, snap: { total: '9 980 ₽', promo: '' } },
        { a: "getByLabel('Промокод').fill('SALE10')", ms: 31, snap: { total: '9 980 ₽', promo: 'SALE10' } },
        { a: "getByRole('button', { name: 'Применить' }).click()", ms: 58, snap: { total: '9 980 ₽', promo: 'SALE10', msg: 'Срок действия промокода истёк' }, net: true },
        { a: "expect(getByTestId('cart-total')).toHaveText('8 982 ₽')", ms: 5000, fail: true, snap: { total: '9 980 ₽', promo: 'SALE10', msg: 'Срок действия промокода истёк' } },
      ],
      network: ['GET  /cart                    200  html   88 ms', 'GET  /api/cart                200  json   41 ms', 'POST /api/cart/promo          422  json   37 ms   {"code":"PROMO_EXPIRED","message":"Срок действия промокода истёк"}'],
      console: ['[warning] Promo apply failed: PROMO_EXPIRED'],
      options: [
        ['locator', 'Локатор нашёл не тот элемент'],
        ['wait', 'Тест не дождался пересчёта суммы'],
        ['data', 'Промокод на стенде недействителен (тестовые данные)'],
        ['bug', 'Ошибка расчёта скидки во фронтенде'],
      ],
      answer: 'data',
      explain: {
        locator: 'Нет: в снимке DOM подсвечен именно элемент итога, и он содержит сумму. Локатор однозначен.',
        wait: 'Нет: expect повторял проверку 5 секунд, а сумма так и не изменилась. Ожидание здесь ни при чём.',
        data: 'Да. Во вкладке Network запрос POST /api/cart/promo вернул 422 PROMO_EXPIRED, а в снимке после клика видно сообщение «Срок действия промокода истёк». Тест полагался на промокод, который существует на стенде и у которого закончился срок. Исправление — создавать промокод для теста через API (с датой окончания в будущем) и удалять после теста.',
        bug: 'Нет: фронтенд корректно не применил скидку и показал сообщение об ошибке, которую вернул бэкенд.',
      },
    },
    overlay: {
      title: 'tests/ui/catalog/add-to-cart.spec.ts › товар добавляется в корзину',
      error: "Test timeout of 30000ms exceeded.\n\nError: locator.click: Test timeout of 30000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'В корзину' }).first()\n  - locator resolved to <button class=\"btn btn-primary\">В корзину</button>\n  - attempting click action\n  - element is visible, enabled and stable\n  - <div class=\"cookie-banner\">…</div> intercepts pointer events\n  - retrying click action",
      actions: [
        { a: "page.goto('/catalog')", ms: 520, snap: { cards: true, banner: true } },
        { a: "getByRole('button', { name: 'В корзину' }).first().click()", ms: 29480, fail: true, snap: { cards: true, banner: true } },
      ],
      network: ['GET  /catalog                 200  html  102 ms', 'GET  /api/products?limit=20   200  json   66 ms', 'GET  /api/consent             200  json   12 ms   {"required":true}'],
      console: [],
      options: [
        ['slow', 'Каталог слишком долго загружается'],
        ['overlay', 'Кнопку перекрывает баннер cookies'],
        ['disabled', 'Кнопка заблокирована, товара нет в наличии'],
        ['first', 'first() выбрал карточку не того товара'],
      ],
      answer: 'overlay',
      explain: {
        slow: 'Нет: каталог загрузился за полсекунды, кнопка найдена сразу (locator resolved).',
        overlay: 'Да. Call log: «element is visible, enabled and stable», затем «cookie-banner intercepts pointer events» — Playwright повторял клик, пока не истёк таймаут теста. В новом контексте нет согласия на cookies, поэтому баннер показывается каждому тесту. Исправление — закрыть баннер в фикстуре или заранее записать согласие в storageState; не использовать force: true, чтобы не скрыть реальную проблему интерфейса.',
        disabled: 'Нет: в call log явно сказано «enabled».',
        first: 'Отчасти: first() — плохая практика и может выбрать не тот товар, но причина таймаута в другом — клик перехватывает другой элемент.',
      },
    },
  };
  Sim.register('trace-explorer', (root) => {
    let tk = 'promo', step = 0, answered = null;
    const sh = UI.shell(root, {
      title: 'Разбор падения по trace', icon: 'bug', kicker: 'Тренажёр', layout: 'one',
      help: 'Учебная трассировка упавшего теста, как в Trace Viewer: действия, снимок страницы, сеть и консоль. Найдите причину и выберите ответ.',
      onReset: () => { step = 0; answered = null; draw(); },
      note: 'Упрощённая модель Trace Viewer (npx playwright show-trace trace.zip): в настоящем есть шкала времени со скриншотами, снимки DOM до и после действия, исходный код и вложения.',
    });
    const col = sh.col();
    UI.seg(col, { label: 'Расследование', value: tk, options: [{ value: 'promo', label: '1. Сумма не пересчиталась' }, { value: 'overlay', label: '2. Таймаут клика' }], onChange: (v) => { tk = v; step = 0; answered = null; draw(); } });
    const head = el('div', { class: 'tr-head' });
    const body = el('div', { class: 'tr-body' });
    const quiz = el('div', { class: 'tr-quiz' });
    col.append(head, body, quiz);
    let tab = 'snap';
    function draw() {
      const t = TRACES[tk];
      U.clear(head);
      head.append(el('div', { class: 'mono tr-title', text: t.title }), el('pre', { class: 'out-box sql-err', text: t.error }));
      U.clear(body);
      const acts = el('div', { class: 'tr-actions', role: 'listbox', 'aria-label': 'Действия теста' });
      t.actions.forEach((a, i) => {
        const b = el('button', { type: 'button', role: 'option', 'aria-selected': String(i === step), class: 'tr-act' + (i === step ? ' is-sel' : '') + (a.fail ? ' is-fail' : '') }, [el('span', { class: 'mono', text: a.a }), el('span', { class: 'muted-t', text: U.fmt(a.ms) + ' мс' })]);
        b.addEventListener('click', () => { step = i; draw(); });
        acts.appendChild(b);
      });
      const pane = el('div', { class: 'tr-pane' });
      const tabs = el('div', { class: 'btn-row tr-tabs' });
      [['snap', 'Снимок'], ['net', 'Network'], ['console', 'Console']].forEach(([k, l]) => { const b = UI.button(tabs, { label: l, cls: tab === k ? 'is-on' : '', onClick: () => { tab = k; draw(); } }); b.setAttribute('aria-pressed', String(tab === k)); });
      pane.appendChild(tabs);
      const a = t.actions[step];
      if (tab === 'snap') pane.appendChild(snapshot(tk, a.snap, step));
      if (tab === 'net') pane.appendChild(el('pre', { class: 'out-box', text: t.network.slice(0, tk === 'promo' ? (step >= 3 ? 3 : 2) : 3).join('\n') }));
      if (tab === 'console') pane.appendChild(el('pre', { class: 'out-box', text: (tk === 'promo' && step < 3 ? [] : t.console).join('\n') || '(пусто)' }));
      body.append(acts, pane);
      U.clear(quiz);
      quiz.appendChild(el('div', { class: 'card-sub', text: 'Наиболее вероятная причина' }));
      const row = el('div', { class: 'tr-opts' });
      t.options.forEach(([k, l]) => { const b = UI.button(row, { label: l, cls: answered ? (k === t.answer ? 'is-right' : k === answered ? 'is-wrong' : '') : '', onClick: () => { answered = k; draw(); } }); b.setAttribute('aria-pressed', String(answered === k)); });
      quiz.appendChild(row);
      sh.say(answered ? `<p><b>${answered === t.answer ? 'Верно.' : 'Не совсем.'}</b> ${t.explain[answered]}</p>` : '<p>Пройдите по действиям слева и посмотрите вкладки Network и Console на каждом шаге. Сообщение об ошибке показывает симптом, а trace — что происходило до него.</p>');
    }
    function snapshot(kind, sn, i) {
      const v = el('div', { class: 'ni-view tr-snap' });
      const pg = el('div', { class: 'ni-page' }, [el('div', { class: 'lp-url mono', text: kind === 'promo' ? 'shop.local/cart' : 'shop.local/catalog' })]);
      if (kind === 'promo') {
        pg.appendChild(el('div', { class: 'ni-h', text: 'Корзина' }));
        pg.appendChild(el('div', { class: 'tr-line' }, [el('span', { text: 'Наушники Pulse × 2' }), el('span', { text: '9 980 ₽' })]));
        if (i >= 1) pg.appendChild(el('div', { class: 'tr-line' }, [el('span', { class: 'tr-input' + (i === 2 ? ' tr-hl' : ''), text: sn.promo || 'Введите промокод' }), el('span', { class: 'tr-btn' + (i === 3 ? ' tr-hl' : ''), text: 'Применить' })]));
        if (sn.msg) pg.appendChild(el('div', { class: 'ni-alert', text: sn.msg }));
        pg.appendChild(el('div', { class: 'tr-line tr-total' + (i === 4 ? ' tr-hl' : '') }, [el('b', { text: 'Итого' }), el('b', { text: sn.total })]));
      } else {
        pg.appendChild(el('div', { class: 'ni-h', text: 'Каталог' }));
        pg.appendChild(el('div', { class: 'ni-grid' }, ['Наушники Pulse', 'Колонка Boom', 'Клавиатура Keys'].map((t, j) => el('div', { class: 'ni-card' }, [el('b', { text: t }), el('span', { class: 'tr-btn' + (i === 1 && j === 0 ? ' tr-hl' : ''), text: 'В корзину' })]))));
        if (sn.banner) pg.appendChild(el('div', { class: 'tr-banner' }, [el('span', { text: 'Мы используем cookies.' }), el('span', { class: 'tr-btn', text: 'Принять' })]));
      }
      v.appendChild(pg);
      return v;
    }
    draw();
  });
})();

;
