:::why
Почти каждому тесту что-то нужно до начала: открытая страница, вошедший пользователь, товар в корзине. Если копировать эту подготовку в каждый тест, код разрастается, а уборку после теста легко забыть. Hooks и fixtures дают одно место для подготовки и уборки — и делают тесты короче и надёжнее.
:::

## Подготовка и уборка

У теста обычно три части: подготовить состояние, выполнить проверяемое действие, убрать за собой. Первую и третью называют [[setup-teardown|setup и teardown]]. В Playwright Test для них есть два механизма:

- [[hook|hooks]] — функции `test.beforeEach`, `test.afterEach`, `test.beforeAll`, `test.afterAll`. Они выполняются для **всех** тестов файла или группы `test.describe`;
- [[fixture|fixtures]] — именованные ресурсы, которые тест **запрашивает в параметрах**: `async ({ page, request }) => …`. Вы уже пользовались встроенными fixtures `page` и `request`.

## Hooks: общая подготовка для всех тестов файла

```ts tests/cart.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // перед каждым тестом: в корзине один блокнот
  await page.request.post('/api/cart', { data: { productId: 3, qty: 1 } });
  await page.goto('/');
});

test('счётчик корзины показывает 1', async ({ page }) => {
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
```

`page.request` — HTTP-клиент, который делит cookies со страницей. Поэтому товар, добавленный через API, оказывается в корзине того же посетителя, что и страница. Хук получает те же fixtures, что и тест: здесь — `page`, и это **та же самая** страница, которую потом получит тест.

Порядок для двух тестов в одном [[worker|worker]]: `beforeAll → beforeEach → тест 1 → afterEach → beforeEach → тест 2 → afterEach → afterAll`.

:::try Запустите тесты с хуком
Оба теста получают одинаковую подготовку из `beforeEach`. Попробуйте удалить строку с `page.request.post` и запустить снова — оба теста упадут, потому что корзина пуста.
:::

```widget
{"type":"playground","lang":"pw","title":"Hooks: подготовка в beforeEach","variant":"ok","code":"import { test, expect } from '@playwright/test';\n\ntest.beforeEach(async ({ page }) => {\n  // общая подготовка: в корзине уже лежит блокнот\n  await page.request.post('/api/cart', { data: { productId: 3, qty: 1 } });\n  await page.goto('/');\n});\n\ntest('счётчик корзины показывает 1', async ({ page }) => {\n  await expect(page.getByTestId('cart-count')).toHaveText('1');\n});\n\ntest('в корзине один блокнот за 390 ₽', async ({ page }) => {\n  await page.getByRole('link', { name: /Корзина/ }).click();\n  await expect(page.getByTestId('cart-total')).toHaveText('390 ₽');\n});\n","recorded":{"variant":"Исправный магазин","output":"Магазин: Исправный магазин\n✓ счётчик корзины показывает 1 (326 мс)\n✓ в корзине один блокнот за 390 ₽ (280 мс)"}}
```

:::happened
Каждый тест получил **новый** [[browser-context|контекст браузера]] — пустые cookies и пустую корзину. `beforeEach` выполнился дважды, по разу перед каждым тестом, и каждый раз положил блокнот в свою корзину. Тесты не зависят друг от друга: второй можно запустить отдельно, и он пройдёт.
:::

## Fixtures: подготовка по запросу

Хук выполняется для всех тестов блока, даже если части тестов подготовка не нужна. Fixture создаётся, **только если тест её запросил**. Свою fixture объявляют через `test.extend`:

```ts tests/fixtures.ts
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    // setup: всё, что до use()
    await page.goto('/login');
    await page.getByLabel('Email').fill('anna@example.test');
    await page.getByLabel('Пароль').fill('learn-123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByTestId('user-name')).toHaveText('Анна');

    await use(page);          // здесь выполняется тест

    // teardown: всё, что после use()
    await page.goto('/logout');
  },
});
export { expect };
```

Как это читать:

