# Как писать уроки и задания AQA Lab

Документ для авторов. Всё, что описано здесь, проверяется `npm run test:content` и e2e-самопроверкой заданий.

## Где что лежит

| Что | Где |
|---|---|
| Структура курса (модули, уроки, цели, предпосылки, главы v3) | `src/content/course.ts` — единственный источник |
| Текст урока | `src/content/lessons/<lesson-id>.md` (урок без файла показывается как «план» со ссылкой на v3) |
| Задания | `src/content/exercises/ex-<группа>.ts`, `export default [...]` (типы — `types.ts`) |
| Глоссарий | `src/content/glossary.json` генерируется `npm run import-glossary` из v3 + `glossary-extra.json` + `glossary-extra.d/*.json`. Руками `glossary.json` не править |
| База магазина (SQL-тренажёр и магазин runner) | `shared/shop-data.mjs` |
| Учебный магазин и дефекты | `runner/shop.mjs` (`VARIANTS`) |

## Формат урока (Markdown)

Заголовок H1 не пишется — он берётся из `course.ts`. Разделы — `##`, подразделы — `###`.

Порядок слоёв (обязательные отмечены *):

1. `:::why` * — зачем это нужно, 2–4 предложения, без терминов, которые ещё не введены.
2. Объяснение * — простыми словами; одна новая идея за раз; термин объясняется в момент первого появления.
3. Пример * — короткий, реалистичный (магазин, корзина, заказ, API), с подписью файла: ```` ```ts tests/cart.spec.ts ````.
4. `:::try` + виджет — «Попробуйте сами»: песочница или задание.
5. `:::happened` — что произошло и почему (после песочницы/примера).
6. `:::deep` — глубже (свёрнуто).
7. `:::tech` — технические детали (свёрнуто).
8. `:::interview` — для собеседования (свёрнуто): вопрос + суть ответа.
9. `:::terms` — термины урока списком `[[id]]`.

Также доступны `:::note`, `:::warn`, `:::mistake` (типичная ошибка). Блоки не вкладываются; закрываются строкой `:::`. Заголовок блока можно задать после типа: `:::try Запустите тест`.

**Термины:** `[[id]]` или `[[id|текст в предложении]]` — id из `glossary.json`. Нового термина нет — добавьте его в `src/content/glossary-extra.d/<ваша-группа>.json` (поля `en`, `ru`, `def` (HTML), `aliases`, `lesson`, по возможности `example`) и выполните `npm run import-glossary`. Подсвечивайте термин при первом появлении в уроке, а не каждый раз.

**Блоки кода** всегда с языком: `ts`, `sql`, `py`, `bash`, `text` (вывод), `json`, `http`, `yaml`, `html`.

## Виджеты

Вставляются fenced-блоком `widget` с JSON **в одну строку** (переводы строк в коде — `\n`):

```text
```widget
{"type":"exercise","id":"ts-fn-total"}
```
```

- `{"type":"exercise","id":"…"}` — задание (id из `ex-*.ts`, `lesson` задания должен совпадать с уроком).
- `{"type":"playground","lang":"ts|sql|py|pw","title":"…","code":"…"}` — песочница. Для `sql` можно `"dataset":"base|edge|empty"`. Для `pw` — `"variant":"<вариант магазина>"` и **обязательно** `"recorded":{"variant":"<label>","output":"<вывод настоящего запуска>"}` — показывается с меткой «Записанный сценарий», если runner не подключён. `recorded.output` копируйте из реального запуска через runner, не сочиняйте.
- `{"type":"locator-lab","task":"…"}` — лаборатория локаторов (учебная модель).

## Задания

Общие поля: `id` (уникальный, с префиксом группы), `lesson`, `kind`, `title`, `goal` (что сделать, 1–3 предложения, Markdown inline), `starter` (стартовый код — **должен не проходить проверку**), `solution` (эталон — **должен проходить**), `explanation` (разбор), `hints` — ровно 3 ступени: направление → идея → фрагмент (полное решение показывается отдельно), `mistakes?`, `alternatives?`.

| kind | Как проверяется | Поля |
|---|---|---|
| `ts` | Код ученика — модуль `student.ts`; `check` — модуль, который `import { … } from './student'` и вызывает `test('…', () => expectEq(…))`. Сначала проверка типов (strict), затем выполнение в Worker (таймаут 4 с). | `check` |
| `ts-test` | Ученик пишет тесты в `student.test.ts`, импортируя из `./app`. Тесты должны пройти на `good` и упасть на каждой версии из `broken`. | `good`, `broken: [{name, code}]` |
| `sql` | Результат запроса ученика сравнивается с `reference` на каждом наборе из `datasets` (свежая база на каждый набор). Имена столбцов не сравниваются, количество и значения — да. `ordered: true` — порядок важен. Для DML: `verify` — SELECT, которым сравнивается состояние после выполнения. | `reference`, `ordered`, `datasets`, `verify?` |
| `py` | Код ученика — `student.py`; `check` — pytest-файл (`from student import …`). | `check` |
| `py-test` | Ученик пишет `test_student.py`, импортируя из `shop`. Тесты проходят на `good` и падают на каждой версии `broken`. | `good`, `broken` |
| `pw` | Настоящий Playwright через runner: тест должен пройти на всех `mustPass` и упасть на всех `mustFail` вариантах магазина. | `mustPass`, `mustFail` |

Проверка «по поведению» — главное правило: допустимы любые правильные решения. Не проверяйте текст кода. Если правильное альтернативное решение не проходит — исправьте проверку, а не ученика.

### Глобальные функции TS-тренажёра

Код выполняется в Web Worker (без DOM, без `document`, без реальной сети). Доступны: `console.*`, таймеры, `URL`/`URLSearchParams`, `sleep(ms)`, `fakeFetchOrder(id)` (Promise с учебным JSON заказа через 50 мс; для id 42 `total` — строка `'9980'`, для остальных — число 2990), а для проверок: `test(name, fn)`, `expectEq(actual, expected, msg?)` (сравнение как JSON), `expectTrue(v, msg)`, `await expectThrows(fn, msg)`. Компилятор: TypeScript 5.9, `strict`, ES2022, модули ES.

### Python-тренажёр

CPython 3.14 (Pyodide) с pytest 9; стандартная библиотека доступна, сторонних пакетов (requests и т. п.) нет, сети нет. Для HTTP-тем используйте учебный клиент-заглушку, `unittest.mock` или записанный сценарий.

### SQL-тренажёр

PostgreSQL 17 (PGlite). Таблицы: `users(id, email, name, city NULL, is_active, created_at date)`, `products(id, sku, title, category, price numeric(10,2), stock)`, `orders(id, user_id → users, status in new/paid/shipped/cancelled, promo_code NULL, created_at date)`, `order_items(order_id → orders ON DELETE CASCADE, product_id → products, qty > 0, price, PK(order_id, product_id))`, `payments(id, order_id → orders ON DELETE CASCADE, amount, method in card/sbp/cash, status in ok/failed/refunded, paid_at NULL)`. Наборы: `base`, `edge` (NULL, пользователи без заказов, заказ без позиций и без оплаты, равные цены, возврат, неактивный пользователь с заказом), `empty` (нет заказов и оплат). Значения numeric приходят строками `'390.00'`, даты — `'2026-04-01'`.

### Учебный магазин (runner)

Страницы: `/` (каталог: `form role=search` с полем «Поиск товара», `?q=` фильтрует; карточки `li` в списке «Товары» с `h2` названием, ценой, кнопкой «В корзину» (нет кнопки, если `stock = 0` — тогда «Нет в наличии»); `role=status` с текстом `Добавлено: <название>`), `/cart` (таблица; строка «Итого: …», внутри неё `<strong data-testid=cart-total>` только с суммой, например `780 ₽`; при пустой корзине — «Корзина пуста.» и элемента `cart-total` нет, кнопка «Оформить заказ», `role=status` с `Заказ №<id> оформлен на сумму <сумма>`; без входа — «Ошибка: нужно войти»), `/login` (поля Email и Пароль, кнопка «Войти»; после входа — переход на `/` и `data-testid=user-name`), `/logout`. Шапка: ссылка «Корзина (N)», `data-testid=cart-count`.

API: `GET /api/products?q=` → массив `{id, sku, title, price(число), stock}`; `GET /api/cart`; `POST /api/cart {productId, qty?}` → 200 `{items, total, count}`, 400/404/409; `POST /api/login {email, password}` → 200/401 (учебный пароль `learn-123`, пользователи из набора `base`, `gleb@` неактивен); `POST /api/orders` → 201 `{id, userId, status:'new', total(число), totalText, items}`, 401 без входа, 422 при пустой корзине; `GET /api/orders/:id` → 200/401/403/404; `POST /__test/sql {sql, params?}` — один SELECT к базе магазина (только учебный маршрут).

Варианты (`mustPass`/`mustFail`): `ok`; дефекты `cart-not-add`, `wrong-total`, `auth-lost`, `api-status`, `api-json`, `order-user`, `shared-cart`; не дефекты (тест должен выдержать) `slow` (кнопки активны через 1,5 с), `similar-names` (появляются «Наушники Pulse Pro Max» и «Чехол для наушников Pulse»), `markup-change` (другие классы/id, те же роли и тексты). Запуск: таймаут теста 10 с, `expect` 3 с, 1 worker, без повторов.

## Самопроверка

```bash
npm run test:content                       # структура, термины, виджеты
npx tsc --noEmit -p tsconfig.json          # типы
npx vite build --outDir dist-X             # сборка в свою папку
APP_PORT=41X0 APP_DIST=dist-X EX_ONLY=id1,id2 AQA_RUNNER_TOKEN=… AQA_BROWSER_PATH=… npx playwright test -c e2e/playwright.config.ts exercises
```

## Стиль

- Пишем для новичка, но не упрощаем до неправды. Если упрощение — так и сказать («упрощённо», «на самом деле…» в `:::deep`).
- Одна мысль — один абзац. Короткие предложения. Без «воды» и восклицаний.
- Примеры — из предметной области магазина. Никаких реальных токенов, паролей, адресов production-сервисов.
- Не утверждать того, что не проверено. API Playwright, TypeScript, PostgreSQL, pytest — только существующие в установленных версиях (Playwright 1.58, TypeScript 5.9, PostgreSQL 17/PGlite 0.5, Python 3.14, pytest 9).
- Не копировать чужие тексты; формулировки свои.
