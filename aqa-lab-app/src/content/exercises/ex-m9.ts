import type { Exercise } from './types';

const ex: Exercise[] = [
  {
    id: 'm9-git-forbidden',
    lesson: 'proj-git',
    kind: 'ts',
    title: 'Проверка перед коммитом: что не должно попасть в Git',
    goal: 'Напишите `forbiddenFiles(porcelain)`: функция получает вывод `git status --porcelain` и возвращает пути, которые нельзя коммитить: всё внутри каталогов `node_modules`, `test-results`, `playwright-report`, `allure-results`, `allure-report` (на любой глубине) и файлы `.env` / `.env.<что-угодно>`, кроме `.env.example`. Порядок — как в выводе.',
    starter: `const FORBIDDEN_DIRS = ['node_modules', 'test-results', 'playwright-report', 'allure-results', 'allure-report'];

export function forbiddenFiles(porcelain: string): string[] {
  // Строка porcelain: два символа статуса, пробел, путь. Например: "?? test-results/"
  // TODO
  return [];
}
`,
    solution: `const FORBIDDEN_DIRS = ['node_modules', 'test-results', 'playwright-report', 'allure-results', 'allure-report'];

function isForbidden(path: string): boolean {
  const withSlash = '/' + path;
  if (FORBIDDEN_DIRS.some((dir) => withSlash.includes('/' + dir + '/'))) return true;
  const name = path.split('/').pop() ?? '';
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example');
}

export function forbiddenFiles(porcelain: string): string[] {
  const result: string[] = [];
  for (const line of porcelain.split('\\n')) {
    if (line.trim() === '') continue;
    let path = line.slice(3).trim();
    // переименование: "R  старое -> новое" — в коммит попадёт новый путь
    if (path.includes(' -> ')) path = path.split(' -> ')[1];
    if (isForbidden(path)) result.push(path);
  }
  return result;
}
`,
    explanation: 'Строка `--porcelain` имеет стабильный формат: два символа статуса, пробел, путь. Путь берётся с третьего символа; при переименовании (`R`) важен новый путь. Каталог проверяется как целый сегмент пути (`/test-results/`), а не подстрока: файл `tests/test-results-parser.ts` — обычный код. `.env.example` — шаблон без секретов, его как раз коммитят. В реальном проекте основную работу делает `.gitignore`, а такая проверка в pre-commit или CI ловит то, что добавили через `git add -f` или забыли внести в `.gitignore`.',
    hints: [
      'Разбейте вывод на строки, пропустите пустые и выделите путь из каждой строки.',
      'Путь — `line.slice(3)`. Каталог ищите как сегмент: `(\'/\' + path).includes(\'/\' + dir + \'/\')`. Для `.env` смотрите только на имя файла — последний сегмент.',
      '`const name = path.split(\'/\').pop() ?? \'\';` и `name === \'.env\' || (name.startsWith(\'.env.\') && name !== \'.env.example\')`; для `R` возьмите часть после `\' -> \'`.',
    ],
    mistakes: [
      '`path.includes(\'test-results\')` — ложное срабатывание на `tests/test-results-parser.ts`.',
      'Считать запрещёнными все файлы, начинающиеся с `.env`: `.env.example` специально хранят в репозитории как образец.',
    ],
    check: `import { forbiddenFiles } from './student';
test('пустой вывод', () => expectEq(forbiddenFiles(''), []));
test('артефакты и .env', () => expectEq(forbiddenFiles(' M tests/cart.spec.ts\\n?? test-results/\\nA  .env\\n?? playwright-report/'), ['test-results/', '.env', 'playwright-report/']));
test('.env.example можно, .env.local нельзя', () => expectEq(forbiddenFiles('?? .env.example\\n?? config/.env.local'), ['config/.env.local']));
test('каталог — целый сегмент пути', () => expectEq(forbiddenFiles('?? tests/test-results-parser.ts\\n?? apps/web/node_modules/x/index.js\\n?? allure-results/a.json'), ['apps/web/node_modules/x/index.js', 'allure-results/a.json']));
test('переименование: важен новый путь', () => expectEq(forbiddenFiles('R  old.spec.ts -> allure-report/index.html\\nR  a.ts -> tests/b.spec.ts'), ['allure-report/index.html']));
`,
  },
  {
    id: 'm9-env-triage',
    lesson: 'proj-env',
    kind: 'ts',
    title: 'Первичная сортировка падений: окружение, тест или продукт',
    goal: 'Напишите `triage(error)`: по тексту ошибки из отчёта верните `\'environment\'` (отказ соединения, DNS, таймаут соединения, ответ 502/503/504), `\'test\'` (strict mode violation, `TypeError`, `SyntaxError` — ошибка в коде теста) или `\'product\'` (всё остальное — расхождение ожидания и результата). Признаки окружения проверяйте первыми.',
    starter: `export type Verdict = 'environment' | 'test' | 'product';

export function triage(error: string): Verdict {
  // TODO
  return 'product';
}
`,
    solution: `export type Verdict = 'environment' | 'test' | 'product';

const ENV = [/ECONNREFUSED/, /ERR_CONNECTION_REFUSED/, /ERR_NAME_NOT_RESOLVED/, /ENOTFOUND/, /ETIMEDOUT/, /\\b50[234]\\b/];
const TEST = [/strict mode violation/, /\\bTypeError\\b/, /\\bSyntaxError\\b/];

export function triage(error: string): Verdict {
  if (ENV.some((re) => re.test(error))) return 'environment';
  if (TEST.some((re) => re.test(error))) return 'test';
  return 'product';
}
`,
    explanation: 'Порядок правил важен: если приложение не отвечает, дальше разбирать ожидания бессмысленно. Коды 502/503/504 ищутся как отдельное число (`\\b`), чтобы `5030` или `1502 мс` не считались ответом шлюза. Strict mode violation и `TypeError` в коде теста говорят о проблеме теста. Остальное — кандидат в дефект, но это только первичная сортировка: окончательный вывод делается по trace, логам и воспроизведению.',
    hints: [
      'Сделайте два списка признаков — окружения и ошибок теста — и проверяйте их по порядку.',
      'Регулярные выражения удобнее строк: `/\\b50[234]\\b/` найдёт 502, 503 и 504 как отдельное число.',
      '`if (ENV.some((re) => re.test(error))) return \'environment\';` — затем то же для TEST, иначе `\'product\'`.',
    ],
    mistakes: [
      '`error.includes(\'50\')` — совпадёт с `Received: 1502` и с ценой `4 990 ₽`.',
      'Проверять признаки теста раньше окружения: `TypeError: fetch failed` при упавшем сервере — это окружение.',
    ],
    check: `import { triage } from './student';
test('сервер не поднят', () => expectEq(triage('page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3000/'), 'environment'));
test('API недоступен', () => expectEq(triage('apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:3000'), 'environment'));
test('DNS', () => expectEq(triage('page.goto: net::ERR_NAME_NOT_RESOLVED at http://shop.test/'), 'environment'));
test('503 от шлюза', () => expectEq(triage('Expected: 201\\nReceived: 503'), 'environment'));
test('TypeError из-за упавшего сервера — окружение', () => expectEq(triage('TypeError: fetch failed\\ncause: connect ECONNREFUSED 127.0.0.1:3000'), 'environment'));
test('strict mode', () => expectEq(triage("Error: strict mode violation: getByRole('button', { name: 'В корзину' }) resolved to 5 elements"), 'test'));
test('ошибка в коде теста', () => expectEq(triage("TypeError: Cannot read properties of undefined (reading 'id')"), 'test'));
test('неверная сумма', () => expectEq(triage('Expected: "780 ₽"\\nReceived: "390 ₽"'), 'product'));
test('200 вместо 201', () => expectEq(triage('Expected: 201\\nReceived: 200'), 'product'));
test('число 1502 — не код ответа', () => expectEq(triage('Timeout 3000ms exceeded after 1502 ms; Received: "0"'), 'product'));
`,
  },
  {
    id: 'm9-structure-client',
    lesson: 'proj-structure',
    kind: 'ts',
    title: 'Слой API-клиента: понятная ошибка вместо тихого undefined',
    goal: 'Допишите `createShopApi(http)`: `addToCart(productId, qty = 1)` отправляет `POST /api/cart` с `{ productId, qty }` и ждёт 200; `createOrder()` отправляет `POST /api/orders` и ждёт 201. При другом статусе метод бросает `Error`, в сообщении которого есть метод, путь и полученный статус. При успехе возвращается тело ответа.',
    starter: `export interface HttpResponse { status: number; body: unknown }
export interface Http { post(path: string, data?: unknown): Promise<HttpResponse> }

export function createShopApi(http: Http) {
  return {
    async addToCart(productId: number, qty = 1): Promise<unknown> {
      const res = await http.post('/api/cart', { productId, qty });
      return res.body;
    },
    async createOrder(): Promise<unknown> {
      const res = await http.post('/api/orders');
      return res.body;
    },
  };
}
`,
    solution: `export interface HttpResponse { status: number; body: unknown }
export interface Http { post(path: string, data?: unknown): Promise<HttpResponse> }

async function postExpecting(http: Http, path: string, expected: number, data?: unknown): Promise<unknown> {
  const res = await http.post(path, data);
  if (res.status !== expected) {
    throw new Error('POST ' + path + ': ожидался ' + expected + ', получен ' + res.status + ' ' + JSON.stringify(res.body));
  }
  return res.body;
}

export function createShopApi(http: Http) {
  return {
    addToCart(productId: number, qty = 1): Promise<unknown> {
      return postExpecting(http, '/api/cart', 200, { productId, qty });
    },
    createOrder(): Promise<unknown> {
      return postExpecting(http, '/api/orders', 201);
    },
  };
}
`,
    explanation: 'Клиент — слой между тестом и HTTP. Его задача — сделать подготовку данных короткой, а сбой подготовки — очевидным: «POST /api/cart: ожидался 200, получен 409 {...}» сразу говорит, что тест упал не на проверке, а на шаге подготовки. Без этого тест получает `undefined` и падает тремя шагами позже с непонятным сообщением. Транспорт (`http`) передаётся снаружи: в тестах это `request` Playwright, в этом задании — заглушка.',
    hints: [
      'Оба метода делают одно и то же: отправить запрос, сравнить статус с ожидаемым, вернуть тело. Вынесите это в функцию.',
      'Сравнивайте точный статус (`!== 201`), а не «успешность»: 200 вместо 201 — тоже нарушение контракта.',
      '`if (res.status !== expected) throw new Error(\'POST \' + path + \': ожидался \' + expected + \', получен \' + res.status);`',
    ],
    mistakes: [
      'Проверять `status < 400`: такой клиент пропустит дефект «API отвечает 200 вместо 201».',
      'Делать в клиенте проверки бизнес-результата (сумма, состав): это работа теста, а не транспортного слоя.',
    ],
    check: `import { createShopApi, type Http } from './student';
function fake(status: number, body: unknown) {
  const calls: unknown[] = [];
  const http: Http = { async post(path, data) { calls.push([path, data]); return { status, body }; } };
  return { http, calls };
}
async function errorOf(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return (e as Error).message; }
  return '';
}
test('addToCart: путь, тело и qty по умолчанию', async () => {
  const f = fake(200, { count: 1 });
  expectEq(await createShopApi(f.http).addToCart(3), { count: 1 });
  expectEq(f.calls, [['/api/cart', { productId: 3, qty: 1 }]]);
});
test('addToCart: явное количество', async () => {
  const f = fake(200, { count: 2 });
  await createShopApi(f.http).addToCart(3, 2);
  expectEq(f.calls, [['/api/cart', { productId: 3, qty: 2 }]]);
});
test('addToCart: 409 → ошибка с путём и статусом', async () => {
  const msg = await errorOf(createShopApi(fake(409, { error: 'недостаточно товара' }).http).addToCart(4));
  expectTrue(msg.includes('/api/cart') && msg.includes('409'), 'ожидалась ошибка с /api/cart и 409, получено: «' + msg + '»');
  expectTrue(msg.includes('POST'), 'в сообщении нужен метод POST: «' + msg + '»');
});
test('createOrder: 201 → тело заказа', async () => {
  const f = fake(201, { id: 105, total: 780 });
  expectEq(await createShopApi(f.http).createOrder(), { id: 105, total: 780 });
  expectEq((f.calls[0] as unknown[])[0], '/api/orders');
});
test('createOrder: 200 вместо 201 — тоже ошибка', async () => {
  const msg = await errorOf(createShopApi(fake(200, { id: 105 }).http).createOrder());
  expectTrue(msg.includes('/api/orders') && msg.includes('200'), 'ожидалась ошибка с /api/orders и 200, получено: «' + msg + '»');
});
`,
  },
  {
    id: 'm9-report-summary',
    lesson: 'proj-reports',
    kind: 'ts',
    title: 'Сводка по JSON-отчёту Playwright',
    goal: 'Напишите `summarize(report)`: обойдите все наборы отчёта (включая вложенные `describe`) и верните `{ total, failed, flaky }`. `failed` — тесты со статусом `unexpected` в виде `{ title, error }`, где `title` — заголовки наборов и теста через `\' › \'`, `error` — первая строка ошибки последней попытки (или `\'\'`). `flaky` — заголовки тестов со статусом `flaky`.',
    starter: `export interface JsonResult { status?: string; retry: number; error?: { message?: string } }
export interface JsonTest { projectName: string; status: 'expected' | 'unexpected' | 'flaky' | 'skipped'; results: JsonResult[] }
export interface JsonSpec { title: string; tests: JsonTest[] }
export interface JsonSuite { title: string; specs: JsonSpec[]; suites?: JsonSuite[] }
export interface JsonReport { suites: JsonSuite[] }
export interface Summary { total: number; failed: { title: string; error: string }[]; flaky: string[] }

export function summarize(report: JsonReport): Summary {
  const out: Summary = { total: 0, failed: [], flaky: [] };
  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      for (const t of spec.tests) {
        out.total++;
        if (t.status === 'unexpected') out.failed.push({ title: spec.title, error: '' });
      }
    }
  }
  return out;
}
`,
    solution: `export interface JsonResult { status?: string; retry: number; error?: { message?: string } }
export interface JsonTest { projectName: string; status: 'expected' | 'unexpected' | 'flaky' | 'skipped'; results: JsonResult[] }
export interface JsonSpec { title: string; tests: JsonTest[] }
export interface JsonSuite { title: string; specs: JsonSpec[]; suites?: JsonSuite[] }
export interface JsonReport { suites: JsonSuite[] }
export interface Summary { total: number; failed: { title: string; error: string }[]; flaky: string[] }

export function summarize(report: JsonReport): Summary {
  const out: Summary = { total: 0, failed: [], flaky: [] };
  const walk = (suite: JsonSuite, path: string[]) => {
    const here = [...path, suite.title];
    for (const spec of suite.specs) {
      const title = [...here, spec.title].join(' › ');
      for (const t of spec.tests) {
        out.total++;
        if (t.status === 'unexpected') {
          const last = t.results[t.results.length - 1];
          out.failed.push({ title, error: (last?.error?.message ?? '').split('\\n')[0] });
        } else if (t.status === 'flaky') {
          out.flaky.push(title);
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites) walk(suite, []);
  return out;
}
`,
    explanation: 'В JSON-отчёте верхний набор — файл, вложенные наборы — `describe`, а тесты лежат в `specs[].tests[]` (по одному на проект). Обход должен быть рекурсивным, иначе тесты внутри `describe` теряются. Итоговый статус теста — поле `status`: `unexpected` — упал, `flaky` — упал и прошёл на повторе. Ошибку берут из последней попытки: именно она определила результат. Такая сводка — основа комментария в merge request или сообщения в чат.',
    hints: [
      'Наборы вложены друг в друга: нужна рекурсивная функция, которая получает набор и путь заголовков до него.',
      'Заголовок теста — `[...путь, suite.title, spec.title].join(\' › \')`. Последняя попытка — `t.results[t.results.length - 1]`.',
      '`const walk = (suite: JsonSuite, path: string[]) => { … for (const child of suite.suites ?? []) walk(child, [...path, suite.title]); };`',
    ],
    mistakes: [
      'Обходить только `report.suites[].specs`: тесты внутри `describe` пропадают из сводки.',
      'Брать ошибку первой попытки: при повторах она может отличаться от той, что решила исход.',
    ],
    check: `import { summarize, type JsonReport } from './student';
const report: JsonReport = { suites: [
  { title: 'cart.spec.ts', specs: [
      { title: 'блокнот добавляется', tests: [{ projectName: 'chromium', status: 'expected', results: [{ status: 'passed', retry: 0 }] }] },
    ],
    suites: [{ title: 'Итог корзины', specs: [
      { title: 'два блокнота — 780 ₽', tests: [{ projectName: 'chromium', status: 'unexpected', results: [
        { status: 'failed', retry: 0, error: { message: 'Error: timeout' } },
        { status: 'failed', retry: 1, error: { message: 'Error: expect(locator).toHaveText(expected) failed\\n\\nExpected: "780 ₽"' } },
      ] }] },
      { title: 'пустая корзина', tests: [{ projectName: 'chromium', status: 'flaky', results: [{ status: 'failed', retry: 0, error: { message: 'x' } }, { status: 'passed', retry: 1 }] }] },
    ] }] },
  { title: 'login.spec.ts', specs: [
      { title: 'вход', tests: [{ projectName: 'chromium', status: 'skipped', results: [] }] },
      { title: 'выход', tests: [{ projectName: 'chromium', status: 'unexpected', results: [{ status: 'timedOut', retry: 0 }] }] },
  ] },
] };
test('всего тестов', () => expectEq(summarize(report).total, 5));
test('упавшие: путь заголовков и ошибка последней попытки', () => expectEq(summarize(report).failed, [
  { title: 'cart.spec.ts › Итог корзины › два блокнота — 780 ₽', error: 'Error: expect(locator).toHaveText(expected) failed' },
  { title: 'login.spec.ts › выход', error: '' },
]));
test('нестабильные', () => expectEq(summarize(report).flaky, ['cart.spec.ts › Итог корзины › пустая корзина']));
test('пустой отчёт', () => expectEq(summarize({ suites: [] }), { total: 0, failed: [], flaky: [] }));
`,
  },
  {
    id: 'm9-docker-retry',
    lesson: 'proj-docker',
    kind: 'ts-test',
    title: 'Тесты для помощника «повторять с нарастающей паузой»',
    goal: 'Функция `retry(fn, { attempts, baseDelayMs, sleep })` из `./app` ждёт готовности сервиса: вызывает `fn`, при ошибке ждёт `baseDelayMs`, затем вдвое больше и т. д.; делает не больше `attempts` попыток и после последней неудачи бросает последнюю ошибку (без паузы в конце). Напишите тесты, которые проходят на исправной версии и ловят все сломанные.',
    starter: `import { retry } from './app';

const noSleep = async (_ms: number) => {};

test('успех с первой попытки', async () => {
  const result = await retry(async () => 'ready', { attempts: 3, baseDelayMs: 100, sleep: noSleep });
  expectEq(result, 'ready');
});
`,
    solution: `import { retry } from './app';

// fn, которая падает first раз подряд, потом отвечает 'ready'
function failing(first: number) {
  let calls = 0;
  return { fn: async () => { calls++; if (calls <= first) throw new Error('503 #' + calls); return 'ready'; }, calls: () => calls };
}
// вместо настоящего ожидания — запись пауз: тест быстрый и детерминированный
function recorder() {
  const delays: number[] = [];
  return { delays, sleep: async (ms: number) => { delays.push(ms); } };
}

test('две неудачи, затем успех: 3 вызова, паузы 100 и 200', async () => {
  const f = failing(2), r = recorder();
  expectEq(await retry(f.fn, { attempts: 3, baseDelayMs: 100, sleep: r.sleep }), 'ready');
  expectEq(f.calls(), 3);
  expectEq(r.delays, [100, 200]);
});

test('все попытки неудачны: ровно attempts вызовов и последняя ошибка', async () => {
  const f = failing(99), r = recorder();
  let error: unknown;
  try { await retry(f.fn, { attempts: 3, baseDelayMs: 100, sleep: r.sleep }); } catch (e) { error = e; }
  expectTrue(error instanceof Error, 'после исчерпания попыток retry должен бросить ошибку');
  expectEq((error as Error).message, '503 #3');
  expectEq(f.calls(), 3);
  expectEq(r.delays, [100, 200]);
});
`,
    good: `export interface RetryOptions { attempts: number; baseDelayMs: number; sleep: (ms: number) => Promise<void> }

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let last: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < opts.attempts - 1) await opts.sleep(opts.baseDelayMs * 2 ** i);
    }
  }
  throw last;
}
`,
    broken: [
      { name: 'Повторов нет', code: `export interface RetryOptions { attempts: number; baseDelayMs: number; sleep: (ms: number) => Promise<void> }
export async function retry<T>(fn: () => Promise<T>, _opts: RetryOptions): Promise<T> {
  return fn();
}
` },
      { name: 'Лишняя попытка', code: `export interface RetryOptions { attempts: number; baseDelayMs: number; sleep: (ms: number) => Promise<void> }
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= opts.attempts; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < opts.attempts) await opts.sleep(opts.baseDelayMs * 2 ** i); }
  }
  throw last;
}
` },
      { name: 'Ошибка проглатывается', code: `export interface RetryOptions { attempts: number; baseDelayMs: number; sleep: (ms: number) => Promise<void> }
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  for (let i = 0; i < opts.attempts; i++) {
    try { return await fn(); } catch { if (i < opts.attempts - 1) await opts.sleep(opts.baseDelayMs * 2 ** i); }
  }
  return undefined as T;
}
` },
      { name: 'Пауза не растёт', code: `export interface RetryOptions { attempts: number; baseDelayMs: number; sleep: (ms: number) => Promise<void> }
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let last: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < opts.attempts - 1) await opts.sleep(opts.baseDelayMs); }
  }
  throw last;
}
` },
      { name: 'Лишняя пауза после последней попытки', code: `export interface RetryOptions { attempts: number; baseDelayMs: number; sleep: (ms: number) => Promise<void> }
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let last: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try { return await fn(); } catch (e) { last = e; await opts.sleep(opts.baseDelayMs * 2 ** i); }
  }
  throw last;
}
` },
    ],
    explanation: 'Два сценария покрывают поведение целиком: «успех после нескольких неудач» проверяет сам факт повторов и рост паузы, «все попытки неудачны» — предел попыток, отсутствие паузы в конце и то, что ошибка не теряется. Паузы не выполняются по-настоящему: подменённый `sleep` их записывает. Так тест идёт миллисекунды и не зависит от скорости машины — тот же приём, что `page.clock` в Playwright.',
    hints: [
      'Нужна `fn`, которая падает заданное число раз, и `sleep`, который не ждёт, а запоминает паузы.',
      'Проверьте два сценария: «2 неудачи, потом успех» и «все попытки неудачны». В каждом — число вызовов `fn` и массив пауз.',
      'Для второго сценария: `try { await retry(...) } catch (e) { error = e; }`, затем `expectEq((error as Error).message, \'503 #3\')` и `expectEq(r.delays, [100, 200])`.',
    ],
    mistakes: [
      'Проверять только успех с первой попытки: такой тест проходит даже на функции без повторов.',
      'Ждать настоящим `sleep`: тест становится медленным и зависит от таймеров машины.',
    ],
  },
  {
    id: 'm9-ci-gate',
    lesson: 'proj-ci',
    kind: 'ts',
    title: 'Quality gate по статистике прогона',
    goal: 'Напишите `gate(stats, policy)` по полю `stats` JSON-отчёта Playwright. Верните `{ exitCode, reasons }`: причина — есть упавшие (`unexpected > 0`); нестабильных больше `policy.maxFlaky`; не выполнился ни один тест (`expected + unexpected + flaky === 0`). `exitCode` — 1, если есть хотя бы одна причина, иначе 0. Текст причин — на ваш выбор.',
    starter: `export interface Stats { expected: number; unexpected: number; flaky: number; skipped: number }
export interface Policy { maxFlaky: number }

export function gate(stats: Stats, policy: Policy): { exitCode: 0 | 1; reasons: string[] } {
  return { exitCode: stats.unexpected > 0 ? 1 : 0, reasons: [] };
}
`,
    solution: `export interface Stats { expected: number; unexpected: number; flaky: number; skipped: number }
export interface Policy { maxFlaky: number }

export function gate(stats: Stats, policy: Policy): { exitCode: 0 | 1; reasons: string[] } {
  const reasons: string[] = [];
  if (stats.unexpected > 0) reasons.push('упало тестов: ' + stats.unexpected);
  if (stats.flaky > policy.maxFlaky) reasons.push('нестабильных: ' + stats.flaky + ' (допустимо ' + policy.maxFlaky + ')');
  if (stats.expected + stats.unexpected + stats.flaky === 0) reasons.push('не выполнено ни одного теста (skipped: ' + stats.skipped + ')');
  return { exitCode: reasons.length ? 1 : 0, reasons };
}
`,
    explanation: 'Код возврата Playwright уже отражает упавшие тесты, но gate отвечает на вопросы, которые Playwright не задаёт: допустимо ли столько нестабильных тестов (они проходят на повторе и дают зелёный прогон) и выполнилось ли вообще что-нибудь. Пустой прогон — частая ловушка CI: опечатка в `--grep` или пути, все тесты пропущены, а pipeline зелёный. Причины пишутся текстом, чтобы в логе задачи было видно, почему gate закрыт.',
    hints: [
      'Соберите массив причин, а `exitCode` выведите из его длины.',
      'Три независимых условия — три `if`; не используйте `else`: причин может быть несколько сразу.',
      '`if (stats.expected + stats.unexpected + stats.flaky === 0) reasons.push(\'не выполнено ни одного теста\');`',
    ],
    mistakes: [
      'Считать прогон, где все тесты `skipped`, успешным: так проходит pipeline, в котором ничего не проверялось.',
      'Ронять gate на любом flaky без порога: команда начнёт отключать повторы вместо того, чтобы чинить тесты, — порог задаётся политикой.',
    ],
    check: `import { gate } from './student';
const s = (expected: number, unexpected: number, flaky: number, skipped: number) => ({ expected, unexpected, flaky, skipped });
test('всё зелёное', () => expectEq(gate(s(10, 0, 0, 1), { maxFlaky: 0 }), { exitCode: 0, reasons: [] }));
test('есть упавший', () => { const r = gate(s(9, 1, 0, 0), { maxFlaky: 0 }); expectEq([r.exitCode, r.reasons.length], [1, 1]); });
test('flaky выше порога', () => { const r = gate(s(10, 0, 1, 0), { maxFlaky: 0 }); expectEq([r.exitCode, r.reasons.length], [1, 1]); });
test('flaky в пределах порога', () => expectEq(gate(s(10, 0, 2, 0), { maxFlaky: 2 }).exitCode, 0));
test('все тесты пропущены', () => { const r = gate(s(0, 0, 0, 5), { maxFlaky: 0 }); expectEq([r.exitCode, r.reasons.length], [1, 1]); });
test('пустой прогон', () => expectEq(gate(s(0, 0, 0, 0), { maxFlaky: 3 }).exitCode, 1));
test('две причины сразу', () => { const r = gate(s(0, 2, 3, 0), { maxFlaky: 0 }); expectEq([r.exitCode, r.reasons.length], [1, 2]); });
`,
  },
];
export default ex;
