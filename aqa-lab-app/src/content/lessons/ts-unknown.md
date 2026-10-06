:::why
Типы TypeScript проверяют ваш код, но не сервер. Если API вернул сумму заказа строкой `'9980'` вместо числа, тип `Order` этого не заметит: при выполнении типов нет. Тест, который должен ловить нарушения контракта, обязан проверять данные сам. Разберём, как TypeScript помогает это не забыть.
:::

## any: проверка выключена

Тип [[any-type|any]] означает «что угодно, не проверять». С `any` можно обратиться к любому полю, вызвать что угодно, присвоить куда угодно — компилятор молчит. Результат `JSON.parse` и `response.json()` в Playwright имеет тип `any`.

```ts tests/api/order.spec.ts
const body = await response.json();      // any
const total: number = body.total;        // компилятор не возражает
expect(total + 100).toBe(10080);         // а при '9980' получится '9980100'
```

## Приведение типа — не проверка

Запись `value as Order` называется [[type-assertion|приведением типа]]. Она говорит компилятору: «считай, что это `Order`». Никакой проверки при выполнении нет — это обещание, которое легко нарушить.

```ts tests/api/order.spec.ts
const order = (await response.json()) as Order;   // Order — только на словах
```

Тип есть, подсказки в редакторе есть, а данные — какие пришли. Если сервер прислал строку, тест будет работать со строкой, думая, что это число.

## unknown: сначала проверь

[[unknown-type|unknown]] — тоже «что угодно», но с обратным правилом: **ничего нельзя сделать, пока не проверишь**. Нельзя прочитать поле, сложить, передать туда, где ждут число. Сначала нужно сузить тип проверками во время выполнения — теми же `typeof`, `=== null`, `in`, что в прошлом уроке.

```ts tests/helpers/parse-order.ts
export interface OrderTotal { id: number; total: number }

export function parseOrder(data: unknown): OrderTotal {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Ответ API — не объект');
  }
  const o = data as Record<string, unknown>;   // объект с неизвестными полями
  if (typeof o.id !== 'number') throw new Error('id — не число');
  if (typeof o.total !== 'number') {
    throw new Error(`total — не число: ${JSON.stringify(o.total)}`);
  }
  return { id: o.id, total: o.total };
}
```

Такая функция — [[runtime-validation|проверка во время выполнения]]. Если данные нарушают контракт, тест падает с понятным сообщением, а не через три шага с непонятным. После проверки TypeScript сам сужает типы: `o.total` в последней строке — уже `number`.

Здесь тоже есть `as`, но безопасный: `Record<string, unknown>` не обещает ничего конкретного — каждое поле по-прежнему `unknown`, и его надо проверить.

## Учебный сервер

В песочнице есть функция `fakeFetchOrder(id)`. Она ведёт себя как запрос к API: через 50 мс возвращает JSON заказа с типом `unknown`. Для заказа `42` сервер «с дефектом»: `total` приходит строкой `'9980'`. Перед вызовом стоит `await` — «дождаться ответа»; подробно это следующий урок.

:::try Попробуйте сами
Запустите код и сравните три способа работы с ответом. Затем замените `42` на `1` во второй строке — у этого заказа `total` число.
:::

```widget
{"type": "playground", "lang": "ts", "title": "any, as и проверка ответа", "code": "interface OrderTotal { id: number; total: number }\n\nconst data = await fakeFetchOrder(42);\nconsole.log('пришло:', data);\n\nconst asAny = data as any;\nconsole.log('any:', asAny.total + 100);\n\nconst asOrder = data as OrderTotal;\nconsole.log('as:', asOrder.total + 100, typeof asOrder.total);\n\nfunction parseOrder(value: unknown): OrderTotal {\n  if (typeof value !== 'object' || value === null) throw new Error('Ответ API — не объект');\n  const o = value as Record<string, unknown>;\n  if (typeof o.id !== 'number') throw new Error('id — не число');\n  if (typeof o.total !== 'number') throw new Error(`total — не число: ${JSON.stringify(o.total)}`);\n  return { id: o.id, total: o.total };\n}\n\ntry {\n  const order = parseOrder(data);\n  console.log('проверено:', order.total + 100);\n} catch (e) {\n  console.error('проверка ответа:', (e as Error).message);\n}\n\n// console.log(data.total + 100); // с unknown так нельзя: ошибка типа\n"}
```

:::happened
С `any` и с `as OrderTotal` компилятор не возражал, и оба раза сложение дало `9980100` — строку. Во втором случае `typeof asOrder.total` прямо показывает `string`, хотя тип в коде — `number`. Тип солгал, потому что `as` ничего не проверяет.

`parseOrder` проверил значение во время выполнения и остановил работу понятной ошибкой: «total — не число: "9980"». В тесте это было бы сообщение о дефекте API, а не загадочное падение где-то дальше.

Если убрать `//` в начале последней строки, будет ошибка типа `TS18046: 'data' is of type 'unknown'`: `data` имеет тип `unknown`, и TypeScript не даёт трогать поля без проверки. Ровно это и нужно.
:::

## Задание

```widget
{"type":"exercise","id":"m3-unknown-parse-order"}
```

:::mistake Тихо исправить данные
`total: Number(o.total)` «чинит» строку в число, и тест проходит. Но сервер нарушил контракт, и клиенты, которые ждут число, сломаются. Задача теста — заметить это, а не скрыть. Преобразование уместно, только если контракт явно разрешает строку.
:::

:::deep Схемы вместо ручных проверок
Когда полей много, проверки пишут не вручную, а схемой: JSON Schema с валидатором (например, Ajv) или библиотеки вроде Zod, которые одновременно проверяют данные и выводят тип TypeScript. Идея та же: значение `unknown` превращается в типизированное только после проверки. Подробнее — в уроке про контракты API.
:::

:::tech Почему response.json() возвращает any
Метод не знает, что пришлёт сервер, и тип `any` выбран для удобства. Вы можете сразу присвоить результат переменной типа `unknown`: `const body: unknown = await response.json();` — тогда компилятор заставит проверить данные перед использованием.
:::

:::interview
**Вопрос:** «Чем `any` отличается от `unknown`?» **Ответ по сути:** оба принимают любое значение, но `any` отключает проверку типов, а `unknown` запрещает любые операции до сужения проверками. Для данных извне (JSON, ответы API) правильнее `unknown` плюс проверка во время выполнения; `as` — только обещание компилятору, не проверка.
:::

:::terms
[[any-type]], [[type-assertion]], [[unknown-type]], [[runtime-validation]], [[type-narrowing]]
:::
