:::why
Большинству тестов магазина нужен вошедший пользователь. Если каждый тест заполняет форму входа, прогон замедляется, а падение формы роняет сразу все тесты. Playwright умеет войти один раз, сохранить cookies в файл и выдавать каждому тесту уже авторизованный браузер. Важно сделать это так, чтобы тесты не мешали друг другу через общий аккаунт.
:::

## Что хранит вход

После входа сервер выдаёт браузеру [[cookie|cookie]] сессии; в учебном магазине это `sid`. Пока cookie есть в браузере, сервер узнаёт пользователя. Некоторые приложения вместо cookie держат токен в `localStorage`.

[[storage-state|storageState]] — снимок cookies и `localStorage` контекста браузера в формате JSON:

```json anna-state.json
{
  "cookies": [
    { "name": "sid", "value": "3f9c…", "domain": "127.0.0.1", "path": "/",
      "expires": -1, "httpOnly": true, "secure": false, "sameSite": "Lax" }
  ],
  "origins": []
}
```

Если создать новый контекст с этим снимком, браузер сразу «вошедший»: форма входа не нужна.

## Войти один раз и сохранить состояние

Сохранить снимок умеют и контекст браузера, и HTTP-клиент: `context.storageState({ path })`, `request.storageState({ path })`. Подключить — опцией `storageState` в `test.use` или в конфигурации.

```ts tests/orders.spec.ts
import { test, expect } from '@playwright/test';

const STATE = 'anna-state.json';

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await context.request.post('/api/login', {
    data: { email: 'anna@example.test', password: 'learn-123' },
  });
  expect(res.status()).toBe(200);
  await context.storageState({ path: STATE });
  await context.close();
});

test.use({ storageState: STATE });

test('Анна видит своё имя в корзине', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
});
```

Что здесь происходит:

1. `beforeAll` получает worker-fixture `browser` и создаёт временный контекст. Опция `storageState: { cookies: [], origins: [] }` здесь обязательна: `browser.newContext()` в тестах получает настройки из `use`, включая `test.use({ storageState: STATE })` ниже, и без явного пустого состояния попытался бы прочитать файл, которого ещё нет (`Error reading storage state … ENOENT`).
2. `context.request` — HTTP-клиент этого контекста: cookie `sid` из ответа на вход сохраняется в контексте. Вход через API быстрее, чем через форму.
3. `context.storageState({ path })` записывает снимок в файл.
4. `test.use({ storageState: STATE })` говорит Playwright: каждый тест этого файла получает **новый** контекст, но с cookies из файла. Контекст создаётся уже после `beforeAll`, поэтому файл к этому моменту готов.

Каждый тест по-прежнему изолирован: свой контекст, своя страница. Общим остаётся только **аккаунт**.

```widget
{"type":"exercise","id":"m6-auth-state"}
```

## Как выглядит дефект «вход теряется»

В варианте магазина «вход не сохраняется после перехода» сессия забывает пользователя на второй странице. Тест с сохранённым состоянием замечает это.

```widget
{"type":"playground","lang":"pw","title":"storageState на магазине, где вход теряется","variant":"auth-lost","code":"import { test, expect } from '@playwright/test';\n\nconst STATE = 'anna-state.json';\n\ntest.beforeAll(async ({ browser }) => {\n  // явно пустое состояние: иначе контекст попытается прочитать ещё не созданный STATE из test.use\n  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });\n  await context.request.post('/api/login', { data: { email: 'anna@example.test', password: 'learn-123' } });\n  await context.storageState({ path: STATE });\n  await context.close();\n});\n\ntest.use({ storageState: STATE });\n\ntest('Анна остаётся в системе на всех страницах', async ({ page }) => {\n  await page.goto('/');\n  await expect(page.getByTestId('user-name')).toHaveText('Анна');\n  await page.goto('/cart');\n  await expect(page.getByTestId('user-name')).toHaveText('Анна');\n});\n","recorded":{"variant":"Дефект: вход не сохраняется после перехода","output":"Магазин: Дефект: вход не сохраняется после перехода\n✗ Анна остаётся в системе на всех страницах (3507 мс)\nError: expect(locator).toHaveText(expected) failed\n\nLocator: getByTestId('user-name')\nExpected: \"Анна\"\nTimeout: 3000ms\nError: element(s) not found\n\nCall log:\n  - Expect \"toHaveText\" with timeout 3000ms\n  - waiting for getByTestId('user-name')\n"}}
```

