:::why
Когда тестов становится много, одни и те же локаторы и действия повторяются в каждом: «найти карточку товара», «нажать В корзину», «открыть корзину». Меняется вёрстка — исправлять приходится десятки мест. Page Object собирает знание о странице в одном классе, и тест читается как сценарий пользователя.
:::

## Идея Page Object

[[page-object-model|Page Object]] — класс, который описывает одну страницу (или её часть) для тестов:

- **локаторы** — как найти важные элементы;
- **действия** — что пользователь делает на странице: «добавить товар», «открыть корзину».

Тест вызывает действия и делает проверки, а детали вёрстки остаются в классе. Для класса понадобятся основы из урока про [[oop|классы TypeScript]]: конструктор, поля, методы.

```ts tests/pages/catalog-page.ts
import type { Page, Locator } from '@playwright/test';

export class CatalogPage {
  readonly cartCount: Locator;

  constructor(private readonly page: Page) {
    this.cartCount = page.getByTestId('cart-count');
  }

  async open() {
    await this.page.goto('/');
  }

  async add(title: string) {
    const card = this.page.getByRole('listitem')
      .filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
    await card.getByRole('button', { name: 'В корзину' }).click();
  }
}
```

```ts tests/cart.spec.ts
import { test, expect } from '@playwright/test';
import { CatalogPage } from './pages/catalog-page';

test('блокнот в корзине', async ({ page }) => {
  const catalog = new CatalogPage(page);
  await catalog.open();
  await catalog.add('Блокнот A5');
  await expect(catalog.cartCount).toHaveText('1');
});
```

Разберём:

- `constructor(private readonly page: Page)` — сокращённая запись TypeScript: параметр сразу становится полем `this.page`.
- Локатор `cartCount` создаётся в конструкторе. Это безопасно: локатор ничего не ищет до действия или проверки.
- Метод `add` принимает **данные** (название товара), а не локатор. Тест не знает, что карточка — `li` с заголовком `h2`.
- Проверка `expect` осталась **в тесте**: тест решает, что считать правильным результатом.

## Компонент вместо страницы

Повторяющуюся часть интерфейса — карточку товара, шапку — удобно описать отдельным классом-[[page-component|компонентом]] с корневым локатором:

```widget
{"type":"playground","lang":"pw","title":"Компонент «карточка товара» на данных с похожими названиями","variant":"similar-names","code":"import { test, expect, type Locator, type Page } from '@playwright/test';\n\n// Компонент: одна карточка товара. Корень — элемент списка с точным заголовком.\nclass ProductCard {\n  readonly root: Locator;\n  constructor(page: Page, title: string) {\n    this.root = page.getByRole('listitem')\n      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });\n  }\n  addToCart() {\n    return this.root.getByRole('button', { name: 'В корзину' }).click();\n  }\n}\n\ntest('в корзину попадает именно «Наушники Pulse»', async ({ page }) => {\n  await page.goto('/');\n  await new ProductCard(page, 'Наушники Pulse').addToCart();\n  await expect(page.getByRole('status')).toHaveText('Добавлено: Наушники Pulse');\n});\n","recorded":{"variant":"Новые данные: похожие названия товаров (не дефект)","output":"Магазин: Новые данные: похожие названия товаров (не дефект)\n✓ в корзину попадает именно «Наушники Pulse» (318 мс)"}}
```

:::happened
Магазин в этом варианте добавил «Наушники Pulse Pro Max» и «Чехол для наушников Pulse». Компонент нашёл нужную карточку, потому что ищет заголовок с **точным** именем (`exact: true`). Правило поиска написано один раз — в конструкторе компонента. Если завтра оно изменится, правка будет в одном месте, а не в каждом тесте.
:::

## Где проверять: в тесте или в объекте страницы

Общее правило — **проверки результата в тесте**. Тест «два блокнота стоят 780 ₽» должен содержать строку с `780 ₽`, иначе при чтении непонятно, что проверяется.

Исключение — ожидание, без которого действие не закончено. Метод «добавить товар» может дождаться, пока счётчик корзины увеличится: это не проверка требования, а признак «действие завершилось». Без такого ожидания следующий клик может уйти раньше, чем закончился предыдущий запрос.

## Ваш Page Object

Допишите метод `add`: найти карточку по точному заголовку, нажать кнопку и дождаться, пока счётчик увеличится на один. Тест должен проходить и на новой вёрстке магазина: классы и id там другие, роли и тексты те же.

```widget
{"type":"exercise","id":"m6-pom-cart"}
```

:::mistake Слишком много слоёв
`BasePage → AbstractShopPage → CatalogPage`, методы `clickButton(name)` и `fillInput(label, value)`, которые просто переименовывают Playwright, — это лишние уровни, через которые приходится пробираться при каждом падении. Хороший Page Object маленький: несколько локаторов и действия **в терминах пользователя** («добавить в корзину», «войти как»).
:::

:::mistake Возвращать данные вместо локаторов
Метод `getTotal(): Promise<string>` читает текст один раз, и проверка `expect(await cart.getTotal()).toBe('780 ₽')` не ждёт. Отдавайте локатор (`cart.total`) и проверяйте его через `await expect(cart.total).toHaveText('780 ₽')` — проверка повторится до таймаута.
:::

:::deep Page Object и fixtures
Объекты страниц удобно выдавать тестам через fixtures: `test.extend<{ catalog: CatalogPage }>({ catalog: async ({ page }, use) => { await use(new CatalogPage(page)); } })`. Тогда тест пишет `async ({ catalog }) => …` и не создаёт объекты сам. Fixture может сразу открыть страницу или войти — подготовка уходит из теста целиком.
:::

:::tech Структура проекта
Объекты страниц обычно лежат в `tests/pages/` (или `src/pages/`), компоненты — в `tests/components/`, fixtures — в `tests/fixtures.ts`. Тесты импортируют только fixtures и `expect`. Подробнее о слоях проекта — в уроке о структуре тестового проекта. Главное правило: в объекте страницы нет `test(…)` и нет проверок требований, в тесте нет «сырых» CSS-селекторов.
:::

:::interview
**Вопрос:** «Зачем нужен Page Object и где в нём проверки?» **Ответ по сути:** он собирает локаторы и действия страницы в одном классе: при изменении вёрстки правка в одном месте, тест читается как сценарий. Методы принимают данные и выполняют действия пользователя; проверки требований — в тесте, в объекте допустимы только ожидания завершения действия. Без лишних уровней наследования и обёрток над API Playwright.
:::

:::terms
[[page-object-model]], [[page-component]], [[oop]], [[locator]], [[fixture]]
:::
