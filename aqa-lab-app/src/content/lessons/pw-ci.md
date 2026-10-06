:::why
Тесты, которые запускаются только на ноутбуке автора, защищают только автора. В CI они выполняются на каждое изменение кода и не дают слить в общую ветку то, что ломает магазин. Чтобы это работало, CI должен поставить всё нужное, проверить типы, запустить тесты, сохранить отчёт и **правильно передать результат**: красный прогон должен останавливать слияние.
:::

## Что делает job с тестами

[[continuous-integration|CI]] выполняет [[pipeline|pipeline]] — набор задач ([[ci-job|jobs]]) на чистой машине. Для Playwright типичная задача состоит из шагов:

1. получить код репозитория;
2. поставить Node.js и зависимости строго по lock-файлу: `npm ci`;
3. поставить браузеры **той же версии**, что и `@playwright/test`: `npx playwright install --with-deps chromium`;
4. проверить типы: `npx tsc --noEmit` — ошибка типов в тесте должна останавливать pipeline так же, как упавший тест;
5. запустить тесты: `npx playwright test`;
6. сохранить отчёт и trace как [[test-artifacts|артефакты]] — **даже если тесты упали**.

Результат задачи определяет **код возврата** команды: `0` — успех, любой другой — провал. `npx playwright test` возвращает `1`, если есть упавшие тесты.

## Пример для GitHub Actions

```yaml .github/workflows/e2e.yml
name: e2e
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx tsc --noEmit
      - run: npx playwright test
        env:
          BASE_URL: ${{ vars.STAGE_URL }}
          SHOP_PASSWORD: ${{ secrets.SHOP_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 14
```

На что обратить внимание:

- `if: ${{ !cancelled() }}` — шаг выгрузки выполняется и после падения тестов. Без этого условия после красного шага отчёт не сохранится — как раз тогда, когда он нужен.
- Адрес стенда и пароль приходят из настроек репозитория (`vars`, `secrets`), а не из кода. В конфигурации их читают через `process.env.BASE_URL`.
- `timeout-minutes` ограничивает зависшую задачу.

[[github-actions|GitHub Actions]] и GitLab CI устроены по-разному, но шаги те же. В GitLab артефакты сохраняют с `artifacts: when: always`.

## Конфигурация для CI

Переменная окружения `CI` выставляется почти всеми системами CI. Конфигурация может от неё зависеть:

```ts playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  forbidOnly: !!process.env.CI,          // забытый test.only — ошибка, а не тихий пропуск остальных
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
});
```

`forbidOnly` особенно важен: `test.only`, случайно попавший в коммит, запустит один тест и сделает прогон «зелёным».

## Шарды в CI

Большой набор делят между машинами через matrix:

```yaml .github/workflows/e2e.yml
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]
    steps:
      # … те же шаги установки …
      - run: npx playwright test --shard=${{ matrix.shard }} --reporter=blob
```

Каждая машина выгружает `blob-report`, а отдельная задача после всех шардов собирает их: `npx playwright merge-reports --reporter=html ./all-blob-reports`.

## Ворота качества

[[quality-gate|Ворота качества]] — правило, по которому CI решает «можно сливать или нет». Самое простое — «все тесты прошли». На практике учитывают ещё два случая:

- **ничего не выполнилось** — опечатка в `--grep` или пути, и прогон «зелёный» без единого теста. По умолчанию Playwright в этом случае завершается с ошибкой «No tests found»; опция `--pass-with-no-tests` отключает эту защиту;
- **нестабильные тесты** — прошли со второй попытки. Флаг `--fail-on-flaky-tests` делает такой прогон красным.

Напишите функцию ворот по сводке JSON-отчёта.

```widget
{"type":"exercise","id":"m6-ci-gate"}
```

:::mistake Скрыть код возврата
`npx playwright test || true` или `continue-on-error: true` на шаге тестов — и pipeline всегда зелёный. Если нужно сохранить отчёт после падения, для этого есть условие на шаге выгрузки, а не подавление ошибки.
:::

:::mistake Браузеры «из кэша» другой версии
Браузеры Playwright привязаны к версии пакета. Если обновили `@playwright/test`, а в CI используется старый образ или кэш браузеров, запуск упадёт с «Executable doesn't exist». Ставьте браузеры командой `npx playwright install` после `npm ci` или используйте Docker-образ `mcr.microsoft.com/playwright` с той же версией.
:::

:::deep Docker-образ вместо установки
Официальный образ Playwright уже содержит браузеры и системные библиотеки нужной версии: шаг установки браузеров исчезает, а окружение одинаково у всех запусков. Это важно и для визуальных проверок: эталонные снимки сравниваются в том же образе, где их сняли. Версия образа должна совпадать с версией `@playwright/test` в `package-lock.json`.
:::

:::tech Отчёт в интерфейсе CI
Репортер `github` превращает падения в аннотации прямо в pull request. `junit` (`['junit', { outputFile: 'results.xml' }]`) понимают GitLab, Jenkins и многие другие системы: упавшие тесты видны на странице pipeline. HTML-отчёт из артефакта открывают локально: `npx playwright show-report путь/к/playwright-report`.
:::

:::interview
**Вопрос:** «Что должно быть в CI-задаче с Playwright?» **Ответ по сути:** `npm ci`, установка браузеров той же версии, проверка типов, запуск тестов с `forbidOnly` и ретраями, секреты и адрес стенда из переменных окружения, выгрузка отчёта и trace с условием «даже при падении». Код возврата не подавляется; при большом наборе — шарды и `merge-reports`. Ворота качества: нет упавших, тесты действительно выполнились, нестабильные — под контролем.
:::

:::terms
[[continuous-integration]], [[pipeline]], [[ci-job]], [[github-actions]], [[test-artifacts]], [[quality-gate]], [[secrets-management]], [[sharding]]
:::