1. `base.extend<{ loggedInPage: Page }>` создаёт **новую функцию `test`**, у которой есть ещё одна fixture. Тип в угловых скобках описывает, что получит тест.
2. Fixture может зависеть от других fixtures: `loggedInPage` запрашивает встроенную `page`.
3. `await use(page)` передаёт значение тесту и ждёт, пока тест закончится.
4. Код после `use()` — teardown. Он выполняется и тогда, когда тест упал на проверке.

Тест просто перечисляет то, что ему нужно:

```ts tests/profile.spec.ts
import { test, expect } from './fixtures';

test('имя видно в корзине', async ({ loggedInPage }) => {
  await loggedInPage.goto('/cart');
  await expect(loggedInPage.getByTestId('user-name')).toHaveText('Анна');
});
```

Обычно fixtures выносят в отдельный файл и импортируют `test` оттуда. В тренажёре весь код — один файл `student.spec.ts`, поэтому fixture объявляется прямо в нём.

:::note Проверка внутри fixture
`expect(…user-name).toHaveText('Анна')` в setup — не лишняя строка. Если вход сломался, тест упадёт сразу с понятным сообщением «не удалось войти», а не где-то дальше на непонятном шаге.
:::

## Ваша fixture

```widget
{"type":"exercise","id":"m6-fixture-login"}
```

## Hooks или fixtures

| | Hooks | Fixtures |
|---|---|---|
| Для каких тестов | для всех тестов блока | только для запросивших |
| Уборка | отдельный `afterEach`, легко забыть | в той же функции после `use()` |
| Повторное использование | копирование между файлами | импорт `test` из общего файла |
| Зависимости | неявные, через порядок | явные: fixture запрашивает fixtures |

Хуки удобны для простой общей подготовки одного файла. Всё, что нужно в нескольких файлах или требует уборки, лучше оформить fixture.

:::mistake Уборка в конце тела теста
Строки уборки в конце теста не выполнятся, если тест упал раньше: оставшиеся данные помешают следующим запускам. Уборка — в teardown fixture (после `use()`) или в `afterEach`.
:::

:::deep Область жизни: test и worker
[[fixture-scope|Область жизни]] fixture задаётся опцией `scope`. По умолчанию `'test'`: значение создаётся заново для каждого теста. С `{ scope: 'worker' }` значение создаётся один раз на процесс-worker и общее для всех его тестов — подходит для дорогих ресурсов, которые тесты не меняют (подключение к тестовой базе, учебный аккаунт «только для чтения»). Worker-fixture не может зависеть от test-fixture: `page` живёт меньше, чем worker.

```ts tests/fixtures.ts
export const test = base.extend<{}, { runId: string }>({
  runId: [async ({}, use) => { await use(`run-${Date.now()}`); }, { scope: 'worker' }],
});
```

Второй параметр типа в `extend<…, …>` описывает worker-fixtures. Опция `{ auto: true }` делает [[auto-fixture|автоматическую fixture]]: она выполняется для каждого теста без запроса — например, чтобы приложить к отчёту логи.
:::

:::tech beforeAll выполняется не один раз
`beforeAll` выполняется **в каждом worker**, где идут тесты файла. А после падения теста Playwright перезапускает worker, и `beforeAll` выполняется снова для оставшихся тестов. Поэтому в `beforeAll` нельзя создавать «единственного» пользователя с фиксированным email: второй запуск упадёт на дубликате. Подробнее — в уроке про [[test-isolation|независимые тесты]].
:::

:::interview
**Вопрос:** «Чем fixture отличается от `beforeEach`?» **Ответ по сути:** хук выполняется для всех тестов блока, fixture — только для тестов, которые её запросили. Fixture держит setup и teardown в одной функции (до и после `use()`), teardown выполняется и при падении, fixtures типизированы, переиспользуются через импорт `test` и явно зависят друг от друга.
:::

:::terms
[[setup-teardown|setup / teardown]], [[hook]], [[fixture]], [[fixture-scope]], [[auto-fixture]], [[browser-context]], [[worker]]
:::
