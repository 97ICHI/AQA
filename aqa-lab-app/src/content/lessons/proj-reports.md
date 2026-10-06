:::why
Тест упал ночью в CI. Если отчёт показывает только «failed», придётся перезапускать прогон и пытаться поймать ошибку заново, а нестабильная ошибка может не повториться. Хороший отчёт отвечает на вопрос «что сломалось и почему» с первого взгляда, без перезапуска.
:::

## Что должно быть в отчёте

Для каждого упавшего теста нужен ответ на четыре вопроса:

1. **Что проверялось** — понятное название теста и шаги.
2. **Что ожидалось и что получено** — сообщение assertion с `Expected` / `Received`.
3. **В каком состоянии была система** — скриншот, снимок DOM, сетевые запросы, ответы API.
4. **В каком окружении** — стенд, версия, браузер, номер прогона.

Playwright собирает большую часть этого сам, если включить [[test-artifacts|артефакты]] и подобрать [[reporter|репортеры]].

## Настройка в playwright.config.ts

В учебном проекте конфигурация такая (фрагмент):

```ts playwright.config.ts
reporter: [['list'], ['html', { open: 'never' }], ['allure-playwright', { resultsDir: 'allure-results' }]],
use: {
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
},
```

- `list` — построчный вывод в консоль, его видно прямо в логе CI-задачи.
- `html` — интерактивный отчёт в `playwright-report/`; `open: 'never'` не даёт ему открываться в браузере на сервере CI.
- [[allure-report|Allure]] — отчёт с историей прогонов и категориями; сырые результаты пишутся в `allure-results/`, отчёт собирается отдельной командой.
- `trace: 'retain-on-failure'` записывает trace для каждого теста, но сохраняет только для упавших: полная картина падения без раздувания артефактов зелёных тестов.

Для машинной обработки (сводка в чат, комментарий к merge request, статистика нестабильности) добавляют JSON-репортер:

```ts playwright.config.ts
reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'reports/results.json' }]],
```

## Шаги и вложения

Длинный сценарий без структуры превращается в стену действий. [[test-step|Шаги]] группируют действия, и в отчёте видно, на каком из них тест остановился. [[attachment|Вложения]] добавляют в отчёт то, чего Playwright не собирает сам, — например, тело ответа API:

```ts tests/order.spec.ts
import { test, expect } from '@playwright/test';

test('заказ из корзины', async ({ page }, testInfo) => {
  await test.step('вход Бориса', async () => {
    const res = await page.request.post('/api/login', { data: { email: 'boris@example.test', password: 'learn-123' } });
    await expect(res).toBeOK();
  });
  await test.step('два блокнота в корзине', async () => {
    await expect(await page.request.post('/api/cart', { data: { productId: 3, qty: 2 } })).toBeOK();
  });
  const order = await test.step('оформление заказа', async () => {
    const res = await page.request.post('/api/orders');
    const body = await res.json();
    await testInfo.attach('order-response', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
    expect(res.status()).toBe(201);
    return body;
  });
  expect(order.total).toBe(780);
});
```

Вложение добавлено **до** проверки: если проверка упадёт, ответ уже будет в отчёте. `test.step` возвращает значение колбэка, поэтому шаги не мешают передавать данные дальше.

:::mistake
Логировать всё подряд через `console.log`. Сотни строк без структуры никто не читает. Лучше несколько осмысленных шагов, вложение ответа API при падении и [[correlation-id|идентификатор запроса]], по которому можно найти запись в логах сервера.
:::

## JSON-отчёт изнутри

JSON-отчёт повторяет структуру тестов: верхние наборы — файлы, вложенные — `describe`, в каждом `specs[]` с тестами. У теста есть итоговый `status` (`expected`, `unexpected`, `flaky`, `skipped`) и массив попыток `results[]` с ошибкой и вложениями. В конце — `stats` с количеством тестов каждого статуса.

```json
{
  "suites": [{ "title": "cart.spec.ts", "specs": [], "suites": [
    { "title": "Итог корзины", "specs": [{ "title": "два блокнота — 780 ₽", "tests": [
      { "projectName": "chromium", "status": "unexpected", "results": [
        { "status": "failed", "retry": 0, "error": { "message": "Error: expect(locator).toHaveText(expected) failed …" } }
      ] }
    ] }] }
  ] }],
  "stats": { "expected": 41, "unexpected": 1, "flaky": 2, "skipped": 0 }
}
```

:::try Сводка для merge request
Напишите функцию, которая превращает JSON-отчёт в короткую сводку: сколько тестов, какие упали и с какой ошибкой, какие нестабильны.
:::

```widget
{"type":"exercise","id":"m9-report-summary"}
```

:::happened
Рекурсивный обход нужен, потому что `describe` может быть вложен в `describe`. Ошибка берётся из последней попытки — она определила итог. Такая сводка в комментарии к merge request экономит ревьюеру переход в CI: сразу видно, что упало и почему.
:::

:::deep Отчёт как часть процесса
Отчёт полезен, только если его читают. Практики, которые помогают: ссылка на HTML-отчёт и trace прямо в сообщении о падении; категории падений в Allure (дефект продукта, проблема теста, окружение) для [[failure-triage|разбора]]; история прогонов, чтобы видеть, когда тест начал падать или стал нестабильным. Метаданные (владелец, ссылка на задачу, критичность) задаются через `tag` и `annotation` в опциях теста — по ним фильтруют отчёт и строят статистику.
:::

:::tech Где лежат артефакты
`test-results/` — trace, скриншоты и видео по каждому тесту (каталог `outputDir`, очищается в начале прогона). `playwright-report/` — HTML-отчёт; открыть локально: `npx playwright show-report`. Trace открывается командой `npx playwright show-trace путь/к/trace.zip` или на trace.playwright.dev — файл не покидает браузер. При [[sharding|шардировании]] каждый шард пишет `blob`-отчёт, а общий собирается командой `npx playwright merge-reports`.
:::

:::interview
**Вопрос:** «Что вы кладёте в отчёт автотестов?» **Ответ по сути:** понятные названия и шаги, сообщение с ожидаемым и фактическим значением, trace и скриншот для упавших тестов, вложения с ответами API, идентификатор запроса и сведения об окружении. Цель — разобрать падение по отчёту, не перезапуская тест. Для автоматической обработки — JSON или JUnit, для людей — HTML или Allure.
:::

:::terms
[[reporter]], [[test-artifacts]], [[trace-viewer]], [[test-step]], [[attachment]], [[allure-report]], [[correlation-id]], [[json-report]], [[failure-triage]]
:::
