:::why
Часто одну и ту же проверку нужно выполнить на разных данных: разные товары, разные количества, граничные значения. Копировать тест пять раз — значит пять раз исправлять его при изменении. Параметризация оставляет одну логику проверки и таблицу данных, а Playwright всё равно показывает каждую строку таблицы отдельным тестом.
:::

## Одна проверка — таблица данных

[[data-driven-testing|Data-driven тест]] состоит из двух частей: **таблицы случаев** (входные данные и ожидаемый результат) и **одной функции**, которая выполняет проверку для строки таблицы. В Playwright Test нет отдельного синтаксиса для этого: тесты объявляются обычным циклом.

```ts tests/cart-totals.spec.ts
import { test, expect } from '@playwright/test';

const cases = [
  { title: 'Блокнот A5',   qty: 2, total: '780 ₽' },
  { title: 'Кабель USB-C', qty: 3, total: '1 770 ₽' },
  { title: 'Кружка',       qty: 1, total: '690 ₽' },
];

for (const c of cases) {
  test(`${c.title} × ${c.qty} → итог ${c.total}`, async ({ page }) => {
    await page.goto('/');
    const card = page.getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: c.title, exact: true }) });
    for (let i = 1; i <= c.qty; i++) {
      await card.getByRole('button', { name: 'В корзину' }).click();
      await expect(page.getByTestId('cart-count')).toHaveText(String(i));
    }
    await page.goto('/cart');
    await expect(page.getByTestId('cart-total')).toHaveText(c.total);
  });
}
```

Три важных детали:

1. **Цикл снаружи `test`.** Playwright сначала читает файл и собирает список тестов, потом выполняет. Цикл при чтении файла объявляет три теста.
2. **Уникальное название.** В название входят данные строки. Одинаковые названия в одном файле Playwright не примет: это ошибка ещё до запуска. А в отчёте сразу видно, какая строка упала.
3. **Проверка после каждого клика.** Счётчик корзины подтверждает, что клик сработал, прежде чем нажимать снова.

:::try Запустите таблицу на магазине с дефектом
В этом варианте магазина сумма корзины не учитывает количество. Посмотрите, какие строки таблицы упадут, а какие пройдут.
:::

```widget
{"type":"playground","lang":"pw","title":"Таблица случаев: дефект «сумма без количества»","variant":"wrong-total","code":"import { test, expect } from '@playwright/test';\n\nconst cases = [\n  { title: 'Блокнот A5', qty: 2, total: '780 ₽' },\n  { title: 'Кабель USB-C', qty: 3, total: '1 770 ₽' },\n  { title: 'Кружка', qty: 1, total: '690 ₽' },\n];\n\nfor (const c of cases) {\n  test(`${c.title} × ${c.qty} → итог ${c.total}`, async ({ page }) => {\n    await page.goto('/');\n    const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: c.title, exact: true }) });\n    for (let i = 1; i <= c.qty; i++) {\n      await card.getByRole('button', { name: 'В корзину' }).click();\n      await expect(page.getByTestId('cart-count')).toHaveText(String(i));\n    }\n    await page.goto('/cart');\n    await expect(page.getByTestId('cart-total')).toHaveText(c.total);\n  });\n}\n","recorded":{"variant":"Дефект: сумма корзины не учитывает количество","output":"Магазин: Дефект: сумма корзины не учитывает количество\n✗ Блокнот A5 × 2 → итог 780 ₽ (3481 мс)\nError: expect(locator).toHaveText(expected) failed\n\nLocator:  getByTestId('cart-total')\nExpected: \"780 ₽\"\nReceived: \"390 ₽\"\nTimeout:  3000ms\n\nCall log:\n  - Expect \"toHaveText\" with timeout 3000ms\n  - waiting for getByTestId('cart-total')\n    7 × locator resolved to <strong data-testid=\"cart-total\">390 ₽</strong>\n      - unexpected value \"390 ₽\"\n\n✗ Кабель USB-C × 3 → итог 1 770 ₽ (3644 мс)\nError: expect(locator).toHaveText(expected) failed\n\nLocator:  getByTestId('cart-total')\nExpected: \"1 770 ₽\"\nReceived: \"590 ₽\"\nTimeout:  3000ms\n\nCall log:\n  - Expect \"toHaveText\" with timeout 3000ms\n  - waiting for getByTestId('cart-total')\n    7 × locator resolved to <strong data-testid=\"cart-total\">590 ₽</strong>\n      - unexpected value \"590 ₽\"\n\n✓ Кружка × 1 → итог 690 ₽ (361 мс)"}}
```

