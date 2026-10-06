import type { Exercise } from './types';

const ex: Exercise[] = [
  {
    id: 'm11-parse-status',
    lesson: 'iv-scenarios',
    kind: 'ts',
    title: 'Live coding: номер и сумма заказа из сообщения',
    goal: 'Напишите `parseOrderStatus(text)`: из строки вида `Заказ №105 оформлен на сумму 12 970 ₽` верните `{ id: 105, total: 12970 }`, для любой другой строки — `null`. Разделитель тысяч — обычный или неразрывный пробел (`\\u00a0`), дробная часть — через запятую.',
    starter: `export function parseOrderStatus(text: string): { id: number; total: number } | null {
  const parts = text.split(' ');
  return { id: Number(parts[1].slice(1)), total: Number(parts[5]) };
}
`,
    solution: `export function parseOrderStatus(text: string): { id: number; total: number } | null {
  const m = /^Заказ №(\\d+) оформлен на сумму ([\\d\\s\\u00a0]+(?:,\\d+)?) ₽$/.exec(text.trim());
  if (!m) return null;
  const total = Number(m[2].replace(/[\\s\\u00a0]/g, '').replace(',', '.'));
  return { id: Number(m[1]), total };
}
`,
    explanation: 'Регулярное выражение одновременно проверяет формат и извлекает части: если строка не совпала, возвращается `null`, а не объект с `NaN`. Перед `Number` убираются разделители тысяч (оба вида пробелов) и запятая меняется на точку. На интервью ценится не только код, но и вопросы: «какой разделитель тысяч?», «бывают ли копейки?», «что вернуть при ошибке?» — и проговорённые граничные случаи.',
    hints: [
      'Сначала решите, как отличить «правильную» строку от любой другой, — `split` по пробелам ломается на «12 970».',
      'Регулярное выражение с двумя группами: номер `(\\d+)` и сумма из цифр, пробелов и необязательной дробной части.',
      '`Number(m[2].replace(/[\\s\\u00a0]/g, \'\').replace(\',\', \'.\'))` превращает «12 970» в 12970, а «1 234,5» — в 1234.5.',
    ],
    mistakes: [
      'Возвращать `{ id: NaN, total: NaN }` для неподходящей строки: вызывающий код не отличит ошибку от данных.',
      'Убирать только обычные пробелы: магазин форматирует сумму через неразрывный пробел.',
    ],
    check: `import { parseOrderStatus } from './student';
test('простая сумма', () => expectEq(parseOrderStatus('Заказ №105 оформлен на сумму 780 ₽'), { id: 105, total: 780 }));
test('неразрывный пробел в тысячах', () => expectEq(parseOrderStatus('Заказ №7 оформлен на сумму 12\\u00a0970 ₽'), { id: 7, total: 12970 }));
test('обычный пробел и копейки', () => expectEq(parseOrderStatus('Заказ №1001 оформлен на сумму 1 234,5 ₽'), { id: 1001, total: 1234.5 }));
test('ошибка — null', () => expectEq(parseOrderStatus('Ошибка: нужно войти'), null));
test('пустая строка — null', () => expectEq(parseOrderStatus(''), null));
test('нет суммы — null', () => expectEq(parseOrderStatus('Заказ №105 оформлен'), null));
`,
  },
  {
    id: 'm11-capstone',
    lesson: 'iv-final',
    kind: 'pw',
    title: 'Итоговый сценарий: вход → корзина → заказ → API',
    goal: 'Допишите сквозной тест Бориса: два «Блокнота A5» в корзине с итогом 780 ₽, оформление заказа с проверкой ответа `POST /api/orders` (201, `total` — число 780) и сообщения на странице, затем `GET /api/orders/:id` — заказ сохранён за Борисом (`userId` 2). Тест должен выдержать медленный магазин и новую вёрстку и поймать шесть дефектов.',
    starter: `import { test, expect } from '@playwright/test';

test('Борис покупает два блокнота: UI и API согласны', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('boris@example.test');
  await page.getByLabel('Пароль').fill('learn-123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByTestId('user-name')).toHaveText('Борис');

  // TODO: корзина (2 × «Блокнот A5», итог 780 ₽)
  // TODO: заказ (ответ POST /api/orders: 201, total — число 780; сообщение на странице)
  // TODO: GET /api/orders/:id — заказ сохранён за Борисом (userId 2)
});
`,
    solution: `import { test, expect } from '@playwright/test';

test('Борис покупает два блокнота: UI и API согласны', async ({ page }) => {
  await test.step('вход', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('boris@example.test');
    await page.getByLabel('Пароль').fill('learn-123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByTestId('user-name')).toHaveText('Борис');
  });

  await test.step('корзина', async () => {
    const add = page.getByRole('listitem').filter({ hasText: 'Блокнот A5' }).getByRole('button', { name: 'В корзину' });
    await add.click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await add.click();
    await expect(page.getByTestId('cart-count')).toHaveText('2');
    await page.getByRole('link', { name: /Корзина/ }).click();
    await expect(page.getByTestId('cart-total')).toHaveText('780 ₽');
  });

  const order = await test.step('заказ', async () => {
    const created = page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Оформить заказ' }).click();
    const res = await created;
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.total).toBe(780);
    await expect(page.getByRole('status')).toHaveText(\`Заказ №\${body.id} оформлен на сумму 780 ₽\`);
    return body as { id: number };
  });

  await test.step('заказ сохранён за Борисом', async () => {
    const saved = await page.request.get(\`/api/orders/\${order.id}\`);
    expect(saved.status()).toBe(200);
    expect(await saved.json()).toMatchObject({ id: order.id, userId: 2, status: 'new', total: 780 });
  });
});
`,
    explanation: 'Каждый шаг сценария закрыт проверкой наблюдаемого результата, поэтому падение указывает на конкретное место: вход, корзину, ответ API или сохранённые данные. Ожидание ответа создаётся до клика — иначе ответ можно пропустить. Проверка `GET /api/orders/:id` через `page.request` выполняется в той же сессии: дефект «заказ записан не тому пользователю» не виден в интерфейсе и в ответе на создание, но сервер отказывает Борису в доступе к «его» заказу (403). `test.step` делает отчёт читаемым: в нём видно, на каком шаге сценарий остановился.',
    hints: [
      'Распишите сценарий шагами и для каждого шага выберите одну проверку результата: счётчик, итог, ответ API, сообщение, сохранённый заказ.',
      'Ответ на создание заказа: `const created = page.waitForResponse((r) => r.url().endsWith(\'/api/orders\') && r.request().method() === \'POST\');` — до клика по «Оформить заказ». Сохранённый заказ — `page.request.get(\'/api/orders/\' + id)`.',
      '`expect(res.status()).toBe(201); expect(body.total).toBe(780);` и `expect(await saved.json()).toMatchObject({ id: body.id, userId: 2, total: 780 });`',
    ],
    mistakes: [
      'Проверять только сообщение «Заказ №… оформлен»: дефекты в JSON и в сохранении заказа проходят незамеченными.',
      'Брать `userId` из ответа на создание заказа: при дефекте он верный, а в базе записан другой пользователь.',
      'Использовать фикстуру `request` для `GET /api/orders/:id`: у неё нет сессии Бориса, ответ будет 401 на любом магазине.',
    ],
    mustPass: ['ok', 'slow', 'markup-change'],
    mustFail: ['cart-not-add', 'wrong-total', 'auth-lost', 'order-user', 'api-status', 'api-json'],
  },
];
export default ex;
