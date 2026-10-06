:::why
Тестировщику постоянно нужны числа: сумма заказа, сколько заказов у пользователя, сколько товаров закончилось. Такие числа считают по группам строк. Ошибка в группировке даёт правдоподобное, но неверное число, и тест сравнивает ожидание с ложным эталоном.
:::

## Агрегаты: много строк → одно значение

[[aggregate-function|Агрегатная функция]] сворачивает набор строк в одно значение:

| Функция | Что считает | Что делает с NULL |
|---|---|---|
| `COUNT(*)` | количество строк | считает и такие строки |
| `COUNT(col)` | количество непустых значений | пропускает |
| `SUM(col)` | сумму | пропускает; если значений нет — `NULL` |
| `AVG(col)` | среднее | пропускает |
| `MIN(col)`, `MAX(col)` | минимум, максимум | пропускает |

Без группировки агрегат работает по всей выборке: `SELECT COUNT(*) FROM orders WHERE status = 'paid'` — сколько оплаченных заказов.

## GROUP BY: по одной строке на группу

[[group-by|GROUP BY]] делит строки на группы с одинаковым значением и считает агрегат для каждой группы отдельно:

```sql queries/order-totals.sql
SELECT order_id,
       COUNT(*)          AS positions,
       SUM(qty)          AS units,
       SUM(qty * price)  AS total
FROM order_items
GROUP BY order_id
ORDER BY order_id;
```

Каждая строка результата — один заказ. Обратите внимание: сумма заказа — это `SUM(qty * price)`, а не `SUM(price)`. Цена в `order_items` — за одну штуку.

Правило для `SELECT` с группировкой: каждый столбец в списке либо стоит в `GROUP BY`, либо обёрнут в агрегат. Запрос `SELECT order_id, product_id, SUM(qty) … GROUP BY order_id` PostgreSQL не выполнит: в группе несколько `product_id`, и непонятно, какой показать.

## HAVING: фильтр по группам

`WHERE` отбирает строки **до** группировки, поэтому про сумму группы он ничего не знает. Условие на результат агрегата пишут в [[having|HAVING]] — он работает **после** группировки:

```sql queries/big-orders.sql
SELECT order_id, SUM(qty * price) AS total
FROM order_items
WHERE qty > 0                      -- условие на строки
GROUP BY order_id
HAVING SUM(qty * price) > 1000     -- условие на группы
ORDER BY total DESC, order_id;
```

:::try Посчитайте по статусам
Запустите запрос. Затем добавьте `HAVING COUNT(*) >= 2`, чтобы остались только статусы, в которых два заказа или больше. Попробуйте написать то же условие в `WHERE` и прочитайте ошибку PostgreSQL.
:::

```widget
{"type":"playground","lang":"sql","title":"Заказы по статусам","dataset":"base","code":"SELECT status,\n       COUNT(*)          AS orders,\n       COUNT(promo_code) AS with_promo,\n       MIN(created_at)   AS first_date\nFROM orders\nGROUP BY status\nORDER BY status;\n"}
```

:::happened
В основном наборе два заказа `paid` и по одному в остальных статусах, поэтому `HAVING COUNT(*) >= 2` оставляет одну строку. Условие в `WHERE` даёт ошибку `aggregate functions are not allowed in WHERE`: на этапе `WHERE` групп ещё нет. `COUNT(promo_code)` показывает, сколько заказов в группе с промокодом, — `NULL` не считаются.
:::

## LEFT JOIN + COUNT: ноль или единица

Классическая задача: «сколько заказов у каждого пользователя, включая тех, у кого их нет». Нужен `LEFT JOIN`, чтобы не потерять пользователей без заказов. Но после него у такого пользователя есть одна строка с `NULL` в столбцах `orders`, и `COUNT(*)` посчитает её как один заказ. Считать нужно непустые значения: `COUNT(o.id)`.

```widget
{"type":"playground","lang":"sql","title":"COUNT(*) против COUNT(o.id)","dataset":"base","code":"SELECT u.email,\n       COUNT(*)    AS count_star,\n       COUNT(o.id) AS count_orders\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id, u.email\nORDER BY u.id;\n"}
```

У Глеба `count_star` = 1, `count_orders` = 0. Правильный ответ — 0.

## Задания

```widget
{"type":"exercise","id":"sql-group-order-sums"}
```

```widget
{"type":"exercise","id":"sql-group-orders-per-user"}
```

:::deep Агрегат после размножения строк
Если сначала соединить заказ с двумя таблицами «многих» (позициями и оплатами), а потом сгруппировать, `SUM` сложит повторившиеся строки: сумма позиций умножится на число оплат и наоборот. Группировка не «лечит» лишние строки — она их добросовестно суммирует. Каждую сумму считают по своей таблице отдельно, а соединяют уже готовые суммы. Как это сделать удобно — в следующем уроке.
:::

:::tech Типы результата
`COUNT` в PostgreSQL возвращает `bigint`. `SUM` от `numeric(10,2)` — `numeric` с теми же двумя знаками: `5770.00`. `AVG` от целых — `numeric` с длинной дробной частью (`2856.6666666666666667`), поэтому в проверках среднее округляют: `ROUND(AVG(price), 2)`. Сумма по пустому набору — `NULL`; если в тесте ждёте 0, оберните в `COALESCE(SUM(...), 0)`.
:::

:::interview
**Вопрос:** «Чем отличается WHERE от HAVING?» **Ответ по сути:** `WHERE` фильтрует строки до группировки и не может использовать агрегаты; `HAVING` фильтрует группы после `GROUP BY` и работает с агрегатами. Условия на обычные столбцы лучше держать в `WHERE`: меньше строк попадает в группировку.
:::

:::terms
[[aggregate-function|агрегатная функция]], [[group-by|GROUP BY]], [[having|HAVING]], [[left-join|LEFT JOIN]]
:::