:::happened
Упали строки с количеством 2 и 3, прошла строка с количеством 1: при одном товаре «цена» и «цена × количество» совпадают. Это и есть смысл таблицы: случаи подбираются так, чтобы **разные** дефекты давали разный результат. Строка с `qty: 1` сама по себе дефект не ловит, но вместе с остальными показывает его границу: «ломается при количестве больше одного».

Каждая строка — отдельный тест: свой контекст, своя корзина, своё место в отчёте.
:::

## Как выбирать строки таблицы

Таблица — не «побольше данных», а осознанный выбор. Строки берут из техник тест-дизайна:

- **классы эквивалентности** — по одному представителю: дешёвый товар, дорогой, товар с одним экземпляром на складе;
- **граничные значения** — количество 1 и количество, равное остатку на складе; соседнее значение за границей — отдельный негативный случай;
- **данные, на которых ломалось раньше** — например, суммы с разделителем тысяч `1 770 ₽`.

Десять строк, которые проверяют одно и то же, только замедляют прогон.

## Ваша таблица

```widget
{"type":"exercise","id":"m6-params-cart"}
```

## Параметризация на уровне проекта

Иногда меняются не данные, а **условия запуска**: роль пользователя, язык, браузер. Для этого в Playwright есть свои опции fixtures и проекты.

```ts tests/fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{ customer: string }>({
  customer: ['anna@example.test', { option: true }],   // значение по умолчанию
});
```

```ts playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'anna', use: { customer: 'anna@example.test' } },
    { name: 'boris', use: { customer: 'boris@example.test' } },
  ],
});
```

Fixture с `{ option: true }` можно переопределить в `use` проекта, и все тесты, которые её запрашивают, выполнятся по разу для каждого проекта.

:::mistake Цикл внутри одного теста
```ts tests/cart-totals.spec.ts
test('все суммы', async ({ page }) => {
  for (const c of cases) { /* … */ }
});
```
Это один тест: при падении первой строки остальные не выполнятся, а в отчёте будет одно «упало» без указания строки. Кроме того, все строки делят одну корзину — вторая строка начнёт с товарами первой.
:::

:::deep Таблица из файла
Данные можно держать в JSON-файле рядом с тестом и импортировать: `import cases from './cart-cases.json'`. Удобно, когда таблицу ведёт аналитик или она большая. Минус — проверка и данные в разных местах, и при чтении теста не видно, что именно проверяется. Для таблицы до десятка строк держите её в тесте.
:::

:::tech Порядок и параллельность
Тесты из цикла — обычные тесты файла. По умолчанию тесты одного файла идут по порядку в одном worker. С `test.describe.configure({ mode: 'parallel' })` или `fullyParallel: true` строки таблицы распределяются между worker. Поэтому строки не должны зависеть друг от друга — как и любые тесты.
:::

:::interview
**Вопрос:** «Как сделать data-driven тест в Playwright?» **Ответ по сути:** таблица случаев в массиве и цикл `for … of`, который объявляет `test` для каждой строки с уникальным названием из данных. Каждая строка — отдельный тест со своим контекстом и местом в отчёте. Строки выбирают по классам эквивалентности и границам; условия запуска (роль, браузер) параметризуют проектами и fixtures с `option: true`.
:::

:::terms
[[data-driven-testing]], [[equivalence-partitioning]], [[boundary-value-analysis]], [[project-pw]], [[fixture]]
:::
