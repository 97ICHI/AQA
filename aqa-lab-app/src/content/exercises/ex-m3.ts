import type { Exercise } from './types';

// Задания модуля m3 «JavaScript → TypeScript». Все проверки — по поведению: любые правильные решения проходят.
const ex: Exercise[] = [
  // ---------- ts-js-vs-ts ----------
  {
    id: 'm3-jsts-price-type',
    lesson: 'ts-js-vs-ts',
    kind: 'ts',
    title: 'Цена — число, а не строка',
    goal: 'В тестовых данных цена блокнота записана строкой, и TypeScript останавливает код ещё до запуска. Исправьте данные так, чтобы проверка типов прошла, `price` был равен `390`, а `total` — `780`.',
    starter: `export const title = 'Блокнот A5';
export const price: number = '390';
export const qty = 2;
export const total = price * qty;
`,
    solution: `export const title = 'Блокнот A5';
export const price: number = 390;
export const qty = 2;
export const total = price * qty;
`,
    alternatives: ["export const price: number = Number('390');"],
    explanation: 'Аннотация `: number` обещает, что в `price` лежит число. Строка `\'390\'` этому обещанию не соответствует — TypeScript сообщает об ошибке до запуска, и код даже не выполняется. После исправления `price * qty` считается как число: 780. Заметьте: убрать аннотацию `: number` было бы плохой идеей — тогда ошибку типа скрыло бы, а строка поехала бы дальше по тесту.',
    hints: [
      'Посмотрите на ошибку типа: что обещает аннотация `: number` и что на самом деле записано справа от `=`?',
      'Кавычки делают значение строкой. Число записывается без кавычек.',
      '`export const price: number = 390;`',
    ],
    mistakes: ['Удалить `: number` вместо исправления значения — ошибка типа пропадёт, но `price` останется строкой.'],
    check: `import { price, total } from './student';
test('price — число 390', () => expectEq(price, 390));
test('итог для двух блокнотов — 780', () => expectEq(total, 780));
test('price имеет тип number во время выполнения', () => expectEq(typeof price, 'number'));
`,
  },

  // ---------- ts-values ----------
  {
    id: 'm3-values-let',
    lesson: 'ts-values',
    kind: 'ts',
    title: 'Накопить сумму корзины',
    goal: 'Код считает сумму корзины: два блокнота по 390 ₽ и ручка за 120 ₽. Он не проходит проверку типов. Исправьте объявление так, чтобы `result` был равен `900`.',
    starter: `const notebookPrice = 390;
const penPrice = 120;

const total = 0;
total = total + notebookPrice * 2;
total = total + penPrice;

export const result = total;
`,
    solution: `const notebookPrice = 390;
const penPrice = 120;

let total = 0;
total = total + notebookPrice * 2;
total = total + penPrice;

export const result = total;
`,
    alternatives: ['const total = notebookPrice * 2 + penPrice;'],
    explanation: '`const` запрещает присваивать переменной новое значение, а код дважды меняет `total`. Для «накопителя» нужен `let`. Другой правильный путь — посчитать всё одним выражением и оставить `const`: тогда переприсваивания нет вовсе.',
    hints: [
      'Прочитайте сообщение об ошибке: какой переменной пытаются присвоить новое значение?',
      'Переменную, значение которой меняется, объявляют через `let`, а не через `const`.',
      '`let total = 0;`',
    ],
    mistakes: ['Объявить `let` для `notebookPrice` и `penPrice`: они не меняются, им подходит `const`.'],
    check: `import { result } from './student';
test('сумма корзины — 900', () => expectEq(result, 900));
`,
  },

  // ---------- ts-primitives ----------
  {
    id: 'm3-prim-price-label',
    lesson: 'ts-primitives',
    kind: 'ts',
    title: 'Подпись цены товара',
    goal: 'Функция `priceLabel(title, price)` должна возвращать строку вида `Блокнот A5 — 390 ₽` (название, пробел, длинное тире, пробел, цена, пробел, знак рубля). Измените выражение после `return`.',
    starter: `export function priceLabel(title: string, price: number): string {
  return title + price;
}
`,
    solution: `export function priceLabel(title: string, price: number): string {
  return \`\${title} — \${price} ₽\`;
}
`,
    alternatives: ["return title + ' — ' + price + ' ₽';"],
    explanation: 'Шаблонная строка в обратных кавычках подставляет значения через `${…}` и не требует ручной расстановки пробелов между кусками. Склеивание через `+` даёт тот же результат, если не забыть пробелы и разделитель.',
    hints: [
      'Сравните, что возвращает функция сейчас, с образцом: каких символов не хватает между названием и ценой?',
      'Используйте шаблонную строку в обратных кавычках и подставьте `title` и `price` через `${…}`.',
      '`` return `${title} — ${price} ₽`; ``',
    ],
    mistakes: ['Обычный дефис `-` вместо длинного тире `—`: строки сравниваются посимвольно.', 'Одинарные кавычки вместо обратных: `${price}` не подставится, а попадёт в строку как текст.'],
    check: `import { priceLabel } from './student';
test('блокнот', () => expectEq(priceLabel('Блокнот A5', 390), 'Блокнот A5 — 390 ₽'));
test('наушники', () => expectEq(priceLabel('Наушники Pulse', 4990), 'Наушники Pulse — 4990 ₽'));
test('бесплатный товар', () => expectEq(priceLabel('Пробник', 0), 'Пробник — 0 ₽'));
`,
  },

  // ---------- ts-conditions ----------
  {
    id: 'm3-cond-delivery',
    lesson: 'ts-conditions',
    kind: 'ts',
    title: 'Стоимость доставки',
    goal: 'Напишите тело `deliveryCost(total, isMember)`: доставка бесплатна (`0`), если сумма заказа **от 3000 ₽ включительно** или покупатель — участник клуба; иначе `300`.',
    starter: `export function deliveryCost(total: number, isMember: boolean): number {
  // TODO
  return 300;
}
`,
    solution: `export function deliveryCost(total: number, isMember: boolean): number {
  if (total >= 3000 || isMember) {
    return 0;
  }
  return 300;
}
`,
    alternatives: ['return total >= 3000 || isMember ? 0 : 300;'],
    explanation: 'Условие «или» записывается через `||`: достаточно одного истинного. Граница «от 3000 включительно» — это `>=`, а не `>`: заказ ровно на 3000 ₽ доставляется бесплатно. Проверка намеренно включает 2999 и 3000 — так ловят ошибку на границе.',
    hints: [
      'Есть два независимых повода для бесплатной доставки. Достаточно одного из них.',
      'Используйте `if` с условием через `||`; для «от 3000 включительно» нужен оператор `>=`.',
      '`if (total >= 3000 || isMember) { return 0; }` и после него `return 300;`',
    ],
    mistakes: ['`total > 3000` — заказ ровно на 3000 ₽ получит платную доставку.', '`&&` вместо `||` — бесплатно только участникам клуба с большим заказом.'],
    check: `import { deliveryCost } from './student';
test('2999 ₽, не участник — 300', () => expectEq(deliveryCost(2999, false), 300));
test('3000 ₽ (граница) — 0', () => expectEq(deliveryCost(3000, false), 0));
test('5000 ₽ — 0', () => expectEq(deliveryCost(5000, false), 0));
test('390 ₽, участник клуба — 0', () => expectEq(deliveryCost(390, true), 0));
`,
  },
  {
    id: 'm3-cond-nullish',
    lesson: 'ts-conditions',
    kind: 'ts',
    title: 'Скидка по умолчанию: ?? вместо ||',
    goal: 'Если у покупателя скидка не задана (`undefined`), действует скидка 5 %. Но `0` — это осознанное «без скидки», его нельзя заменять на 5. Исправьте `discountPercent` так, чтобы `0` оставался `0`.',
    starter: `export function discountPercent(saved: number | undefined): number {
  return saved || 5;
}
`,
    solution: `export function discountPercent(saved: number | undefined): number {
  return saved ?? 5;
}
`,
    alternatives: ['return saved === undefined ? 5 : saved;'],
    explanation: '`||` подставляет значение по умолчанию для любого «ложного» значения, а `0` — ложное. Поэтому `0 || 5` даёт 5. Оператор `??` подставляет значение по умолчанию только для `null` и `undefined`, и `0 ?? 5` даёт 0. Явная проверка `=== undefined` тоже правильна.',
    hints: [
      'Подумайте, что вернёт `0 || 5`. Почему?',
      'Нужен оператор, который заменяет только `null` и `undefined`, а не любое «ложное» значение.',
      '`return saved ?? 5;`',
    ],
    mistakes: ['`if (!saved) return 5;` — та же ошибка, что и с `||`: `!0` равно `true`.'],
    check: `import { discountPercent } from './student';
test('скидка не задана — 5', () => expectEq(discountPercent(undefined), 5));
test('осознанно без скидки — 0', () => expectEq(discountPercent(0), 0));
test('скидка 15 — 15', () => expectEq(discountPercent(15), 15));
`,
  },

  // ---------- ts-arrays-objects ----------
  {
    id: 'm3-obj-order-summary',
    lesson: 'ts-arrays-objects',
    kind: 'ts',
    title: 'Краткая сводка заказа',
    goal: 'Функция получает заказ и должна вернуть строку `Заказ №17: позиций 2, первая — Блокнот A5, город Казань`. Номер берётся из `id`, количество позиций — длина `items`, первая позиция — `items[0]`, город — из вложенного объекта `customer`.',
    starter: `export interface Order {
  id: number;
  items: { title: string; price: number; qty: number }[];
  customer: { name: string; city: string };
}

export function orderSummary(order: Order): string {
  return 'Заказ №' + order.id;
}
`,
    solution: `export interface Order {
  id: number;
  items: { title: string; price: number; qty: number }[];
  customer: { name: string; city: string };
}

export function orderSummary(order: Order): string {
  return \`Заказ №\${order.id}: позиций \${order.items.length}, первая — \${order.items[0].title}, город \${order.customer.city}\`;
}
`,
    alternatives: ['const { id, items, customer } = order; …'],
    explanation: 'Свойство объекта читается через точку: `order.id`. Элемент массива — по индексу с нуля: `order.items[0]`. Длина массива — `order.items.length`. Вложенный объект читается цепочкой: `order.customer.city`.',
    hints: [
      'Разберите строку-образец на части: какие из них берутся из объекта заказа?',
      'Первая позиция — элемент с индексом 0; количество позиций — свойство `length` массива.',
      '`order.items[0].title`, `order.items.length`, `order.customer.city`',
    ],
    mistakes: ['`order.items[1]` — это вторая позиция: индексы начинаются с нуля.', '`order.city` — города нет на верхнем уровне, он внутри `customer`.'],
    check: `import { orderSummary } from './student';
test('заказ из двух позиций', () => expectEq(orderSummary({ id: 17, items: [{ title: 'Блокнот A5', price: 390, qty: 2 }, { title: 'Ручка', price: 120, qty: 1 }], customer: { name: 'Анна', city: 'Казань' } }), 'Заказ №17: позиций 2, первая — Блокнот A5, город Казань'));
test('заказ из одной позиции', () => expectEq(orderSummary({ id: 3, items: [{ title: 'Наушники Pulse', price: 4990, qty: 1 }], customer: { name: 'Глеб', city: 'Пермь' } }), 'Заказ №3: позиций 1, первая — Наушники Pulse, город Пермь'));
`,
  },

  // ---------- ts-loops ----------
  {
    id: 'm3-loops-in-stock',
    lesson: 'ts-loops',
    kind: 'ts',
    title: 'Названия товаров в наличии',
    goal: 'Верните массив названий тех товаров, у которых `stock` больше нуля, в исходном порядке. Можно циклом `for…of` или методами `filter` и `map`.',
    starter: `export interface Product { title: string; price: number; stock: number }

export function inStockTitles(products: Product[]): string[] {
  return [];
}
`,
    solution: `export interface Product { title: string; price: number; stock: number }

export function inStockTitles(products: Product[]): string[] {
  return products.filter((p) => p.stock > 0).map((p) => p.title);
}
`,
    alternatives: ['const result: string[] = []; for (const p of products) { if (p.stock > 0) result.push(p.title); } return result;'],
    explanation: '`filter` оставляет элементы, для которых условие истинно, `map` превращает каждый оставшийся товар в его название. Цикл с `push` делает то же самое явно. Оба способа сохраняют порядок и для пустого списка возвращают пустой массив.',
    hints: [
      'Задача из двух шагов: отобрать нужные товары, затем взять у каждого название.',
      'Отбор — `filter` (или `if` в цикле), превращение товара в название — `map` (или `push(p.title)`).',
      '`products.filter((p) => p.stock > 0).map((p) => p.title)`',
    ],
    mistakes: ['`p.stock >= 0` — товар с нулевым остатком попадёт в список.', '`find` вместо `filter` — вернёт только первый подходящий товар.'],
    check: `import { inStockTitles } from './student';
const products = [
  { title: 'Блокнот A5', price: 390, stock: 12 },
  { title: 'Наушники Pulse', price: 4990, stock: 0 },
  { title: 'Ручка', price: 120, stock: 1 },
];
test('товары с остатком, по порядку', () => expectEq(inStockTitles(products), ['Блокнот A5', 'Ручка']));
test('пустой каталог', () => expectEq(inStockTitles([]), []));
test('всё распродано', () => expectEq(inStockTitles([{ title: 'Чехол', price: 590, stock: 0 }]), []));
`,
  },

  // ---------- ts-functions ----------
  {
    id: 'm3-fn-test-discount',
    lesson: 'ts-functions',
    kind: 'ts-test',
    title: 'Тесты для функции скидки',
    goal: 'Модуль `./app` экспортирует `applyDiscount(price, percent)` — цену после скидки в процентах (с округлением до рубля). Напишите тесты через `test` и `expectEq`, которые проходят на исправной функции и падают на сломанных.',
    starter: `import { applyDiscount } from './app';

test('скидка 10% на 1000 ₽', () => {
  // TODO: вызовите applyDiscount и сравните результат с ожидаемым
});
`,
    solution: `import { applyDiscount } from './app';

test('скидка 10% на 1000 ₽ — 900 ₽', () => {
  expectEq(applyDiscount(1000, 10), 900);
});

test('скидка 0% не меняет цену', () => {
  expectEq(applyDiscount(390, 0), 390);
});

test('скидка 50% на 4990 ₽ — 2495 ₽', () => {
  expectEq(applyDiscount(4990, 50), 2495);
});
`,
    good: `export function applyDiscount(price: number, percent: number): number {
  return Math.round(price * (100 - percent) / 100);
}
`,
    broken: [
      { name: 'Вычитает проценты как рубли', code: `export function applyDiscount(price: number, percent: number): number {
  return price - percent;
}
` },
      { name: 'Возвращает размер скидки, а не цену', code: `export function applyDiscount(price: number, percent: number): number {
  return Math.round(price * percent / 100);
}
` },
      { name: 'Не делит на 100', code: `export function applyDiscount(price: number, percent: number): number {
  return Math.round(price * (100 - percent));
}
` },
    ],
    explanation: 'Тест — это вызов функции с конкретными входными данными и сравнение результата с заранее посчитанным ожиданием. Одного случая «1000 ₽, 10 %» уже хватает, чтобы поймать все три дефекта; случаи с 0 % и 50 % добавляют уверенности на границе и с округлением.',
    hints: [
      'Тест без проверки проходит всегда — даже на сломанной функции. Внутри `test` нужен вызов `expectEq`.',
      'Посчитайте ожидаемый результат сами: 10 % от 1000 ₽ — это 100 ₽, значит, цена после скидки 900 ₽.',
      '`expectEq(applyDiscount(1000, 10), 900);`',
    ],
    mistakes: ['Ожидание посчитано той же формулой, что и в функции: тест повторяет ошибку кода вместо того, чтобы её поймать.'],
  },

  // ---------- ts-arrows ----------
  {
    id: 'm3-arrow-lines',
    lesson: 'ts-arrows',
    kind: 'ts',
    title: 'Строки корзины через map и destructuring',
    goal: 'Допишите стрелочную функцию `cartLines`: для каждой позиции верните строку `Блокнот A5 × 2 = 780 ₽` (название, `×`, количество, `=`, цена × количество, `₽`).',
    starter: `export interface Line { title: string; price: number; qty: number }

export const cartLines = (lines: Line[]): string[] => [];
`,
    solution: `export interface Line { title: string; price: number; qty: number }

export const cartLines = (lines: Line[]): string[] =>
  lines.map(({ title, price, qty }) => \`\${title} × \${qty} = \${price * qty} ₽\`);
`,
    alternatives: ['lines.map((line) => line.title + \' × \' + line.qty + \' = \' + line.price * line.qty + \' ₽\')'],
    explanation: 'В `map` передаётся callback — функция, которую `map` вызывает для каждой позиции. Запись `({ title, price, qty }) => …` сразу достаёт нужные свойства из объекта-позиции: это destructuring в параметре, та же запись, что `async ({ page }) => …` в тестах Playwright.',
    hints: [
      'Из каждой позиции нужно получить одну строку — это работа для `map`.',
      'Callback может сразу «распаковать» позицию: `({ title, price, qty }) => …`.',
      '`` lines.map(({ title, price, qty }) => `${title} × ${qty} = ${price * qty} ₽`) ``',
    ],
    mistakes: ['Фигурные скобки после стрелки без `return`: такая функция возвращает `undefined`, и массив будет из `undefined`.'],
    check: `import { cartLines } from './student';
test('две позиции', () => expectEq(cartLines([{ title: 'Блокнот A5', price: 390, qty: 2 }, { title: 'Ручка', price: 120, qty: 1 }]), ['Блокнот A5 × 2 = 780 ₽', 'Ручка × 1 = 120 ₽']));
test('пустая корзина', () => expectEq(cartLines([]), []));
`,
  },

  // ---------- ts-modules ----------
  {
    id: 'm3-mod-export',
    lesson: 'ts-modules',
    kind: 'ts',
    title: 'Экспортировать помощник из модуля',
    goal: 'Проверка импортирует из вашего модуля `formatRub` и `FREE_DELIVERY_FROM`: `import { formatRub, FREE_DELIVERY_FROM } from \'./student\'`. Сейчас импорт не работает. Сделайте оба имени доступными; `FREE_DELIVERY_FROM` должен быть равен `3000`.',
    starter: `// helpers/money.ts — общие помощники для тестов

function formatRub(amount: number): string {
  return amount + ' ₽';
}

const FREE_DELIVERY_FROM = 3000;
`,
    solution: `// helpers/money.ts — общие помощники для тестов

export function formatRub(amount: number): string {
  return amount + ' ₽';
}

export const FREE_DELIVERY_FROM = 3000;
`,
    alternatives: ['export { formatRub, FREE_DELIVERY_FROM }; — в конце файла'],
    explanation: 'Всё, что объявлено в модуле, по умолчанию видно только внутри него. Ключевое слово `export` делает имя доступным для `import` в других файлах. Можно поставить `export` перед объявлением или перечислить имена в `export { … }` в конце файла.',
    hints: [
      'Ошибка компилятора говорит, что у модуля нет такого экспортированного члена.',
      'Имена, которые нужны другим файлам, помечают ключевым словом `export`.',
      '`export function formatRub(…)` и `export const FREE_DELIVERY_FROM = 3000;`',
    ],
    mistakes: ['`export default formatRub` — тогда импорт пишется без фигурных скобок, и `import { formatRub }` его не найдёт.'],
    check: `import { formatRub, FREE_DELIVERY_FROM } from './student';
test('formatRub(390)', () => expectEq(formatRub(390), '390 ₽'));
test('порог бесплатной доставки', () => expectEq(FREE_DELIVERY_FROM, 3000));
`,
  },

  // ---------- ts-types ----------
  {
    id: 'm3-types-product',
    lesson: 'ts-types',
    kind: 'ts',
    title: 'Описать товар и функцию покупки',
    goal: 'Опишите тип `Product` с полями `id: number`, `title: string`, `price: number`, `stock: number` и напишите `canBuy(product, qty)`: `true`, если `qty` больше нуля и не больше остатка. Проверка также убеждается, что объект с ценой-строкой **не** проходит проверку типов.',
    starter: `export type Product = any;

export function canBuy(product: Product, qty: number): boolean {
  return true;
}
`,
    solution: `export interface Product {
  id: number;
  title: string;
  price: number;
  stock: number;
}

export function canBuy(product: Product, qty: number): boolean {
  return qty > 0 && qty <= product.stock;
}
`,
    alternatives: ['export type Product = { id: number; title: string; price: number; stock: number };'],
    explanation: '`type` и `interface` одинаково хорошо описывают форму объекта. С типом `any` TypeScript принимает что угодно — и цену-строку тоже; с точным описанием ошибка в тестовых данных видна до запуска. Логика `canBuy` проверяет обе границы: ноль и остаток.',
    hints: [
      'Замените `any` на описание объекта с четырьмя полями и их типами.',
      'Форма объекта: `{ id: number; title: string; … }` — через `type Product = …` или `interface Product { … }`. В `canBuy` нужны два условия через `&&`.',
      '`return qty > 0 && qty <= product.stock;`',
    ],
    mistakes: ['`price: number | string` — тогда цена-строка снова проходит проверку типов.', '`qty < product.stock` — нельзя купить последний товар.'],
    check: `import { canBuy, type Product } from './student';
const notebook: Product = { id: 1, title: 'Блокнот A5', price: 390, stock: 3 };
// Объект с ценой-строкой должен давать ошибку типа:
// @ts-expect-error — price должна быть числом
const broken: Product = { id: 2, title: 'Ручка', price: '120', stock: 5 };
void broken;
test('можно купить 1', () => expectEq(canBuy(notebook, 1), true));
test('можно купить весь остаток', () => expectEq(canBuy(notebook, 3), true));
test('нельзя больше остатка', () => expectEq(canBuy(notebook, 4), false));
test('нельзя 0 штук', () => expectEq(canBuy(notebook, 0), false));
`,
  },

  // ---------- ts-union ----------
  {
    id: 'm3-union-status',
    lesson: 'ts-union',
    kind: 'ts',
    title: 'Текст статуса заказа',
    goal: 'Верните текст статуса: `new` → `Новый`, `paid` → `Оплачен`, `cancelled` → `Отменён`, `shipped` → `Отправлен` или, если передан трек-номер, `Отправлен, трек RU123`.',
    starter: `export type OrderStatus = 'new' | 'paid' | 'shipped' | 'cancelled';

export function statusText(status: OrderStatus, track?: string): string {
  return status;
}
`,
    solution: `export type OrderStatus = 'new' | 'paid' | 'shipped' | 'cancelled';

export function statusText(status: OrderStatus, track?: string): string {
  if (status === 'new') return 'Новый';
  if (status === 'paid') return 'Оплачен';
  if (status === 'cancelled') return 'Отменён';
  return track ? \`Отправлен, трек \${track}\` : 'Отправлен';
}
`,
    alternatives: ['switch (status) { case \'new\': … }', 'const names: Record<OrderStatus, string> = { … }'],
    explanation: 'Union из строк перечисляет все допустимые статусы, и TypeScript не даст передать, например, `\'lost\'`. После трёх проверок `===` компилятор знает, что остался только `\'shipped\'` — это сужение типа. Необязательный параметр `track?` имеет тип `string | undefined`, поэтому перед использованием его проверяют.',
    hints: [
      'Сравните `status` с каждым вариантом через `===` и верните нужный текст.',
      'Для `shipped` дополнительно проверьте, передан ли `track`: если он есть — добавьте его к тексту.',
      '`` return track ? `Отправлен, трек ${track}` : \'Отправлен\'; ``',
    ],
    mistakes: ['`Отправлен, трек undefined` — трек подставлен без проверки, что он передан.'],
    check: `import { statusText } from './student';
test('new', () => expectEq(statusText('new'), 'Новый'));
test('paid', () => expectEq(statusText('paid'), 'Оплачен'));
test('cancelled', () => expectEq(statusText('cancelled'), 'Отменён'));
test('shipped без трека', () => expectEq(statusText('shipped'), 'Отправлен'));
test('shipped с треком', () => expectEq(statusText('shipped', 'RU123'), 'Отправлен, трек RU123'));
// @ts-expect-error — такого статуса нет
void (() => statusText('lost'));
`,
  },

  // ---------- ts-unknown ----------
  {
    id: 'm3-unknown-parse-order',
    lesson: 'ts-unknown',
    kind: 'ts',
    title: 'Проверить ответ API перед использованием',
    goal: 'Напишите `parseOrder(data: unknown)`: если `data` — объект, у которого `id` и `total` — **числа**, верните `{ id, total }`; иначе бросьте `Error`. Ответ `fakeFetchOrder(42)` с `total: \'9980\'` должен отклоняться.',
    starter: `export interface OrderTotal { id: number; total: number }

export function parseOrder(data: unknown): OrderTotal {
  return data as OrderTotal;
}
`,
    solution: `export interface OrderTotal { id: number; total: number }

export function parseOrder(data: unknown): OrderTotal {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Ответ не объект');
  }
  const o = data as Record<string, unknown>;
  if (typeof o.id !== 'number') throw new Error('id не число');
  if (typeof o.total !== 'number') throw new Error(\`total не число: \${JSON.stringify(o.total)}\`);
  return { id: o.id, total: o.total };
}
`,
    alternatives: ["if (!data || typeof data !== 'object' || !('id' in data) || !('total' in data)) throw …; const { id, total } = data; if (typeof id !== 'number' || typeof total !== 'number') throw …"],
    explanation: '`as OrderTotal` ничего не проверяет — это обещание компилятору, и строка `\'9980\'` проходит дальше. `unknown` заставляет сначала проверить значение: `typeof` и сравнение с `null` во время выполнения доказывают, что поля нужного типа. После проверки TypeScript сам сужает тип, и возвращаемый объект действительно соответствует `OrderTotal`.',
    hints: [
      'Привести тип через `as` — не проверка. Что должно произойти с ответом, где `total` — строка?',
      'Сначала убедитесь, что это объект и не `null`; затем проверьте `typeof … === \'number\'` для `id` и `total`; при нарушении — `throw new Error(…)`.',
      '`const o = data as Record<string, unknown>; if (typeof o.total !== \'number\') throw new Error(\'total не число\');`',
    ],
    mistakes: ['Тихо исправить `Number(o.total)`: тест перестанет замечать, что сервер нарушил контракт.', 'Забыть `data === null`: `typeof null` — тоже `\'object\'`.'],
    check: `import { parseOrder } from './student';
test('корректный объект', () => expectEq(parseOrder({ id: 1, total: 2990, status: 'paid' }), { id: 1, total: 2990 }));
test('total строкой — ошибка', () => expectThrows(() => parseOrder({ id: 42, total: '9980' }), 'total-строка должна отклоняться'));
test('null — ошибка', () => expectThrows(() => parseOrder(null), 'null должен отклоняться'));
test('строка вместо объекта — ошибка', () => expectThrows(() => parseOrder('{"id":1}'), 'строка должна отклоняться'));
test('нет total — ошибка', () => expectThrows(() => parseOrder({ id: 5 }), 'отсутствующий total должен отклоняться'));
test('нет id — ошибка', () => expectThrows(() => parseOrder({ total: 100 }), 'отсутствующий id должен отклоняться'));
test('ответ fakeFetchOrder(1) проходит', async () => expectEq(parseOrder(await fakeFetchOrder(1)), { id: 1, total: 2990 }));
test('ответ fakeFetchOrder(42) отклоняется', async () => { const data = await fakeFetchOrder(42); await expectThrows(() => parseOrder(data), 'total: "9980" должен отклоняться'); });
`,
  },

  // ---------- ts-async ----------
  {
    id: 'm3-async-forgotten-await',
    lesson: 'ts-async',
    kind: 'ts',
    title: 'Найти забытый await',
    goal: '`createOrder` должна вернуть количество заказов в «базе» **после** сохранения нового. Сейчас она возвращает старое число: запись ещё не завершилась. Исправьте функцию, не меняя `saveOrder`.',
    starter: `export const db: string[] = [];

async function saveOrder(sku: string): Promise<void> {
  await sleep(30); // запись в базу занимает время
  db.push(sku);
}

export async function createOrder(sku: string): Promise<number> {
  saveOrder(sku);
  return db.length;
}
`,
    solution: `export const db: string[] = [];

async function saveOrder(sku: string): Promise<void> {
  await sleep(30); // запись в базу занимает время
  db.push(sku);
}

export async function createOrder(sku: string): Promise<number> {
  await saveOrder(sku);
  return db.length;
}
`,
    alternatives: ['return saveOrder(sku).then(() => db.length);'],
    explanation: 'Без `await` вызов `saveOrder` только запускает запись и возвращает Promise, а функция сразу идёт дальше и читает `db.length`, пока запись ещё не случилась. TypeScript такой код не считает ошибкой — это «висящий» Promise. `await` приостанавливает `createOrder`, пока запись не завершится.',
    hints: [
      'Какую строку функция выполняет раньше, чем закончится запись в базу?',
      '`saveOrder` возвращает Promise. Чтобы дождаться его, нужен оператор, который ставят перед вызовом асинхронной функции.',
      '`await saveOrder(sku);`',
    ],
    mistakes: ['Добавить `await sleep(50)` перед `return` — «лечит» гонку подбором задержки; при медленной базе тест снова упадёт.'],
    check: `import { createOrder, db } from './student';
test('после первого заказа в базе 1 запись', async () => { db.length = 0; expectEq(await createOrder('PULSE-01'), 1); });
test('после второго — 2', async () => expectEq(await createOrder('NOTE-A5'), 2));
test('заказ действительно сохранён', () => expectEq(db, ['PULSE-01', 'NOTE-A5']));
// «Медленная база»: первая задержка внутри вызова длится на 300 мс дольше. Подбор задержки в createOrder здесь не спасает.
const realSleep = sleep;
let slowNext = false;
(globalThis as unknown as { sleep: typeof sleep }).sleep = (ms: number) => {
  const extra = slowNext ? 300 : 0;
  slowNext = false;
  return realSleep(ms + extra);
};
test('медленная база: результат после записи', async () => { slowNext = true; expectEq(await createOrder('PEN-01'), 3); });
`,
  },

  // ---------- ts-parallel ----------
  {
    id: 'm3-parallel-all',
    lesson: 'ts-parallel',
    kind: 'ts',
    title: 'Загрузить заказы параллельно',
    goal: 'Перепишите `loadOrders(ids)` так, чтобы все запросы `fakeFetchOrder` выполнялись **одновременно**, а результат был в том же порядке, что и `ids`. Проверка считает, сколько запросов было «в полёте» одновременно.',
    starter: `export async function loadOrders(ids: number[]): Promise<unknown[]> {
  const result: unknown[] = [];
  for (const id of ids) {
    result.push(await fakeFetchOrder(id));
  }
  return result;
}
`,
    solution: `export async function loadOrders(ids: number[]): Promise<unknown[]> {
  return Promise.all(ids.map((id) => fakeFetchOrder(id)));
}
`,
    alternatives: ['const promises = ids.map((id) => fakeFetchOrder(id)); return await Promise.all(promises);'],
    explanation: 'В цикле с `await` каждый следующий запрос начинается только после ответа на предыдущий: время складывается. `ids.map(…)` сразу запускает все запросы и даёт массив Promise; `Promise.all` ждёт их все и возвращает результаты **в порядке массива**, а не в порядке прихода ответов.',
    hints: [
      'Сейчас `await` внутри цикла ждёт каждый ответ, прежде чем отправить следующий запрос.',
      'Сначала запустите все запросы (получите массив Promise через `map`), потом дождитесь всех сразу.',
      '`return Promise.all(ids.map((id) => fakeFetchOrder(id)));`',
    ],
    mistakes: ['`ids.forEach(async (id) => result.push(await fakeFetchOrder(id)))` — `forEach` не ждёт callbacks, и функция вернёт пустой массив.'],
    check: `import { loadOrders } from './student';
const original = fakeFetchOrder;
let inFlight = 0, maxInFlight = 0;
(globalThis as unknown as { fakeFetchOrder: typeof fakeFetchOrder }).fakeFetchOrder = async (id: number) => {
  inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
  try { return await original(id); } finally { inFlight--; }
};
test('результаты в порядке ids', async () => {
  const orders = (await loadOrders([3, 1, 2])) as { id: number }[];
  expectEq(orders.map((o) => o.id), [3, 1, 2]);
});
test('запросы выполнялись одновременно', async () => {
  maxInFlight = 0;
  await loadOrders([10, 11, 12, 13]);
  expectEq(maxInFlight, 4, 'максимум одновременных запросов');
});
test('пустой список', async () => expectEq(await loadOrders([]), []));
`,
  },

  // ---------- ts-classes ----------
  {
    id: 'm3-class-cart',
    lesson: 'ts-classes',
    kind: 'ts',
    title: 'Класс корзины',
    goal: 'Допишите класс `Cart`: `add(title, price, qty = 1)` добавляет позицию, `count()` возвращает общее количество штук, `total()` — сумму. У каждой корзины своё содержимое: две корзины не должны влиять друг на друга.',
    starter: `export class Cart {
  add(title: string, price: number, qty: number = 1): void {
    // TODO
  }

  count(): number {
    return 0;
  }

  total(): number {
    return 0;
  }
}
`,
    solution: `interface Line { title: string; price: number; qty: number }

export class Cart {
  private lines: Line[] = [];

  add(title: string, price: number, qty: number = 1): void {
    this.lines.push({ title, price, qty });
  }

  count(): number {
    return this.lines.reduce((sum, l) => sum + l.qty, 0);
  }

  total(): number {
    return this.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  }
}
`,
    alternatives: ['private items: { price: number; qty: number }[] = []; и цикл for…of в count/total'],
    explanation: 'Поле `lines` объявлено в классе и создаётся заново для каждого `new Cart()` — поэтому корзины независимы. Методы обращаются к полю через `this`. Если хранить позиции в переменной вне класса или в `static`-поле, все корзины делили бы одно содержимое — именно такой дефект «общая корзина» встречается в учебном магазине.',
    hints: [
      'Корзине нужно где-то хранить добавленные позиции — это поле класса.',
      'Объявите поле-массив `private lines = []` с типом, в `add` делайте `this.lines.push(…)`, в `count`/`total` проходите по `this.lines`.',
      '`this.lines.reduce((sum, l) => sum + l.price * l.qty, 0)`',
    ],
    mistakes: ['Массив позиций объявлен вне класса: все экземпляры `Cart` работают с одним массивом.', 'Забыт `this.` — обращение к несуществующей переменной `lines`.'],
    check: `import { Cart } from './student';
test('пустая корзина', () => { const c = new Cart(); expectEq([c.count(), c.total()], [0, 0]); });
test('две позиции', () => {
  const c = new Cart();
  c.add('Блокнот A5', 390, 2);
  c.add('Ручка', 120);
  expectEq(c.count(), 3, 'count');
  expectEq(c.total(), 900, 'total');
});
test('корзины независимы', () => {
  const a = new Cart(); const b = new Cart();
  a.add('Наушники Pulse', 4990);
  expectEq([b.count(), b.total()], [0, 0], 'вторая корзина');
});
`,
  },

  // ---------- ts-generics ----------
  {
    id: 'm3-generic-find',
    lesson: 'ts-generics',
    kind: 'ts',
    title: 'Обобщённая функция findOrThrow',
    goal: 'Напишите обобщённую `findOrThrow<T>(items, predicate)`: возвращает первый элемент, для которого `predicate` вернул `true`, а если такого нет — бросает `Error`. Тип результата должен совпадать с типом элементов массива (не `any`).',
    starter: `export function findOrThrow(items: any[], predicate: (item: any) => boolean): any {
  return items[0];
}
`,
    solution: `export function findOrThrow<T>(items: T[], predicate: (item: T) => boolean): T {
  const found = items.find(predicate);
  if (found === undefined) {
    throw new Error('Элемент не найден');
  }
  return found;
}
`,
    alternatives: ['for (const item of items) { if (predicate(item)) return item; } throw new Error(…);'],
    explanation: '`<T>` — параметр типа: TypeScript подставляет вместо него тип элементов конкретного массива. Для массива товаров результат — товар, для массива заказов — заказ. С `any` проверка типов отключается: обращение к несуществующему полю или присваивание строки в число прошло бы молча.',
    hints: [
      'Объявите параметр типа после имени функции и используйте его в типе массива, предиката и результата.',
      '`function findOrThrow<T>(items: T[], predicate: (item: T) => boolean): T`; внутри — `items.find(predicate)` и проверка на `undefined`.',
      '`if (found === undefined) throw new Error(\'Элемент не найден\'); return found;`',
    ],
    mistakes: ['`return items.find(predicate)!` — восклицательный знак убирает ошибку типа, но не добавляет проверку: вместо понятной ошибки тест получит `undefined`.'],
    check: `import { findOrThrow } from './student';
const products = [{ title: 'Блокнот A5', price: 390 }, { title: 'Наушники Pulse', price: 4990 }];
const orders = [{ id: 1, status: 'new' }, { id: 2, status: 'paid' }];
test('находит товар', () => expectEq(findOrThrow(products, (p) => p.price > 1000).title, 'Наушники Pulse'));
test('находит заказ', () => expectEq(findOrThrow(orders, (o) => o.status === 'paid').id, 2));
test('первый подходящий', () => expectEq(findOrThrow([5, 7, 9], (n) => n > 6), 7));
test('не найдено — ошибка', () => expectThrows(() => findOrThrow(products, (p) => p.price > 100000), 'должна быть ошибка'));
// тип результата — товар, а не any: строка в число не присваивается
// @ts-expect-error — title имеет тип string
const n: number = findOrThrow(products, (p) => p.price > 0).title;
void n;
`,
  },

  // ---------- ts-config ----------
  {
    id: 'm3-config-strict',
    lesson: 'ts-config',
    kind: 'ts',
    title: 'Пройти strict-проверку',
    goal: 'Код написан без типов и не проходит `strict`. Товары — объекты `{ title, price }`. Добавьте типы параметров и обработайте случай «товар не найден»: `priceOf(products, title)` возвращает цену найденного товара, а для неизвестного названия бросает `Error`.',
    starter: `export function priceOf(products, title) {
  const product = products.find((p) => p.title === title);
  return product.price;
}
`,
    solution: `export interface Product { title: string; price: number }

export function priceOf(products: Product[], title: string): number {
  const product = products.find((p) => p.title === title);
  if (!product) {
    throw new Error(\`Товар не найден: \${title}\`);
  }
  return product.price;
}
`,
    alternatives: ['products: { title: string; price: number }[]'],
    explanation: 'В режиме `strict` параметр без типа — ошибка (неявный `any`), а `find` возвращает `Product | undefined`, и обращение к `.price` без проверки тоже ошибка. Без strict этот код компилировался бы, а в тесте с неизвестным названием упал бы во время выполнения с `TypeError: Cannot read properties of undefined`. Явная проверка превращает его в понятную ошибку.',
    hints: [
      'Прочитайте ошибки типов: их две разновидности — параметры без типа и значение, которое может быть `undefined`.',
      'Опишите товар (`{ title: string; price: number }`), укажите типы параметров; после `find` проверьте, что товар найден, иначе `throw`.',
      '`if (!product) throw new Error(\'Товар не найден\');`',
    ],
    mistakes: ['`products: any` — ошибка исчезает, но вместе с ней и вся проверка типов для этой функции.', '`product!.price` — компилятор замолкает, а падение во время выполнения остаётся.'],
    check: `import { priceOf } from './student';
const catalog = [{ title: 'Блокнот A5', price: 390 }, { title: 'Ручка', price: 120 }];
test('цена блокнота', () => expectEq(priceOf(catalog, 'Блокнот A5'), 390));
test('цена ручки', () => expectEq(priceOf(catalog, 'Ручка'), 120));
test('неизвестный товар — Error', async () => {
  try { priceOf(catalog, 'Глобус'); } catch (e) { expectTrue(e instanceof Error && !(e instanceof TypeError), 'ожидалась понятная Error, а не TypeError: ' + String(e)); return; }
  throw new Error('ошибка не была брошена');
});
`,
  },
];
export default ex;
