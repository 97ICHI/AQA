:::why
Проверочные запросы быстро становятся длинными: посчитать суммы, отфильтровать, сравнить с чем-то ещё. Если писать всё одним куском, ошибку не видно. Подзапросы и CTE позволяют разбить запрос на шаги, каждый из которых можно запустить и проверить отдельно.
:::

## Подзапрос — запрос внутри запроса

[[subquery|Подзапрос]] — это `SELECT` в скобках внутри другого запроса. Бывает трёх видов, и различаются они тем, что возвращают.

**Одно значение (скалярный подзапрос).** Его можно ставить туда, где ожидается число или строка:

```sql queries/above-average.sql
SELECT title, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC, title;
```

Сначала база считает среднюю цену, потом сравнивает с ней каждую строку. Средняя цена берётся из текущих данных, а не вписывается числом, поэтому запрос остаётся правильным на любой базе.

**Список значений.** Используется с `IN`:

```sql queries/paid-users.sql
SELECT email
FROM users
WHERE id IN (SELECT user_id FROM orders WHERE status = 'paid');
```

**Таблица.** Подзапрос в `FROM` работает как временная таблица; ему обязательно дают имя:

```sql queries/order-sums.sql
SELECT t.order_id, t.total
FROM (SELECT order_id, SUM(qty * price) AS total
      FROM order_items
      GROUP BY order_id) AS t
WHERE t.total > 1000;
```

## EXISTS и коррелированные подзапросы

Подзапрос может ссылаться на строку внешнего запроса. Такой подзапрос называют *коррелированным*: база выполняет его (логически) для каждой внешней строки. Чаще всего его используют с `EXISTS` — «существует ли хотя бы одна строка»:

```sql queries/users-without-orders.sql
SELECT u.email
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id
);
```

`SELECT 1` внутри — условность: `EXISTS` интересует только наличие строк, а не их содержимое.

## CTE: именованные шаги

[[cte|CTE]] (`WITH`) — это подзапрос, вынесенный в начало запроса и получивший имя. Читается сверху вниз, как список шагов:

```sql queries/order-check.sql
WITH items AS (            -- шаг 1: сумма позиций по заказу
  SELECT order_id, SUM(qty * price) AS total
  FROM order_items
  GROUP BY order_id
),
paid AS (                  -- шаг 2: сумма успешных оплат
  SELECT order_id, SUM(amount) AS total
  FROM payments
  WHERE status = 'ok'
  GROUP BY order_id
)
SELECT o.id, i.total AS items_total, p.total AS paid_total
FROM orders o
LEFT JOIN items i ON i.order_id = o.id
LEFT JOIN paid  p ON p.order_id = o.id
ORDER BY o.id;
```

Каждую часть можно отладить отдельно: запустить `SELECT … FROM order_items GROUP BY order_id`, убедиться, что суммы верные, и только потом соединять. Заодно решается проблема размножения строк из урока про JOIN: суммы считаются по одной таблице за раз, а соединяются уже готовые числа — одна строка на заказ.

:::try Отладьте по шагам
Запустите запрос. Затем замените последний `SELECT` на `SELECT * FROM paid` и посмотрите на промежуточный результат. Переключитесь на «Граничные случаи»: почему у заказа 202 нет суммы оплат?
:::

```widget
{"type":"playground","lang":"sql","title":"CTE: позиции и оплаты по шагам","dataset":"base","code":"WITH items AS (\n  SELECT order_id, SUM(qty * price) AS total\n  FROM order_items\n  GROUP BY order_id\n),\npaid AS (\n  SELECT order_id, SUM(amount) AS total\n  FROM payments\n  WHERE status = 'ok'\n  GROUP BY order_id\n)\nSELECT o.id, o.status, i.total AS items_total, p.total AS paid_total\nFROM orders o\nLEFT JOIN items i ON i.order_id = o.id\nLEFT JOIN paid  p ON p.order_id = o.id\nORDER BY o.id;\n"}
```

:::happened
В основном наборе у оплаченных и отправленных заказов суммы совпадают; у заказа 105 неуспешная попытка оплаты не учтена — её отсёк `WHERE status = 'ok'` внутри `paid`. У нового и отменённого заказов `paid_total` пустой: оплат нет. В граничном наборе оплата заказа 202 возвращена (`refunded`), поэтому успешных оплат у него нет — и это расхождение, которое тест должен заметить.
:::

## Задания

```widget
{"type":"exercise","id":"sql-sub-above-avg"}
```

```widget
{"type":"exercise","id":"sql-sub-no-orders"}
```

:::deep NOT IN против NOT EXISTS
`WHERE id NOT IN (SELECT user_id FROM orders)` работает, пока в подзапросе нет `NULL`. Как только он появится, условие для каждой строки станет «неизвестно», и запрос вернёт 0 строк — без ошибки. `NOT EXISTS` такой ловушки не имеет. В учебной базе `orders.user_id` объявлен `NOT NULL`, поэтому оба варианта работают; в чужой базе по привычке выбирайте `NOT EXISTS`.
:::

:::tech Производительность
Коррелированный подзапрос не обязательно выполняется построчно: планировщик PostgreSQL часто превращает `EXISTS` в соединение (semi-join). CTE в PostgreSQL 12+ по умолчанию встраиваются в основной запрос, если на них ссылаются один раз; принудительно отдельный шаг — `WITH x AS MATERIALIZED (…)`. Для проверочных запросов в тестах важнее читаемость, чем микрооптимизации.
:::

:::interview
**Вопрос:** «Как найти пользователей без заказов?» **Ответ по сути:** три способа — `NOT EXISTS` с коррелированным подзапросом, `LEFT JOIN … WHERE o.id IS NULL` и `NOT IN`. Предпочтительны первые два: `NOT IN` возвращает пустой результат, если в подзапросе встречается `NULL`.
:::

:::terms
[[subquery|подзапрос]], [[cte|CTE]], [[null-sql|NULL]]
:::
