:::why
Тест упал. Перезапускать его «посмотреть, повторится ли» — самый медленный способ разобраться. Playwright сохраняет всё, что нужно для диагноза: сообщение с ожидаемым и полученным, шаги, снимки страницы, сеть. В этом уроке вы узнаете, какой инструмент открыть в какой ситуации и как читать отчёт без перезапуска.
:::

## Четыре инструмента

| Инструмент | Когда | Как запустить |
|---|---|---|
| Сообщение об ошибке | всегда, первым делом | в выводе `npx playwright test` |
| HTML-отчёт | разобрать прогон целиком | `npx playwright show-report` |
| [[trace-viewer|Trace Viewer]] | тест упал в CI, локально не повторяется | `npx playwright show-trace trace.zip` |
| [[ui-mode|UI Mode]] и [[playwright-inspector|Inspector]] | пишете или чините тест локально | `--ui`, `--debug`, `page.pause()` |

## Шаг 1: прочитать сообщение

Сообщение Playwright уже отвечает на главные вопросы: **что** проверялось (локатор), **что ожидалось и что получено**, **сколько ждали** и что происходило в это время (`Call log`). Чтобы сообщение указывало ещё и на **место в сценарии**, длинный тест делят на шаги — [[test-step|`test.step`]]:

```widget
{"type":"playground","lang":"pw","title":"Тест с шагами на магазине с дефектом суммы","variant":"wrong-total","code":"import { test, expect } from '@playwright/test';\n\ntest('покупка двух блокнотов', async ({ page }) => {\n  await test.step('добавить два блокнота', async () => {\n    await page.goto('/');\n    const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });\n    await card.getByRole('button', { name: 'В корзину' }).click();\n    await expect(page.getByTestId('cart-count')).toHaveText('1');\n    await card.getByRole('button', { name: 'В корзину' }).click();\n    await expect(page.getByTestId('cart-count')).toHaveText('2');\n  });\n  await test.step('проверить итог корзины', async () => {\n    await page.getByRole('link', { name: /Корзина/ }).click();\n    await expect(page.getByTestId('cart-total')).toHaveText('780 ₽');\n  });\n});\n","recorded":{"variant":"Дефект: сумма корзины не учитывает количество","output":"Магазин: Дефект: сумма корзины не учитывает количество\n✗ покупка двух блокнотов (3604 мс)\nError: expect(locator).toHaveText(expected) failed\n\nLocator:  getByTestId('cart-total')\nExpected: \"780 ₽\"\nReceived: \"390 ₽\"\nTimeout:  3000ms\n\nCall log:\n  - Expect \"toHaveText\" with timeout 3000ms\n  - waiting for getByTestId('cart-total')\n    7 × locator resolved to <strong data-testid=\"cart-total\">390 ₽</strong>\n      - unexpected value \"390 ₽\"\n"}}
```

:::happened
Счётчик дважды показал верное значение — значит, клики сработали, и шаг «добавить два блокнота» прошёл. Упала проверка итога: `Expected: "780 ₽"`, `Received: "390 ₽"`. В HTML-отчёте и в trace шаги показываются деревом, и красным будет отмечен шаг «проверить итог корзины». Вывод без перезапуска: товары добавляются, а сумма не учитывает количество — это дефект расчёта, а не проблема теста.
:::

`test.step(название, функция)` возвращает результат функции, шаги можно вкладывать. С опцией `{ box: true }` ошибка внутри шага указывает на строку вызова шага, а не на строку внутри вспомогательной функции.

## Шаг 2: trace — запись прогона

Trace — архив `trace.zip` с полной записью теста: каждое действие, снимок DOM до и после, сеть, консоль, исходный код. Его включают в конфигурации:

```ts playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'on-first-retry',        // записать при первом повторе упавшего теста
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

Варианты `trace`: `'off'`, `'on'`, `'retain-on-failure'` (писать всегда, хранить только у упавших), `'on-first-retry'`, `'on-all-retries'`, `'retain-on-first-failure'`. Запись каждого теста замедляет прогон, поэтому в CI обычно выбирают `'on-first-retry'` или `'retain-on-failure'`.

В Trace Viewer слева — список действий, по центру — снимок страницы в момент действия, внизу — вкладки «Network», «Console», «Errors». Типичные находки:

- **Network**: запрос `POST /api/cart` вернул `409` — дефект или данные, а не локатор;
- **снимок перед кликом**: кнопку закрыло всплывающее окно;
- **Console**: ошибка JavaScript на странице сразу после действия.

```bash
npx playwright show-trace test-results/<папка-упавшего-теста>/trace.zip
```

[[test-artifacts|Артефакты]] (trace, скриншоты, видео) лежат в папке `test-results`, а ссылки на них — в HTML-отчёте у каждого упавшего теста.

## Шаг 3: локальная отладка

- `npx playwright test --ui` — UI Mode: список тестов, запуск по одному, шкала времени со снимками, повтор при изменении файла.
- `npx playwright test -g "итог корзины" --debug` — Inspector: выполнение по шагам, браузер виден, таймауты отключены.
- `await page.pause()` в коде теста — остановка в нужном месте с открытым Inspector.
- `npx playwright test --last-failed` — перезапустить только упавшие в прошлом прогоне.
- `npx playwright test tests/cart.spec.ts:12` — один тест по номеру строки.

:::warn page.pause в общей ветке
`page.pause()` в CI остановит тест до таймаута. Это инструмент локальной отладки: удаляйте его перед коммитом.
:::

## Отчёт как данные

Отчёт можно читать не только глазами. JSON-репортер (`--reporter=json`) пишет весь прогон в файл: дерево `suites → specs → tests → results`, у каждой попытки — статус и ошибка. По такому файлу скрипт CI собирает сводку «что упало и где». Напишите функцию, которая находит упавшие тесты в отчёте.

```widget
{"type":"exercise","id":"m6-debug-report"}
```

:::mistake Сразу добавить ожидание
Тест упал по таймауту — добавили `waitForTimeout(3000)`. Тест позеленел, причина осталась. Сначала посмотрите trace: что было на странице и в сети в момент ожидания. Чаще всего причина — неверный локатор, другие данные или настоящий дефект, а не «медленная страница».
:::

:::deep Ретраи и flaky в отчёте
С `retries` упавший тест повторяется. Если повтор прошёл, Playwright помечает тест как `flaky`: прогон зелёный, но в отчёте есть отдельная отметка. Это сигнал, а не повод забыть: [[flaky-test|нестабильный тест]] нужно расследовать по trace первой попытки. Трассировка `'on-first-retry'` для этого и нужна: она записывает именно ту попытку, которая повторяет падение.
:::

:::tech Несколько репортеров сразу
[[reporter|Репортеры]] можно сочетать: `reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'report.json' }]]`. `list` — для консоли, `html` — для людей, `json` и `junit` — для программ и CI. Свои данные в отчёт добавляют через `test.info().attach(name, { body, contentType })` — например, тело ответа API при падении.
:::

:::interview
**Вопрос:** «Тест упал в CI, локально проходит. Ваши действия?» **Ответ по сути:** не перезапускаю вслепую. Читаю сообщение (ожидаемое/полученное, call log), открываю HTML-отчёт и trace упавшей попытки: снимки страницы, сеть, консоль. Ищу различия окружения: данные, время, параллельность, размер окна. По результату — дефект, проблема теста или окружения; для flaky — расследование, а не только ретрай.
:::

:::terms
[[trace-viewer]], [[ui-mode]], [[playwright-inspector]], [[test-step]], [[test-artifacts]], [[reporter]], [[flaky-test]], [[debug-mode]]
:::
