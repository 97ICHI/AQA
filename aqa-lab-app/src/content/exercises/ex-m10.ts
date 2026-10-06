import type { Exercise } from './types';

const ex: Exercise[] = [
  {
    id: 'm10-flaky-fix',
    lesson: 'mid-flaky',
    kind: 'pw',
    title: 'Починить нестабильный тест корзины',
    goal: 'Тест проходит на быстрой машине и падает на медленном агенте CI. Перепишите его без пауз и однократного чтения так, чтобы он проходил на исправном, медленном магазине и на новой вёрстке, но падал, когда товар не добавляется в корзину.',
    starter: `import { test, expect } from '@playwright/test';

test('блокнот добавляется в корзину', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(300); // «дать странице прогрузиться»
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  const button = card.getByRole('button', { name: 'В корзину' });
  if (await button.isEnabled()) {
    await button.click();
  }
  await page.waitForTimeout(300); // «дождаться ответа сервера»
  const count = await page.getByTestId('cart-count').textContent();
  expect(count).toBe('1');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('блокнот добавляется в корзину', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('status')).toHaveText('Добавлено: Блокнот A5');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
`,
    explanation: 'Причина нестабильности — три предположения о времени: «через 300 мс страница готова», «если кнопка неактивна, клик не нужен», «через 300 мс сервер ответил». На медленном агенте первое и второе ложны, и тест молча пропускает клик. Исправление убирает предположения: `click()` сам ждёт, пока кнопка станет активной, а `toHaveText` повторяет проверку до таймаута. Проверка сообщения «Добавлено» полезна, но недостаточна: при дефекте магазин показывает его, хотя товар не добавился, — решает счётчик корзины.',
    hints: [
      'Найдите в тесте места, где код предполагает, сколько времени что-то займёт, или решает «делать или не делать» по текущему состоянию.',
      'Условие `if (await button.isEnabled())` превращает медленный магазин в пропущенный клик. `click()` сам дожидается активной кнопки. Однократное `textContent()` замените веб-первой проверкой.',
      '`await card.getByRole(\'button\', { name: \'В корзину\' }).click();` и `await expect(page.getByTestId(\'cart-count\')).toHaveText(\'1\');` — без `waitForTimeout`.',
    ],
    mistakes: [
      'Увеличить паузы до 2000 мс: тест станет медленнее везде и снова упадёт на ещё более медленном агенте.',
      'Включить `retries`: падение станет «зелёным со второй попытки», причина останется.',
      'Проверять только сообщение «Добавлено: Блокнот A5»: при дефекте магазин показывает его, а счётчик остаётся 0.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add'],
  },
  {
    id: 'm10-flaky-rate',
    lesson: 'mid-flaky',
    kind: 'ts',
    title: 'Доля нестабильности по истории прогонов',
    goal: 'Напишите `flakyReport(history, threshold)`. Каждая запись истории — один прогон одного теста: `{ test, attempts }`, где `attempts` — результаты попыток (`\'passed\' | \'failed\'`). Прогон нестабилен, если в нём есть и падение, и успех. Верните тесты с долей нестабильных прогонов `≥ threshold` как `{ test, runs, flaky, rate }`, по убыванию `rate`, при равенстве — по имени.',
    starter: `export type Attempt = 'passed' | 'failed';
export interface Run { test: string; attempts: Attempt[] }
export interface FlakyRow { test: string; runs: number; flaky: number; rate: number }

export function flakyReport(history: Run[], threshold: number): FlakyRow[] {
  const rows = new Map<string, FlakyRow>();
  for (const run of history) {
    const row = rows.get(run.test) ?? { test: run.test, runs: 0, flaky: 0, rate: 0 };
    row.runs++;
    if (run.attempts.includes('failed')) row.flaky++;
    row.rate = row.flaky / row.runs;
    rows.set(run.test, row);
  }
  return [...rows.values()].filter((r) => r.rate >= threshold);
}
`,
    solution: `export type Attempt = 'passed' | 'failed';
export interface Run { test: string; attempts: Attempt[] }
export interface FlakyRow { test: string; runs: number; flaky: number; rate: number }

export function flakyReport(history: Run[], threshold: number): FlakyRow[] {
  const rows = new Map<string, FlakyRow>();
  for (const run of history) {
    const row = rows.get(run.test) ?? { test: run.test, runs: 0, flaky: 0, rate: 0 };
    row.runs++;
    // нестабилен: падал и проходил в одном прогоне; «все попытки упали» — это стабильное падение
    if (run.attempts.includes('failed') && run.attempts.includes('passed')) row.flaky++;
    row.rate = row.flaky / row.runs;
    rows.set(run.test, row);
  }
  return [...rows.values()]
    .filter((r) => r.rate >= threshold)
    .sort((a, b) => b.rate - a.rate || a.test.localeCompare(b.test));
}
`,
    explanation: 'Главное — не смешивать нестабильность с падением. Прогон, где все попытки упали, — стабильный красный: тест или продукт сломан, и это видно сразу. Нестабилен прогон, где результат менялся без изменения кода. Доля считается по прогонам конкретного теста, а не по всему набору, иначе редкий, но систематически плавающий тест теряется среди сотен зелёных. Сортировка по доле даёт список для карантина и расследования.',
    hints: [
      'Сгруппируйте прогоны по имени теста (`Map`) и для каждого посчитайте всего прогонов и нестабильных.',
      'Нестабильный прогон — тот, где есть и `\'failed\'`, и `\'passed\'`. Прогон «упал, упал» — не нестабильный.',
      '`.sort((a, b) => b.rate - a.rate || a.test.localeCompare(b.test))` после фильтра по порогу.',
    ],
    mistakes: [
      'Считать нестабильным любой прогон с падением: стабильно сломанный тест попадает в карантин вместо исправления.',
      'Делить на общее число прогонов всех тестов: доля каждого теста становится заниженной.',
    ],
    check: `import { flakyReport, type Run } from './student';
const P = 'passed' as const, F = 'failed' as const;
const history: Run[] = [
  { test: 'cart', attempts: [P] }, { test: 'cart', attempts: [F, P] }, { test: 'cart', attempts: [P] }, { test: 'cart', attempts: [F, P] },
  { test: 'login', attempts: [P] }, { test: 'login', attempts: [P] }, { test: 'login', attempts: [F, F] }, { test: 'login', attempts: [P] },
  { test: 'order', attempts: [F, P] }, { test: 'order', attempts: [P] }, { test: 'order', attempts: [P] }, { test: 'order', attempts: [P] },
  { test: 'search', attempts: [P] }, { test: 'search', attempts: [F, P] },
];
test('порог 0.25', () => expectEq(flakyReport(history, 0.25), [
  { test: 'cart', runs: 4, flaky: 2, rate: 0.5 },
  { test: 'search', runs: 2, flaky: 1, rate: 0.5 },
  { test: 'order', runs: 4, flaky: 1, rate: 0.25 },
]));
test('стабильное падение — не нестабильность', () => expectEq(flakyReport(history, 0).find((r) => r.test === 'login'), { test: 'login', runs: 4, flaky: 0, rate: 0 }));
test('порог 0.6', () => expectEq(flakyReport(history, 0.6), []));
test('пустая история', () => expectEq(flakyReport([], 0.1), []));
`,
  },
  {
    id: 'm10-iso-contexts',
    lesson: 'mid-isolation',
    kind: 'pw',
    title: 'Два покупателя — два контекста',
    goal: 'Проверьте, что корзина одного покупателя не видна другому. Стартовый тест открывает «второго покупателя» во второй вкладке — и падает на исправном магазине. Перепишите его на двух отдельных контекстах браузера. Тест должен падать, если в магазине одна корзина на всех.',
    starter: `import { test, expect } from '@playwright/test';

test('корзина одного покупателя не видна другому', async ({ page }) => {
  // «Второй покупатель» — просто вторая вкладка того же контекста
  const other = await page.context().newPage();

  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');

  await other.goto('/cart');
  await expect(other.getByText('Корзина пуста.')).toBeVisible();
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('корзина одного покупателя не видна другому', async ({ browser }) => {
  const anna = await browser.newContext();
  const boris = await browser.newContext();
  try {
    const a = await anna.newPage();
    const b = await boris.newPage();

    await a.goto('/');
    const card = a.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
    await card.getByRole('button', { name: 'В корзину' }).click();
    await expect(a.getByTestId('cart-count')).toHaveText('1');

    await b.goto('/cart');
    await expect(b.getByTestId('cart-count')).toHaveText('0');
    await expect(b.getByText('Корзина пуста.')).toBeVisible();
  } finally {
    await anna.close();
    await boris.close();
  }
});
`,
    explanation: 'Вкладки одного контекста делят cookie, а значит и сессию: для магазина это один и тот же посетитель. Отдельного пользователя даёт только отдельный `BrowserContext` — `browser.newContext()`. Контексты, созданные вручную, нужно закрывать (`finally`), иначе они живут до конца worker. Тест проверяет обе стороны: у первого покупателя товар добавился (иначе пустая корзина второго ничего не доказывает), у второго корзина пуста.',
    hints: [
      'Почему вторая вкладка видит корзину первой? Что у них общего?',
      'Фикстура `browser` даёт `browser.newContext()`: у каждого контекста свои cookie. Страница создаётся `context.newPage()`.',
      '`const anna = await browser.newContext(); const boris = await browser.newContext();` … в конце `await anna.close(); await boris.close();` в `finally`.',
    ],
    mistakes: [
      'Проверять только второго покупателя: если товар вообще не добавляется, его корзина тоже пуста — тест проходит, ничего не доказав.',
      '`page.context().newPage()` — та же сессия, тот же «покупатель».',
    ],
    mustPass: ['ok', 'slow'],
    mustFail: ['shared-cart', 'cart-not-add'],
  },
  {
    id: 'm10-speed-api-setup',
    lesson: 'mid-speed',
    kind: 'pw',
    title: 'Подготовка через API, проверка в UI',
    goal: 'Тест готовит состояние через API (вход Анны и два блокнота в корзине), а в интерфейсе проверяет только итог — но страница не видит подготовленных данных. Исправьте подготовку так, чтобы тест проходил на исправном, медленном магазине и на новой вёрстке и падал на дефектах суммы и добавления в корзину.',
    starter: `import { test, expect } from '@playwright/test';

test('корзина Анны: два блокнота за 780 ₽', async ({ page, request }) => {
  // Подготовка через API — быстрее, чем кликать по каталогу
  await request.post('/api/login', { data: { email: 'anna@example.test', password: 'learn-123' } });
  await request.post('/api/cart', { data: { productId: 3, qty: 2 } });

  await page.goto('/cart');
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
  await expect(page.getByTestId('cart-total')).toHaveText('780 ₽');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('корзина Анны: два блокнота за 780 ₽', async ({ page }) => {
  // page.request делит cookie с вкладкой: сессия и корзина общие
  const login = await page.request.post('/api/login', { data: { email: 'anna@example.test', password: 'learn-123' } });
  await expect(login).toBeOK();
  const cart = await page.request.post('/api/cart', { data: { productId: 3, qty: 2 } });
  await expect(cart).toBeOK();

  await page.goto('/cart');
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
  await expect(page.getByTestId('cart-total')).toHaveText('780 ₽');
});
`,
    explanation: 'Фикстура `request` — отдельный HTTP-клиент со своим хранилищем cookie: вход через неё создаёт сессию, о которой браузер ничего не знает. `page.request` (то же, что `page.context().request`) использует cookie контекста страницы — сессия и корзина становятся общими для API и UI. Ответы подготовки проверяются `toBeOK()`: если подготовка не удалась, тест должен упасть на ней, а не на проверке итога с непонятным сообщением.',
    hints: [
      'Почему браузер не видит сессию, созданную запросом? Где хранится cookie `sid` в каждом случае?',
      'Нужен HTTP-клиент, который делит cookie с контекстом страницы: `page.request`.',
      '`const login = await page.request.post(\'/api/login\', { data: { … } }); await expect(login).toBeOK();` — то же для `/api/cart`.',
    ],
    mistakes: [
      'Вернуть подготовку через UI: тест снова медленный, а проверка итога от этого не стала точнее.',
      'Не проверять ответы подготовки: при 409 тест упадёт позже с сообщением про итог, и придётся разбираться, что пошло не так.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['wrong-total', 'cart-not-add'],
  },
  {
    id: 'm10-contract-shape',
    lesson: 'mid-contracts',
    kind: 'ts',
    title: 'Проверка формы ответа заказа без библиотек',
    goal: 'Напишите `orderErrors(json: unknown): string[]` — список нарушений контракта заказа: `id` — целое > 0; `status` — один из `new`, `paid`, `shipped`, `cancelled`; `total` — конечное число ≥ 0; `items` — непустой массив `{ productId: целое, qty: целое ≥ 1 }`. Каждое сообщение начинается с пути поля (`total`, `items[0].qty`). Лишние поля — не ошибка.',
    starter: `export function orderErrors(json: unknown): string[] {
  if (typeof json !== 'object' || json === null) return ['ответ: ожидался объект'];
  // TODO: проверить id, status, total, items
  return [];
}
`,
    solution: `const STATUSES = ['new', 'paid', 'shipped', 'cancelled'];
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const kind = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

export function orderErrors(json: unknown): string[] {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return ['ответ: ожидался объект, получено ' + kind(json)];
  const o = json as Record<string, unknown>;
  const errors: string[] = [];
  if (!isInt(o.id) || o.id <= 0) errors.push('id: ожидалось целое > 0, получено ' + JSON.stringify(o.id));
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status)) errors.push('status: недопустимое значение ' + JSON.stringify(o.status));
  if (typeof o.total !== 'number' || !Number.isFinite(o.total) || o.total < 0) errors.push('total: ожидалось число ≥ 0, получено ' + kind(o.total));
  if (!Array.isArray(o.items) || o.items.length === 0) {
    errors.push('items: ожидался непустой массив');
  } else {
    o.items.forEach((item: unknown, i: number) => {
      const it = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      if (!isInt(it.productId)) errors.push('items[' + i + '].productId: ожидалось целое');
      if (!isInt(it.qty) || it.qty < 1) errors.push('items[' + i + '].qty: ожидалось целое ≥ 1');
    });
  }
  return errors;
}
`,
    explanation: 'Ответ API приходит как `unknown`: TypeScript не знает, что там на самом деле, и проверка выполняется во время работы. Функция собирает все нарушения, а не останавливается на первом, — в отчёте сразу видно, что сломано. Путь поля в начале сообщения делает ошибку адресной. Лишние поля допускаются намеренно: добавление поля — совместимое изменение, и клиент не должен на нём падать. В проектах ту же работу делают библиотеки схем (zod, ajv); ручная версия показывает, что именно они проверяют.',
    hints: [
      'Сначала убедитесь, что это объект, затем проверяйте поля по одному и складывайте сообщения в массив.',
      '`typeof v === \'number\' && Number.isInteger(v)` — целое; строка `\'9980\'` не проходит `typeof … === \'number\'`. Для `items` переберите элементы с индексом.',
      '`if (typeof o.total !== \'number\' || !Number.isFinite(o.total) || o.total < 0) errors.push(\'total: ожидалось число ≥ 0\');`',
    ],
    mistakes: [
      '`Number(o.total)` перед проверкой: строка `\'9980\'` превращается в число, и нарушение контракта пропадает.',
      'Отклонять ответ с лишними полями: любое совместимое расширение API ломает тесты.',
    ],
    check: `import { orderErrors } from './student';
const ok = { id: 105, userId: 2, status: 'new', total: 780, totalText: '780 ₽', items: [{ productId: 3, qty: 2 }] };
const starts = (errs: string[], path: string) => errs.some((e) => e.startsWith(path));
test('корректный заказ', () => expectEq(orderErrors(ok), []));
test('лишнее поле допустимо', () => expectEq(orderErrors({ ...ok, promo: 'SPRING' }), []));
test('total строкой', () => { const e = orderErrors({ ...ok, total: '780.00' }); expectEq(e.length, 1); expectTrue(starts(e, 'total'), 'ожидалась ошибка total, получено ' + JSON.stringify(e)); });
test('null вместо объекта', () => expectTrue(orderErrors(null).length > 0, 'null должен давать ошибку'));
test('массив вместо объекта', () => expectTrue(orderErrors([ok]).length > 0, 'массив должен давать ошибку'));
test('нет items', () => { const { items, ...rest } = ok; void items; expectTrue(starts(orderErrors(rest), 'items'), 'ожидалась ошибка items'); });
test('qty = 0', () => expectTrue(starts(orderErrors({ ...ok, items: [{ productId: 3, qty: 0 }] }), 'items[0].qty'), 'ожидалась ошибка items[0].qty'));
test('неизвестный статус', () => expectTrue(starts(orderErrors({ ...ok, status: 'done' }), 'status'), 'ожидалась ошибка status'));
test('id дробный', () => expectTrue(starts(orderErrors({ ...ok, id: 1.5 }), 'id'), 'ожидалась ошибка id'));
test('несколько нарушений сразу', () => expectEq(orderErrors({ ...ok, id: 0, total: -1 }).length, 2));
`,
  },
  {
    id: 'm10-contract-api',
    lesson: 'mid-contracts',
    kind: 'pw',
    title: 'Контракт POST /api/orders',
    goal: 'Допишите API-тест создания заказа: проверьте точный код ответа и форму тела — типы `id`, `status`, `total`, `totalText`, `items` и значение суммы. Тест должен проходить на исправном магазине и падать, если API отвечает 200 вместо 201 или присылает `total` строкой.',
    starter: `import { test, expect } from '@playwright/test';

test('POST /api/orders: статус и форма ответа', async ({ request }) => {
  await expect(await request.post('/api/login', { data: { email: 'boris@example.test', password: 'learn-123' } })).toBeOK();
  await expect(await request.post('/api/cart', { data: { productId: 3, qty: 2 } })).toBeOK();

  const res = await request.post('/api/orders');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.total).toBeTruthy();
  // TODO: проверьте точный статус и форму ответа
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('POST /api/orders: статус и форма ответа', async ({ request }) => {
  await expect(await request.post('/api/login', { data: { email: 'boris@example.test', password: 'learn-123' } })).toBeOK();
  await expect(await request.post('/api/cart', { data: { productId: 3, qty: 2 } })).toBeOK();

  const res = await request.post('/api/orders');
  expect(res.status()).toBe(201);
  const body = await res.json();
  // форма: типы полей; лишние поля не мешают (toMatchObject)
  expect(body).toMatchObject({
    id: expect.any(Number),
    userId: 2,
    status: 'new',
    total: expect.any(Number),
    totalText: expect.any(String),
    items: [{ productId: 3, qty: 2 }],
  });
  expect(body.total).toBe(780);
});
`,
    explanation: '`res.ok()` истинно для любого 2xx, поэтому 200 вместо 201 проходит незамеченным. `toBeTruthy()` для суммы пропускает строку `\'780.00\'`. `toMatchObject` с `expect.any(Number)` проверяет тип и при этом не мешает добавлению новых полей — это и есть совместимая проверка контракта. Значение суммы проверяется отдельно: форма и смысл — разные вещи.',
    hints: [
      'Какие проверки в стартовом коде проходят и на дефектах? `ok()` — это любой 2xx, `toBeTruthy()` — любая непустая строка.',
      'Код ответа — `expect(res.status()).toBe(201)`. Типы полей — `toMatchObject` с `expect.any(Number)` / `expect.any(String)`.',
      '`expect(body).toMatchObject({ id: expect.any(Number), status: \'new\', total: expect.any(Number), totalText: expect.any(String) });` и `expect(body.total).toBe(780);`',
    ],
    mistakes: [
      '`toEqual` со всеми полями: тест упадёт, когда в ответ добавят новое поле, хотя для клиентов ничего не сломалось.',
      'Проверять только `body.total == 780` (нестрогое сравнение): строка `\'780\'` пройдёт.',
    ],
    mustPass: ['ok', 'slow'],
    mustFail: ['api-json', 'api-status'],
  },
  {
    id: 'm10-design-smoke',
    lesson: 'mid-design',
    kind: 'ts',
    title: 'Набор smoke-проверок в бюджете времени',
    goal: 'Напишите `pickSmoke(cases, budgetSec)`. Сначала берутся все `critical` проверки (если они не помещаются в бюджет — бросьте `Error`). Затем остальные в порядке: риск по убыванию, время по возрастанию, `id` по алфавиту; каждая добавляется, если ещё помещается (не поместилась — пропускаем и смотрим следующую). Верните `id` в порядке выбора.',
    starter: `export interface Case { id: string; risk: number; seconds: number; critical?: boolean }

export function pickSmoke(cases: Case[], budgetSec: number): string[] {
  return [...cases].sort((a, b) => b.risk - a.risk).map((c) => c.id);
}
`,
    solution: `export interface Case { id: string; risk: number; seconds: number; critical?: boolean }

export function pickSmoke(cases: Case[], budgetSec: number): string[] {
  const critical = cases.filter((c) => c.critical);
  let used = critical.reduce((sum, c) => sum + c.seconds, 0);
  if (used > budgetSec) throw new Error('критичные проверки не помещаются в бюджет: ' + used + ' с > ' + budgetSec + ' с');
  const picked = critical.map((c) => c.id);
  const rest = cases
    .filter((c) => !c.critical)
    .sort((a, b) => b.risk - a.risk || a.seconds - b.seconds || a.id.localeCompare(b.id));
  for (const c of rest) {
    if (used + c.seconds <= budgetSec) {
      picked.push(c.id);
      used += c.seconds;
    }
  }
  return picked;
}
`,
    explanation: 'Это формализация обычного решения: критичный путь (вход, оплата) входит в smoke всегда, и если он не помещается — это сигнал пересмотреть бюджет или ускорить проверки, а не тихо выкинуть важное. Остальное выбирается по риску, а при равном риске — более дешёвое. Жадный выбор не оптимален математически, но предсказуем и объясним команде; для smoke это важнее.',
    hints: [
      'Разделите проверки на критичные и остальные; критичные идут первыми и без условий.',
      'Сортировка с несколькими ключами: `b.risk - a.risk || a.seconds - b.seconds || a.id.localeCompare(b.id)`. Ведите счётчик использованного времени.',
      '`for (const c of rest) { if (used + c.seconds <= budgetSec) { picked.push(c.id); used += c.seconds; } }`',
    ],
    mistakes: [
      'Останавливаться на первой непоместившейся проверке: более дешёвые проверки с меньшим риском тоже полезны.',
      'Молча отбрасывать критичную проверку при нехватке бюджета.',
    ],
    check: `import { pickSmoke, type Case } from './student';
const cases: Case[] = [
  { id: 'login', risk: 5, seconds: 20, critical: true },
  { id: 'order', risk: 5, seconds: 40, critical: true },
  { id: 'search', risk: 3, seconds: 15 },
  { id: 'cart-total', risk: 4, seconds: 25 },
  { id: 'promo', risk: 4, seconds: 10 },
  { id: 'profile', risk: 2, seconds: 5 },
  { id: 'reviews', risk: 3, seconds: 15 },
];
test('бюджет 100 с', () => expectEq(pickSmoke(cases, 100), ['login', 'order', 'promo', 'cart-total', 'profile']));
test('бюджет 75 с: дорогая пропускается, дешёвые берутся', () => expectEq(pickSmoke(cases, 75), ['login', 'order', 'promo', 'profile']));
test('бюджет 200 с: все', () => expectEq(pickSmoke(cases, 200), ['login', 'order', 'promo', 'cart-total', 'reviews', 'search', 'profile']));
test('критичные не помещаются', async () => expectThrows(() => pickSmoke(cases, 50), 'ожидалась ошибка: критичные проверки не помещаются'));
test('нет проверок', () => expectEq(pickSmoke([], 10), []));
`,
  },
];
export default ex;
