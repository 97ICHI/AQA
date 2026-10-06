import type { Exercise } from './types';

// Модуль 7 «SQL для тестировщика». Все задания проверяются на настоящем PostgreSQL (PGlite)
// на нескольких наборах данных: запрос, подогнанный под один набор, не проходит.

const paramsCheck = `import { ordersByEmailQuery } from './student';

const placeholderFor = (text: string, column: string): number | null => {
  const a = new RegExp(column + '\\\\s*=\\\\s*\\\\$(\\\\d+)', 'i').exec(text);
  const b = new RegExp('\\\\$(\\\\d+)\\\\s*=\\\\s*[a-z_]*\\\\.?' + column, 'i').exec(text);
  const m = a ?? b;
  return m ? Number(m[1]) : null;
};

test('значения передаются в values, а не в текст запроса', () => {
  const q = ordersByEmailQuery('anna@example.test', 'paid');
  expectTrue(Array.isArray(q.values), 'values должен быть массивом');
  expectEq(q.values.length, 2, 'в values должно быть ровно два значения');
  expectTrue(q.values.includes('anna@example.test'), 'email должен быть среди values');
  expectTrue(q.values.includes('paid'), 'статус должен быть среди values');
  expectTrue(!q.text.includes('anna@example.test'), 'email не должен попадать в текст запроса');
});

test('опасный ввод не меняет текст запроса', () => {
  const evil = "x' OR '1'='1";
  const q1 = ordersByEmailQuery(evil, "new' --");
  const q2 = ordersByEmailQuery('boris@example.test', 'shipped');
  expectTrue(!q1.text.includes("OR '1'='1"), 'введённая строка оказалась внутри SQL — это SQL-инъекция');
  expectEq(q1.text, q2.text, 'текст запроса не должен зависеть от значений');
  expectEq(q1.values.includes(evil), true, 'опасная строка должна уйти в values как обычное значение');
});

test('каждый плейсхолдер указывает на нужное значение', () => {
  const q = ordersByEmailQuery('vera@example.test', 'cancelled');
  const e = placeholderFor(q.text, 'email');
  const s = placeholderFor(q.text, 'status');
  expectTrue(e !== null, 'в тексте нет условия вида email = $N');
  expectTrue(s !== null, 'в тексте нет условия вида status = $N');
  expectEq(q.values[(e ?? 0) - 1], 'vera@example.test', 'плейсхолдер email указывает не на email');
  expectEq(q.values[(s ?? 0) - 1], 'cancelled', 'плейсхолдер status указывает не на статус');
  const used = [...q.text.matchAll(/\\$(\\d+)/g)].map((m) => Number(m[1]));
  expectTrue(used.every((n) => n >= 1 && n <= q.values.length), 'есть плейсхолдер без значения');
});
`;

