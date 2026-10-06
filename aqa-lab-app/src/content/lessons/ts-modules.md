:::why
Настоящий тестовый проект — это десятки файлов: тесты, помощники, тестовые данные, конфигурация. Файлы обмениваются кодом через `import` и `export`, а готовые библиотеки вроде Playwright приходят из npm. Без этого не понять ни первую строку теста, ни что делает `npm install`.
:::

## Модуль: файл со своими границами

Каждый файл `.ts` в проекте — [[es-module|модуль]]. Всё, что объявлено в модуле, по умолчанию видно только внутри него. Чтобы другой файл мог пользоваться функцией или константой, её **экспортируют**:

```ts tests/helpers/money.ts
export const FREE_DELIVERY_FROM = 3000;

export function formatRub(amount: number): string {
  return `${amount} ₽`;
}

function roundToRub(value: number): number {   // без export — только для этого файла
  return Math.round(value);
}
```

А в другом файле — **импортируют** по имени:

```ts tests/cart.spec.ts
import { test, expect } from '@playwright/test';
import { formatRub } from './helpers/money';

test('итог корзины для двух блокнотов', async ({ page }) => {
  // … добавить два блокнота по 390 ₽ …
  await page.goto('/cart');
  await expect(page.getByTestId('cart-total')).toHaveText(formatRub(780));   // '780 ₽'
});
```

Обратите внимание на два вида путей после `from`:

- `'./helpers/money'` начинается с точки — это **ваш файл**, путь считается от текущего файла. Расширение `.ts` обычно не пишут.
- `'@playwright/test'` без точки — это **пакет**: код, установленный в папку `node_modules`.

## Именованный и default-экспорт

Кроме экспорта по имени есть `export default` — «главное значение модуля». Его импортируют без фигурных скобок и под любым именем:

```ts playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests' });
```

Так устроен файл конфигурации Playwright: раннер импортирует из него default-экспорт. В собственных помощниках удобнее именованные экспорты: имя одно и то же во всех файлах, редактор подсказывает его при наборе.

## npm и package.json

[[npm|npm]] — менеджер пакетов Node.js: он скачивает библиотеки из общего реестра. Список нужных проекту пакетов хранится в [[package-json|package.json]] в корне проекта:

```json package.json
{
  "name": "shop-tests",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "1.58.2",
    "typescript": "5.9.3"
  }
}
```

- `devDependencies` — пакеты, нужные для разработки и тестов, с версиями.
- `scripts` — короткие команды: `npm test` запустит `playwright test`, `npm run typecheck` — проверку типов.

Основные команды:

```bash
npm install          # установить всё из package.json в node_modules
npm ci               # чистая установка строго по package-lock.json — так делают в CI
npm run typecheck    # выполнить скрипт из package.json
npx playwright test  # запустить программу из установленного пакета
```

`package-lock.json` фиксирует точные версии всех пакетов, включая вложенные, и хранится в git вместе с кодом. Папку `node_modules` в git не добавляют: её всегда можно восстановить командой `npm ci`.

:::try Посмотрите на package.json как на данные
Песочница выполняет один файл, поэтому настоящий `import` между файлами здесь не показать — это делает задание ниже. Зато `package.json` — обычный JSON, и его можно разобрать и прочитать как объект. Запустите код и попробуйте добавить в `scripts` ещё одну команду.
:::

```widget
{"type": "playground", "lang": "ts", "title": "package.json — это объект", "code": "const text = `{\n  \"name\": \"shop-tests\",\n  \"scripts\": { \"test\": \"playwright test\", \"typecheck\": \"tsc --noEmit\" },\n  \"devDependencies\": { \"@playwright/test\": \"1.58.2\", \"typescript\": \"5.9.3\" }\n}`;\n\nconst pkg = JSON.parse(text);\nconsole.log('проект:', pkg.name);\nconsole.log('npm test запустит:', pkg.scripts.test);\nconsole.log('npm run typecheck запустит:', pkg.scripts.typecheck);\nfor (const [name, version] of Object.entries(pkg.devDependencies)) {\n  console.log(`пакет ${name}, версия ${version}`);\n}\n"}
```

:::happened
`JSON.parse` превратил текст в объект, и дальше с ним работают как с любым объектом: `pkg.scripts.test`. `Object.entries` дал пары «имя пакета → версия», и цикл прошёл по ним. Именно эти данные читает npm, когда вы пишете `npm test` или `npm install`.
:::

## Задание

В этом задании проверка — отдельный модуль, который импортирует ваш код: `import { formatRub, FREE_DELIVERY_FROM } from './student'`. Ровно так тестовый файл импортирует помощники.

```widget
{"type":"exercise","id":"m3-mod-export"}
```

:::mistake Импорт default как именованного
Если модуль экспортирует `export default formatRub`, то `import { formatRub } from './money'` не сработает — нужно `import formatRub from './money'`. Смешение двух видов экспорта — частая причина ошибки «has no exported member».
:::

:::deep Почему версии фиксируют точно
Запись `"^1.58.0"` разрешает npm поставить любую совместимую версию 1.x новее 1.58.0. Для тестового проекта это означает: вчера и сегодня могут работать разные версии Playwright и браузеров. Точная версия в package.json и закоммиченный `package-lock.json` делают прогон воспроизводимым; обновление — отдельное осознанное изменение.
:::

:::tech ESM и CommonJS
`import`/`export` — стандартные модули JavaScript (ESM). В старом коде Node.js встречается другая система — CommonJS: `const x = require('x')` и `module.exports = …`. Какая используется в проекте, определяет поле `"type"` в package.json и настройки TypeScript. Playwright Test поддерживает обе.
:::

:::interview
**Вопрос:** «Чем `dependencies` отличаются от `devDependencies` и зачем `npm ci`?» **Ответ по сути:** `dependencies` нужны приложению при работе, `devDependencies` — только для разработки и тестов; тестовый проект почти всё держит в `devDependencies`. `npm ci` ставит пакеты строго по `package-lock.json` и падает при расхождении с package.json — так CI получает те же версии, что и разработчик.
:::

:::terms
[[es-module]], [[npm]], [[package-json]], [[json]]
:::
