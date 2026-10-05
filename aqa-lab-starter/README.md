# Учебный проект AQA Lab

Небольшое приложение с API и формой, на котором удобно учиться писать автотесты. Система учебная: HTTP, данные хранятся в памяти, нет базы данных, оплаты и авторизации.

Нужен **Node.js 22 или новее** и терминал.

## Быстрый старт без установки зависимостей

```bash
node --test tests/api.node.test.mjs   # проверка настоящего HTTP API
node server.mjs                       # магазин на http://localhost:3000
```

`Ctrl+C` останавливает сервер; данные в памяти исчезают. Сервер слушает только `127.0.0.1`; чтобы открыть его в контейнере, задайте `HOST=0.0.0.0` (так сделано в `compose.yaml`). Порт меняется через `PORT`, но Playwright-тесты ждут порт 3000.

## Playwright

```bash
npm ci                              # зависимости строго по package-lock.json
npx playwright install chromium     # браузер для Playwright (на Linux при нехватке библиотек: --with-deps)
npm run lint
npm run typecheck
npm test                            # Playwright сам запускает сервер
npm run verify                      # lint + typecheck + API-тест + Playwright
```

HTML-отчёт: `npx playwright show-report`. Отчёт Allure: `npm run report:allure` (нужна Java).

Не запускайте сервер вручную одновременно с `npm test`: Playwright стартует свой экземпляр и завершится с ошибкой, если порт занят.

Версии зависимостей закреплены (в том числе `@playwright/test` 1.58.2) ради воспроизводимости, это не утверждение о «последней версии». `package-lock.json` храните в Git и ставьте зависимости командой `npm ci`; перед обновлением читайте release notes.

## Контракт API

| Метод и путь | Поведение |
| --- | --- |
| `GET /ready` | 200, `{ "ready": true }` |
| `POST /api/orders` | `{ "quantity": 1..10 }` → 201 и заказ; сумма = `quantity × 1000` |
| | некорректный JSON → 400; недопустимое количество → 422 `{ "error": "quantity must be an integer from 1 to 10" }`; тело больше 16 КиБ → 413 |
| `GET /api/orders/:id` | 200 или 404 |
| `DELETE /api/orders/:id` | 204, в том числе при повторном удалении |

## Docker и CI

```bash
docker compose up --build --abort-on-container-exit --exit-code-from tests
docker compose down
```

Код возврата команды `up` — код сервиса `tests`; сохраните его до `down`, иначе успешная очистка перекроет упавшие тесты. Отчёты и логи сохраняются в `playwright-report/`, `test-results/`, `allure-results/`. В `.github/workflows/tests.yml` эти шаги вынесены отдельно, артефакты загружаются при любом исходе.

## Задания

1. Добавьте таблицу проверок для `quantity`: 0, 1, 10, 11, дробное, строка, `null`, отсутствующее поле.
2. Добавьте отдельные API-тесты и фикстуры создания и удаления заказа. При падении проверки очистка должна выполняться.
3. Вынесите форму в компонент вместо широкого Page Object. Запустите 20 повторов на 2 workers: `npx playwright test --repeat-each=20 --workers=2`.
4. Внесите контролируемый дефект в расчёт суммы (например, `* 1001` в `server.mjs`) и убедитесь, что тесты его обнаруживают. Верните исправление.
5. Расширьте правила линтера и метаданные Allure, обоснуйте quality gate и политику для flaky-тестов.