const ex: Exercise[] = [
  {
    id: 'sql-top3-price',
    lesson: 'sql-select',
    kind: 'sql',
    title: 'Три самых дорогих товара',
    goal: 'Выведите `title` и `price` трёх самых дорогих товаров. При равной цене товары идут по `title` по алфавиту.',
    starter: `SELECT title, price
FROM products
ORDER BY price DESC;
-- TODO: оставьте только три строки и сделайте порядок однозначным
`,
    solution: `SELECT title, price
FROM products
ORDER BY price DESC, title
LIMIT 3;`,
    reference: `SELECT title, price FROM products ORDER BY price DESC, title LIMIT 3`,
    ordered: true,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`ORDER BY price DESC` ставит дорогие товары первыми, второй ключ `title` решает, кто идёт раньше при равной цене, а `LIMIT 3` отрезает первые три строки. На наборе «Граничные случаи» две книги стоят по 990 — без второго ключа PostgreSQL вправе вернуть их в любом порядке, и в тройку может попасть «не та» книга. На наборе «Без заказов» товар один — `LIMIT 3` просто вернёт одну строку.',
    hints: [
      'Ограничить число строк помогает `LIMIT`, а порядок задаёт `ORDER BY`.',
      'В `ORDER BY` можно перечислить несколько ключей через запятую: второй работает, когда первый равен.',
      '`ORDER BY price DESC, title LIMIT 3`',
    ],
    mistakes: ['`LIMIT` без `ORDER BY` возвращает «какие-то» три строки — порядок без сортировки не гарантирован.', '`ORDER BY price, title` без `DESC` — это три самых дешёвых.'],
    alternatives: ['SELECT title, price FROM products ORDER BY price DESC, title FETCH FIRST 3 ROWS ONLY'],
  },
  {
    id: 'sql-null-no-city',
    lesson: 'sql-null',
    kind: 'sql',
    title: 'Пользователи без города',
    goal: 'Выведите `email` и `name` пользователей, у которых город не указан (`city` — `NULL`). Порядок строк не важен.',
    starter: `SELECT email, name
FROM users
WHERE city = NULL;`,
    solution: `SELECT email, name
FROM users
WHERE city IS NULL;`,
    reference: `SELECT email, name FROM users WHERE city IS NULL`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`city = NULL` даёт не «истину», а `NULL` («неизвестно») для каждой строки, и `WHERE` не пропускает ни одной. Пустое значение ищут только через `IS NULL`. На наборе «Без заказов» у единственного пользователя город указан — правильный ответ там пустой.',
    hints: [
      'Сравнение с `NULL` через `=` не работает: результат не «истина», а «неизвестно».',
      'Для проверки на пустоту в SQL есть отдельный оператор.',
      '`WHERE city IS NULL`',
    ],
    mistakes: ["`city = ''` ищет пустую строку, а не отсутствующее значение — это разные вещи.", '`city = NULL` всегда возвращает 0 строк, и тест на таком запросе «ничего не находит» без ошибки.'],
  },
  {
    id: 'sql-null-count',
    lesson: 'sql-null',
    kind: 'sql',
    title: 'Сколько пользователей без города',
    goal: 'Одной строкой выведите два числа: сколько всего пользователей и у скольких из них город не указан.',
    starter: `SELECT COUNT(*) AS total,
       COUNT(city) AS without_city
FROM users;`,
    solution: `SELECT COUNT(*) AS total,
       COUNT(*) - COUNT(city) AS without_city
FROM users;`,
    reference: `SELECT COUNT(*), COUNT(*) FILTER (WHERE city IS NULL) FROM users`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`COUNT(*)` считает строки, а `COUNT(city)` — только строки, где `city` не `NULL`. Значит, `COUNT(city)` — это пользователи *с* городом, а без города — разница. Так же работает `COUNT(*) FILTER (WHERE city IS NULL)` или `SUM(CASE WHEN city IS NULL THEN 1 ELSE 0 END)`.',
    hints: [
      'Подумайте, какие строки считает `COUNT(city)`, а какие — `COUNT(*)`.',
      '`COUNT(столбец)` пропускает `NULL`. Пользователи без города — это все минус пользователи с городом.',
      '`COUNT(*) - COUNT(city)`',
    ],
    mistakes: ['`COUNT(city)` во втором столбце — это количество пользователей *с* городом.', '`COUNT(city IS NULL)` считает все строки: выражение `city IS NULL` никогда не бывает `NULL`, только true или false.'],
    alternatives: ['SELECT COUNT(*), SUM(CASE WHEN city IS NULL THEN 1 ELSE 0 END) FROM users'],
  },
  {
    id: 'sql-join-users-orders',
    lesson: 'sql-join',
    kind: 'sql',
    title: 'Все пользователи и их заказы',
    goal: 'Выведите `email` пользователя и `id` его заказа — по строке на каждый заказ. Пользователи без заказов тоже должны попасть в результат (с `NULL` вместо `id` заказа). Порядок не важен.',
    starter: `SELECT u.email, o.id
FROM users u
JOIN orders o ON o.user_id = u.id;`,
    solution: `SELECT u.email, o.id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;`,
    reference: `SELECT u.email, o.id FROM users u LEFT JOIN orders o ON o.user_id = u.id`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`JOIN` (он же `INNER JOIN`) оставляет только пары, для которых нашлось совпадение, поэтому пользователь без заказов исчезает: в основном наборе это Глеб, в граничном — Нина, в наборе «Без заказов» — вообще все. `LEFT JOIN` сохраняет каждую строку левой таблицы и подставляет `NULL` в столбцы правой, если пары нет.',
    hints: [
      'Сравните результат с таблицей `users`: кого не хватает?',
      'Нужен тип соединения, который сохраняет все строки левой таблицы, даже без пары.',
      '`FROM users u LEFT JOIN orders o ON o.user_id = u.id`',
    ],
    mistakes: ['`INNER JOIN` молча теряет пользователей без заказов — отчёт «по всем пользователям» становится неполным.', 'Условие `WHERE o.status = …` после `LEFT JOIN` снова отбрасывает строки с `NULL` — фильтр по правой таблице ставят в `ON`.'],
    alternatives: ['SELECT u.email, o.id FROM orders o RIGHT JOIN users u ON u.id = o.user_id'],
  },
  {
    id: 'sql-group-order-sums',
    lesson: 'sql-group',
    kind: 'sql',
    title: 'Крупные заказы по сумме позиций',
    goal: 'Для каждого заказа посчитайте сумму позиций `qty * price` из `order_items`. Выведите `order_id` и сумму только для заказов дороже 1000, от больших сумм к меньшим; при равной сумме — по `order_id`.',
    starter: `SELECT order_id, SUM(price) AS total
FROM order_items
GROUP BY order_id
ORDER BY total DESC;`,
    solution: `SELECT order_id, SUM(qty * price) AS total
FROM order_items
GROUP BY order_id
HAVING SUM(qty * price) > 1000
ORDER BY total DESC, order_id;`,
    reference: `SELECT order_id, SUM(qty * price) FROM order_items GROUP BY order_id HAVING SUM(qty * price) > 1000 ORDER BY 2 DESC, 1`,
    ordered: true,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`GROUP BY order_id` собирает позиции каждого заказа в группу, `SUM(qty * price)` складывает стоимость позиций с учётом количества. Условие на сумму — это условие на *группу*, поэтому оно в `HAVING`: `WHERE` работает до группировки и про сумму ещё ничего не знает. На граничном наборе у заказов 202 и 206 одинаковая сумма 4990, поэтому без второго ключа сортировки порядок не определён.',
    hints: [
      'Стоимость позиции — это цена, умноженная на количество. Фильтр по сумме группы ставится не в `WHERE`.',
      'После `GROUP BY` условие на агрегат пишут в `HAVING`; для равных сумм нужен второй ключ сортировки.',
      '`HAVING SUM(qty * price) > 1000 ORDER BY total DESC, order_id`',
    ],
    mistakes: ['`SUM(price)` без `qty` — та же ошибка, что дефект «сумма не учитывает количество».', '`WHERE SUM(...) > 1000` — ошибка PostgreSQL: агрегаты в `WHERE` запрещены.'],
    alternatives: ['SELECT * FROM (SELECT order_id, SUM(qty * price) AS s FROM order_items GROUP BY order_id) t WHERE s > 1000 ORDER BY s DESC, order_id'],
  },
  {
    id: 'sql-group-orders-per-user',
    lesson: 'sql-group',
    kind: 'sql',
    title: 'Количество заказов у каждого пользователя',
    goal: 'Выведите `email` каждого пользователя и число его заказов. У пользователей без заказов должно быть `0`. Порядок не важен.',
    starter: `SELECT u.email, COUNT(*) AS orders_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.email;`,
    solution: `SELECT u.email, COUNT(o.id) AS orders_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.email;`,
    reference: `SELECT u.email, COUNT(o.id) FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id, u.email`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: 'После `LEFT JOIN` у пользователя без заказов остаётся одна строка, где все столбцы `orders` — `NULL`. `COUNT(*)` считает эту строку и выдаёт 1. `COUNT(o.id)` пропускает `NULL` и даёт честный 0. Группировать можно по `u.email` или по `u.id, u.email` — результат одинаковый, потому что email уникален.',
    hints: [
      'Посмотрите на пользователя без заказов: сколько строк у него после `LEFT JOIN` и что в них лежит?',
      '`COUNT(*)` считает строки, `COUNT(столбец)` — только непустые значения.',
      '`COUNT(o.id)` вместо `COUNT(*)`',
    ],
    mistakes: ['`COUNT(*)` с `LEFT JOIN` превращает «0 заказов» в 1.', '`INNER JOIN` вместо `LEFT JOIN` — пользователи без заказов пропадают совсем.'],
    alternatives: ['SELECT u.email, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) FROM users u'],
  },
  {
    id: 'sql-sub-above-avg',
    lesson: 'sql-subquery',
    kind: 'sql',
    title: 'Товары дороже средней цены',
    goal: 'Выведите `title` и `price` товаров, цена которых выше средней цены всех товаров. Сортировка — от дорогих к дешёвым, при равной цене — по `title`.',
    starter: `SELECT title, price
FROM products
WHERE price > 2000  -- «примерно средняя»
ORDER BY price DESC, title;`,
    solution: `SELECT title, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC, title;`,
    reference: `WITH a AS (SELECT AVG(price) AS v FROM products) SELECT title, price FROM products, a WHERE price > a.v ORDER BY price DESC, title`,
    ordered: true,
    datasets: ['base', 'edge', 'empty'],
    explanation: 'Скалярный подзапрос `(SELECT AVG(price) FROM products)` возвращает одно число, и с ним можно сравнивать, как с константой. Число, вписанное руками, верно только для одного состояния базы: в основном наборе средняя цена 2856.67, в граничном — 1512, и любая новая строка в `products` её меняет. Если товар один, он равен средней и не проходит строгое `>`.',
    hints: [
      'Среднюю цену нельзя записать числом: на других данных она другая.',
      'Подзапрос в скобках, который возвращает одно значение, можно поставить прямо в `WHERE`.',
      '`WHERE price > (SELECT AVG(price) FROM products)`',
    ],
    mistakes: ['Подставить посчитанное вручную число — запрос «подогнан» под один набор данных.', '`HAVING price > AVG(price)` без подзапроса — агрегат считается по группе, а не по всей таблице.'],
    alternatives: ['WITH avg_price AS (SELECT AVG(price) AS v FROM products) SELECT p.title, p.price FROM products p CROSS JOIN avg_price WHERE p.price > avg_price.v ORDER BY p.price DESC, p.title'],
  },
  {
    id: 'sql-sub-no-orders',
    lesson: 'sql-subquery',
    kind: 'sql',
    title: 'Пользователи без единого заказа',
    goal: 'Выведите `email` пользователей, у которых нет ни одного заказа. Порядок не важен.',
    starter: `SELECT email
FROM users
WHERE is_active = false;`,
    solution: `SELECT u.email
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id
);`,
    reference: `SELECT u.email FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.id IS NULL`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`NOT EXISTS` проверяет для каждого пользователя, есть ли хотя бы одна строка в подзапросе. Подзапрос *коррелированный*: он ссылается на `u.id` внешнего запроса. Неактивность здесь ни при чём: в граничном наборе неактивная Лена сделала заказ, а активная Нина — нет. Тот же результат дают `LEFT JOIN … WHERE o.id IS NULL` и `NOT IN (SELECT user_id FROM orders)` — последний безопасен только потому, что `orders.user_id` не бывает `NULL`.',
    hints: [
      'Признак «нет заказов» берётся из таблицы `orders`, а не из `is_active`.',
      'Для каждого пользователя нужно проверить, существует ли его заказ: `EXISTS` / `NOT EXISTS`.',
      '`WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)`',
    ],
    mistakes: ['`NOT IN (подзапрос)` при наличии `NULL` в подзапросе возвращает 0 строк — с `NOT EXISTS` такой ловушки нет.', 'Перепутать неактивных пользователей и пользователей без заказов.'],
    alternatives: ['SELECT email FROM users WHERE id NOT IN (SELECT user_id FROM orders)', 'SELECT email FROM users EXCEPT SELECT u.email FROM users u JOIN orders o ON o.user_id = u.id'],
  },
  {
    id: 'sql-dml-insert-order',
    lesson: 'sql-dml',
    kind: 'sql',
    title: 'Тестовый заказ с ценой из каталога',
    goal: "Подготовьте данные для теста: добавьте заказ `id = 900` пользователю `1` (статус `new`, без промокода, дата `'2026-08-01'`) и одну позицию — товар `1`, количество `2`, **цена — текущая цена товара 1 из `products`**.",
    starter: `INSERT INTO orders (id, user_id, status, promo_code, created_at)
VALUES (900, 1, 'new', NULL, '2026-08-01');

INSERT INTO order_items (order_id, product_id, qty, price)
VALUES (900, 1, 2, 4990.00);`,
    solution: `INSERT INTO orders (id, user_id, status, promo_code, created_at)
VALUES (900, 1, 'new', NULL, '2026-08-01');

INSERT INTO order_items (order_id, product_id, qty, price)
SELECT 900, id, 2, price
FROM products
WHERE id = 1;`,
    reference: `INSERT INTO orders (id, user_id, status, promo_code, created_at) VALUES (900, 1, 'new', NULL, '2026-08-01');
INSERT INTO order_items (order_id, product_id, qty, price) SELECT 900, 1, 2, price FROM products WHERE id = 1;`,
    verify: `SELECT o.id, o.user_id, o.status, o.promo_code, o.created_at, i.product_id, i.qty, i.price FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE o.id = 900`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`INSERT … SELECT` вставляет строки, которые вернул `SELECT`, — так цена берётся из каталога, а не переписывается руками. Цена 4990 верна только для основного набора: в граничном товар 1 стоит 990, в наборе «Без заказов» — 390. Порядок вставок важен: сначала заказ, потом позиция, иначе внешний ключ `order_items.order_id` не найдёт заказ.',
    hints: [
      'Цена товара на разных наборах данных разная — её нельзя вписать числом.',
      'Вместо `VALUES` можно вставить результат `SELECT`: `INSERT INTO … (столбцы) SELECT …`.',
      '`INSERT INTO order_items (order_id, product_id, qty, price) SELECT 900, id, 2, price FROM products WHERE id = 1;`',
    ],
    mistakes: ['Вписать цену числом — тест работает на одной базе и ломается на другой.', 'Вставить позицию раньше заказа — ошибка внешнего ключа.'],
    alternatives: ["INSERT INTO orders VALUES (900, 1, 'new', NULL, '2026-08-01'); INSERT INTO order_items VALUES (900, 1, 2, (SELECT price FROM products WHERE id = 1));"],
  },
  {
    id: 'sql-dml-cleanup',
    lesson: 'sql-dml',
    kind: 'sql',
    title: 'Очистка: отменённые и пустые заказы',
    goal: 'Перед тестом списка заказов удалите отменённые заказы (`status = \'cancelled\'`) и заказы, в которых нет ни одной позиции. Остальные заказы должны остаться.',
    starter: `DELETE FROM orders
WHERE status = 'cancelled';`,
    solution: `DELETE FROM orders o
WHERE o.status = 'cancelled'
   OR NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);`,
    reference: `DELETE FROM orders WHERE status = 'cancelled' OR id NOT IN (SELECT order_id FROM order_items)`,
    verify: `SELECT id, status FROM orders`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`DELETE … WHERE` удаляет только строки, подходящие под условие; два признака соединяются через `OR`. «Нет позиций» — это `NOT EXISTS` из прошлого урока. Позиции и оплаты удалённых заказов исчезают сами: у внешних ключей стоит `ON DELETE CASCADE`. В основном наборе пустых заказов нет, в граничном пуст заказ 204 — поэтому стартовый запрос проходит на одном наборе и падает на другом.',
    hints: [
      'Условий два, и заказ удаляется, если выполнено любое из них.',
      'Заказ без позиций — это заказ, для которого не существует строк в `order_items`.',
      "`WHERE status = 'cancelled' OR NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = orders.id)`",
    ],
    mistakes: ['`DELETE FROM orders;` без `WHERE` удаляет всё — включая данные других тестов.', '`AND` вместо `OR` удаляет только отменённые заказы без позиций.'],
    alternatives: ['DELETE FROM orders o WHERE status = \'cancelled\' OR NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)'],
  },
  {
    id: 'sql-constraint-upsert',
    lesson: 'sql-constraints',
    kind: 'sql',
    title: 'Идемпотентная подготовка товара',
    goal: "Добавьте товар `id = 50`, `sku = 'NOTE-A5'`, «Блокнот A5», категория `stationery`, цена `390`, остаток `40`. Если товар с таким `sku` уже есть, ничего не делайте — запрос не должен падать.",
    starter: `INSERT INTO products (id, sku, title, category, price, stock)
VALUES (50, 'NOTE-A5', 'Блокнот A5', 'stationery', 390, 40);`,
    solution: `INSERT INTO products (id, sku, title, category, price, stock)
VALUES (50, 'NOTE-A5', 'Блокнот A5', 'stationery', 390, 40)
ON CONFLICT (sku) DO NOTHING;`,
    reference: `INSERT INTO products (id, sku, title, category, price, stock) SELECT 50, 'NOTE-A5', 'Блокнот A5', 'stationery', 390, 40 WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'NOTE-A5')`,
    verify: `SELECT id, sku, title, category, price, stock FROM products`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: 'Столбец `sku` объявлен `UNIQUE`, поэтому второй товар с тем же артикулом база не примет: обычный `INSERT` падает с `duplicate key value violates unique constraint`. `ON CONFLICT (sku) DO NOTHING` превращает конфликт в «ничего не делать». Подготовка данных становится *идемпотентной*: её можно запускать сколько угодно раз. В граничном наборе блокнота нет — он добавится; в двух других уже есть — останется прежний.',
    hints: [
      'Запустите стартовый запрос и прочитайте ошибку: какое ограничение нарушено?',
      'В PostgreSQL у `INSERT` есть ветка на случай конфликта уникальности.',
      '`ON CONFLICT (sku) DO NOTHING`',
    ],
    mistakes: ['Удалить существующий товар перед вставкой — на него ссылаются заказы, и внешний ключ этого не позволит.', '`ON CONFLICT (id)` — конфликт будет по `sku`, а не по `id`, и ошибка останется.'],
    alternatives: ["INSERT INTO products VALUES (50, 'NOTE-A5', 'Блокнот A5', 'stationery', 390, 40) ON CONFLICT DO NOTHING"],
  },
  {
    id: 'sql-tx-rollback',
    lesson: 'sql-transactions',
    kind: 'sql',
    title: 'Проверить и откатить',
    goal: 'Скрипт создаёт заказ, списывает остаток и проверяет результат, но оставляет изменения в базе. Сделайте так, чтобы проверка выполнилась, а после скрипта база осталась точно такой же, как до него.',
    starter: `BEGIN;
INSERT INTO orders (id, user_id, status, created_at)
VALUES (900, 1, 'new', '2026-08-01');
UPDATE products SET stock = stock - 1 WHERE id = 1;
SELECT id, stock FROM products WHERE id = 1;
COMMIT;`,
    solution: `BEGIN;
INSERT INTO orders (id, user_id, status, created_at)
VALUES (900, 1, 'new', '2026-08-01');
UPDATE products SET stock = stock - 1 WHERE id = 1;
SELECT id, stock FROM products WHERE id = 1;
ROLLBACK;`,
    reference: `SELECT 1`,
    verify: `SELECT p.id, p.stock, (SELECT COUNT(*) FROM orders) AS orders_count FROM products p`,
    ordered: false,
    datasets: ['base', 'edge', 'empty'],
    explanation: 'Внутри транзакции `SELECT` видит изменения — проверка работает. `ROLLBACK` отменяет всё, что сделано после `BEGIN`: и новый заказ, и списание остатка. Проверка задания смотрит на базу *после* скрипта: число заказов и остатки должны совпасть с исходными на каждом наборе.',
    hints: [
      'Какая команда в конце транзакции сохраняет изменения, а какая — отменяет?',
      '`COMMIT` фиксирует транзакцию, противоположная ей команда откатывает всё с момента `BEGIN`.',
      'Замените последнюю строку на `ROLLBACK;`',
    ],
    mistakes: ['Поставить `ROLLBACK` до проверочного `SELECT` — проверка увидит уже откатанные данные и ничего не докажет.', 'Писать «обратные» команды вручную (`DELETE`, `stock + 1`) — легко забыть одну из них, а `ROLLBACK` отменяет всё сразу.'],
  },
  {
    id: 'sql-check-order-diff',
    lesson: 'sql-check-order',
    kind: 'sql',
    title: 'Сверка позиций и оплат',
    goal: 'Для заказов в статусах `paid` и `shipped` найдите те, у которых сумма позиций (`qty * price`) не равна сумме **успешных** оплат (`payments.status = \'ok\'`). Выведите `id` заказа и разницу «позиции минус оплаты», по возрастанию `id`.',
    starter: `SELECT o.id, SUM(i.qty * i.price) - SUM(p.amount) AS diff
FROM orders o
JOIN order_items i ON i.order_id = o.id
JOIN payments p ON p.order_id = o.id
WHERE o.status IN ('paid', 'shipped')
GROUP BY o.id
HAVING SUM(i.qty * i.price) <> SUM(p.amount)
ORDER BY o.id;`,
    solution: `WITH items AS (
  SELECT order_id, SUM(qty * price) AS total
  FROM order_items
  GROUP BY order_id
), paid AS (
  SELECT order_id, SUM(amount) AS total
  FROM payments
  WHERE status = 'ok'
  GROUP BY order_id
)
SELECT o.id,
       COALESCE(i.total, 0) - COALESCE(p.total, 0) AS diff
FROM orders o
LEFT JOIN items i ON i.order_id = o.id
LEFT JOIN paid p ON p.order_id = o.id
WHERE o.status IN ('paid', 'shipped')
  AND COALESCE(i.total, 0) <> COALESCE(p.total, 0)
ORDER BY o.id;`,
    reference: `SELECT * FROM (SELECT o.id, (SELECT COALESCE(SUM(qty * price), 0) FROM order_items WHERE order_id = o.id) - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = o.id AND status = 'ok') AS diff FROM orders o WHERE o.status IN ('paid', 'shipped')) t WHERE diff <> 0 ORDER BY id`,
    ordered: true,
    datasets: ['base', 'edge', 'empty'],
    explanation: 'Если соединить заказ сразу с позициями и с оплатами, строки перемножаются: у заказа 101 две позиции и одна оплата — оплата посчитается дважды; у заказа 105 одна позиция и две оплаты — позиция посчитается дважды. Поэтому суммы считают отдельно (в CTE или подзапросах) и только потом сравнивают. `COALESCE(…, 0)` превращает «оплат нет» (`NULL`) в ноль — иначе разница тоже `NULL`, и заказ 202 с возвратом из граничного набора выпадет из отчёта. Неуспешные (`failed`) и возвращённые (`refunded`) платежи не считаются.',
    hints: [
      'Посчитайте отдельно для заказа 105 сумму позиций и сумму оплат и сравните с тем, что даёт стартовый запрос. Почему суммы удвоились?',
      'Посчитайте две суммы независимо — каждую по своей таблице — и только потом соедините их с `orders` через `LEFT JOIN`; учитывайте только `status = \'ok\'`.',
      '`WITH items AS (SELECT order_id, SUM(qty * price) AS total FROM order_items GROUP BY order_id), paid AS (… WHERE status = \'ok\' …)` и `COALESCE(i.total, 0) - COALESCE(p.total, 0)`',
    ],
    mistakes: ['Два `JOIN` к «многим» таблицам в одном запросе с `SUM` — суммы умножаются на число строк в другой таблице.', 'Забыть `status = \'ok\'` — неуспешная попытка оплаты засчитывается как деньги.', 'Без `COALESCE` заказ без оплат даёт `NULL`, и условие `<> 0` его отбрасывает.'],
  },
  {
    id: 'sql-params-query',
    lesson: 'sql-params',
    kind: 'ts',
    title: 'Запрос с плейсхолдерами',
    goal: 'Допишите `ordersByEmailQuery(email, status)`: она возвращает объект `{ text, values }` для node-postgres/PGlite — запрос заказов пользователя с данным email и статусом. Значения передайте через `$1`, `$2` в `values`, в текст запроса они попадать не должны.',
    starter: `export interface Query { text: string; values: unknown[] }

export function ordersByEmailQuery(email: string, status: string): Query {
  // Так делать нельзя: значения склеиваются с SQL
  const text =
    "SELECT o.id, o.status FROM orders o JOIN users u ON u.id = o.user_id " +
    "WHERE u.email = '" + email + "' AND o.status = '" + status + "'";
  return { text, values: [] };
}
`,
    solution: `export interface Query { text: string; values: unknown[] }

export function ordersByEmailQuery(email: string, status: string): Query {
  const text =
    'SELECT o.id, o.status FROM orders o JOIN users u ON u.id = o.user_id ' +
    'WHERE u.email = $1 AND o.status = $2';
  return { text, values: [email, status] };
}
`,
    check: paramsCheck,
    explanation: 'Текст запроса постоянный, а значения едут отдельно в `values`: `$1` — первый элемент, `$2` — второй. База получает их как *данные* и никогда не разбирает как SQL, поэтому строка `x\' OR \'1\'=\'1` ищется как обычный (несуществующий) email. Порядок может быть любым — `o.status = $1 AND u.email = $2` с `values: [status, email]` тоже правильно, важно, чтобы номер указывал на нужное значение.',
    hints: [
      'Текст запроса не должен меняться от входных данных: одинаковый для любого email.',
      'Вместо вставки значения в строку поставьте плейсхолдер `$1`, а само значение положите в массив `values` на позицию 0.',
      "`'… WHERE u.email = $1 AND o.status = $2'` и `values: [email, status]`",
    ],
    mistakes: ['Экранировать кавычки вручную (`replace(\"\'\", \"\'\'\")`) вместо параметров — легко забыть случай, и это всё ещё склейка.', 'Ставить плейсхолдер в кавычки: `\'$1\'` — это строка из двух символов, а не параметр.'],
    alternatives: ["{ text: 'SELECT … WHERE o.status = $1 AND u.email = $2', values: [status, email] }"],
  },
  {
    id: 'sql-win-top-per-category',
    lesson: 'sql-windows',
    kind: 'sql',
    title: 'Самый дорогой товар в каждой категории',
    goal: 'Для каждой категории выведите `category`, `title` и `price` самого дорогого товара. Если цены равны, выбирается товар, чей `title` раньше по алфавиту. Строки — по `category`.',
    starter: `SELECT category, MAX(title), MAX(price)
FROM products
GROUP BY category
ORDER BY category;`,
    solution: `SELECT category, title, price
FROM (
  SELECT category, title, price,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, title) AS rn
  FROM products
) ranked
WHERE rn = 1
ORDER BY category;`,
    reference: `SELECT DISTINCT ON (category) category, title, price FROM products ORDER BY category, price DESC, title`,
    ordered: true,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, title)` нумерует товары внутри каждой категории от самого дорогого: строки не схлопываются, как при `GROUP BY`, а получают номер. Остаётся взять номер 1. `MAX(title)` и `MAX(price)` из стартового запроса считаются независимо и могут взять название от одного товара, а цену — от другого. В граничном наборе две книги стоят по 990, и второй ключ `title` делает выбор однозначным.',
    hints: [
      'Агрегаты `MAX` считаются по столбцам независимо — название и цена могут оказаться от разных товаров.',
      'Пронумеруйте товары внутри каждой категории оконной функцией и оставьте первую строку.',
      '`ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, title) AS rn` во вложенном запросе, снаружи `WHERE rn = 1`',
    ],
    mistakes: ['Фильтровать `WHERE ROW_NUMBER() … = 1` в том же запросе — оконные функции вычисляются после `WHERE`, нужен подзапрос или CTE.', '`RANK()` вместо `ROW_NUMBER()` при равных ценах вернёт две строки на категорию.'],
    alternatives: ['WITH r AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, title) AS n FROM products) SELECT category, title, price FROM r WHERE n = 1 ORDER BY category'],
  },
];
export default ex;
