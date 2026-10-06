:::why
Тест повторяет то, что делает пользователь: нажимает, вводит, отмечает, выбирает, загружает файлы, подтверждает диалоги, открывает ссылки в новой вкладке. Для каждого такого шага в Playwright есть своё действие, и у каждого — свои подводные камни. В этом уроке вы соберёте полный сценарий покупки: вход, поиск, корзина и заказ.
:::

## Основные действия

Действие вызывается у [[locator|локатора]]. Перед выполнением Playwright находит элемент и ждёт, пока он будет готов (подробно — в следующем уроке).

| Действие | Что делает пользователь | Пример |
|---|---|---|
| `click()` | нажимает | `page.getByRole('button', { name: 'Войти' }).click()` |
| `dblclick()` | двойной щелчок | редко нужен в формах |
| `fill(text)` | очищает поле и вводит текст целиком | `page.getByLabel('Email').fill('anna@example.test')` |
| `press(key)` | нажимает клавишу | `search.press('Enter')`, `press('Control+A')` |
| `pressSequentially(text)` | печатает по символу | поле с подсказками при вводе |
| `check()` / `uncheck()` | отмечает или снимает флажок | `page.getByLabel('Подарочная упаковка').check()` |
| `selectOption(value)` | выбирает пункт списка `<select>` | `page.getByLabel('Доставка').selectOption('Самовывоз')` |
| `setInputFiles(files)` | загружает файл в `<input type="file">` | путь к файлу или объект с содержимым |
| `hover()` | наводит указатель | открыть выпадающее меню |
| `dragTo(target)` | перетаскивает | сортировка списка |

Несколько уточнений:

- **`fill`** заменяет значение поля целиком и вызывает событие `input` один раз. Для большинства полей это то, что нужно. `pressSequentially` нужен, только если приложение реагирует на каждое нажатие клавиши.
- **`check`** не просто кликает: после клика он проверяет, что флажок действительно отмечен, и падает, если нет. Повторный `check` на отмеченном флажке ничего не делает.
- **`selectOption`** принимает значение (`value`) или видимый текст пункта, а также массив — для списков с множественным выбором.

## Диалоги, файлы и новые вкладки

Три ситуации требуют подготовки **до** действия, которое их вызывает.

**Диалог** `alert`/`confirm`/`prompt`. По умолчанию Playwright сам закрывает диалоги (отклоняет `confirm`). Чтобы нажать «ОК», подпишитесь на событие заранее:

```ts
page.once('dialog', (dialog) => dialog.accept());
await page.getByRole('button', { name: 'Очистить' }).click();
```

**Файл.** `setInputFiles` принимает путь или объект `{ name, mimeType, buffer }` — второй вариант не требует файла на диске.

**Новая вкладка** (ссылка с `target="_blank"`). Начните ждать событие `popup` до клика, затем дождитесь его:

```ts
const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Корзина в новой вкладке' }).click();
const popup = await popupPromise;
await expect(popup.getByRole('heading', { name: 'Корзина' })).toBeVisible();
```

Почему «до» — подробно в уроке про ожидание событий. Коротко: если вкладка откроется раньше, чем вы начнёте ждать, событие будет пропущено.

:::try Все действия на одной странице
В магазине нет флажков и выпадающих списков, поэтому первый тест строит учебную форму через `page.setContent()`. Второй открывает настоящую страницу магазина, добавляет на неё ссылку с `target="_blank"` и ловит новую вкладку.
:::

