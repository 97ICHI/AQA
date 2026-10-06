import type { Exercise } from './types';

const ex: Exercise[] = [
  {
    id: 'intro-cart-total',
    lesson: 'intro-first-test',
    kind: 'pw',
    title: 'Тест корзины: добавить два блокнота и проверить сумму',
    goal: 'Допишите тест: дважды добавьте «Блокнот A5» в корзину, откройте корзину и проверьте, что итог — `780 ₽`. Тест должен проходить на исправном магазине и падать, если товар не добавляется или сумма не учитывает количество.',
    starter: `import { test, expect } from '@playwright/test';

test('два блокнота в корзине стоят 780 ₽', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  // TODO: добавьте второй блокнот, дождитесь счётчика корзины = 2,
  //       перейдите в корзину и проверьте итог
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('два блокнота в корзине стоят 780 ₽', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');
  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('780 ₽');
});
`,
    explanation: 'Каждое действие заканчивается проверкой состояния: счётчик корзины подтверждает, что клик сработал, прежде чем делать следующий шаг. `toHaveText` сам повторяет проверку до таймаута, поэтому тест устойчив к медленному магазину. Итог проверяется точным текстом — так ловится дефект, при котором сумма не учитывает количество.',
    hints: [
      'Тест без проверки ничего не доказывает: после действий нужен `expect`.',
      'Счётчик корзины доступен как `page.getByTestId(\'cart-count\')`, итог на странице корзины — `page.getByTestId(\'cart-total\')`.',
      '`await expect(page.getByTestId(\'cart-total\')).toHaveText(\'780 ₽\');` — после перехода по ссылке «Корзина».',
    ],
    mistakes: [
      'Проверка только того, что страница корзины открылась: тест пройдёт и с неправильной суммой.',
      '`expect(await locator.textContent()).toBe(...)` — однократное чтение без ожидания; на медленном магазине такой тест нестабилен.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add', 'wrong-total'],
  },
];
export default ex;
