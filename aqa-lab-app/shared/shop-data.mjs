// Единая учебная база магазина: используется SQL-тренажёром (PGlite в браузере) и учебным магазином runner (PGlite в Node).
// Все данные вымышленные. Наборы данных отличаются, чтобы запрос, «подогнанный» под один результат, не проходил проверку.

export const SCHEMA = `
CREATE TABLE users (
  id         integer PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  city       text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at date NOT NULL
);
CREATE TABLE products (
  id       integer PRIMARY KEY,
  sku      text NOT NULL UNIQUE,
  title    text NOT NULL,
  category text NOT NULL,
  price    numeric(10,2) NOT NULL CHECK (price >= 0),
  stock    integer NOT NULL DEFAULT 0 CHECK (stock >= 0)
);
CREATE TABLE orders (
  id         integer PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id),
  status     text NOT NULL CHECK (status IN ('new','paid','shipped','cancelled')),
  promo_code text,
  created_at date NOT NULL
);
CREATE TABLE order_items (
  order_id   integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id),
  qty        integer NOT NULL CHECK (qty > 0),
  price      numeric(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
CREATE TABLE payments (
  id       integer PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount   numeric(10,2) NOT NULL,
  method   text NOT NULL CHECK (method IN ('card','sbp','cash')),
  status   text NOT NULL CHECK (status IN ('ok','failed','refunded')),
  paid_at  date
);
`;

const BASE = `
INSERT INTO users VALUES
 (1,'anna@example.test','Анна','Москва',true,'2026-01-10'),
 (2,'boris@example.test','Борис','Казань',true,'2026-02-03'),
 (3,'vera@example.test','Вера',NULL,true,'2026-02-20'),
 (4,'gleb@example.test','Глеб','Москва',false,'2026-03-01'),
 (5,'dina@example.test','Дина','Пермь',true,'2026-03-15');
INSERT INTO products VALUES
 (1,'PULSE-01','Наушники Pulse','audio',4990.00,12),
 (2,'PULSE-02','Наушники Pulse Pro','audio',7990.00,3),
 (3,'NOTE-A5','Блокнот A5','stationery',390.00,40),
 (4,'LAMP-S','Лампа настольная','home',2490.00,0),
 (5,'CABLE-C','Кабель USB-C','audio',590.00,25),
 (6,'MUG-01','Кружка','home',690.00,8);
INSERT INTO orders VALUES
 (101,1,'paid',NULL,'2026-04-01'),
 (102,1,'new',NULL,'2026-04-03'),
 (103,2,'shipped','SPRING','2026-04-02'),
 (104,3,'cancelled',NULL,'2026-04-05'),
 (105,5,'paid',NULL,'2026-04-06');
INSERT INTO order_items VALUES
 (101,1,1,4990.00),(101,3,2,390.00),
 (102,6,1,690.00),
 (103,2,1,7990.00),(103,5,2,590.00),
 (104,4,1,2490.00),
 (105,3,5,390.00);
INSERT INTO payments VALUES
 (1,101,5770.00,'card','ok','2026-04-01'),
 (2,103,9170.00,'sbp','ok','2026-04-02'),
 (3,105,1950.00,'card','failed',NULL),
 (4,105,1950.00,'card','ok','2026-04-07');
`;

// Граничные случаи: NULL в городе и промокоде, пользователь без заказов, заказ без позиций и без оплаты,
// одинаковые цены (порядок при равенстве), возврат оплаты, неактивный пользователь с заказом.
const EDGE = `
INSERT INTO users VALUES
 (1,'ira@example.test','Ира',NULL,true,'2026-05-01'),
 (2,'kirill@example.test','Кирилл','Москва',true,'2026-05-02'),
 (3,'lena@example.test','Лена','Москва',false,'2026-05-03'),
 (4,'max@example.test','Макс','Самара',true,'2026-05-04'),
 (5,'nina@example.test','Нина',NULL,true,'2026-05-05'),
 (6,'oleg@example.test','Олег','Казань',true,'2026-05-06');
INSERT INTO products VALUES
 (1,'BOOK-QA','Книга о тестировании','books',990.00,5),
 (2,'BOOK-SQL','Книга о SQL','books',990.00,0),
 (3,'PULSE-01','Наушники Pulse','audio',4990.00,1),
 (4,'STICK-01','Наклейки','stationery',0.00,100),
 (5,'CABLE-C','Кабель USB-C','audio',590.00,2);
INSERT INTO orders VALUES
 (201,2,'paid','WELCOME','2026-06-01'),
 (202,2,'paid',NULL,'2026-06-02'),
 (203,3,'paid',NULL,'2026-06-02'),
 (204,4,'new',NULL,'2026-06-03'),
 (205,1,'shipped',NULL,'2026-06-04'),
 (206,6,'cancelled','WELCOME','2026-06-05');
INSERT INTO order_items VALUES
 (201,1,2,990.00),(201,4,3,0.00),
 (202,3,1,4990.00),
 (203,2,1,990.00),(203,5,4,590.00),
 (205,1,1,990.00),
 (206,3,1,4990.00);
INSERT INTO payments VALUES
 (10,201,1980.00,'card','ok','2026-06-01'),
 (11,202,4990.00,'sbp','refunded','2026-06-02'),
 (12,203,3350.00,'cash','ok','2026-06-03'),
 (13,205,990.00,'card','ok','2026-06-04');
`;

// Пустые таблицы заказов: проверяет, что запрос не падает и не выдумывает строки.
const EMPTY_ORDERS = `
INSERT INTO users VALUES (1,'solo@example.test','Соло','Омск',true,'2026-07-01');
INSERT INTO products VALUES (1,'NOTE-A5','Блокнот A5','stationery',390.00,40);
`;

export const DATASETS = {
  base: { title: 'Основной', description: 'Пять пользователей, шесть товаров, пять заказов с оплатами.', sql: BASE },
  edge: { title: 'Граничные случаи', description: 'NULL, пользователь без заказов, заказ без позиций, одинаковые цены, возврат.', sql: EDGE },
  empty: { title: 'Без заказов', description: 'Один пользователь и один товар, заказов и оплат нет.', sql: EMPTY_ORDERS },
};
