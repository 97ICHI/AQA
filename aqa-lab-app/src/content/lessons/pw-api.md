:::why
Через интерфейс проверяют то, что видит пользователь. Но подготовку данных и проверку ответа сервера удобнее делать напрямую через HTTP: это в десятки раз быстрее и не зависит от вёрстки. Playwright умеет отправлять HTTP-запросы тем же инструментом, которым вы пишете UI-тесты, и проверять ответ: код статуса, JSON, побочные эффекты.
:::

## HTTP-клиент Playwright

[[api-request-context|APIRequestContext]] — HTTP-клиент Playwright. Его можно получить тремя способами:

| Откуда | Что делит |
|---|---|
| fixture `request` | отдельный клиент теста: свои cookies, `baseURL` из конфигурации |
| `page.request` | cookies с контекстом страницы: вошли через API — страница тоже «вошедшая» |
| `playwright.request.newContext()` | клиент, созданный вручную (например, в `beforeAll`) |

Методы повторяют [[http-method|HTTP-методы]]: `get`, `post`, `put`, `patch`, `delete`, `fetch`. Тело JSON передаётся опцией `data`, параметры строки запроса — `params`. В ответ приходит `APIResponse`: `status()`, `ok()`, `headers()`, `json()`, `text()`.

## Слои проверки ответа

[[response-validation|Проверка ответа]] идёт слоями, от общего к частному:

1. **код статуса** — `201 Created` для создания, а не просто «успех»;
2. **структура и типы** — нужные поля есть, `total` — число, а не строка;
3. **значения** — сумма, статус, владелец заказа;
4. **побочный эффект** — заказ действительно сохранён и принадлежит нужному пользователю.

```ts tests/api/orders.spec.ts
import { test, expect } from '@playwright/test';

test('заказ: статус 201 и total — число', async ({ request }) => {
  await request.post('/api/login', { data: { email: 'anna@example.test', password: 'learn-123' } });
  await request.post('/api/cart', { data: { productId: 5, qty: 2 } });

  const res = await request.post('/api/orders');
  expect(res.status()).toBe(201);
  const order = await res.json();
  expect(order).toMatchObject({ status: 'new', total: 1180 });
  expect(order.items).toEqual([{ productId: 5, qty: 2 }]);
});
```

Fixture `request` хранит cookies между запросами одного теста. Поэтому после `POST /api/login` следующие запросы идут от имени Анны.

`toMatchObject` сравнивает только перечисленные поля и не падает из-за лишних (`id`, `userId`, `totalText`). `toEqual` сравнивает целиком — подходит для `items`, где важен весь массив. Сравнение строгое по типу: число `1180` не равно строке `'1180.00'`.

:::try Запустите на магазине с дефектом
В этом варианте API отдаёт `total` строкой. Человек на странице разницы не заметит, а клиент, который складывает суммы, — заметит.
:::

```widget
{"type":"playground","lang":"pw","title":"API: total пришёл строкой","variant":"api-json","code":"import { test, expect } from '@playwright/test';\n\ntest('заказ: статус 201 и total — число', async ({ request }) => {\n  await request.post('/api/login', { data: { email: 'anna@example.test', password: 'learn-123' } });\n  await request.post('/api/cart', { data: { productId: 5, qty: 2 } });\n\n  const res = await request.post('/api/orders');\n  expect(res.status()).toBe(201);\n  const order = await res.json();\n  expect(order).toMatchObject({ status: 'new', total: 1180 });\n  expect(order.items).toEqual([{ productId: 5, qty: 2 }]);\n});\n","recorded":{"variant":"Дефект: total в JSON заказа — строка, а не число","output":"Магазин: Дефект: total в JSON заказа — строка, а не число\n✗ заказ: статус 201 и total — число (54 мс)\nError: expect(received).toMatchObject(expected)\n\n- Expected  - 1\n+ Received  + 1\n\n  Object {\n    \"status\": \"new\",\n-   \"total\": 1180,\n+   \"total\": \"1180.00\",\n  }"}}
```

:::happened
Статус `201` верный, проверка статуса прошла. Упала проверка значений: ожидалось число `1180`, пришла строка `"1180.00"`. Дефект «не тот тип в JSON» опасен тем, что интерфейс выглядит нормально: строка отображается как сумма. Ломаются клиенты, которые делают с полем вычисления: `"1180.00" + 100` в JavaScript даёт `"1180.00100"`.
:::

## Ваш API-тест

Проверьте создание заказа целиком: код статуса, JSON и то, что заказ сохранён за вошедшим пользователем. Для проверки владельца прочитайте заказ: `GET /api/orders/:id` отвечает `200` только владельцу, чужому пользователю — `403`.

```widget
{"type":"exercise","id":"m6-api-order"}
```

## UI + API в одном тесте

Самая полезная комбинация: **подготовка через API, проверка через интерфейс** (или наоборот). `page.request` делит cookies со страницей:

```ts tests/cart.spec.ts
test('корзина показывает товар, добавленный через API', async ({ page }) => {
  await page.request.post('/api/cart', { data: { productId: 6, qty: 1 } });
  await page.goto('/cart');
  await expect(page.getByRole('cell', { name: 'Кружка' })).toBeVisible();
});
```

Обратная схема — действие через интерфейс, проверка через API: нажали «Оформить заказ», затем `GET /api/orders/:id` подтверждает, что заказ записан с правильной суммой.

:::mistake Проверить только `res.ok()`
`ok()` истинно для любого кода 200–299. Тест с `expect(res.ok()).toBeTruthy()` не заметит, что создание вернуло `200` вместо `201`, и ничего не скажет о теле ответа. Проверяйте точный код и поля.
:::

:::deep Почему проверка владельца — отдельный запрос
Ответ на `POST /api/orders` формирует сервер, и он может «сказать» правильный `userId`, а в базу записать другой. Так устроен дефект `order-user` в учебном магазине: ответ выглядит верно, а заказ сохранён за другим пользователем. Ловит его только проверка побочного эффекта: прочитать заказ отдельным запросом или запросом к тестовой базе. Это общее правило: ответ API — заявление сервера, а состояние системы — факт.
:::

:::tech Настройки клиента
`request` берёт `baseURL` и `extraHTTPHeaders` из `use` в конфигурации. Заголовок авторизации для всех запросов задают там же: `use: { extraHTTPHeaders: { Authorization: 'Bearer ' + process.env.API_TOKEN } }`. Для ответа с ошибкой `request` не бросает исключение: `404` или `500` — обычный ответ, который нужно проверить. Опция `failOnStatusCode: true` в запросе меняет это поведение. Для проверки «код 2xx» есть `await expect(res).toBeOK()`.
:::

:::interview
**Вопрос:** «Что проверить в ответе на создание заказа?» **Ответ по сути:** слоями — точный код (`201`), структуру и типы полей, значения (сумма, статус, владелец) и побочный эффект: заказ читается отдельным запросом и принадлежит нужному пользователю. Подготовку данных для UI-тестов делаю через API (`page.request` делит cookies со страницей), чтобы UI-тест проверял только интерфейс.
:::

:::terms
[[api-request-context]], [[http-method]], [[status-code]], [[response-validation]], [[json]], [[api-testing]]
:::
