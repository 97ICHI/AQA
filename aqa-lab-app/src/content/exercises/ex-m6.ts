import type { Exercise } from './types';

// Модуль 6 «Надёжный Playwright»: fixtures, данные, авторизация, параметризация, API, mocks, POM, параллельность, отладка, визуальные проверки, CI.
const ex: Exercise[] = [
  {
    id: 'm6-fixture-login',
    lesson: 'pw-fixtures',
    kind: 'pw',
    title: 'Fixture loggedInPage: страница с выполненным входом',
    goal: 'Допишите fixture `loggedInPage`: она открывает `/login`, входит как `anna@example.test` (пароль `learn-123`), дожидается имени «Анна» в шапке и передаёт страницу тесту. Тест должен проходить на исправном магазине и падать, если вход теряется при переходе на другую страницу.',
    starter: `import { test as base, expect, type Page } from '@playwright/test';

// Своя fixture: страница, на которой уже выполнен вход
const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    // TODO: откройте /login, войдите как anna@example.test (пароль learn-123)
    //       и дождитесь имени «Анна» в шапке
    await use(page);
  },
});

test('вход сохраняется при переходе в корзину', async ({ loggedInPage }) => {
  await loggedInPage.goto('/cart');
  await expect(loggedInPage.getByTestId('user-name')).toHaveText('Анна');
});
`,
    solution: `import { test as base, expect, type Page } from '@playwright/test';

// Своя fixture: страница, на которой уже выполнен вход
const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('anna@example.test');
    await page.getByLabel('Пароль').fill('learn-123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByTestId('user-name')).toHaveText('Анна');
    await use(page);
    await page.goto('/logout'); // уборка после теста
  },
});

test('вход сохраняется при переходе в корзину', async ({ loggedInPage }) => {
  await loggedInPage.goto('/cart');
  await expect(loggedInPage.getByTestId('user-name')).toHaveText('Анна');
});
`,
    explanation: 'Всё, что до `await use(page)`, — setup: вход через форму и проверка, что он удался. Проверка имени внутри fixture даёт понятное падение «не удалось войти» вместо загадочной ошибки дальше в тесте. Код после `use()` — teardown: выход, он выполнится и после падения теста. Сам тест проверяет только своё требование: после перехода в корзину пользователь всё ещё в системе. На варианте «вход не сохраняется» имя в корзине пропадает, и тест падает.',
    hints: [
      'Подготовка (setup) пишется в fixture до вызова `await use(page)` — тест получит страницу уже после неё.',
      'Повторите шаги входа из урока: `goto(\'/login\')`, `getByLabel(\'Email\').fill(…)`, `getByLabel(\'Пароль\').fill(…)`, клик по кнопке «Войти», затем дождитесь `getByTestId(\'user-name\')`.',
      '`await page.getByRole(\'button\', { name: \'Войти\' }).click(); await expect(page.getByTestId(\'user-name\')).toHaveText(\'Анна\');` — и только потом `await use(page);`',
    ],
    mistakes: [
      'Вызвать `use(page)` до входа: тест получит страницу гостя.',
      'Не дождаться результата входа: следующий `goto` может уйти раньше, чем сервер запомнил пользователя.',
      'Забыть `await` перед `use(page)`: fixture завершится раньше теста.',
    ],
    alternatives: [
      'Вход через API: `await page.request.post(\'/api/login\', { data: { email, password } })` — cookies общие со страницей, затем `page.goto(\'/\')`.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['auth-lost'],
  },
  {
    id: 'm6-data-independent',
    lesson: 'pw-data',
    kind: 'pw',
    title: 'Сделать второй тест независимым от первого',
    goal: 'Второй тест рассчитывает, что корзину заполнил первый, и поэтому падает. Сделайте так, чтобы он сам готовил свои данные: два «Блокнота A5» в корзине (товар `id = 3`). Оба теста должны проходить по отдельности и в любом порядке, а падать — если товар не добавляется или сумма не учитывает количество.',
    starter: `import { test, expect } from '@playwright/test';

test('добавить два блокнота', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');
});

test('итог корзины — 780 ₽', async ({ page }) => {
  // Этот тест рассчитывает, что корзину заполнил предыдущий тест.
  // TODO: подготовьте данные сами — например, через page.request.post('/api/cart', …)
  await page.goto('/cart');
  await expect(page.getByTestId('cart-total')).toHaveText('780 ₽');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('добавить два блокнота', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');
});

test('итог корзины — 780 ₽', async ({ page }) => {
  // Тест сам готовит свои данные: два блокнота (id 3) через API в той же сессии браузера
  const res = await page.request.post('/api/cart', { data: { productId: 3, qty: 2 } });
  expect(res.status()).toBe(200);
  await page.goto('/cart');
  await expect(page.getByTestId('cart-total')).toHaveText('780 ₽');
});
`,
    explanation: 'Каждый тест получает новый контекст браузера, а значит, новую сессию и пустую корзину. Второй тест готовит своё состояние сам: `page.request` отправляет `POST /api/cart` с cookies этой страницы, и два блокнота оказываются в её корзине. Через API подготовка занимает миллисекунды, а интерфейс проверяет то, ради чего тест написан, — итог на странице корзины. Теперь тест можно запустить отдельно, повторить и выполнить параллельно.',
    hints: [
      'Тест не должен рассчитывать на то, что сделал другой тест: у него своя, пустая корзина.',
      'Добавьте товар в начале второго теста. Быстрее всего — через API той же страницы: `page.request` делит cookies со страницей.',
      '`await page.request.post(\'/api/cart\', { data: { productId: 3, qty: 2 } });` — перед `page.goto(\'/cart\')`.',
    ],
    mistakes: [
      'Использовать fixture `request` вместо `page.request`: у неё свои cookies, и товар попадёт в другую корзину.',
      'Объединить два теста в один — независимость получится, но потеряется отдельная проверка добавления.',
      '`test.describe.serial` — делает зависимость явной, но не устраняет её.',
    ],
    alternatives: [
      'Подготовить корзину через интерфейс: два клика «В корзину» на странице каталога с проверкой счётчика после каждого.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add', 'wrong-total'],
  },
  {
    id: 'm6-auth-state',
    lesson: 'pw-auth-state',
    kind: 'pw',
    title: 'Войти один раз и переиспользовать storageState',
    goal: 'В `beforeAll` войдите как Анна через `context.request` (`POST /api/login`), сохраните состояние в файл `STATE` и подключите его ко всем тестам файла через `test.use`. Оба теста должны проходить без формы входа и падать, если магазин теряет вход при переходе.',
    starter: `import { test, expect } from '@playwright/test';

const STATE = 'anna-state.json';

test.beforeAll(async ({ browser }) => {
  // явно пустое состояние: иначе контекст попытается прочитать ещё не созданный STATE из test.use
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  // TODO: войдите как anna@example.test (пароль learn-123) через context.request
  //       и сохраните состояние: context.storageState({ path: STATE })
  await context.close();
});

// TODO: подключите сохранённое состояние ко всем тестам файла через test.use

test('Анна видит своё имя в каталоге и в корзине', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
  await page.goto('/cart');
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
});

test('Анна оформляет заказ без повторного входа', async ({ page }) => {
  await page.request.post('/api/cart', { data: { productId: 3, qty: 1 } });
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  await expect(page.getByRole('status')).toContainText('оформлен на сумму 390 ₽');
});
`,
    solution: `import { test, expect } from '@playwright/test';

const STATE = 'anna-state.json';

// Вход один раз на файл: логинимся через API и сохраняем cookies в файл
test.beforeAll(async ({ browser }) => {
  // явно пустое состояние: иначе контекст попытается прочитать ещё не созданный STATE из test.use
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await context.request.post('/api/login', { data: { email: 'anna@example.test', password: 'learn-123' } });
  expect(res.status()).toBe(200);
  await context.storageState({ path: STATE });
  await context.close();
});

// Каждый тест получает новый контекст, но уже с cookies Анны
test.use({ storageState: STATE });

test('Анна видит своё имя в каталоге и в корзине', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
  await page.goto('/cart');
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
});

test('Анна оформляет заказ без повторного входа', async ({ page }) => {
  await page.request.post('/api/cart', { data: { productId: 3, qty: 1 } });
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  await expect(page.getByRole('status')).toContainText('оформлен на сумму 390 ₽');
});
`,
    explanation: '`context.request` — HTTP-клиент контекста: cookie сессии из ответа на вход сохраняется в контексте. `context.storageState({ path })` записывает cookies в файл, а `test.use({ storageState: STATE })` создаёт каждому тесту новый контекст уже с этими cookies. Вход выполняется один раз на worker, а тесты остаются изолированными: у каждого своя страница. Первый тест проверяет имя на двух страницах — поэтому он замечает дефект, при котором вход теряется после перехода.',
    hints: [
      'Нужны две вещи: сохранить cookies после входа в файл и подключить файл как начальное состояние тестов.',
      'В `beforeAll`: `context.request.post(\'/api/login\', { data: { email, password } })`, затем `context.storageState({ path: STATE })`. Вне тестов: `test.use({ storageState: STATE })`.',
      '`await context.request.post(\'/api/login\', { data: { email: \'anna@example.test\', password: \'learn-123\' } }); await context.storageState({ path: STATE });`',
    ],
    mistakes: [
      'Сохранить состояние до входа: файл будет без cookie сессии.',
      'Вызвать `test.use` внутри теста — его вызывают на уровне файла или `describe`.',
      'Создать временный контекст в `beforeAll` без `storageState: { cookies: [], origins: [] }`: он унаследует `test.use({ storageState: STATE })` и упадёт на чтении ещё не созданного файла.',
    ],
    alternatives: [
      'Вход через форму на странице временного контекста и `page.context().storageState({ path: STATE })`.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['auth-lost'],
  },
  {
    id: 'm6-params-cart',
    lesson: 'pw-params',
    kind: 'pw',
    title: 'Таблица случаев: количество и итог корзины',
    goal: 'Тесты объявляются циклом по таблице `cases`. Допишите тело: нажмите «В корзину» `c.qty` раз, после каждого клика дождитесь значения счётчика корзины. Тесты должны проходить на исправном магазине и падать, если товар не добавляется или сумма не учитывает количество.',
    starter: `import { test, expect } from '@playwright/test';

const cases = [
  { title: 'Блокнот A5', qty: 2, total: '780 ₽' },
  { title: 'Кабель USB-C', qty: 3, total: '1 770 ₽' },
  { title: 'Кружка', qty: 1, total: '690 ₽' },
];

for (const c of cases) {
  test(\`\${c.title} × \${c.qty} → итог \${c.total}\`, async ({ page }) => {
    await page.goto('/');
    const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: c.title, exact: true }) });
    // TODO: нажмите «В корзину» c.qty раз, после каждого клика дождитесь счётчика корзины
    await card.getByRole('button', { name: 'В корзину' }).click();
    await page.goto('/cart');
    await expect(page.getByTestId('cart-total')).toHaveText(c.total);
  });
}
`,
    solution: `import { test, expect } from '@playwright/test';

const cases = [
  { title: 'Блокнот A5', qty: 2, total: '780 ₽' },
  { title: 'Кабель USB-C', qty: 3, total: '1 770 ₽' },
  { title: 'Кружка', qty: 1, total: '690 ₽' },
];

for (const c of cases) {
  test(\`\${c.title} × \${c.qty} → итог \${c.total}\`, async ({ page }) => {
    await page.goto('/');
    const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: c.title, exact: true }) });
    for (let i = 1; i <= c.qty; i++) {
      await card.getByRole('button', { name: 'В корзину' }).click();
      await expect(page.getByTestId('cart-count')).toHaveText(String(i));
    }
    await page.goto('/cart');
    await expect(page.getByTestId('cart-total')).toHaveText(c.total);
  });
}
`,
    explanation: 'Цикл снаружи объявляет по тесту на строку таблицы; название включает данные строки, поэтому оно уникально и в отчёте видно, какая строка упала. Внутри — второй цикл: клик и ожидание счётчика `String(i)`, чтобы следующий клик не ушёл раньше, чем закончился предыдущий запрос. Строки с количеством 2 и 3 ловят дефект «сумма без количества», строка с количеством 1 показывает его границу. Поиск карточки по точному заголовку выдерживает похожие названия товаров.',
    hints: [
      'Сейчас клик выполняется один раз, а количество в строке таблицы бывает 2 и 3.',
      'Оберните клик в цикл `for (let i = 1; i <= c.qty; i++)` и после каждого клика проверяйте счётчик корзины `page.getByTestId(\'cart-count\')`.',
      '`await card.getByRole(\'button\', { name: \'В корзину\' }).click(); await expect(page.getByTestId(\'cart-count\')).toHaveText(String(i));`',
    ],
    mistakes: [
      'Кликать подряд без ожидания: на медленном магазине кнопка ещё неактивна или предыдущий запрос не завершился.',
      'Перенести цикл по `cases` внутрь одного теста — при падении первой строки остальные не выполнятся, а корзина станет общей для всех строк.',
      'Одинаковое название у всех тестов цикла — Playwright не примет такой файл.',
    ],
    mustPass: ['ok', 'slow', 'similar-names', 'markup-change'],
    mustFail: ['cart-not-add', 'wrong-total'],
  },
  {
    id: 'm6-api-order',
    lesson: 'pw-api',
    kind: 'pw',
    title: 'API-тест создания заказа: статус, JSON, владелец',
    goal: 'Допишите проверки ответа `POST /api/orders`: код `201`, в JSON — `userId` Бориса, `status: "new"`, `total` — **число** `780`. Затем прочитайте заказ через `GET /api/orders/:id` и убедитесь, что он сохранён за Борисом. Тест должен падать на трёх дефектах API: неверный код, `total` строкой, заказ записан другому пользователю.',
    starter: `import { test, expect } from '@playwright/test';

test('POST /api/orders создаёт заказ вошедшего пользователя', async ({ request }) => {
  // подготовка через API: вход Бориса и товар в корзине
  const login = await request.post('/api/login', { data: { email: 'boris@example.test', password: 'learn-123' } });
  expect(login.status()).toBe(200);
  const user = await login.json();
  await request.post('/api/cart', { data: { productId: 3, qty: 2 } });

  const res = await request.post('/api/orders');
  expect(res.status()).toBe(200); // TODO: какой код означает «создано»?
  // TODO: проверьте JSON: userId Бориса, status 'new', total — число 780.
  // TODO: прочитайте заказ через GET /api/orders/:id и убедитесь, что он принадлежит Борису.
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('POST /api/orders создаёт заказ вошедшего пользователя', async ({ request }) => {
  // подготовка через API: вход Бориса и товар в корзине
  const login = await request.post('/api/login', { data: { email: 'boris@example.test', password: 'learn-123' } });
  expect(login.status()).toBe(200);
  const user = await login.json();
  await request.post('/api/cart', { data: { productId: 3, qty: 2 } });

  // действие
  const res = await request.post('/api/orders');
  expect(res.status()).toBe(201);
  const order = await res.json();
  expect(order).toMatchObject({ userId: user.id, status: 'new', total: 780 });
  expect(typeof order.total).toBe('number');

  // заказ действительно принадлежит Борису: он может его прочитать
  const saved = await request.get(\`/api/orders/\${order.id}\`);
  expect(saved.status()).toBe(200);
  expect((await saved.json()).userId).toBe(user.id);
});
`,
    explanation: 'Проверка идёт слоями. Точный код `201` отличает «создано» от просто «успешно». `toMatchObject` сравнивает нужные поля и тип: число `780` не равно строке `"780.00"`. Последний слой — побочный эффект: ответ на создание — заявление сервера, а `GET /api/orders/:id` показывает, за кем заказ записан на самом деле (чужому пользователю магазин отвечает `403`). Fixture `request` хранит cookies между запросами, поэтому все запросы идут от имени Бориса.',
    hints: [
      'Код «создано» — не 200. И одного кода мало: проверьте тело ответа и то, что заказ действительно сохранён.',
      '`const order = await res.json()` и `expect(order).toMatchObject({ … })`; потом `request.get(\'/api/orders/\' + order.id)` — владелец получает 200.',
      '`expect(res.status()).toBe(201); expect(order).toMatchObject({ userId: user.id, status: \'new\', total: 780 }); const saved = await request.get(\'/api/orders/\' + order.id); expect(saved.status()).toBe(200);`',
    ],
    mistakes: [
      '`expect(res.ok()).toBeTruthy()` — пропустит 200 вместо 201.',
      'Проверять `total` через `toBeTruthy()` или `Number(order.total)` — строка `"780.00"` пройдёт.',
      'Доверять `userId` из ответа на создание: дефект «не тот пользователь» виден только при чтении сохранённого заказа.',
    ],
    alternatives: [
      'Проверить владельца запросом к учебной базе: `request.post(\'/__test/sql\', { data: { sql: \'select user_id from orders where id = $1\', params: [order.id] } })`.',
    ],
    mustPass: ['ok'],
    mustFail: ['api-status', 'api-json', 'order-user'],
  },
  {
    id: 'm6-mock-error',
    lesson: 'pw-mocks',
    kind: 'pw',
    title: 'Подменить ошибку сервера и не потерять проверку настоящего',
    goal: 'В первом тесте перехватите `**/api/cart` и ответьте статусом `500` с JSON `{ error: "склад недоступен" }` — страница должна показать «Ошибка: склад недоступен». Во втором тесте, без подмены, проверьте сообщение «Добавлено: Блокнот A5» и счётчик корзины `1`. Набор должен падать, если на настоящем сервере товар не добавляется.',
    starter: `import { test, expect } from '@playwright/test';

test('ошибка сервера при добавлении показывается пользователю', async ({ page }) => {
  // TODO: перехватите запросы к **/api/cart и ответьте статусом 500
  //       с JSON { error: 'склад недоступен' }
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('status')).toHaveText('Ошибка: склад недоступен');
});

test('без подмены товар действительно добавляется', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  // TODO: проверьте сообщение «Добавлено: Блокнот A5» и счётчик корзины
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('ошибка сервера при добавлении показывается пользователю', async ({ page }) => {
  await page.route('**/api/cart', (route) =>
    route.fulfill({ status: 500, json: { error: 'склад недоступен' } }));
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('status')).toHaveText('Ошибка: склад недоступен');
});

test('без подмены товар действительно добавляется', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('status')).toHaveText('Добавлено: Блокнот A5');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
`,
    explanation: '`page.route` ставится до клика, и запрос к `/api/cart` не доходит до сервера: `route.fulfill` отвечает вместо него. Так проверяется реакция интерфейса на ошибку, которую трудно получить на настоящем сервере. Этот тест пройдёт и на сломанной корзине — сервер в нём не участвует. Поэтому второй тест без подмены обязателен: только он ловит дефект «товар не добавляется».',
    hints: [
      'Перехват нужно поставить до действия, которое отправляет запрос. Во втором тесте сейчас нет ни одной проверки.',
      '`page.route(\'**/api/cart\', (route) => route.fulfill({ status: 500, json: { … } }))`. Во втором тесте — `getByRole(\'status\')` и `getByTestId(\'cart-count\')`.',
      '`await page.route(\'**/api/cart\', (route) => route.fulfill({ status: 500, json: { error: \'склад недоступен\' } }));`',
    ],
    mistakes: [
      'Поставить `page.route` после клика — запрос уже ушёл на сервер.',
      'Подменить ответ и во втором тесте — тогда ни один тест не проверит настоящий сервер.',
      '`route.abort()` вместо ответа с ошибкой — страница получит сетевой сбой, а не ответ `500`, и сообщения не покажет.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add'],
  },
  {
    id: 'm6-pom-cart',
    lesson: 'pw-pom',
    kind: 'pw',
    title: 'Page Object каталога: метод add',
    goal: 'Допишите метод `CatalogPage.add(title)`: найти карточку товара по **точному** заголовку, нажать «В корзину» и дождаться, пока счётчик корзины увеличится на 1. Тест должен проходить на новой вёрстке и при похожих названиях товаров, а падать — если товар не добавляется или сумма неверна.',
    starter: `import { test, expect, type Page, type Locator } from '@playwright/test';

class CatalogPage {
  readonly cartCount: Locator;
  constructor(private readonly page: Page) {
    this.cartCount = page.getByTestId('cart-count');
  }
  async open() {
    await this.page.goto('/');
  }
  async add(title: string) {
    // TODO: найдите карточку товара по заголовку title, нажмите «В корзину»
    //       и дождитесь, пока счётчик корзины увеличится на 1
  }
}

class CartPage {
  readonly total: Locator;
  constructor(private readonly page: Page) {
    this.total = page.getByTestId('cart-total');
  }
  async open() {
    await this.page.getByRole('link', { name: /Корзина/ }).click();
  }
}

test('два блокнота и кабель — итог 1 370 ₽', async ({ page }) => {
  const catalog = new CatalogPage(page);
  const cart = new CartPage(page);
  await catalog.open();
  await catalog.add('Блокнот A5');
  await catalog.add('Блокнот A5');
  await catalog.add('Кабель USB-C');
  await cart.open();
  await expect(cart.total).toHaveText('1 370 ₽');
});
`,
    solution: `import { test, expect, type Page, type Locator } from '@playwright/test';

class CatalogPage {
  readonly cartCount: Locator;
  constructor(private readonly page: Page) {
    this.cartCount = page.getByTestId('cart-count');
  }
  async open() {
    await this.page.goto('/');
  }
  async add(title: string) {
    const before = Number(await this.cartCount.textContent());
    const card = this.page.getByRole('listitem').filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
    await card.getByRole('button', { name: 'В корзину' }).click();
    await expect(this.cartCount).toHaveText(String(before + 1));
  }
}

class CartPage {
  readonly total: Locator;
  constructor(private readonly page: Page) {
    this.total = page.getByTestId('cart-total');
  }
  async open() {
    await this.page.getByRole('link', { name: /Корзина/ }).click();
  }
}

test('два блокнота и кабель — итог 1 370 ₽', async ({ page }) => {
  const catalog = new CatalogPage(page);
  const cart = new CartPage(page);
  await catalog.open();
  await catalog.add('Блокнот A5');
  await catalog.add('Блокнот A5');
  await catalog.add('Кабель USB-C');
  await cart.open();
  await expect(cart.total).toHaveText('1 370 ₽');
});
`,
    explanation: 'Метод принимает данные (название), а не локатор: тест не знает, как устроена карточка. Карточка ищется по роли и точному заголовку, поэтому новая вёрстка и похожие названия ему не мешают. Ожидание счётчика — признак завершения действия: следующий `add` не начнётся, пока не закончился предыдущий запрос. Проверка требования (итог `1 370 ₽`) осталась в тесте.',
    hints: [
      'Метод `add` сейчас ничего не делает. Ему нужно найти карточку, нажать кнопку и дождаться результата.',
      'Запомните текущее значение счётчика (`Number(await this.cartCount.textContent())`), найдите карточку через `filter({ has: getByRole(\'heading\', { name: title, exact: true }) })`, кликните и ждите `before + 1`.',
      '`await card.getByRole(\'button\', { name: \'В корзину\' }).click(); await expect(this.cartCount).toHaveText(String(before + 1));`',
    ],
    mistakes: [
      'Искать карточку по `hasText: title` — «Наушники Pulse» совпадут с «Наушники Pulse Pro Max».',
      'Не ждать счётчик после клика — второй клик по тому же товару может прийти раньше, чем закончился первый запрос.',
      'Перенести проверку итога в Page Object — тест перестанет показывать, что он проверяет.',
    ],
    alternatives: [
      'Хранить ожидаемое количество в поле объекта (`this.added++`) вместо чтения счётчика перед кликом.',
    ],
    mustPass: ['ok', 'slow', 'similar-names', 'markup-change'],
    mustFail: ['cart-not-add', 'wrong-total'],
  },
  {
    id: 'm6-parallel-two-users',
    lesson: 'pw-parallel',
    kind: 'pw',
    title: 'Два покупателя одновременно: корзины не должны смешиваться',
    goal: 'Создайте второй контекст браузера для Бориса. После того как Анна положила блокнот в корзину, откройте каталог от имени Бориса и проверьте, что его счётчик корзины — `0`. Тест должен падать, если магазин держит одну корзину на всех.',
    starter: `import { test, expect } from '@playwright/test';

test('у двух покупателей разные корзины', async ({ browser }) => {
  const anna = await browser.newContext();
  const annaPage = await anna.newPage();
  // TODO: создайте второй контекст для Бориса и страницу в нём

  await annaPage.goto('/');
  await annaPage.getByRole('listitem').filter({ hasText: 'Блокнот A5' })
    .getByRole('button', { name: 'В корзину' }).click();
  await expect(annaPage.getByTestId('cart-count')).toHaveText('1');

  // TODO: откройте каталог от имени Бориса и проверьте, что его корзина пуста
  await expect(annaPage.getByTestId('cart-count')).toHaveText('0');

  await anna.close();
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('у двух покупателей разные корзины', async ({ browser }) => {
  const anna = await browser.newContext();
  const boris = await browser.newContext();
  const annaPage = await anna.newPage();
  const borisPage = await boris.newPage();

  await annaPage.goto('/');
  await annaPage.getByRole('listitem').filter({ hasText: 'Блокнот A5' })
    .getByRole('button', { name: 'В корзину' }).click();
  await expect(annaPage.getByTestId('cart-count')).toHaveText('1');

  await borisPage.goto('/');
  await expect(borisPage.getByTestId('cart-count')).toHaveText('0');

  await anna.close();
  await boris.close();
});
`,
    explanation: '`browser.newContext()` создаёт независимого посетителя: свои cookies, своя сессия, а `baseURL` берётся из конфигурации. Два контекста в одном тесте — явная проверка изоляции данных между пользователями: параллельные тесты с разными аккаунтами полагаются именно на неё. На варианте «одна корзина на всех» Борис видит товар Анны, и тест падает. Контексты, созданные вручную, закрывают в конце теста.',
    hints: [
      'Сейчас вторая проверка снова смотрит на страницу Анны. Нужен второй, независимый посетитель.',
      '`const boris = await browser.newContext(); const borisPage = await boris.newPage();` — затем `borisPage.goto(\'/\')`.',
      '`await borisPage.goto(\'/\'); await expect(borisPage.getByTestId(\'cart-count\')).toHaveText(\'0\');`',
    ],
    mistakes: [
      'Открыть вторую страницу в том же контексте (`anna.newPage()`) — у неё те же cookies, это тот же покупатель.',
      'Проверить Бориса до того, как Анна добавила товар, — дефект общей корзины не проявится.',
      'Не закрыть созданные вручную контексты — они живут до конца worker.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['shared-cart'],
  },
  {
    id: 'm6-debug-report',
    lesson: 'pw-debug',
    kind: 'ts',
    title: 'Найти упавшие тесты в JSON-отчёте',
    goal: 'Напишите `failures(report)`: обойдите `suites` (включая вложенные), для каждого теста возьмите **последнюю** попытку из `results` и верните упавшие (статус не `passed` и не `skipped`) в виде `{ title, where: "файл:строка", error: первая строка сообщения }`. Тест, прошедший со второй попытки, упавшим не считается.',
    starter: `// Упрощённая форма JSON-отчёта Playwright (reporter: 'json')
export interface JsonResult { status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'; retry: number; error?: { message: string } }
export interface JsonTest { status: 'expected' | 'unexpected' | 'flaky' | 'skipped'; results: JsonResult[] }
export interface JsonSpec { title: string; file: string; line: number; tests: JsonTest[] }
export interface JsonSuite { title: string; specs: JsonSpec[]; suites?: JsonSuite[] }
export interface JsonReport { suites: JsonSuite[] }
export interface Failure { title: string; where: string; error: string }

export function failures(report: JsonReport): Failure[] {
  const out: Failure[] = [];
  // TODO: обойдите report.suites (и вложенные suites), для каждого теста возьмите
  //       последнюю попытку из results и соберите упавшие
  return out;
}
`,
    solution: `// Упрощённая форма JSON-отчёта Playwright (reporter: 'json')
export interface JsonResult { status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'; retry: number; error?: { message: string } }
export interface JsonTest { status: 'expected' | 'unexpected' | 'flaky' | 'skipped'; results: JsonResult[] }
export interface JsonSpec { title: string; file: string; line: number; tests: JsonTest[] }
export interface JsonSuite { title: string; specs: JsonSpec[]; suites?: JsonSuite[] }
export interface JsonReport { suites: JsonSuite[] }
export interface Failure { title: string; where: string; error: string }

export function failures(report: JsonReport): Failure[] {
  const out: Failure[] = [];
  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs) {
      for (const t of spec.tests) {
        const last = t.results[t.results.length - 1];
        if (!last || last.status === 'passed' || last.status === 'skipped') continue;
        out.push({ title: spec.title, where: \`\${spec.file}:\${spec.line}\`, error: (last.error?.message ?? '').split('\\n')[0] });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const s of report.suites) walk(s);
  return out;
}
`,
    check: `import { failures, type JsonReport } from './student';

const ok = { status: 'expected' as const, results: [{ status: 'passed' as const, retry: 0 }] };
const report: JsonReport = {
  suites: [
    {
      title: 'cart.spec.ts',
      specs: [
        { title: 'итог корзины', file: 'cart.spec.ts', line: 12, tests: [{ status: 'unexpected', results: [{ status: 'failed', retry: 0, error: { message: 'expect(locator).toHaveText(expected) failed\\n\\nExpected: "780 ₽"\\nReceived: "390 ₽"' } }] }] },
        { title: 'счётчик корзины', file: 'cart.spec.ts', line: 4, tests: [ok] },
      ],
      suites: [
        {
          title: 'оформление заказа',
          specs: [
            { title: 'заказ без входа', file: 'cart.spec.ts', line: 30, tests: [{ status: 'skipped', results: [{ status: 'skipped', retry: 0 }] }] },
            { title: 'заказ после входа', file: 'cart.spec.ts', line: 40, tests: [{ status: 'unexpected', results: [{ status: 'timedOut', retry: 0, error: { message: 'Test timeout of 10000ms exceeded.' } }] }] },
          ],
          suites: [],
        },
      ],
    },
    {
      title: 'api.spec.ts',
      specs: [
        { title: 'POST /api/orders', file: 'api.spec.ts', line: 7, tests: [{ status: 'flaky', results: [{ status: 'failed', retry: 0, error: { message: 'socket hang up' } }, { status: 'passed', retry: 1 }] }] },
        { title: 'GET /api/orders/:id', file: 'api.spec.ts', line: 20, tests: [{ status: 'unexpected', results: [{ status: 'failed', retry: 0, error: { message: 'first' } }, { status: 'failed', retry: 1, error: { message: 'Expected: 200\\nReceived: 403' } }] }] },
      ],
    },
  ],
};

test('пустой отчёт — нет падений', () => expectEq(failures({ suites: [] }), []));
test('все прошли — нет падений', () => expectEq(failures({ suites: [{ title: 'a.spec.ts', specs: [{ title: 'x', file: 'a.spec.ts', line: 1, tests: [ok] }] }] }), []));
test('находит упавшие, включая вложенные describe и timedOut', () => expectEq(failures(report).map((f) => f.title), ['итог корзины', 'заказ после входа', 'GET /api/orders/:id']));
test('место — файл:строка', () => expectEq(failures(report).map((f) => f.where), ['cart.spec.ts:12', 'cart.spec.ts:40', 'api.spec.ts:20']));
test('ошибка — первая строка сообщения последней попытки', () => expectEq(failures(report).map((f) => f.error), ['expect(locator).toHaveText(expected) failed', 'Test timeout of 10000ms exceeded.', 'Expected: 200']));
test('тест, прошедший со второй попытки (flaky), не считается упавшим', () => expectTrue(!failures(report).some((f) => f.title === 'POST /api/orders'), 'flaky-тест попал в список упавших'));
`,
    explanation: 'Отчёт — дерево: `describe` превращается во вложенный `suite`, поэтому обход рекурсивный. Решение о тесте принимает последняя попытка: если повтор прошёл, тест flaky, а не упавший. `timedOut` и `interrupted` — тоже падения. Первая строка сообщения Playwright обычно уже говорит, какая проверка не прошла; остальное (ожидаемое, полученное, call log) нужно при разборе.',
    hints: [
      'Наборы вкладываются друг в друга: `describe` внутри файла — это `suites` внутри `suite`. Нужен обход всего дерева.',
      'Рекурсивная функция `walk(suite)`: цикл по `suite.specs` и их `tests`, потом `walk` для каждого `suite.suites ?? []`. Последняя попытка — `t.results[t.results.length - 1]`.',
      '`if (!last || last.status === \'passed\' || last.status === \'skipped\') continue; out.push({ title: spec.title, where: spec.file + \':\' + spec.line, error: (last.error?.message ?? \'\').split(\'\\n\')[0] });`',
    ],
    mistakes: [
      'Смотреть на первую попытку — flaky-тест попадёт в список упавших.',
      'Обходить только верхний уровень `suites` — тесты внутри `describe` потеряются.',
      'Проверять `status === \'failed\'` — пропустит `timedOut`.',
    ],
    alternatives: [
      'Использовать поле `test.status === \'unexpected\'`, которое Playwright уже вычислил по всем попыткам.',
    ],
  },
  {
    id: 'm6-visual-diff',
    lesson: 'pw-visual',
    kind: 'ts',
    title: 'Модель сравнения снимков: threshold и допуски',
    goal: 'Напишите `compareSnapshots(expected, actual, opts)` для снимков-массивов яркостей 0…255. Пиксель отличается, если `|a − b| / 255 > threshold`. Допустимое число отличий — меньшее из `maxDiffPixels` и `maxDiffPixelRatio × число пикселей` (без допусков — 0). Снимки разного размера никогда не совпадают (`diffPixels: -1`).',
    starter: `// Снимок упрощённо — двумерный массив яркостей пикселей 0…255.
export type Image = number[][];
export interface CompareOptions { threshold: number; maxDiffPixels?: number; maxDiffPixelRatio?: number }
export interface CompareResult { pass: boolean; diffPixels: number }

export function compareSnapshots(expected: Image, actual: Image, opts: CompareOptions): CompareResult {
  // TODO: проверьте размеры, посчитайте отличающиеся пиксели с учётом threshold
  //       и сравните их число с допуском maxDiffPixels / maxDiffPixelRatio
  return { pass: true, diffPixels: 0 };
}
`,
    solution: `// Снимок упрощённо — двумерный массив яркостей пикселей 0…255.
export type Image = number[][];
export interface CompareOptions { threshold: number; maxDiffPixels?: number; maxDiffPixelRatio?: number }
export interface CompareResult { pass: boolean; diffPixels: number }

export function compareSnapshots(expected: Image, actual: Image, opts: CompareOptions): CompareResult {
  const sameSize = expected.length === actual.length && expected.every((row, y) => row.length === actual[y].length);
  if (!sameSize) return { pass: false, diffPixels: -1 };
  let diffPixels = 0;
  let total = 0;
  for (let y = 0; y < expected.length; y++) {
    for (let x = 0; x < expected[y].length; x++) {
      total++;
      if (Math.abs(expected[y][x] - actual[y][x]) / 255 > opts.threshold) diffPixels++;
    }
  }
  const limits: number[] = [];
  if (opts.maxDiffPixels !== undefined) limits.push(opts.maxDiffPixels);
  if (opts.maxDiffPixelRatio !== undefined) limits.push(opts.maxDiffPixelRatio * total);
  const allowed = limits.length ? Math.min(...limits) : 0;
  return { pass: diffPixels <= allowed, diffPixels };
}
`,
    check: `import { compareSnapshots } from './student';

const base = [[10, 10, 10, 10], [10, 200, 200, 10], [10, 10, 10, 10]]; // 12 пикселей
const aa = [[12, 10, 10, 10], [10, 196, 200, 10], [10, 10, 10, 13]];   // мелкий шум сглаживания
const moved = [[10, 10, 10, 10], [10, 10, 200, 200], [10, 10, 10, 10]]; // кнопка сдвинулась на пиксель

test('одинаковые снимки совпадают', () => expectEq(compareSnapshots(base, base, { threshold: 0.2 }), { pass: true, diffPixels: 0 }));
test('шум меньше threshold не считается отличием', () => expectEq(compareSnapshots(base, aa, { threshold: 0.2 }), { pass: true, diffPixels: 0 }));
test('без допуска любое отличие — падение', () => expectEq(compareSnapshots(base, moved, { threshold: 0.2 }), { pass: false, diffPixels: 2 }));
test('threshold 0 замечает даже шум', () => expectEq(compareSnapshots(base, aa, { threshold: 0 }).diffPixels, 3));
test('maxDiffPixels: 2 пропускает 2 отличия', () => expectEq(compareSnapshots(base, moved, { threshold: 0.2, maxDiffPixels: 2 }).pass, true));
test('maxDiffPixels: 1 не пропускает 2 отличия', () => expectEq(compareSnapshots(base, moved, { threshold: 0.2, maxDiffPixels: 1 }).pass, false));
test('maxDiffPixelRatio считается от числа пикселей', () => {
  expectEq(compareSnapshots(base, moved, { threshold: 0.2, maxDiffPixelRatio: 0.2 }).pass, true);   // 2 из 12 ≈ 0.17
  expectEq(compareSnapshots(base, moved, { threshold: 0.2, maxDiffPixelRatio: 0.1 }).pass, false);  // допуск 1.2 пикселя
});
test('если заданы оба допуска, действует более строгий', () => expectEq(compareSnapshots(base, moved, { threshold: 0.2, maxDiffPixels: 5, maxDiffPixelRatio: 0.1 }).pass, false));
test('другой размер снимка — всегда падение', () => expectEq(compareSnapshots(base, [[10, 10], [10, 10]], { threshold: 0.2, maxDiffPixels: 100 }).pass, false));
`,
    explanation: 'Две ступени, как в `toHaveScreenshot`: сначала `threshold` решает, считать ли отдельный пиксель отличием (так отсекается шум сглаживания), затем число отличий сравнивается с допуском. Если заданы оба допуска, действует более строгий; если ни одного — допуск ноль. Разный размер — всегда падение: сравнивать попиксельно нечего. Модель упрощённая: Playwright сравнивает цвет в пространстве YIQ, а не яркость.',
    hints: [
      'Сначала размеры, потом подсчёт отличающихся пикселей, потом сравнение с допуском.',
      'Двойной цикл по строкам и столбцам; отличие — `Math.abs(e - a) / 255 > opts.threshold`. Допуски соберите в массив и возьмите `Math.min`, пустой массив — 0.',
      '`const allowed = limits.length ? Math.min(...limits) : 0; return { pass: diffPixels <= allowed, diffPixels };`',
    ],
    mistakes: [
      'Сравнивать `>=` с threshold вместо `>` — пиксель на границе допуска станет отличием.',
      'Брать больший из двух допусков — тест станет мягче, чем задумано.',
      'Не проверять размеры — при разной ширине цикл обратится к несуществующим пикселям.',
    ],
  },
  {
    id: 'm6-ci-gate',
    lesson: 'pw-ci',
    kind: 'ts',
    title: 'Ворота качества по сводке отчёта',
    goal: 'Допишите `qualityGate(stats, maxFlaky)`: вернуть `exitCode: 1`, если есть упавшие (`unexpected > 0`), если не выполнено ни одного теста (только пропущенные или ничего) или если нестабильных (`flaky`) больше `maxFlaky`; иначе `exitCode: 0`. В `reason` — короткое объяснение.',
    starter: `// stats из JSON-отчёта Playwright
export interface Stats { expected: number; unexpected: number; flaky: number; skipped: number }
export interface Gate { exitCode: 0 | 1; reason: string }

export function qualityGate(stats: Stats, maxFlaky: number): Gate {
  // TODO: красный, если есть упавшие, если ничего не выполнилось
  //       или нестабильных больше допустимого
  if (stats.unexpected > 0) return { exitCode: 1, reason: \`упало тестов: \${stats.unexpected}\` };
  return { exitCode: 0, reason: 'ok' };
}
`,
    solution: `// stats из JSON-отчёта Playwright
export interface Stats { expected: number; unexpected: number; flaky: number; skipped: number }
export interface Gate { exitCode: 0 | 1; reason: string }

export function qualityGate(stats: Stats, maxFlaky: number): Gate {
  if (stats.unexpected > 0) return { exitCode: 1, reason: \`упало тестов: \${stats.unexpected}\` };
  if (stats.expected + stats.flaky === 0) return { exitCode: 1, reason: 'не выполнено ни одного теста' };
  if (stats.flaky > maxFlaky) return { exitCode: 1, reason: \`нестабильных тестов \${stats.flaky}, допустимо \${maxFlaky}\` };
  return { exitCode: 0, reason: 'ok' };
}
`,
    check: `import { qualityGate } from './student';

test('всё зелёное — 0', () => expectEq(qualityGate({ expected: 40, unexpected: 0, flaky: 0, skipped: 2 }, 0).exitCode, 0));
test('есть упавший — 1', () => expectEq(qualityGate({ expected: 39, unexpected: 1, flaky: 0, skipped: 0 }, 5).exitCode, 1));
test('ни одного выполненного теста — 1', () => expectEq(qualityGate({ expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, 0).exitCode, 1));
test('только пропущенные — тоже 1', () => expectEq(qualityGate({ expected: 0, unexpected: 0, flaky: 0, skipped: 12 }, 0).exitCode, 1));
test('flaky в пределах допуска — 0', () => expectEq(qualityGate({ expected: 38, unexpected: 0, flaky: 2, skipped: 0 }, 2).exitCode, 0));
test('flaky больше допуска — 1', () => expectEq(qualityGate({ expected: 37, unexpected: 0, flaky: 3, skipped: 0 }, 2).exitCode, 1));
test('только flaky-тесты, допуск позволяет — 0', () => expectEq(qualityGate({ expected: 0, unexpected: 0, flaky: 1, skipped: 0 }, 1).exitCode, 0));
test('reason непустой при красном результате', () => expectTrue(qualityGate({ expected: 1, unexpected: 2, flaky: 0, skipped: 0 }, 0).reason.length > 0, 'reason пустой'));
`,
    explanation: 'Три правила ворот: упавшие тесты, пустой прогон и нестабильность. Пустой прогон опасен тем, что выглядит зелёным: опечатка в фильтре — и ни один тест не выполнился. Выполненными считаются `expected` и `flaky` (flaky тоже выполнился и в итоге прошёл); пропущенные тесты ничего не проверили. Порог `maxFlaky` позволяет команде постепенно снижать нестабильность вместо мгновенного запрета.',
    hints: [
      'Сейчас проверено только первое правило. Подумайте, какой прогон «зелёный», но ничего не доказал.',
      'Выполненные тесты — `expected + flaky`; если их 0, ворота закрыты. Отдельно сравните `stats.flaky` с `maxFlaky`.',
      '`if (stats.expected + stats.flaky === 0) return { exitCode: 1, reason: \'не выполнено ни одного теста\' }; if (stats.flaky > maxFlaky) return { exitCode: 1, reason: \'много нестабильных\' };`',
    ],
    mistakes: [
      'Считать выполненными `skipped` — прогон из одних пропусков пройдёт ворота.',
      'Сравнивать `flaky >= maxFlaky` — допуск 2 перестанет пропускать ровно 2 нестабильных теста.',
    ],
  },
];
export default ex;