```widget
{"type":"playground","lang":"pw","title":"Действия: fill, check, selectOption, файл, диалог, вкладка","variant":"ok","code":"import { test, expect } from '@playwright/test';\n\ntest('элементы формы', async ({ page }) => {\n  await page.setContent(`\n    <label>Количество <input type=\"number\" value=\"1\"></label>\n    <label><input type=\"checkbox\"> Подарочная упаковка</label>\n    <label>Доставка <select><option value=\"courier\">Курьер</option><option value=\"pickup\">Самовывоз</option></select></label>\n    <label>Чек <input type=\"file\"></label>\n    <button onclick=\"if (confirm('Очистить корзину?')) this.textContent = 'Очищено'\">Очистить</button>`);\n\n  await page.getByLabel('Количество').fill('3');\n  await page.getByLabel('Подарочная упаковка').check();\n  await page.getByLabel('Доставка').selectOption('Самовывоз');\n  await page.getByLabel('Чек').setInputFiles({ name: 'receipt.txt', mimeType: 'text/plain', buffer: Buffer.from('чек') });\n  page.once('dialog', (dialog) => dialog.accept());\n  await page.getByRole('button', { name: 'Очистить' }).click();\n\n  await expect(page.getByLabel('Количество')).toHaveValue('3');\n  await expect(page.getByLabel('Подарочная упаковка')).toBeChecked();\n  await expect(page.getByLabel('Доставка')).toHaveValue('pickup');\n  await expect(page.getByLabel('Чек')).toHaveValue(/receipt\\.txt/);\n  await expect(page.getByRole('button', { name: 'Очищено' })).toBeVisible();\n});\n\ntest('ссылка открывает новую вкладку', async ({ page }) => {\n  await page.goto('/');\n  await page.evaluate(() => {\n    const a = document.createElement('a');\n    a.href = '/cart';\n    a.target = '_blank';\n    a.textContent = 'Корзина в новой вкладке';\n    document.body.append(a);\n  });\n  const popupPromise = page.waitForEvent('popup');\n  await page.getByRole('link', { name: 'Корзина в новой вкладке' }).click();\n  const popup = await popupPromise;\n  await expect(popup.getByRole('heading', { name: 'Корзина' })).toBeVisible();\n});\n","recorded":{"variant":"Исправный магазин","output":"✓ элементы формы (389 мс)\n✓ ссылка открывает новую вкладку (323 мс)"}}
```

:::happened
Каждое действие изменило состояние элемента, а проверки в конце это подтвердили: `toHaveValue` у поля и списка, `toBeChecked` у флажка, имя файла в значении поля. Диалог `confirm` был принят обработчиком `page.once`, поэтому код кнопки выполнил ветку «ОК», и текст кнопки сменился на «Очищено». Во втором тесте ожидание `popup` началось до клика, поэтому новая вкладка не была пропущена.
:::

## Сценарий магазина целиком

```ts tests/order.spec.ts
await page.goto('/login');
await page.getByLabel('Email').fill('anna@example.test');
await page.getByLabel('Пароль').fill('learn-123');
await page.getByRole('button', { name: 'Войти' }).click();
await expect(page.getByTestId('user-name')).toHaveText('Анна');   // вход завершился
```

После `click` по «Войти» страница отправляет запрос и переходит в каталог. Проверка имени в шапке — это точка синхронизации: дальше тест работает уже как вошедший пользователь. Пароль `learn-123` — учебный, общий для всех пользователей тренировочной базы.

## Задание

```widget
{"type":"exercise","id":"m5-actions-order"}
```

:::mistake
**Действие без проверки результата.** `click()` завершается, когда клик *отправлен*, а не когда приложение закончило работу. Если сразу после клика по «Войти» перейти в корзину, вход может ещё не завершиться. После каждого значимого действия проверяйте видимый результат: имя в шапке, счётчик корзины, сообщение.
:::

:::deep force и другие опции действий
У действий есть опции: `click({ button: 'right' })`, `click({ modifiers: ['Shift'] })`, `click({ position: { x, y } })`. Опция `force: true` отключает часть проверок готовности элемента — например, кликает по элементу, перекрытому другим. В тестах она почти всегда скрывает настоящий дефект: пользователь по перекрытой кнопке нажать не может. Используйте `force` только осознанно, с комментарием, почему.
:::

:::tech Клавиатура и мышь напрямую
Кроме действий у локатора есть низкоуровневые `page.keyboard` (`press`, `type`, `down`, `up`) и `page.mouse` (`click(x, y)`, `move`, `down`, `up`). Они действуют «туда, где сейчас фокус или указатель» и не ждут готовности элемента. Их используют для сложных жестов (рисование на canvas), а в обычных формах — действия локатора.
:::

:::interview
**Вопрос:** «Чем `fill` отличается от `pressSequentially`?» **Ответ по сути:** `fill` устанавливает значение поля целиком за один раз (с событием `input`) — быстро и надёжно. `pressSequentially` эмулирует нажатие каждой клавиши — нужен, когда приложение реагирует на ввод по символу (автодополнение, маска ввода). По умолчанию — `fill`.
:::

:::terms
[[locator]], [[actionability]], [[assertion]]
:::
