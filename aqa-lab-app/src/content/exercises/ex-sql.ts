import type { Exercise } from './types';

const ex: Exercise[] = [
  {
    id: 'sql-cheap-audio',
    lesson: 'sql-select',
    kind: 'sql',
    title: 'Недорогие товары категории audio',
    goal: 'Выведите `title` и `price` товаров категории `audio` дешевле 5000, от дешёвых к дорогим; при равной цене — по `title`.',
    starter: `SELECT title, price
FROM products
-- TODO: условие и сортировка
`,
    solution: `SELECT title, price
FROM products
WHERE category = 'audio' AND price < 5000
ORDER BY price, title;`,
    reference: `SELECT title, price FROM products WHERE category = 'audio' AND price < 5000 ORDER BY price, title`,
    ordered: true,
    datasets: ['base', 'edge', 'empty'],
    explanation: '`WHERE` оставляет только нужные строки, `ORDER BY price, title` задаёт порядок полностью: без второго ключа строки с одинаковой ценой могут прийти в любом порядке, и тест, сравнивающий список, станет нестабильным.',
    hints: [
      'Фильтр строк — `WHERE`, порядок — `ORDER BY`.',
      'Два условия соединяются через `AND`; строковое значение — в одинарных кавычках.',
      "`WHERE category = 'audio' AND price < 5000 ORDER BY price, title`",
    ],
    mistakes: ['`price <= 5000` — граница включена, а нужно «дешевле».', 'Без второго ключа сортировки результат на наборе «Граничные случаи» может отличаться порядком.'],
  },
];
export default ex;
