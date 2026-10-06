import type { Exercise } from './types';

const ex: Exercise[] = [
  {
    id: 'ts-fn-total',
    lesson: 'ts-functions',
    kind: 'ts',
    title: 'Функция суммы корзины',
    goal: 'Напишите и экспортируйте функцию `cartTotal(items)`: она получает массив позиций `{ price: number; qty: number }` и возвращает сумму `price * qty`. Для пустого массива — `0`.',
    starter: `export interface Item { price: number; qty: number }

export function cartTotal(items: Item[]): number {
  // TODO
  return 0;
}
`,
    solution: `export interface Item { price: number; qty: number }

export function cartTotal(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price * item.qty;
  }
  return total;
}
`,
    alternatives: ['items.reduce((sum, i) => sum + i.price * i.qty, 0)'],
    explanation: 'Функция проходит по всем позициям и накапливает сумму. Начальное значение `0` делает результат для пустой корзины корректным. Тот же результат даёт `reduce` с начальным значением `0` — без него `reduce` на пустом массиве бросает `TypeError`.',
    hints: [
      'Нужно пройти по всем элементам массива и сложить стоимость каждой позиции.',
      'Заведите переменную `total = 0`, в цикле `for (const item of items)` прибавляйте `item.price * item.qty`.',
      '`total += item.price * item.qty;` внутри цикла, `return total;` после него.',
    ],
    mistakes: ['Сложить только `price` без `qty` — именно такой дефект «сумма не учитывает количество» ловит тест магазина.', '`reduce` без начального значения: на пустом массиве — ошибка.'],
    check: `import { cartTotal } from './student';
test('пустая корзина — 0', () => expectEq(cartTotal([]), 0));
test('одна позиция', () => expectEq(cartTotal([{ price: 390, qty: 1 }]), 390));
test('количество учитывается', () => expectEq(cartTotal([{ price: 390, qty: 2 }, { price: 4990, qty: 1 }]), 5770));
test('нулевая цена', () => expectEq(cartTotal([{ price: 0, qty: 3 }, { price: 590, qty: 4 }]), 2360));
`,
  },
];
export default ex;
