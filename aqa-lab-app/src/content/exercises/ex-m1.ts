import type { Exercise } from './types';

const fixStarter = `import { test, expect } from '@playwright/test';

test('два блокнота в корзине стоят 780 ₽', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  const addButton = card.getByRole('button', { name: 'Добавить в корзину' });
  await addButton.click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await addButton.click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');
  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('Итого: 780 ₽');
});
`;

const ex: Exercise[] = [
  {
    id: 'm1-check-total',
    lesson: 'intro-what-is-test',
    kind: 'ts',
    title: 'Проверка, которая умеет говорить «нет»',
    goal: 'В пустую корзину дважды добавили «Блокнот A5» по 390 ₽. Функция `checkCartTotal(shownTotal)` получает итог, который показал магазин, и должна вернуть `\'passed\'`, только если итог совпал с ожидаемым, иначе — `\'failed\'`.',
    starter: `// Сценарий: в пустую корзину дважды добавили «Блокнот A5» по 390 ₽.
// shownTotal — итог, который показал магазин (фактический результат).
export function checkCartTotal(shownTotal: number): 'passed' | 'failed' {
  // TODO: сравните фактический итог с ожидаемым
  return 'passed';
}
`,
    solution: `// Сценарий: в пустую корзину дважды добавили «Блокнот A5» по 390 ₽.
// shownTotal — итог, который показал магазин (фактический результат).
export function checkCartTotal(shownTotal: number): 'passed' | 'failed' {
  const expected = 2 * 390; // ожидаемый результат считаем из условия, а не из программы
  return shownTotal === expected ? 'passed' : 'failed';
}
`,
    alternatives: ['if (shownTotal === 780) return \'passed\'; return \'failed\';'],
    explanation: 'Проверка — это сравнение фактического результата с ожидаемым. Ожидаемое значение (780) известно заранее из условия: 2 × 390. Стартовый код всегда отвечает «passed» — такой «тест» зелёный при любом поведении магазина и поэтому ничего не доказывает. Полезная проверка обязана падать, когда результат неправильный.',
    hints: [
      'Сначала посчитайте, какой итог должен быть по условию, — это ожидаемый результат.',
      'Сравните `shownTotal` с ожидаемым значением оператором `===` и верните `\'passed\'` или `\'failed\'`.',
      '`return shownTotal === 780 ? \'passed\' : \'failed\';`',
    ],
    mistakes: [
      'Всегда возвращать `\'passed\'`: проверка без возможности упасть — не проверка.',
      'Сравнивать с ценой одного блокнота (390): тогда «прошёл» бы как раз дефект «сумма не учитывает количество».',
    ],
    check: `import { checkCartTotal } from './student';
test('итог 780 ₽ — проверка проходит', () => expectEq(checkCartTotal(780), 'passed'));
test('итог 390 ₽ (не учтено количество) — проверка падает', () => expectEq(checkCartTotal(390), 'failed'));
test('итог 0 ₽ (товар не добавился) — проверка падает', () => expectEq(checkCartTotal(0), 'failed'));
test('итог 1170 ₽ (лишний блокнот) — проверка падает', () => expectEq(checkCartTotal(1170), 'failed'));
`,
  },
  {
    id: 'm1-fix-test',
    lesson: 'intro-failure',
    kind: 'pw',
    title: 'Тест падает на исправном магазине: найдите ошибку в тесте',
    goal: 'Этот тест падает даже на исправном магазине — значит, ошибка в самом тесте. Запустите его, прочитайте сообщения и исправьте тест, **не ослабляя проверку**: он должен проходить на исправном магазине и падать, если товар не добавляется или итог не учитывает количество.',
    starter: fixStarter,
    solution: fixStarter.replace("'Добавить в корзину'", "'В корзину'").replace("'Итого: 780 ₽'", "'780 ₽'"),
    alternatives: ["await expect(page.getByText('Итого: 780 ₽')).toBeVisible();"],
    explanation: 'В тесте две ошибки, и обе видны в сообщениях. Первая: кнопка называется «В корзину», а локатор ищет «Добавить в корзину» — Playwright ждёт несуществующую кнопку до таймаута теста. Вторая: `getByTestId(\'cart-total\')` указывает на элемент `<strong>` только с суммой, а ожидается текст вместе со словом «Итого:» — в сообщении видно `Received: "780 ₽"`. Сумма правильная, неправильное ожидание. Проверку итога нельзя удалять: именно она ловит дефект «сумма не учитывает количество».',
    hints: [
      'Запустите тест и прочитайте первое сообщение: на какой строке он остановился и чего ждал?',
      'Сравните имя кнопки в локаторе с тем, что написано на кнопке в магазине. После исправления запустите снова — появится вторая ошибка: сравните `Expected` и `Received`.',
      'Кнопка: `card.getByRole(\'button\', { name: \'В корзину\' })`. Итог: `toHaveText(\'780 ₽\')` — в элементе `cart-total` только сумма.',
    ],
    mistakes: [
      'Удалить последнюю проверку, чтобы тест «позеленел»: тогда дефект суммы останется незамеченным.',
      'Заменить ожидание на `toContainText(\'₽\')`: тест пройдёт и при неправильной сумме.',
      'Увеличить таймаут: кнопка с таким именем не появится никогда, ожидание тут ни при чём.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add', 'wrong-total'],
  },
];
export default ex;
