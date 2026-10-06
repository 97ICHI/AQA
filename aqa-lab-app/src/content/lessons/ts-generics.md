:::why
В тестах и подсказках редактора постоянно встречаются записи в угловых скобках: `Promise<Order>`, `Array<Product>`, `Locator[]`, `APIResponse`. Это generics — типы с параметром. Достаточно разобрать один пример, чтобы читать их свободно и написать свою простую обобщённую функцию.
:::

## Тип с параметром

Вы уже встречали `Promise<string>` в уроке про async: это «Promise, который даст строку». `Promise` сам по себе — заготовка: «обещание результата *какого-то* типа». Что именно за тип, указывают в угловых скобках.

```ts tests/api/orders.ts
interface Order { id: number; total: number }

async function loadOrder(id: number): Promise<Order> { /* … */ }

const order = await loadOrder(1);   // тип order — Order
order.total.toFixed(2);             // редактор знает поля заказа
```

Так же читаются `Array<Product>` (то же, что `Product[]`), `Map<string, number>` — словарь «строка → число», `Record<string, unknown>` — объект с любыми строковыми ключами и значениями `unknown`.

## Своя обобщённая функция

Представьте функцию «первый элемент массива». Она одинаково работает для товаров, заказов и чисел. Как её типизировать?

- `function first(items: Product[]): Product` — подходит только для товаров.
- `function first(items: any[]): any` — подходит для всего, но тип результата потерян: опечатка в поле пройдёт молча.

[[generics|Generic]] решает это параметром типа:

```ts tests/helpers/arrays.ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}

const p = first(products);   // T = Product → результат Product | undefined
const n = first([390, 120]); // T = number  → результат number | undefined
```

`<T>` после имени объявляет параметр типа — «какой-то тип, назовём его T». `items: T[]` — массив элементов этого типа, результат — `T`. При вызове TypeScript сам выводит `T` из аргумента; указывать вручную (`first<Product>(…)`) почти никогда не нужно. Имя `T` — соглашение; можно писать и понятнее, например `TItem`.

## Обобщённый тип

Параметр бывает и у собственных типов. Например, ответ API с успехом или ошибкой:

```ts tests/types/api.ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type OrderResult = ApiResult<Order>;   // data — заказ
type CatalogResult = ApiResult<Product[]>;   // data — массив товаров
```

Одно описание формы ответа подходит ко всем запросам, и при этом тип `data` у каждого свой.

:::try Попробуйте сами
Запустите код. Обобщённая `first` сохраняет тип, `firstAny` — нет. Последняя строка содержит опечатку в имени поля: посмотрите, кто её заметил — компилятор или выполнение.
:::

```widget
{"type": "playground", "lang": "ts", "title": "Generic против any", "code": "interface Product { title: string; price: number }\ninterface Order { id: number; total: number }\n\nfunction first<T>(items: T[]): T | undefined {\n  return items[0];\n}\n\nconst products: Product[] = [{ title: 'Блокнот A5', price: 390 }, { title: 'Ручка', price: 120 }];\nconst p = first(products);\nconsole.log('первый товар:', p?.title, p?.price);\nconsole.log('первое число:', first([4990, 590]));\n\nasync function loadOrder(id: number): Promise<Order> {\n  const data = (await fakeFetchOrder(id)) as Record<string, unknown>;\n  if (typeof data.id !== 'number' || typeof data.total !== 'number') throw new Error('неверный ответ API');\n  return { id: data.id, total: data.total };\n}\nconst order = await loadOrder(1);\nconsole.log('заказ:', order.id, order.total.toFixed(2));\n\nfunction firstAny(items: any[]): any {\n  return items[0];\n}\nconst q = firstAny(products);\nconsole.log('цена:', q.prise.toFixed(2));\n"}
```

:::happened
`first` вернула товар с типом `Product | undefined`: поэтому обращение записано через `?.` — массив мог быть пустым. Для чисел та же функция вернула число. `loadOrder` возвращает `Promise<Order>`, и после `await` редактор знает, что у заказа есть `total`.

С `firstAny` компилятор промолчал: у `any` можно прочитать что угодно, и опечатка `prise` прошла проверку типов. Ошибку нашло только выполнение: `TypeError: Cannot read properties of undefined (reading 'toFixed')`. Если в последней строке заменить `firstAny` на `first`, та же опечатка станет ошибкой типа ещё до запуска.
:::

## Задание

```widget
{"type":"exercise","id":"m3-generic-find"}
```

:::mistake Generic ради generic
`function add<T>(a: T, b: T)` для сложения цен не нужен: функция работает только с числами, и `number` честнее. Параметр типа оправдан, когда функция действительно одинаково работает с разными типами и должна сохранить связь «что пришло — то и вернулось».
:::

:::deep Ограничения параметра
`<T extends { id: number }>` означает «любой тип, у которого есть числовой `id`». Внутри функции тогда можно обращаться к `item.id`, а тип результата всё равно останется конкретным: заказ, пользователь или товар. Так пишут, например, помощник «найти по id» для любых сущностей.
:::

:::tech Generics в Playwright
Обобщённые типы встречаются в API Playwright постоянно, хотя писать их самим приходится редко: `test.extend<{ cartPage: CartPage }>({ … })` описывает типы собственных fixtures, `page.evaluate<R>(…)` возвращает `Promise<R>`. Подсказка редактора с угловыми скобками читается так же, как `Promise<Order>`.
:::

:::interview
**Вопрос:** «Зачем generics, если есть `any`?» **Ответ по сути:** generic сохраняет связь между типами входа и выхода: функция работает с любым типом, но для массива товаров возвращает товар, и компилятор продолжает проверять код дальше. `any` отключает проверку, и ошибки переезжают из компиляции в выполнение.
:::

:::terms
[[generics]], [[any-type]], [[promise]]
:::
