:::why
Некоторые ошибки база ловит сама: не даст создать два товара с одним артикулом или заказ несуществующего пользователя. Тестировщику полезно знать, какие правила проверяет база, а какие — нет. Первые можно использовать в негативных тестах, вторые придётся проверять запросами.
:::

## Ограничения — правила, которые база проверяет всегда

[[constraint|Ограничение]] (constraint) — правило в описании таблицы. База проверяет его при каждом `INSERT` и `UPDATE` и отказывается выполнять команду, если правило нарушено. Вот фрагмент схемы учебного магазина:

```sql schema/shop.sql
CREATE TABLE products (
  id       integer PRIMARY KEY,
  sku      text NOT NULL UNIQUE,
  title    text NOT NULL,
  price    numeric(10,2) NOT NULL CHECK (price >= 0),
  stock    integer NOT NULL DEFAULT 0 CHECK (stock >= 0)
  -- …
);
CREATE TABLE order_items (
  order_id   integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id),
  qty        integer NOT NULL CHECK (qty > 0),
  PRIMARY KEY (order_id, product_id)
  -- …
);
```

| Ограничение | Что запрещает | Пример ошибки PostgreSQL |
|---|---|---|
| `NOT NULL` | пустое значение | `null value in column "title" … violates not-null constraint` |
| `UNIQUE` | повтор значения | `duplicate key value violates unique constraint "products_sku_key"` |
| [[primary-key|PRIMARY KEY]] | повтор и пустоту ключа строки | `duplicate key value violates unique constraint "products_pkey"` |
| [[foreign-key|FOREIGN KEY]] (`REFERENCES`) | ссылку на несуществующую строку и удаление строки, на которую ссылаются | `violates foreign key constraint "order_items_product_id_fkey"` |
| `CHECK` | значение, для которого условие ложно | `violates check constraint "products_stock_check"` |

Первичный ключ может состоять из нескольких столбцов: в `order_items` это пара `(order_id, product_id)`. Значит, один товар в заказе встречается не более одного раза — повторное добавление должно увеличить `qty`, а не создать вторую строку.

:::try Нарушьте правила
Запустите каждую команду по очереди (остальные закомментируйте через `--`) и прочитайте сообщения. Какая из них прошла бы, если бы ограничения не было?
:::

```widget
{"type":"playground","lang":"sql","title":"Ограничения в действии","dataset":"base","code":"-- 1. Повтор артикула\nINSERT INTO products (id, sku, title, category, price) VALUES (10, 'NOTE-A5', 'Копия', 'stationery', 100);\n\n-- 2. Отрицательный остаток\n-- UPDATE products SET stock = stock - 100 WHERE sku = 'NOTE-A5';\n\n-- 3. Позиция с несуществующим товаром\n-- INSERT INTO order_items VALUES (101, 999, 1, 100);\n\n-- 4. Удаление товара, который есть в заказах\n-- DELETE FROM products WHERE id = 3;\n"}
```

:::happened
Каждая команда завершилась ошибкой, и данные не изменились. В сообщении есть имя ограничения (`products_sku_key`, `products_stock_check` и т. д.) — по нему понятно, какое правило сработало. Команда 2 особенно показательна для AQA: если бы `CHECK (stock >= 0)` не было, продажа больше остатка прошла бы молча, и остаток ушёл бы в минус.
:::

## Ограничения в тестах

**Негативные проверки на уровне API.** Если API позволяет создать товар с дублирующим артикулом, правильный ответ — `409 Conflict` или `422` с понятным сообщением. Если же API отвечает `500`, значит, ошибка базы дошла до пользователя необработанной. Это дефект, даже если данные не испортились.

**Чего ограничения не проверяют.** База разрешит заказ без позиций, оплату на сумму, не равную сумме заказа, и цену в позиции, отличную от цены в каталоге. Такие правила живут в коде приложения, и проверять их — работа тестов и проверочных запросов.

## Идемпотентная подготовка данных

Подготовка данных часто запускается повторно: тест перезапустили, два теста готовят один и тот же справочник. Обычный `INSERT` во второй раз упадёт на `UNIQUE`. В PostgreSQL на этот случай есть [[upsert|ON CONFLICT]]:

```sql seed/products.sql
INSERT INTO products (id, sku, title, category, price, stock)
VALUES (50, 'MUG-02', 'Кружка большая', 'home', 790, 10)
ON CONFLICT (sku) DO NOTHING;          -- уже есть — ничего не делать

INSERT INTO products (id, sku, title, category, price, stock)
VALUES (51, 'MUG-03', 'Кружка дорожная', 'home', 990, 5)
ON CONFLICT (sku) DO UPDATE SET stock = EXCLUDED.stock;  -- уже есть — обновить остаток
```

`EXCLUDED` — строка, которую пытались вставить. Такой скрипт можно запускать сколько угодно раз: состояние будет одним и тем же. Это свойство называют [[idempotency|идемпотентностью]].

## Задание

```widget
{"type":"exercise","id":"sql-constraint-upsert"}
```

:::deep Как посмотреть ограничения таблицы
Список ограничений хранится в системном каталоге: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'products'::regclass;`. Это полезно, когда вы впервые видите схему и хотите понять, какие негативные сценарии база закрывает сама. В `psql` то же показывает команда `\d products`.
:::

:::tech NULL в UNIQUE и CHECK
`UNIQUE` не считает два `NULL` одинаковыми: в столбце с `UNIQUE` может быть сколько угодно пустых значений (в PostgreSQL 15+ это меняется опцией `UNIQUE NULLS NOT DISTINCT`). `CHECK` пропускает строку, если условие дало `NULL`. Поэтому обязательность всегда задаётся отдельным `NOT NULL`.
:::

:::interview
**Вопрос:** «Какие ограничения целостности вы знаете и как они помогают тестированию?» **Ответ по сути:** `PRIMARY KEY`, `UNIQUE`, `NOT NULL`, `FOREIGN KEY`, `CHECK`. Они гарантируют базовую целостность, и их нарушение — ожидаемая ошибка для негативных тестов (а API должен превратить её в понятный 4xx, а не 500). Бизнес-правила вроде «сумма оплаты равна сумме заказа» ограничениями обычно не закрыты — их проверяют тесты.
:::

:::terms
[[constraint|ограничение]], [[primary-key|первичный ключ]], [[foreign-key|внешний ключ]], [[upsert|ON CONFLICT]], [[idempotency|идемпотентность]], [[negative-testing|негативное тестирование]]
:::
