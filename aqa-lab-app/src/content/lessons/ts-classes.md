:::why
Когда в тестах повторяются одни и те же действия со страницей — открыть корзину, прочитать итог, оформить заказ, — их собирают в класс: Page Object. Чтобы такой класс написать или прочитать, нужно знать, как устроены классы: поля, конструктор, методы и `this`.
:::

## Класс: шаблон для объектов

[[js-class|Класс]] описывает, какие данные хранит объект и что он умеет делать. По классу создают сколько угодно объектов — **экземпляров** — через `new`:

```ts tests/support/cart.ts
export class Cart {
  private lines: { title: string; price: number; qty: number }[] = [];   // поле

  add(title: string, price: number, qty: number = 1): void {             // метод
    this.lines.push({ title, price, qty });
  }

  total(): number {
    return this.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  }
}

const cart = new Cart();
cart.add('Блокнот A5', 390, 2);
cart.total();   // 780
```

- **Поле** (`lines`) — данные объекта. У каждого экземпляра свои.
- **Метод** (`add`, `total`) — функция, привязанная к объекту.
- **`this`** внутри метода — тот объект, у которого метод вызвали. `this.lines` — позиции *этой* корзины.
- **`private`** — поле доступно только внутри класса. Снаружи `cart.lines` — ошибка типа. Это ограничение TypeScript: при выполнении его нет.

## Конструктор

Конструктор — особый метод `constructor`, который выполняется при `new`. В нём объект получает то, без чего не может работать:

```ts tests/pages/cart-page.ts
import type { Page } from '@playwright/test';

export class CartPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/cart');
  }

  total() {
    return this.page.getByTestId('cart-total');
  }

  async checkout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Оформить заказ' }).click();
  }
}
```

Запись `constructor(private readonly page: Page) {}` — сокращение TypeScript: она объявляет поле `page`, сохраняет в него аргумент и запрещает его переприсваивать (`readonly`). В тесте класс используется так:

```ts tests/cart.spec.ts
test('итог в корзине', async ({ page }) => {
  // … добавить два блокнота по 390 ₽ …
  const cartPage = new CartPage(page);
  await cartPage.open();
  await expect(cartPage.total()).toHaveText('780 ₽');
});
```

Это и есть небольшой Page Object: тест говорит «открой корзину», а *как* — знает класс.

## Композиция: объект из объектов

[[composition|Композиция]] — это когда объект *содержит* другие объекты и поручает им работу. Страница оформления заказа может содержать шапку и корзину; клиент API — содержать HTTP-запросы. Это проще и гибче, чем строить длинные цепочки наследования (`class AdminCartPage extends CartPage extends BasePage …`).

:::try Попробуйте сами
Запустите код. Покупатель «содержит» корзину — это композиция. В конце — класс с общей (`static`) корзиной: посмотрите, что происходит со второй корзиной. Строка с `anna.cart.lines` нарушает `private`.
:::

```widget
{"type": "playground", "lang": "ts", "title": "Класс, композиция и общая корзина", "code": "class Cart {\n  private lines: { title: string; price: number; qty: number }[] = [];\n  add(title: string, price: number, qty: number = 1): void {\n    this.lines.push({ title, price, qty });\n  }\n  count(): number {\n    return this.lines.reduce((sum, l) => sum + l.qty, 0);\n  }\n  total(): number {\n    return this.lines.reduce((sum, l) => sum + l.price * l.qty, 0);\n  }\n}\n\nclass Customer {\n  readonly cart = new Cart();            // композиция: покупатель содержит корзину\n  constructor(readonly name: string) {}\n  buy(title: string, price: number, qty: number = 1): this {\n    this.cart.add(title, price, qty);\n    return this;\n  }\n}\n\nconst anna = new Customer('Анна');\nconst gleb = new Customer('Глеб');\nanna.buy('Блокнот A5', 390, 2).buy('Ручка', 120);\nconsole.log(anna.name, anna.cart.count(), anna.cart.total());\nconsole.log(gleb.name, gleb.cart.count(), gleb.cart.total());\n\nclass SharedCart {\n  static prices: number[] = [];          // одно поле на ВСЕ экземпляры\n  add(price: number): void { SharedCart.prices.push(price); }\n  total(): number { return SharedCart.prices.reduce((s, p) => s + p, 0); }\n}\nconst first = new SharedCart();\nconst second = new SharedCart();\nfirst.add(4990);\nconsole.log('вторая корзина:', second.total());\n\nconsole.log(anna.cart.lines);\n"}
```

:::happened
У Анны и Глеба разные корзины: поле `lines` создаётся заново для каждого `new Cart()`, а каждый покупатель создаёт свою корзину. Метод `buy` возвращает `this`, поэтому вызовы можно соединять цепочкой.

`SharedCart` хранит цены в `static`-поле — оно одно на весь класс. Товар, добавленный в первую корзину, «появился» во второй. Это тот же дефект, что вариант учебного магазина «общая корзина»: состояние, которое должно принадлежать одному пользователю, оказалось общим.

Последняя строка — ошибка типа `TS2341: Property 'lines' is private`. Но при выполнении массив напечатался: `private` — проверка компилятора, а не защита во время выполнения.
:::

## Задание

```widget
{"type":"exercise","id":"m3-class-cart"}
```

:::mistake Забытый this
Внутри метода `lines.push(…)` без `this.` — обращение к переменной `lines`, которой нет. TypeScript сообщит «Cannot find name 'lines'»; к полям объекта всегда обращаются через `this`.
:::

:::deep Потерянный this
Если передать метод как callback — `setTimeout(cart.add, 10)` или `items.forEach(cart.add)`, — он вызывается без объекта, и `this` внутри становится `undefined`. Решения: обернуть в стрелку `(x) => cart.add(x)` или объявить метод полем-стрелкой. В Page Object это встречается, когда метод передают в `test.step`.
:::

:::tech Наследование
`class AdminPage extends BasePage` получает поля и методы родителя; `super(…)` вызывает конструктор родителя. Небольшой общий базовый класс бывает удобен, но глубокие иерархии Page Object трудно менять: изменение в базовом классе задевает все страницы. Предпочитайте композицию: страница содержит компоненты (шапку, корзину, форму).
:::

:::interview
**Вопрос:** «Композиция или наследование в Page Object?» **Ответ по сути:** композиция: страница содержит компоненты (header, cart, форма) и поручает им действия. Наследование оставляют для маленького общего поведения; глубокие цепочки затрудняют изменения и чтение. Поля с состоянием не делают `static`, иначе тесты начинают делить данные.
:::

:::terms
[[js-class]], [[composition]], [[oop]], [[page-object-model]], [[shared-state]]
:::
