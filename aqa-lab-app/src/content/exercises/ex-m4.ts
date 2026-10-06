import type { Exercise } from './types';

const authStarter = `import { test, expect } from '@playwright/test';

test('заказ доступен только владельцу', async ({ request }) => {
  // вход Бориса: сервер выдаёт cookie sid, request хранит её и отправляет дальше сам
  await request.post('/api/login', { data: { email: 'boris@example.test', password: 'learn-123' } });
  await request.post('/api/cart', { data: { productId: 3, qty: 1 } });
  const created = await request.post('/api/orders');
  const order = await created.json();

  // TODO: проверьте коды ответов:
  //   оформление заказа — 201;
  //   GET /api/orders/<id> своего заказа — 200;
  //   GET /api/orders/101 (заказ Анны) — 403.
});
`;

const ex: Exercise[] = [
  {
    id: 'm4-find-by-role',
    lesson: 'web-dom',
    kind: 'ts',
    title: 'Поиск в дереве по роли и имени',
    goal: 'Страница описана деревом узлов `{ role, name, children }`. Напишите `findByRole(root, role, name?)`: она возвращает **все** узлы с заданной ролью (включая сам корень), а если передано `name` — только с точно таким именем. Порядок — как в документе: сначала родитель, затем дети слева направо.',
    starter: `export interface El {
  role: string;
  name: string;
  children: El[];
}

export function findByRole(root: El, role: string, name?: string): El[] {
  // TODO: проверьте сам узел, затем всех его потомков
  return [];
}
`,
    solution: `export interface El {
  role: string;
  name: string;
  children: El[];
}

export function findByRole(root: El, role: string, name?: string): El[] {
  const found: El[] = [];
  if (root.role === role && (name === undefined || root.name === name)) found.push(root);
  for (const child of root.children) {
    found.push(...findByRole(child, role, name));
  }
  return found;
}
`,
    alternatives: ['обход стеком или очередью без рекурсии (с сохранением порядка документа)'],
    explanation: 'Дерево обходится рекурсивно: проверяем узел, затем для каждого ребёнка вызываем ту же функцию и собираем результаты. Порядок «родитель, потом дети слева направо» — это обход в глубину, так же упорядочены элементы в DOM. Похожим образом работает `getByRole`: он идёт по дереву доступности и сравнивает роль и доступное имя. Разница в том, что Playwright по умолчанию сравнивает имя как подстроку без учёта регистра, а с `exact: true` — точно.',
    hints: [
      'Узел может быть найден сам и содержать найденных внутри. Обработайте сначала сам узел, потом детей.',
      'Рекурсия: для каждого `child` из `root.children` вызовите `findByRole(child, role, name)` и добавьте результат в общий массив.',
      '`if (root.role === role && (name === undefined || root.name === name)) found.push(root);` и затем `found.push(...findByRole(child, role, name))` в цикле.',
    ],
    mistakes: [
      'Смотреть только на детей первого уровня: кнопки внутри карточек не найдутся.',
      'Проверять `if (name && …)`: пустое имя `\'\'` перестанет быть фильтром. Сравнивайте с `undefined`.',
    ],
    check: `import { findByRole, type El } from './student';
const leaf = (role: string, name: string): El => ({ role, name, children: [] });
const card = (title: string, inStock: boolean): El => ({ role: 'listitem', name: '', children: [leaf('heading', title), inStock ? leaf('button', 'В корзину') : leaf('paragraph', 'Нет в наличии')] });
const page: El = { role: 'document', name: 'Каталог — Учебный магазин', children: [
  { role: 'banner', name: '', children: [leaf('link', 'Каталог'), leaf('link', 'Корзина (0)')] },
  { role: 'main', name: '', children: [
    leaf('heading', 'Каталог'),
    { role: 'search', name: '', children: [leaf('searchbox', 'Поиск товара'), leaf('button', 'Найти')] },
    { role: 'list', name: 'Товары', children: [card('Наушники Pulse', true), card('Блокнот A5', true), card('Лампа настольная', false)] },
  ] },
] };
const names = (els: El[]) => els.map((e) => e.name);
test('все кнопки в порядке документа', () => expectEq(names(findByRole(page, 'button')), ['Найти', 'В корзину', 'В корзину']));
test('кнопки «В корзину» — две', () => expectEq(findByRole(page, 'button', 'В корзину').length, 2));
test('все заголовки, включая вложенные в карточки', () => expectEq(names(findByRole(page, 'heading')), ['Каталог', 'Наушники Pulse', 'Блокнот A5', 'Лампа настольная']));
test('корень тоже проверяется', () => expectEq(names(findByRole(page, 'document')), ['Каталог — Учебный магазин']));
test('имя сравнивается точно', () => expectEq(findByRole(page, 'link', 'Корзина').length, 0));
test('ссылка «Корзина (0)» находится', () => expectEq(findByRole(page, 'link', 'Корзина (0)').length, 1));
test('нет такой роли — пустой массив', () => expectEq(findByRole(page, 'checkbox'), []));
test('возвращаются сами узлы', () => expectTrue(findByRole(page, 'list', 'Товары')[0]?.children.length === 3, 'ожидался узел списка с тремя карточками'));
`,
  },
  {
    id: 'm4-build-request',
    lesson: 'web-http',
    kind: 'ts',
    title: 'Собрать HTTP-запрос',
    goal: 'Опишите два запроса к API магазина как объекты `{ method, path, headers, body? }`. `addToCartRequest(productId, qty)` — добавить товар в корзину: `POST /api/cart`, тело — JSON `{ productId, qty }` с заголовком `content-type: application/json`. `searchRequest(q)` — найти товары: `GET /api/products` с параметром `q` в строке запроса, без тела.',
    starter: `export interface HttpRequest {
  method: string;
  path: string; // путь и строка запроса, например /api/products?q=...
  headers: Record<string, string>;
  body?: string;
}

export function addToCartRequest(productId: number, qty: number): HttpRequest {
  // TODO
  return { method: 'GET', path: '/api/cart', headers: {} };
}

export function searchRequest(q: string): HttpRequest {
  // TODO: не забудьте закодировать q для URL
  return { method: 'GET', path: '/api/products', headers: {} };
}
`,
    solution: `export interface HttpRequest {
  method: string;
  path: string; // путь и строка запроса, например /api/products?q=...
  headers: Record<string, string>;
  body?: string;
}

export function addToCartRequest(productId: number, qty: number): HttpRequest {
  return {
    method: 'POST',
    path: '/api/cart',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId, qty }),
  };
}

export function searchRequest(q: string): HttpRequest {
  return { method: 'GET', path: '/api/products?q=' + encodeURIComponent(q), headers: {} };
}
`,
    explanation: 'Запрос состоит из метода (что сделать), пути (с чем), заголовков (как понимать тело) и тела (данные). Добавление в корзину меняет состояние сервера — это `POST` с JSON-телом; `JSON.stringify` превращает объект в строку, а `content-type` сообщает серверу, что это JSON. Поиск ничего не меняет — это `GET`, а параметры передаются в строке запроса. `encodeURIComponent` нужен, потому что в URL нельзя напрямую писать пробелы, кириллицу и символы вроде `&`.',
    hints: [
      'Какое действие меняет данные на сервере, а какое только читает? От этого зависит метод и наличие тела.',
      'Тело — строка: используйте `JSON.stringify({ productId, qty })`. Значение параметра в URL кодируют `encodeURIComponent(q)`.',
      '`path: \'/api/products?q=\' + encodeURIComponent(q)` и `headers: { \'content-type\': \'application/json\' }`.',
    ],
    mistakes: [
      'Передать в `body` объект вместо строки: по сети уходит текст, и тип `string` это подсказывает.',
      'Склеить `?q=` + q без кодирования: запрос «Чай & кофе» превратится в два параметра.',
      'Добавить тело к GET-запросу: серверы обычно его игнорируют.',
    ],
    check: `import { addToCartRequest, searchRequest } from './student';
const header = (h: Record<string, string>, name: string) => Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1];
const query = (path: string) => {
  const [p, qs = ''] = path.split('?');
  const params: Record<string, string> = {};
  for (const part of qs.split('&').filter(Boolean)) {
    const [k, v = ''] = part.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\\+/g, ' '));
  }
  return { p, params };
};
test('добавление в корзину — метод POST', () => expectEq(addToCartRequest(3, 2).method.toUpperCase(), 'POST'));
test('добавление в корзину — путь /api/cart', () => expectEq(addToCartRequest(3, 2).path, '/api/cart'));
test('тело — JSON с productId и qty', () => { const b = addToCartRequest(3, 2).body; expectTrue(typeof b === 'string', 'body должен быть строкой с JSON'); expectEq(JSON.parse(b as string), { productId: 3, qty: 2 }); });
test('другие значения попадают в тело', () => expectEq(JSON.parse(addToCartRequest(5, 1).body ?? 'null'), { productId: 5, qty: 1 }));
test('заголовок content-type: application/json', () => expectTrue((header(addToCartRequest(3, 2).headers, 'content-type') ?? '').includes('application/json'), 'нужен заголовок content-type со значением application/json'));
test('поиск — метод GET без тела', () => { const r = searchRequest('Блокнот'); expectEq(r.method.toUpperCase(), 'GET'); expectEq(r.body ?? null, null); });
test('поиск — путь /api/products и параметр q', () => { const { p, params } = query(searchRequest('Блокнот').path); expectEq(p, '/api/products'); expectEq(params.q, 'Блокнот'); });
test('пробел и & в запросе кодируются', () => { const { params } = query(searchRequest('Чай & кофе').path); expectEq(params, { q: 'Чай & кофе' }); });
`,
  },
  {
    id: 'm4-order-response',
    lesson: 'web-status',
    kind: 'ts',
    title: 'Проверка ответа на создание заказа',
    goal: 'Напишите `orderProblems(res)` для ответа на `POST /api/orders`. Если код не 201 — верните `[\'status\']` (тело ответа с ошибкой не разбираем). Если код 201, но тело не JSON — `[\'not-json\']`. Иначе соберите проблемы полей: `\'id\'`, если `id` не число, и `\'total\'`, если `total` не число. Корректный ответ — пустой массив.',
    starter: `export type Problem = 'status' | 'not-json' | 'id' | 'total';

export interface RawResponse {
  status: number;
  body: string; // тело ответа как текст
}

export function orderProblems(res: RawResponse): Problem[] {
  // TODO
  return [];
}
`,
    solution: `export type Problem = 'status' | 'not-json' | 'id' | 'total';

export interface RawResponse {
  status: number;
  body: string; // тело ответа как текст
}

export function orderProblems(res: RawResponse): Problem[] {
  if (res.status !== 201) return ['status'];
  let data: unknown;
  try {
    data = JSON.parse(res.body);
  } catch {
    return ['not-json'];
  }
  const order = (typeof data === 'object' && data !== null ? data : {}) as { id?: unknown; total?: unknown };
  const problems: Problem[] = [];
  if (typeof order.id !== 'number') problems.push('id');
  if (typeof order.total !== 'number') problems.push('total');
  return problems;
}
`,
    explanation: 'Сначала код ответа: он говорит, что произошло, и определяет, какое тело ожидать. 201 Created — заказ создан; 200 вместо 201 — нарушение контракта, даже если тело верное. Затем формат: `JSON.parse` бросает ошибку на не-JSON, поэтому он в `try/catch`. Последний шаг — типы полей: `"780.00"` выглядит как число, но это строка, и клиент, который складывает суммы, получит склейку строк. Тип `unknown` заставляет проверить данные, прежде чем ими пользоваться.',
    hints: [
      'Порядок важен: код ответа → удалось ли разобрать JSON → типы полей.',
      '`JSON.parse` в `try { … } catch { return [\'not-json\']; }`. Тип поля проверяет `typeof x === \'number\'`.',
      '`if (res.status !== 201) return [\'status\'];` — первая строка функции.',
    ],
    mistakes: [
      'Проверять `res.status === 200`: создание ресурса отвечает 201, и дефект «200 вместо 201» останется незамеченным.',
      'Проверять `Number(total)` вместо `typeof`: строка `"780.00"` превратится в число, и дефект формата не будет найден.',
    ],
    check: `import { orderProblems } from './student';
const ok = JSON.stringify({ id: 102, userId: 2, status: 'new', total: 780, totalText: '780 ₽', items: [{ productId: 3, qty: 2 }] });
const sorted = (a: string[]) => [...a].sort();
test('корректный ответ 201 — проблем нет', () => expectEq(orderProblems({ status: 201, body: ok }), []));
test('200 вместо 201 — status', () => expectEq(orderProblems({ status: 200, body: ok }), ['status']));
test('401 «нужно войти» — status', () => expectEq(orderProblems({ status: 401, body: '{"error":"нужно войти"}' }), ['status']));
test('500 с текстом вместо JSON — status', () => expectEq(orderProblems({ status: 500, body: 'Internal Server Error' }), ['status']));
test('201, но тело не JSON — not-json', () => expectEq(orderProblems({ status: 201, body: '<html>ok</html>' }), ['not-json']));
test('total строкой "780.00" — total', () => expectEq(orderProblems({ status: 201, body: ok.replace('"total":780', '"total":"780.00"') }), ['total']));
test('id строкой — id', () => expectEq(orderProblems({ status: 201, body: ok.replace('"id":102', '"id":"102"') }), ['id']));
test('нет обоих полей — id и total', () => expectEq(sorted(orderProblems({ status: 201, body: '{"status":"new"}' })), ['id', 'total']));
`,
  },
  {
    id: 'm4-order-access',
    lesson: 'web-auth',
    kind: 'pw',
    title: 'Свой заказ — 200, чужой — 403',
    goal: 'Тест входит как Борис через API, кладёт товар в корзину и оформляет заказ. Допишите проверки кодов ответов: оформление — `201`, свой заказ `GET /api/orders/<id>` — `200`, заказ Анны `GET /api/orders/101` — `403`. Тест должен проходить на исправном магазине и падать, если заказ записывается не тому пользователю или создание отвечает не 201.',
    starter: authStarter,
    solution: `import { test, expect } from '@playwright/test';

test('заказ доступен только владельцу', async ({ request, playwright }) => {
  // вход Бориса: сервер выдаёт cookie sid, request хранит её и отправляет дальше сам
  const login = await request.post('/api/login', { data: { email: 'boris@example.test', password: 'learn-123' } });
  expect(login.status()).toBe(200);
  await request.post('/api/cart', { data: { productId: 3, qty: 1 } });
  const created = await request.post('/api/orders');
  expect(created.status()).toBe(201);
  const order = await created.json();

  const own = await request.get(\`/api/orders/\${order.id}\`);
  expect(own.status()).toBe(200);

  const foreign = await request.get('/api/orders/101');
  expect(foreign.status()).toBe(403);

  // гость: новый контекст без cookie
  const guest = await playwright.request.newContext();
  const anon = await guest.get(\`/api/orders/\${order.id}\`);
  expect(anon.status()).toBe(401);
  await guest.dispose();
});
`,
    alternatives: ['проверка гостя необязательна; можно также проверить, что own.json().userId совпадает с id Бориса (2)'],
    explanation: 'После входа сервер ставит cookie `sid`, и `request` отправляет её с каждым следующим запросом — так сервер узнаёт Бориса. 403 на заказ №101 означает «я знаю, кто вы, но это не ваше» — авторизация. 401 у гостя без cookie означает «не знаю, кто вы» — нет аутентификации. Проверка «свой заказ — 200» ловит дефект, при котором заказ записывается другому пользователю: тогда Борис не может открыть собственный заказ.',
    hints: [
      'У ответа есть метод `status()`. Сравните его с ожидаемым кодом через `expect(…).toBe(…)`.',
      'Свой заказ: `request.get(\'/api/orders/\' + order.id)`. Чужой: `request.get(\'/api/orders/101\')`. Код ответа — `response.status()`.',
      '`expect(created.status()).toBe(201);` сразу после оформления, затем `expect(own.status()).toBe(200);` и `expect(foreign.status()).toBe(403);`.',
    ],
    mistakes: [
      'Проверять только `ok()`: он истинен для любого 2xx, и 200 вместо 201 пройдёт.',
      'Ожидать 401 на чужой заказ: Борис вошёл, сервер его знает — правильный ответ 403.',
    ],
    mustPass: ['ok'],
    mustFail: ['order-user', 'api-status'],
  },
];
export default ex;
