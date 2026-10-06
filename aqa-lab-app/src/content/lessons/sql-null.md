:::why
Пустые значения — частый источник ложных результатов в проверках. Запрос с `= NULL` не падает с ошибкой, он просто ничего не находит, и тест делает неверный вывод «таких записей нет». Разберёмся, как SQL обращается с пустотой, чтобы такие проверки не обманывали.
:::

## NULL — это «неизвестно»

[[null-sql|NULL]] в SQL — не ноль, не пустая строка и не `false`. Это отметка «значение отсутствует или неизвестно». В учебной базе `NULL` бывает в `users.city` (город не указан), `orders.promo_code` (промокода нет) и `payments.paid_at` (оплата не прошла).

Главное правило: **любое сравнение с NULL даёт NULL**, то есть «неизвестно». Равен ли неизвестный город Москве? Неизвестно. Равен ли неизвестный город другому неизвестному городу? Тоже неизвестно. Поэтому:

```sql queries/null-compare.sql
SELECT NULL = NULL;     -- NULL, а не true
SELECT NULL <> 'Москва'; -- NULL, а не true
SELECT NULL IS NULL;    -- true
```

`WHERE` пропускает строку, только если условие **истинно**. «Неизвестно» — не истина, поэтому `WHERE city = NULL` не пропустит ни одной строки. Запрос выполнится без ошибки и вернёт пустой результат.

Для проверки на пустоту есть отдельные операторы: `IS NULL` и `IS NOT NULL`.

```sql queries/users-without-city.sql
SELECT email, name
FROM users
WHERE city IS NULL;
```

:::mistake Условие «не Москва» теряет пустые города
`WHERE city <> 'Москва'` не вернёт пользователей без города: для них условие даёт `NULL`. Если нужны «все, кроме москвичей, включая неизвестных», пишут `WHERE city IS DISTINCT FROM 'Москва'` или `WHERE city <> 'Москва' OR city IS NULL`.
:::

:::try Сравните три условия
Запустите запрос на основном наборе, затем на «Граничных случаях». Обратите внимание на строки, где `city` — `NULL`: в каком столбце они получают `true`, а где — пустое значение.
:::

```widget
{"type":"playground","lang":"sql","title":"NULL в условиях","dataset":"base","code":"SELECT name,\n       city,\n       city = 'Москва'               AS eq_moscow,\n       city <> 'Москва'              AS not_moscow,\n       city IS NULL                  AS is_null,\n       city IS DISTINCT FROM 'Москва' AS distinct_from\nFROM users\nORDER BY id;\n"}
```

:::happened
Для Веры (город не указан) столбцы `eq_moscow` и `not_moscow` пустые — это `NULL`, а не `false`. Значит, Вера не попадёт ни в выборку «москвичи», ни в выборку «не москвичи». Только `IS NULL` и `IS DISTINCT FROM` дают для неё определённый ответ.
:::

## NULL в подсчётах

Агрегатные функции тоже обходят `NULL` стороной:

- `COUNT(*)` считает **строки**;
- `COUNT(city)` считает строки, где `city` **не** `NULL`;
- `SUM`, `AVG`, `MIN`, `MAX` пропускают `NULL`; если непустых значений нет — возвращают `NULL`, а не 0.

Отсюда частая ошибка в проверках: «пользователей с городом 4, значит всего 4». На самом деле всего 5, просто у одного город пустой.

Подставить значение вместо `NULL` помогает `COALESCE(a, b, …)` — первое непустое из списка: `COALESCE(promo_code, 'без промокода')`, `COALESCE(SUM(amount), 0)`.

```widget
{"type":"playground","lang":"sql","title":"COUNT(*) и COUNT(столбец)","dataset":"edge","code":"SELECT COUNT(*)               AS all_orders,\n       COUNT(promo_code)      AS with_promo,\n       COUNT(DISTINCT promo_code) AS different_promos,\n       COALESCE(MAX(promo_code), 'нет') AS any_promo\nFROM orders;\n"}
```

## Задания

```widget
{"type":"exercise","id":"sql-null-no-city"}
```

```widget
{"type":"exercise","id":"sql-null-count"}
```

:::deep NOT IN и NULL
Самая коварная ловушка — `NOT IN` со списком, где есть `NULL`. Условие `x NOT IN (1, NULL)` означает `x <> 1 AND x <> NULL`. Вторая часть всегда «неизвестно», и всё условие никогда не бывает истинным. Запрос `WHERE id NOT IN (SELECT user_id FROM …)` вернёт 0 строк, если в подзапросе встретится хотя бы один `NULL`. Безопасная замена — `NOT EXISTS`, о нём в уроке про подзапросы.
:::

:::tech Логика трёх значений
В SQL у логических выражений три значения: `true`, `false` и `NULL`. `NULL AND false` = `false`, `NULL AND true` = `NULL`, `NULL OR true` = `true`, `NOT NULL` = `NULL`. Ограничение `CHECK` пропускает строку, если условие не `false` — то есть `NULL` ему подходит. Поэтому для обязательных столбцов нужно отдельное ограничение `NOT NULL`. В тренажёре пустое значение показывается как `NULL`.
:::

:::interview
**Вопрос:** «Чем отличаются `COUNT(*)` и `COUNT(column)`?» **Ответ по сути:** `COUNT(*)` считает все строки, `COUNT(column)` — только строки с непустым значением в этом столбце. Разница между ними — число `NULL`. В связке с `LEFT JOIN` это определяет, получите вы 0 или 1 для записи без связанных строк.
:::

:::terms
[[null-sql|NULL]], [[aggregate-function|агрегатная функция]]
:::
