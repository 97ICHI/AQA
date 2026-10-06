:::why
Реальные данные редко бывают «всегда одинаковыми». У заказа может быть промокод, а может не быть. Статус — одно из четырёх значений, а не любая строка. Поиск товара может ничего не найти. TypeScript умеет описывать такие варианты и заставляет проверить их, прежде чем использовать значение.
:::

## Необязательное поле

Знак `?` после имени поля делает его [[optional-property|необязательным]]:

```ts tests/types/shop.ts
type Order = {
  id: number;
  total: number;
  promoCode?: string;   // может отсутствовать
};

const a: Order = { id: 1, total: 900 };                         // можно
const b: Order = { id: 2, total: 810, promoCode: 'SPRING10' };  // можно
```

Тип `promoCode` внутри кода — `string | undefined`. Так же работают необязательные параметры функции: `function statusText(status: string, track?: string)`.

## Union: «одно из»

Вертикальная черта `|` объединяет типы — получается [[union-type|union]]:

```ts tests/types/shop.ts
type OrderStatus = 'new' | 'paid' | 'shipped' | 'cancelled';
type Price = number | null;          // цена или «цены нет»
```

`OrderStatus` — не любая строка, а только одна из четырёх. Опечатка `'payed'` станет ошибкой типа ещё до запуска. Для тестов это особенно полезно: список допустимых статусов записан в одном месте, и редактор подсказывает варианты.

## Narrowing: проверить, прежде чем использовать

Значение типа `string | undefined` нельзя просто использовать как строку: вдруг его нет. TypeScript требует проверку. После проверки он *сужает* тип — это называется [[type-narrowing|narrowing]]:

```ts src/shop/order.ts
function promoLabel(order: Order): string {
  // order.promoCode.toUpperCase();  — ошибка: может быть undefined
  if (order.promoCode === undefined) {
    return 'без промокода';
  }
  return order.promoCode.toUpperCase();   // здесь тип уже string
}
```

Способы сужения, которые встречаются чаще всего:

| Проверка | Что сужает |
|---|---|
| `x === undefined`, `x !== null` | убирает «пустые» варианты |
| `typeof x === 'string'` | выбирает примитивный тип |
| `status === 'shipped'` | выбирает один вариант из union строк |
| `'promoCode' in order` | есть ли поле в объекте |
| `Array.isArray(x)` | массив ли это |
| `if (x)` | убирает `null`, `undefined` и другие falsy |

Последний способ короткий, но помните урок про условия: `if (x)` отбросит и `0`, и пустую строку.

:::try Попробуйте сами
Запустите код. Затем в функции `statusText` удалите две строки ветки `case 'cancelled'` — TypeScript сообщит, что функция не для всех вариантов возвращает строку.
:::

```widget
{"type": "playground", "lang": "ts", "title": "Union статусов и необязательный трек", "code": "type OrderStatus = 'new' | 'paid' | 'shipped' | 'cancelled';\ntype Order = { id: number; status: OrderStatus; track?: string };\n\nfunction statusText(order: Order): string {\n  switch (order.status) {\n    case 'new':\n      return 'Новый';\n    case 'paid':\n      return 'Оплачен';\n    case 'cancelled':\n      return 'Отменён';\n    case 'shipped':\n      // трек необязателен: проверяем, прежде чем подставить\n      return order.track ? `Отправлен, трек ${order.track}` : 'Отправлен';\n  }\n}\n\nconst orders: Order[] = [\n  { id: 1, status: 'new' },\n  { id: 2, status: 'shipped', track: 'RU123' },\n  { id: 3, status: 'shipped' },\n];\nfor (const o of orders) console.log(o.id, statusText(o));\n\nconst typo: Order = { id: 4, status: 'payed' };\nconsole.log(typo.status);\n"}
```

:::happened
Три заказа дали три разных текста. `switch` сравнивает `order.status` с каждым вариантом по очереди — это та же проверка `===`, записанная короче. В ветке `shipped` трек проверяется перед подстановкой: без проверки у третьего заказа получилось бы `Отправлен, трек undefined`.

Объект с `status: 'payed'` — ошибка типа: такого варианта в union нет. При выполнении код отработал и напечатал `payed`: типы при запуске стёрты, и если бы такое значение пришло с сервера, TypeScript бы его не остановил. Как проверять данные, пришедшие во время выполнения, — следующий урок.

Если удалить ветку `cancelled`, возникает ошибка `TS2366: Function lacks ending return statement…`: компилятор знает все четыре варианта union и видит, что для `'cancelled'` функция ничего не вернёт. Тип напомнил обработать забытый случай.
:::

## Задание

```widget
{"type":"exercise","id":"m3-union-status"}
```

:::mistake Восклицательный знак вместо проверки
`order.promoCode!.toUpperCase()` — оператор `!` говорит компилятору «поверь, здесь не undefined». Ошибка типа исчезает, а проверка не появляется: если промокода нет, тест упадёт с `TypeError`. Используйте `!` только там, где отсутствие значения действительно невозможно.
:::

:::deep Исчерпывающая проверка
Для union удобно писать `switch` по всем вариантам и в ветке `default` присвоить значение переменной типа `never`: `const unreachable: never = status;`. Если кто-то добавит в union пятый статус и забудет его обработать, это место станет ошибкой типа. Так типы напоминают обновить код и тесты вслед за изменением данных.
:::

:::tech Discriminated union
Если у вариантов объекта есть общее поле-«метка» с разными значениями, например `{ ok: true; order: Order } | { ok: false; error: string }`, то проверка `if (res.ok)` сужает весь объект: в одной ветке доступно `res.order`, в другой — `res.error`. Так удобно описывать ответы API с успехом и ошибкой.
:::

:::interview
**Вопрос:** «Что такое narrowing?» **Ответ по сути:** сужение типа после проверки во время выполнения: `typeof`, сравнение, `in`, `Array.isArray`, `instanceof`. Внутри ветки, где проверка прошла, TypeScript считает тип более узким и разрешает операции, специфичные для него.
:::

:::terms
[[optional-property]], [[union-type]], [[type-narrowing]]
:::
