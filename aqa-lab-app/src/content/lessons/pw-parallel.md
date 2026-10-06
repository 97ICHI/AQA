:::why
Сотня UI-тестов по 5 секунд — это почти 9 минут подряд. Если запускать их параллельно, прогон займёт столько, сколько самая медленная группа. Но параллельный запуск сразу показывает все скрытые зависимости между тестами. В этом уроке — как Playwright распределяет тесты и что нужно, чтобы параллельность не ломала результаты.
:::

## Workers: несколько процессов на одной машине

[[worker|Worker]] — отдельный процесс операционной системы, в котором Playwright Test выполняет тесты. Каждый worker запускает свой браузер. Число worker задаётся в конфигурации или в командной строке:

```ts playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: process.env.CI ? 2 : undefined, // undefined — половина ядер процессора
  fullyParallel: false,
});
```

```bash
npx playwright test --workers=4
```

По умолчанию распределяются **файлы**: тесты одного файла идут по порядку в одном worker, разные файлы — в разных worker одновременно. Опция [[fully-parallel|`fullyParallel: true`]] (или `test.describe.configure({ mode: 'parallel' })` для одного файла) распределяет уже **отдельные тесты**.

Внутри теста номер worker доступен через `test.info().workerIndex`, а номер «слота» от 0 до `workers − 1` — через `test.info().parallelIndex`. Слот удобен, чтобы выдать каждому worker свой тестовый аккаунт.

## Что ломается при параллельном запуске

Параллельный запуск сам по себе ничего не ломает. Он показывает то, что уже было сломано: [[shared-state|общее состояние]]. Пример — магазин, в котором у всех посетителей **одна** корзина. Два теста идут по очереди в одном worker:

```widget
{"type":"playground","lang":"pw","title":"Два теста на магазине с общей корзиной","variant":"shared-cart","code":"import { test, expect } from '@playwright/test';\n\ntest('Анна кладёт блокнот в корзину', async ({ page }) => {\n  await page.goto('/');\n  await page.getByRole('listitem').filter({ hasText: 'Блокнот A5' })\n    .getByRole('button', { name: 'В корзину' }).click();\n  await expect(page.getByTestId('cart-count')).toHaveText('1');\n});\n\ntest('новый посетитель видит пустую корзину', async ({ page }) => {\n  await page.goto('/');\n  await expect(page.getByTestId('cart-count')).toHaveText('0');\n});\n","recorded":{"variant":"Дефект: одна корзина на всех посетителей","output":"Магазин: Дефект: одна корзина на всех посетителей\n✓ Анна кладёт блокнот в корзину (300 мс)\n✗ новый посетитель видит пустую корзину (3147 мс)\nError: expect(locator).toHaveText(expected) failed\n\nLocator:  getByTestId('cart-count')\nExpected: \"0\"\nReceived: \"1\"\nTimeout:  3000ms\n\nCall log:\n  - Expect \"toHaveText\" with timeout 3000ms\n  - waiting for getByTestId('cart-count')\n    7 × locator resolved to <span data-testid=\"cart-count\">1</span>\n      - unexpected value \"1\"\n"}}
```

:::happened
Первый тест положил блокнот в корзину. Второй тест открыл магазин в **новом** контексте браузера — с новой cookie и, по идее, пустой корзиной — и увидел `1`. Значит, корзина привязана не к посетителю. Для пользователей это серьёзный дефект: один покупатель видит товары другого.

Такой же эффект бывает и без дефекта приложения — когда сами **тесты** делят данные: один тестовый аккаунт, один заказ, одна настройка. При запуске по очереди тесты случайно проходят, при параллельном — падают в зависимости от того, кто успел первым. Это [[race-condition|состояние гонки]].
:::

## Два пользователя в одном тесте

Чтобы проверить изоляцию явно, тест может создать **два контекста браузера** — два независимых посетителя. Встроенная fixture `browser` (общий браузер worker) создаёт их через `browser.newContext()`. `baseURL` из конфигурации к таким контекстам тоже применяется.

```widget
{"type":"exercise","id":"m6-parallel-two-users"}
```

## Projects: разные условия запуска

[[project-pw|Project]] — именованный набор настроек, с которыми выполняются тесты. Один и тот же тест можно прогнать в нескольких браузерах или на нескольких размерах экрана:

```ts playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```

```bash
npx playwright test --project=chromium
```

Проекты выполняются в тех же worker, поэтому с тремя проектами работы втрое больше. Проект может зависеть от другого (`dependencies`), как setup-проект со входом из урока про storageState.

## Sharding: несколько машин

Когда одной машины мало, набор делят на части — [[sharding|шарды]] — и запускают на разных машинах CI:

```bash
npx playwright test --shard=1/4   # первая четверть тестов
npx playwright test --shard=2/4   # вторая четверть — на другой машине
```

Каждая машина получает свою долю тестов и пишет свой отчёт. Чтобы получить единый HTML-отчёт, шарды сохраняют отчёт в формате `blob`, а потом его собирают командой [[merge-reports|`npx playwright merge-reports`]]:

```bash
npx playwright test --shard=1/4 --reporter=blob
npx playwright merge-reports --reporter=html ./all-blob-reports
```

:::mistake Ускорить, выключив изоляцию
Чтобы тесты «не мешали друг другу», ставят `workers: 1` навсегда. Прогон снова медленный, а проблема общих данных никуда не делась — она проявится при повторе или при запуске одного теста. Лечится данными: свой аккаунт на worker, уникальные значения, подготовка в каждом тесте.
:::

:::deep Сколько worker ставить
Больше worker — не всегда быстрее. Каждый worker — браузер, это память и процессор. На машине CI с двумя ядрами восемь worker будут мешать друг другу, и тесты начнут падать по таймаутам. Начинайте с числа ядер и смотрите на время прогона и долю падений по таймауту. Если стенд один на всех, нагрузку ограничивает и он: параллельные тесты могут упереться в производительность тестового сервера.
:::

:::tech Порядок внутри файла и serial
По умолчанию тесты файла выполняются по порядку в одном worker. После падения теста worker перезапускается, и `beforeAll` выполнится снова для оставшихся тестов. Режим `test.describe.configure({ mode: 'serial' })` запускает группу строго по порядку и пропускает остальные тесты после первого падения — он нужен редко, чаще это признак зависимых тестов. Опция `--max-failures=N` останавливает прогон после N падений.
:::

:::interview
**Вопрос:** «Чем workers отличаются от sharding?» **Ответ по сути:** workers — параллельные процессы на одной машине (по умолчанию распределяются файлы, с `fullyParallel` — тесты); sharding — деление набора на части для разных машин (`--shard=i/n`), отчёты шардов собираются `merge-reports` из `blob`. И то и другое работает, только если тесты изолированы: свои данные, свой аккаунт или аккаунт на worker по `parallelIndex`.
:::

:::terms
[[worker]], [[fully-parallel]], [[parallel-execution]], [[shared-state]], [[race-condition]], [[project-pw]], [[sharding]], [[merge-reports]]
:::
