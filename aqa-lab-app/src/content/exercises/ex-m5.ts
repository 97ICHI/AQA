import type { Exercise } from './types';

// Модуль 5 «Playwright с нуля»: задания запускаются настоящим Playwright через runner на вариантах учебного магазина.
const ex: Exercise[] = [
  {
    id: "m5-lib-expect",
    lesson: "pw-library-vs-test",
    kind: "pw",
    title: "Замените console.log на проверку",
    goal: "Тест добавляет «Кружку» в корзину, но вместо проверки печатает сообщение в консоль — и поэтому проходит даже на сломанном магазине. Замените разовое чтение и `console.log` на проверку Playwright Test: тест должен падать, если товар не добавился, и проходить на медленном магазине.",
    starter: `import { test, expect } from '@playwright/test';

test('кружка добавляется в корзину', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Кружка' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  const count = await page.getByTestId('cart-count').textContent();
  if (count !== '1') console.log('Похоже, товар не добавился. Счётчик:', count);
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('кружка добавляется в корзину', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Кружка' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
`,
    explanation: "Раннер считает тест упавшим, только если функция теста выбросила исключение. `console.log` исключения не выбрасывает, а `expect(...).toHaveText('1')` — выбрасывает, если счётчик не стал `1` за время таймаута. Ожидающая проверка заодно решает вторую проблему: она повторяет чтение, пока запрос в корзину не завершится, поэтому тест не зависит от скорости магазина.",
    hints: [
      "Тест падает, только когда в нём выбрасывается исключение. Что в Playwright Test выбрасывает исключение при несовпадении?",
      "Уберите `textContent()` и `if`: вместо них нужна ожидающая проверка счётчика `page.getByTestId('cart-count')`.",
      "`await expect(page.getByTestId('cart-count')).toHaveText('1');`",
    ],
    mistakes: [
      "`expect(count).toBe('1')` после `textContent()` — проверка есть, но значение прочитано один раз сразу после клика; тест станет нестабильным.",
      "`throw` внутри `if` вместо `expect` — тест начнёт падать, но без ожидания и без понятного сообщения «ожидалось / получено».",
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add'],
  },
  {
    id: "m5-lines-search-add",
    lesson: "pw-first-test-lines",
    kind: "pw",
    title: "Поиск и добавление в корзину",
    goal: "Допишите тест: найдите «Кружка» через поле «Поиск товара» и кнопку «Найти», убедитесь, что найдена ровно одна карточка, добавьте её в корзину и проверьте, что счётчик корзины стал `1`. Не забудьте `await` в каждой строке.",
    starter: `import { test, expect } from '@playwright/test';

test('найденная кружка добавляется в корзину', async ({ page }) => {
  await page.goto('/');
  // TODO: введите «Кружка» в поле «Поиск товара» и нажмите «Найти»
  // TODO: убедитесь, что найдена ровно одна карточка
  // TODO: добавьте её в корзину и проверьте счётчик корзины
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('найденная кружка добавляется в корзину', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Поиск товара').fill('Кружка');
  await page.getByRole('button', { name: 'Найти' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
`,
    explanation: "Тест следует схеме «подготовка → действие → проверка». `fill` и `click` выполняют поиск, `toHaveCount(1)` фиксирует, что мы смотрим на результаты поиска, а не на весь каталог, — после этого кнопка «В корзину» на странице одна, и её можно искать без уточнения карточки. Итоговая проверка счётчика ловит дефект «товар не добавляется». Каждая строка с действием или проверкой начинается с `await`.",
    hints: [
      "Повторите структуру теста из урока: поле поиска по подписи, кнопка по роли, затем проверки.",
      "Поле — `page.getByLabel('Поиск товара')`, кнопка — `page.getByRole('button', { name: 'Найти' })`, число карточек — `toHaveCount` у `page.getByRole('listitem')`.",
      "`await page.getByRole('button', { name: 'В корзину' }).click();\nawait expect(page.getByTestId('cart-count')).toHaveText('1');`",
    ],
    mistakes: [
      "Пропущенный `await` перед действием или `expect` — тест ведёт себя непредсказуемо: то проходит, то падает с `Received: \"\"`.",
      "Проверка только сообщения «Добавлено: Кружка» — на магазине с дефектом оно тоже появляется, а корзина остаётся пустой.",
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add'],
  },
  {
    id: "m5-context-two-visitors",
    lesson: "pw-context",
    kind: "pw",
    title: "Корзины двух посетителей не смешиваются",
    goal: "Первый посетитель (`page`) уже добавил блокнот в корзину. Откройте второго посетителя в **отдельном** BrowserContext и проверьте, что его счётчик корзины равен `0`. Тест должен падать на магазине, где одна корзина на всех.",
    starter: `import { test, expect } from '@playwright/test';

test('корзина одного посетителя не видна другому', async ({ page, browser }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');

  // TODO: откройте второго посетителя в отдельном BrowserContext
  //       и проверьте его счётчик корзины
  const otherPage = await page.context().newPage();
  await otherPage.goto('/');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('корзина одного посетителя не видна другому', async ({ page, browser }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto('/');
  await expect(otherPage.getByTestId('cart-count')).toHaveText('0');
  await otherContext.close();
});
`,
    explanation: "`browser.newContext()` создаёт изолированную сессию со своими cookies — для магазина это новый посетитель с новым `sid` и пустой корзиной. Вкладка того же контекста (`page.context().newPage()`) — тот же посетитель, ею изоляцию не проверить. Контекст, созданный вручную, закрывается в конце теста. Проверка `toHaveText('0')` падает на варианте «одна корзина на всех», где второй посетитель видит чужой товар.",
    hints: [
      "Вкладка из `page.context()` — тот же посетитель. Второму посетителю нужен новый контекст браузера.",
      "Fixture `browser` уже есть в параметрах теста: `browser.newContext()`, затем `newPage()` и `goto('/')`.",
      "`const otherContext = await browser.newContext();\nconst otherPage = await otherContext.newPage();\nawait otherPage.goto('/');\nawait expect(otherPage.getByTestId('cart-count')).toHaveText('0');`",
    ],
    mistakes: [
      "Проверять `toHaveText('0')` во вкладке `page.context().newPage()` — на исправном магазине там `1`, тест упадёт без дефекта.",
      "Не закрыть созданный вручную контекст — раннер закрывает только свои fixtures.",
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['shared-cart', 'cart-not-add'],
  },
  {
    id: "m5-roles-search-cart",
    lesson: "pw-roles",
    kind: "pw",
    title: "Сценарий только на ролях",
    goal: "Используя `getByRole`, найдите «Кружка» поиском, добавьте её в корзину, проверьте сообщение в области `status` («Добавлено: Кружка»), перейдите по ссылке «Корзина» и убедитесь, что в таблице есть строка с кружкой. Подсказка из урока: у поля поиска роль не `textbox`.",
    starter: `import { test, expect } from '@playwright/test';

test('кружка находится поиском и попадает в корзину', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Поиск товара' }).fill('Кружка');
  await page.getByRole('button', { name: 'Найти' }).click();
  await page.getByRole('button', { name: 'В корзину' }).click();
  // TODO: проверьте сообщение в области role=status,
  //       перейдите по ссылке «Корзина» и найдите строку таблицы с кружкой
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('кружка находится поиском и попадает в корзину', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Поиск товара' }).fill('Кружка');
  await page.getByRole('button', { name: 'Найти' }).click();
  await page.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('status')).toHaveText('Добавлено: Кружка');
  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByRole('heading', { name: 'Корзина' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Кружка/ })).toBeVisible();
});
`,
    explanation: "Поле `type=\"search\"` имеет роль `searchbox`, поэтому `getByRole('textbox', …)` его не находит. Сообщение «Добавлено: …» находится в элементе с ролью `status`, ссылка «Корзина (1)» ищется регулярным выражением, потому что число в имени меняется. Строка таблицы `row` получает доступное имя из текста ячеек, поэтому `{ name: /Кружка/ }` находит строку с товаром. Сообщение `status` на сломанном магазине тоже появляется — дефект ловит именно проверка строки в корзине.",
    hints: [
      "Тест падает на первом же шаге: проверьте, какая роль у поля `<input type=\"search\">`.",
      "Роли в сценарии: `searchbox`, `button`, `status`, `link`, `heading`, `row`. Для ссылки с меняющимся числом используйте RegExp в `name`.",
      "`await expect(page.getByRole('status')).toHaveText('Добавлено: Кружка');\nawait page.getByRole('link', { name: /Корзина/ }).click();\nawait expect(page.getByRole('row', { name: /Кружка/ })).toBeVisible();`",
    ],
    mistakes: [
      "`getByRole('link', { name: 'Корзина' })` без RegExp сработает (поиск по подстроке), но `exact: true` уже нет: полное имя ссылки — «Корзина (1)».",
      "Проверять только сообщение `status` — оно не доказывает, что товар попал в корзину.",
    ],
    mustPass: ['ok', 'slow', 'markup-change', 'similar-names'],
    mustFail: ['cart-not-add'],
  },
  {
    id: "m5-locators-rewrite",
    lesson: "pw-locators",
    kind: "pw",
    title: "Перепишите хрупкие CSS-локаторы",
    goal: "Тест добавляет два кабеля USB-C и проверяет сумму, но все локаторы в нём — CSS по id, классам и порядку. На новой вёрстке магазина он ломается. Перепишите локаторы на `getByLabel`, `getByRole` (с цепочкой и `filter`) и `getByTestId`, сохранив шаги и проверки.",
    starter: `import { test, expect } from '@playwright/test';

test('два кабеля USB-C стоят 1 180 ₽', async ({ page }) => {
  await page.goto('/');
  await page.locator('#q').fill('Кабель');
  await page.locator('form button').click();
  const addButton = page.locator('#product-5 .add-to-cart');
  await addButton.click();
  await expect(page.locator('header span')).toHaveText('1');
  await addButton.click();
  await expect(page.locator('header span')).toHaveText('2');
  await page.locator('nav a:nth-child(2)').click();
  await expect(page.locator('.total strong')).toHaveText('1 180 ₽');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('два кабеля USB-C стоят 1 180 ₽', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Поиск товара').fill('Кабель');
  await page.getByRole('button', { name: 'Найти' }).click();
  const card = page.getByRole('listitem').filter({ hasText: 'Кабель USB-C' });
  const addButton = card.getByRole('button', { name: 'В корзину' });
  await addButton.click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await addButton.click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');
  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('1 180 ₽');
});
`,
    explanation: "Каждый CSS-локатор заменён признаком, который видит пользователь или который закреплён договорённостью: подпись поля, роль и имя кнопки, карточка товара по тексту, test id счётчика и суммы. Новая вёрстка меняет классы и id, но не роли, тексты и `data-testid`, поэтому тест проходит. Проверки счётчика после каждого клика и точная сумма `1 180 ₽` ловят дефекты «товар не добавляется» и «сумма не учитывает количество».",
    hints: [
      "Посмотрите, какие признаки элементов остаются на новой вёрстке: роли, подписи, тексты и `data-testid`.",
      "Карточка — `page.getByRole('listitem').filter({ hasText: 'Кабель USB-C' })`, кнопка внутри — `getByRole('button', { name: 'В корзину' })`; счётчик и сумма — `getByTestId('cart-count')` и `getByTestId('cart-total')`.",
      "`const card = page.getByRole('listitem').filter({ hasText: 'Кабель USB-C' });\nconst addButton = card.getByRole('button', { name: 'В корзину' });`",
    ],
    mistakes: [
      "Заменить `#product-5 .add-to-cart` на `button[data-product=\"5\"]` — тоже деталь реализации: атрибут не виден пользователю и не является договорённостью для тестов.",
      "`page.getByText('1 180 ₽')` для суммы — при неверной сумме такой локатор просто ничего не найдёт, и сообщение об ошибке не покажет полученное значение.",
    ],
    mustPass: ['ok', 'markup-change', 'similar-names', 'slow'],
    mustFail: ['cart-not-add', 'wrong-total'],
  },
  {
    id: "m5-strict-pulse-pro",
    lesson: "pw-strict",
    kind: "pw",
    title: "Наушники Pulse Pro без first()",
    goal: "Тест должен положить в корзину именно «Наушники Pulse Pro», но локатор карточки неоднозначен и падает со strict mode violation. Уточните локатор так, чтобы он находил ровно эту карточку — и на исправном магазине, и когда появятся «Наушники Pulse Pro Max» и «Чехол для наушников Pulse».",
    starter: `import { test, expect } from '@playwright/test';

test('наушники Pulse Pro попадают в корзину', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Наушники Pulse' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('status')).toHaveText('Добавлено: Наушники Pulse Pro');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('7 990 ₽');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('наушники Pulse Pro попадают в корзину', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Наушники Pulse Pro', exact: true }),
  });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('status')).toHaveText('Добавлено: Наушники Pulse Pro');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('7 990 ₽');
});
`,
    explanation: "Подстрока «Наушники Pulse» есть в нескольких карточках, а «Наушники Pulse Pro» — в двух, когда появляется Pro Max. Точное описание словами пользователя — «карточка, у которой заголовок ровно „Наушники Pulse Pro“» — переводится в `filter({ has: page.getByRole('heading', { name: …, exact: true }) })`. Такой локатор не зависит от порядка карточек. Проверки счётчика и суммы `7 990 ₽` подтверждают, что в корзину попал нужный товар.",
    hints: [
      "Прочитайте ошибку: какие карточки нашёл локатор и чем нужная отличается от остальных для пользователя?",
      "У каждой карточки есть заголовок с названием. Ищите карточку, *внутри* которой есть заголовок с точным именем: `filter({ has: … })` и `exact: true`.",
      "`page.getByRole('listitem').filter({\n  has: page.getByRole('heading', { name: 'Наушники Pulse Pro', exact: true }),\n})`",
    ],
    mistakes: [
      "`.first()` после `filter({ hasText: 'Наушники Pulse' })` — выберет «Наушники Pulse» без Pro: в корзине окажется другой товар.",
      "`filter({ hasText: 'Наушники Pulse Pro' })` без точного совпадения — на данных с «Pulse Pro Max» снова две карточки.",
      "`.first()` с точным текстом «Наушники Pulse Pro» сейчас проходит, но держится только на порядке карточек в каталоге.",
    ],
    mustPass: ['ok', 'similar-names', 'markup-change', 'slow'],
    mustFail: ['cart-not-add'],
  },
  {
    id: "m5-actions-order",
    lesson: "pw-actions",
    kind: "pw",
    title: "Полный заказ: вход, поиск, корзина",
    goal: "Войдите как `anna@example.test` (пароль `learn-123`), найдите блокнот через поиск с нажатием Enter, добавьте его два раза, оформите заказ в корзине и проверьте сообщение «Заказ №… оформлен на сумму 780 ₽». Тест должен падать, если вход теряется после перехода, товар не добавляется или сумма неверна.",
    starter: `import { test, expect } from '@playwright/test';

test('Анна заказывает два блокнота', async ({ page }) => {
  await page.goto('/login');
  // TODO: заполните Email и Пароль (anna@example.test / learn-123), нажмите «Войти»
  //       и убедитесь, что в шапке появилось имя «Анна»

  // TODO: найдите «Блокнот» через поле поиска (Enter), добавьте его два раза

  await page.goto('/cart');
  // TODO: оформите заказ и проверьте сообщение «Заказ №… оформлен на сумму 780 ₽»
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('Анна заказывает два блокнота', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('anna@example.test');
  await page.getByLabel('Пароль').fill('learn-123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByTestId('user-name')).toHaveText('Анна');

  const search = page.getByRole('searchbox', { name: 'Поиск товара' });
  await search.fill('Блокнот');
  await search.press('Enter');
  const add = page.getByRole('button', { name: 'В корзину' });
  await add.click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await add.click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');

  await page.getByRole('link', { name: /Корзина/ }).click();
  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  await expect(page.getByRole('status')).toHaveText(/^Заказ №\\d+ оформлен на сумму 780 ₽$/);
});
`,
    explanation: "`fill` вводит значения в поля, найденные по подписи (у поля пароля нет роли), `click` отправляет форму, а проверка имени «Анна» в шапке подтверждает, что вход завершился. `press('Enter')` в поле поиска отправляет форму так же, как клик по «Найти». Между двумя кликами «В корзину» стоит проверка счётчика: второй клик начинается после завершения первого. Номер заказа заранее неизвестен, поэтому сообщение проверяется регулярным выражением с точной суммой.",
    hints: [
      "Разбейте сценарий на шаги и после каждого проверяйте видимый результат: имя в шапке, счётчик корзины, сообщение о заказе.",
      "Поля входа — `getByLabel('Email')` и `getByLabel('Пароль')`; поиск — `getByRole('searchbox', { name: 'Поиск товара' })` и `press('Enter')`; заказ — кнопка «Оформить заказ» и область `status`.",
      "`await page.getByRole('button', { name: 'Оформить заказ' }).click();\nawait expect(page.getByRole('status')).toHaveText(/^Заказ №\\d+ оформлен на сумму 780 ₽$/);`",
    ],
    mistakes: [
      "Не дождаться входа (проверки имени в шапке) и сразу перейти дальше — на быстром стенде сработает, на медленном вход ещё не завершится.",
      "`toContainText('оформлен')` без суммы — пропустит дефект «сумма не учитывает количество».",
      "`getByRole('textbox', { name: 'Пароль' })` — у поля `type=\"password\"` нет роли textbox.",
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['auth-lost', 'cart-not-add', 'wrong-total'],
  },
  {
    id: "m5-autowait-slow",
    lesson: "pw-autowait",
    kind: "pw",
    title: "Уберите ручные ожидания",
    goal: "Тест «помогает» Playwright: проверяет `isEnabled()`, ставит паузу и читает счётчик один раз. На медленном магазине он падает. Перепишите его без `isEnabled`, `waitForTimeout` и `textContent`, опираясь на автоожидание действия и ожидающую проверку.",
    starter: `import { test, expect } from '@playwright/test';

test('блокнот добавляется даже в медленном магазине', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  const add = card.getByRole('button', { name: 'В корзину' });
  if (await add.isEnabled()) {
    await add.click();
  }
  await page.waitForTimeout(500);
  expect(await page.getByTestId('cart-count').textContent()).toBe('1');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('блокнот добавляется даже в медленном магазине', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
`,
    explanation: "`click()` сам ждёт, пока кнопка станет видимой, стабильной и доступной, поэтому проверка `isEnabled()` не нужна — и вредна: она отвечает про текущий момент и в медленном магазине пропускает клик. Автоожидание не ждёт ответа сервера после клика, поэтому результат проверяется `toHaveText('1')`, который повторяет чтение до таймаута. Пауза больше не нужна.",
    hints: [
      "Какие строки теста не ждут, а спрашивают «прямо сейчас»?",
      "`isEnabled()` и `textContent()` — разовые вопросы. Клик сам дождётся доступности кнопки, а для результата есть ожидающая проверка.",
      "`await add.click();\nawait expect(page.getByTestId('cart-count')).toHaveText('1');`",
    ],
    mistakes: [
      "Увеличить паузу до 2000 мс — тест пройдёт на этом стенде, но станет медленным и упадёт на ещё более медленном.",
      "Заменить `if (await add.isEnabled())` на `await expect(add).toBeEnabled()` и оставить разовое чтение счётчика — клик пройдёт, но проверка результата всё ещё не ждёт ответа сервера.",
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add'],
  },
  {
    id: "m5-assertions-cart",
    lesson: "pw-assertions",
    kind: "pw",
    title: "Точные проверки корзины",
    goal: "Тест добавляет два блокнота и кружку, но проверяет только, что в сумме есть знак «₽». Сделайте проверки точными и ожидающими: счётчик после каждого добавления, две строки товаров в таблице корзины и итог `1 470 ₽`. Тест должен падать, если товар не добавился или сумма не учитывает количество.",
    starter: `import { test, expect } from '@playwright/test';

test('корзина: два блокнота и кружка', async ({ page }) => {
  await page.goto('/');
  const notebook = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  const mug = page.getByRole('listitem').filter({ hasText: 'Кружка' });
  await notebook.getByRole('button', { name: 'В корзину' }).click();
  await notebook.getByRole('button', { name: 'В корзину' }).click();
  await mug.getByRole('button', { name: 'В корзину' }).click();

  await page.goto('/cart');
  const total = await page.getByTestId('cart-total').textContent();
  expect(total).toContain('₽');
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('корзина: два блокнота и кружка', async ({ page }) => {
  await page.goto('/');
  const notebook = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  const mug = page.getByRole('listitem').filter({ hasText: 'Кружка' });
  await notebook.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await notebook.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');
  await mug.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('3');

  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByRole('row')).toHaveCount(3); // заголовок + 2 товара
  await expect(page.getByTestId('cart-total')).toHaveText('1 470 ₽');
});
`,
    explanation: "`toHaveText` после каждого клика синхронизирует тест с магазином: следующий клик начинается, когда предыдущий запрос завершился. `toHaveCount(3)` у строк таблицы (заголовок и две позиции) и точный итог `1 470 ₽` проверяют результат, важный пользователю. Слабая проверка «содержит ₽» проходит при любой сумме, поэтому пропускала оба дефекта.",
    hints: [
      "Проверка «содержит ₽» пройдёт при любой сумме. Что именно должен увидеть покупатель?",
      "После каждого клика — `toHaveText` для `getByTestId('cart-count')`; в корзине — `toHaveCount` для `getByRole('row')` и `toHaveText` для `getByTestId('cart-total')`.",
      "`await expect(page.getByRole('row')).toHaveCount(3); // заголовок + 2 товара\nawait expect(page.getByTestId('cart-total')).toHaveText('1 470 ₽');`",
    ],
    mistakes: [
      "`expect(await page.getByTestId('cart-total').textContent()).toBe('1 470 ₽')` — разовое чтение: оно не ждёт и, в отличие от `toHaveText`, не нормализует пробелы.",
      "Три клика подряд без проверки счётчика — на медленном магазине часть запросов ещё не завершится к моменту перехода в корзину.",
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['wrong-total', 'cart-not-add'],
  },
  {
    id: "m5-waits-order-response",
    lesson: "pw-waits",
    kind: "pw",
    title: "Проверьте ответ сервера на создание заказа",
    goal: "Сценарий заказа уже написан и проверяет сообщение на странице. Добавьте проверку ответа `POST /api/orders`: статус `201`, а поле `total` в JSON — число `390`. Ожидание ответа должно начинаться до клика по «Оформить заказ».",
    starter: `import { test, expect } from '@playwright/test';

test('заказ создаётся: ответ 201 и сумма числом', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('anna@example.test');
  await page.getByLabel('Пароль').fill('learn-123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByTestId('user-name')).toHaveText('Анна');

  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await page.getByRole('link', { name: /Корзина/ }).click();

  // TODO: начните ждать ответ POST /api/orders ДО клика,
  //       затем проверьте статус 201 и что total — число 390
  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  await expect(page.getByRole('status')).toHaveText(/оформлен на сумму 390 ₽/);
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('заказ создаётся: ответ 201 и сумма числом', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('anna@example.test');
  await page.getByLabel('Пароль').fill('learn-123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByTestId('user-name')).toHaveText('Анна');

  const card = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await page.getByRole('link', { name: /Корзина/ }).click();

  const orderResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  const response = await orderResponse;
  expect(response.status()).toBe(201);
  const order = await response.json();
  expect(order.total).toBe(390);
  await expect(page.getByRole('status')).toHaveText(\`Заказ №\${order.id} оформлен на сумму 390 ₽\`);
});
`,
    explanation: "`page.waitForResponse` с предикатом создаётся до клика и сохраняется без `await` — так ответ не будет пропущен. После клика `await` на сохранённом Promise даёт объект ответа: `status()` ловит дефект «200 вместо 201», а `toBe(390)` для `total` — дефект «сумма строкой» (строка `'390.00'` не равна числу). Сообщение на странице проверяется с номером заказа из ответа.",
    hints: [
      "Интерфейс в обоих дефектах выглядит правильно. Проверять нужно сам ответ сервера.",
      "Создайте `page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST')` без `await` до клика, а после клика дождитесь его.",
      "`const response = await orderResponse;\nexpect(response.status()).toBe(201);\nexpect((await response.json()).total).toBe(390);`",
    ],
    mistakes: [
      "Начать `waitForResponse` после клика — ответ может прийти раньше, тест будет падать по таймауту «иногда».",
      "`expect(response.ok()).toBeTruthy()` — 200 тоже «ok», дефект со статусом пройдёт незамеченным.",
      "`expect(Number(order.total)).toBe(390)` — приведение типа прячет дефект «total строкой».",
    ],
    mustPass: ['ok', 'slow'],
    mustFail: ['api-status', 'api-json'],
  },
  {
    id: "m5-timeouts-poll",
    lesson: "pw-timeouts",
    kind: "pw",
    title: "Опрос корзины вместо паузы",
    goal: "Тест кликает с маленьким таймаутом, ждёт 300 мс и один раз читает корзину через API. На медленном магазине он падает. Уберите лишний таймаут и паузу, а количество товаров на сервере проверьте через `expect.poll` с запросом `page.request.get('/api/cart')`.",
    starter: `import { test, expect } from '@playwright/test';

test('кружка попадает в корзину на сервере', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Кружка' });
  await card.getByRole('button', { name: 'В корзину' }).click({ timeout: 1000 });
  await page.waitForTimeout(300);
  const response = await page.request.get('/api/cart');
  expect((await response.json()).count).toBe(1);
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('кружка попадает в корзину на сервере', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('listitem').filter({ hasText: 'Кружка' });
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect
    .poll(async () => {
      const response = await page.request.get('/api/cart');
      return (await response.json()).count;
    }, { message: 'количество товаров в корзине на сервере' })
    .toBe(1);
});
`,
    explanation: "`click({ timeout: 1000 })` ограничивал ожидание доступности кнопки, а в медленном магазине она активна через 1,5 с. Без опции действие ограничено таймаутом теста. `expect.poll` повторяет запрос к API, пока `count` не станет `1` или не истечёт таймаут проверки, — пауза не нужна, а при дефекте сообщение покажет последнее полученное значение. `page.request` отправляет запрос с cookies контекста, поэтому сервер видит ту же корзину.",
    hints: [
      "Найдите в тесте два числа, которые «угадывают» скорость магазина.",
      "Уберите `timeout` у клика и `waitForTimeout`. Разовое чтение API замените на `expect.poll(async () => …).toBe(1)`.",
      "`await expect.poll(async () => {\n  const response = await page.request.get('/api/cart');\n  return (await response.json()).count;\n}).toBe(1);`",
    ],
    mistakes: [
      "Увеличить `timeout` клика до 2000 и паузу до 1000 — сегодня пройдёт, на более медленном стенде снова упадёт.",
      "Использовать `request` fixture вместо `page.request` — у него свои cookies, сервер увидит другого посетителя с пустой корзиной.",
    ],
    mustPass: ['ok', 'slow'],
    mustFail: ['cart-not-add'],
  },
];
export default ex;