:::happened
Первая проверка (каталог) прошла: cookie из файла сработала. Вторая (корзина) упала: элемента `user-name` нет — сервер «забыл» пользователя. Тест проверяет то, что важно пользователю: он остаётся в системе, переходя между страницами. Если бы тест смотрел только на одну страницу, дефект прошёл бы незамеченным.
:::

## Setup project: вход один раз на весь прогон

`beforeAll` выполняется в каждом [[worker|worker]] и для каждого файла. В настоящем проекте вход выносят в отдельный [[project-pw|проект]] Playwright, от которого зависят остальные:

```ts playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { storageState: 'playwright/.auth/anna.json' },
    },
  ],
});
```

```ts tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('вход Анны', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('anna@example.test');
  await page.getByLabel('Пароль').fill('learn-123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByTestId('user-name')).toHaveText('Анна');
  await page.context().storageState({ path: 'playwright/.auth/anna.json' });
});
```

Проект `setup` выполнится первым; проект `chromium` начнётся только после его успеха. Тест, которому нужен гость, сбрасывает состояние: `test.use({ storageState: { cookies: [], origins: [] } })`.

:::warn Файлы состояния — секрет
Снимок содержит действующую сессию. Папку `playwright/.auth` добавляют в `.gitignore`, а пароли для входа берут из переменных окружения CI, а не из кода.
:::

## Не делите аккаунт между тестами, которые его меняют

Сохранённый вход экономит время, но все тесты работают от имени одного пользователя. Пока тесты только читают, это безопасно. Когда тест меняет данные пользователя (корзину, адрес, заказы), параллельные тесты начинают видеть чужие изменения: один очистил корзину, другой как раз проверяет её сумму.

Варианты решения:

- **отдельный аккаунт на worker**: учётные записи `buyer-0`, `buyer-1`… выбираются по `test.info().parallelIndex`;
- **отдельный аккаунт на тест**: создаётся через API в fixture и удаляется в teardown;
- **только чтение** для общего аккаунта: тесты с изменениями получают свой.

:::mistake Один аккаунт «для всех» и параллельный запуск
Тесты зелёные на одном worker и «случайно» падают на четырёх. Причина не в нестабильном интерфейсе, а в общем состоянии одного пользователя. Сначала проверьте, кто ещё работает с этим аккаунтом.
:::

:::deep Когда storageState не поможет
Снимок сохраняет cookies, `localStorage` и, с опцией `indexedDB: true`, IndexedDB. `sessionStorage` в него не попадает: если приложение держит токен там, его переносят вручную через `page.addInitScript`. Сессия также может истечь: если прогон длинный, а сессия короткая, тесты в конце начнут падать на «нужно войти». Такую проблему видно по времени падения.
:::

:::tech Почему вход через API
Форма входа проверяется отдельным UI-тестом. Остальным тестам нужен только результат входа — cookie. Запрос `POST /api/login` занимает миллисекунды, а заполнение формы — сотни миллисекунд и зависит от вёрстки. Если сломается форма, упадёт один тест формы, а не весь набор.
:::

:::interview
**Вопрос:** «Как избежать логина в каждом тесте?» **Ответ по сути:** войти один раз (setup project или `beforeAll`), сохранить `storageState` в файл и подключить его через `use.storageState`. Каждый тест всё равно получает свой контекст. Тесты, которые меняют данные пользователя, получают отдельный аккаунт на worker или на тест, иначе параллельный запуск даёт конфликты. Файлы состояния не коммитят.
:::

:::terms
[[cookie]], [[storage-state]], [[browser-context]], [[project-pw]], [[worker]], [[shared-state]]
:::
