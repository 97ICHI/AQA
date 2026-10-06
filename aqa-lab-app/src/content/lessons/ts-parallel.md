:::why
Тесту часто нужно несколько независимых данных: три заказа по API, пользователь и каталог. Если ждать их по очереди, время складывается. Если запустить одновременно — тест быстрее. Но параллельность уместна не всегда: когда второй шаг зависит от первого, порядок обязателен.
:::

## Последовательно: await в цикле

```ts tests/api/orders.spec.ts
const orders = [];
for (const id of [1, 2, 3]) {
  orders.push(await fakeFetchOrder(id));   // каждый следующий — после предыдущего
}
```

Каждый `await` ждёт ответа, и только потом цикл переходит к следующему id. Три запроса по 50 мс — около 150 мс. Так и надо делать, когда шаги зависят друг от друга: войти, потом добавить товар, потом оформить заказ.

## Одновременно: Promise.all

Если запросы независимы, их можно запустить сразу все, а потом дождаться всех вместе. [[promise-all|Promise.all]] принимает массив Promise и возвращает один Promise с массивом результатов:

```ts tests/api/orders.spec.ts
const orders = await Promise.all([1, 2, 3].map((id) => fakeFetchOrder(id)));
```

Читается справа налево: `map` вызывает `fakeFetchOrder` для каждого id — запросы стартуют **сразу**, и получается массив из трёх Promise. `Promise.all` ждёт, пока выполнятся все. Время — как у самого долгого запроса, около 50 мс.

Два важных свойства:

- Результаты идут **в порядке исходного массива**, а не в порядке прихода ответов. `orders[0]` — всегда заказ 1.
- Если хотя бы один Promise отклонён, `Promise.all` сразу отклоняется с этой ошибкой. Остальные операции при этом не отменяются — просто их результаты уже никто не ждёт.

Если нужны результаты всех операций, даже неудачных, есть `Promise.allSettled`: он ждёт все и для каждой сообщает `fulfilled` со значением или `rejected` с причиной.

## Ловушка forEach

```ts tests/api/orders.spec.ts
const results: unknown[] = [];
[1, 2, 3].forEach(async (id) => {
  results.push(await fakeFetchOrder(id));
});
console.log(results.length);   // 0
```

`forEach` вызывает callback для каждого элемента, но **не ждёт** его, даже если callback асинхронный. Код после `forEach` выполняется сразу, пока запросы ещё идут. Для последовательного обхода нужен `for…of` с `await`, для параллельного — `Promise.all` с `map`.

:::try Попробуйте сами
Запустите код и сравните время. Затем увеличьте список id до восьми и посмотрите, как меняется время каждого способа.
:::

```widget
{"type": "playground", "lang": "ts", "title": "Последовательно, параллельно и forEach", "code": "const ids = [1, 2, 3, 4];\n\nlet start = Date.now();\nfor (const id of ids) {\n  await fakeFetchOrder(id);\n}\nconsole.log('последовательно:', Date.now() - start, 'мс');\n\nstart = Date.now();\nconst orders = await Promise.all(ids.map((id) => fakeFetchOrder(id)));\nconsole.log('Promise.all:', Date.now() - start, 'мс; порядок id:', orders.map((o) => (o as { id: number }).id));\n\nconst results: unknown[] = [];\nids.forEach(async (id) => {\n  results.push(await fakeFetchOrder(id));\n});\nconsole.log('сразу после forEach:', results.length);\nawait sleep(100);\nconsole.log('через 100 мс:', results.length);\n\ntry {\n  await Promise.all([fakeFetchOrder(1), Promise.reject(new Error('заказ 2 не найден')), fakeFetchOrder(3)]);\n} catch (e) {\n  console.log('Promise.all отклонён:', (e as Error).message);\n}\nconst settled = await Promise.allSettled([fakeFetchOrder(1), Promise.reject(new Error('нет')), fakeFetchOrder(3)]);\nconsole.log('allSettled:', settled.map((s) => s.status));\n"}
```

:::happened
Последовательный обход занял около 200 мс — четыре ответа по 50 мс друг за другом. `Promise.all` уложился примерно в 50 мс, а порядок результатов совпал с порядком `ids`. Точные числа зависят от машины, но соотношение — нет.

После `forEach` массив пуст: callbacks запущены, но не дождались. Через 100 мс ответы пришли, и в массиве четыре элемента. В тесте проверка сработала бы на пустом массиве.

`Promise.all` отклонился с ошибкой второго элемента, хотя первый и третий были успешны. `Promise.allSettled` дождался всех и показал статус каждого.
:::

## Задание

```widget
{"type":"exercise","id":"m3-parallel-all"}
```

:::mistake Параллельно то, что зависит от порядка
`Promise.all([login(), addToCart(), checkout()])` запускает три шага одновременно: оформление может начаться до входа. Параллельно запускают только независимые операции. В UI-тестах Playwright одна страница выполняет действия по очереди, поэтому действия на одной `page` пишут последовательно, каждое с `await`.
:::

:::deep Где Promise.all встречается в Playwright
Классический пример — дождаться события, которое вызывает действие: `const [response] = await Promise.all([page.waitForResponse('**/api/orders'), page.getByRole('button', { name: 'Оформить заказ' }).click()]);`. Ожидание ответа начинается **до** клика, поэтому ответ не будет пропущен. Сейчас чаще пишут иначе: сохранить Promise ожидания в переменную до клика и дождаться его после — смысл тот же.
:::

:::tech Ограничение параллельности
Запускать сотни запросов одновременно опасно: сервер может ответить 429 или упасть. Для больших объёмов используют пачки (по 5–10) или очередь с ограничением одновременных операций. Для тестовых данных из нескольких запросов `Promise.all` подходит как есть.
:::

:::interview
**Вопрос:** «Чем `Promise.all` отличается от `Promise.allSettled`, и когда последовательный `await` лучше?» **Ответ по сути:** `Promise.all` отклоняется при первой ошибке, `allSettled` ждёт все и сообщает статус каждой. Последовательно выполняют зависимые шаги (вход → корзина → заказ) и операции над одним ресурсом; параллельно — независимые, например подготовку нескольких наборов данных.
:::

:::terms
[[promise-all]], [[promise]], [[async-await]], [[race-condition]]
:::
