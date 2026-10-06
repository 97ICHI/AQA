import type { Exercise } from './types';

const expectedStarter = `// Требование R-7 «Сумма к оплате»
// 1. Сумма товаров = Σ цена × количество.
// 2. Промокод SPRING уменьшает сумму товаров на 10 %.
// 3. Доставка — 299 ₽; бесплатно, если сумма товаров ПОСЛЕ скидки не меньше 3000 ₽.
// 4. К оплате = сумма товаров после скидки + доставка.
// Цены: «Блокнот A5» — 390 ₽, «Кабель USB-C» — 590 ₽, «Кружка» — 690 ₽, «Наушники Pulse» — 4990 ₽.
//
// Запишите ожидаемую сумму к оплате для каждого случая — по требованию, до запуска программы.
export const expected = {
  twoNotebooks: 0,        // 2 × «Блокнот A5», без промокода
  headphonesSpring: 0,    // 1 × «Наушники Pulse», промокод SPRING
  cablesAndMugs: 0,       // 2 × «Кабель USB-C» + 3 × «Кружка», без промокода
  cablesAndMugsSpring: 0, // 2 × «Кабель USB-C» + 3 × «Кружка», промокод SPRING
};
`;

const qtyGood = `/** Количество одного товара в корзине: целое число от 1 до 10 включительно. */
export function isValidQty(qty: number): boolean {
  return Number.isInteger(qty) && qty >= 1 && qty <= 10;
}

/** Доставка: 299 ₽; бесплатно, если сумма товаров от 3000 ₽ включительно. */
export function shippingCost(subtotal: number): number {
  return subtotal >= 3000 ? 0 : 299;
}
`;

const promoGood = `/**
 * Применяет промокод к сумме товаров.
 * - null или пустая строка — промокода нет, сумма не меняется;
 * - SPRING — скидка 10 % (вниз до целого рубля), действует при сумме от 1000 ₽ включительно,
 *   при меньшей сумме — ошибка «SPRING действует от 1000 ₽»;
 * - любой другой код — ошибка «Неизвестный промокод».
 */
export function applyPromo(total: number, code: string | null): number {
  if (code === null || code === '') return total;
  if (code !== 'SPRING') throw new Error('Неизвестный промокод');
  if (total < 1000) throw new Error('SPRING действует от 1000 ₽');
  return Math.floor((total * 9) / 10);
}
`;

const ex: Exercise[] = [
  {
    id: 'm2-expected-table',
    lesson: 'qa-expected',
    kind: 'ts',
    title: 'Ожидаемые результаты по требованию',
    goal: 'По требованию R-7 посчитайте ожидаемую сумму к оплате для четырёх заказов и запишите числа в объект `expected`. Программы нет — только требование: так и пишут ожидаемый результат до запуска.',
    starter: expectedStarter,
    solution: expectedStarter
      .replace('twoNotebooks: 0,       ', 'twoNotebooks: 1079,    ')
      .replace('headphonesSpring: 0,   ', 'headphonesSpring: 4491,')
      .replace('cablesAndMugs: 0,      ', 'cablesAndMugs: 3250,   ')
      .replace('cablesAndMugsSpring: 0,', 'cablesAndMugsSpring: 3224,'),
    explanation: '2 × 390 = 780 < 3000, значит доставка платная: 780 + 299 = **1079**. Наушники со SPRING: 4990 − 10 % = 4491 ≥ 3000 — доставка бесплатна: **4491**. Кабели и кружки: 2 × 590 + 3 × 690 = 3250 ≥ 3000: **3250**. Самый интересный случай — тот же заказ со SPRING: 3250 − 10 % = 2925, это уже меньше 3000, доставка снова платная: 2925 + 299 = **3224**. Требование прямо говорит «после скидки» — без записанного ожидания легко принять за правильный любой из двух ответов программы.',
    hints: [
      'Для каждого заказа идите по пунктам требования по порядку: сумма товаров → скидка → доставка → к оплате.',
      'Порог бесплатной доставки сравнивается с суммой **после** скидки. В последнем случае скидка опускает сумму ниже 3000 ₽.',
      '`cablesAndMugs`: 2 × 590 + 3 × 690 = 3250 (доставка бесплатна); со SPRING: 3250 × 0,9 = 2925, плюс 299.',
    ],
    mistakes: [
      'Сравнивать порог с суммой до скидки: получится 2925 вместо 3224 — ровно та ошибка, которую стоит искать в программе.',
      'Забыть доставку для маленького заказа: 780 вместо 1079.',
    ],
    check: `import { expected } from './student';
test('2 × «Блокнот A5»: 780 ₽ товаров + 299 ₽ доставки', () => expectEq(expected.twoNotebooks, 1079, 'twoNotebooks'));
test('«Наушники Pulse» со SPRING: 4491 ₽, доставка бесплатна', () => expectEq(expected.headphonesSpring, 4491, 'headphonesSpring'));
test('2 кабеля + 3 кружки: 3250 ₽, доставка бесплатна', () => expectEq(expected.cablesAndMugs, 3250, 'cablesAndMugs'));
test('то же со SPRING: 2925 ₽ < 3000 ₽, доставка платная', () => expectEq(expected.cablesAndMugsSpring, 3224, 'cablesAndMugsSpring'));
`,
  },
  {
    id: 'm2-qty-boundaries',
    lesson: 'qa-boundaries',
    kind: 'ts-test',
    title: 'Тесты на границах: количество и бесплатная доставка',
    goal: 'В модуле `app` есть `isValidQty(qty)` (целое от 1 до 10 включительно) и `shippingCost(subtotal)` (299 ₽, бесплатно от 3000 ₽ включительно). Стартовые тесты проверяют только «середину» и проходят на всех версиях. Добавьте проверки, которые поймают каждую из шести сломанных версий.',
    starter: `import { isValidQty, shippingCost } from './app';

test('обычное количество принимается', () => expectEq(isValidQty(5), true));
test('огромное количество отклоняется', () => expectEq(isValidQty(100), false));
test('дешёвый заказ — платная доставка', () => expectEq(shippingCost(500), 299));

// TODO: добавьте проверки на границах и для «неправильного» класса значений
`,
    solution: `import { isValidQty, shippingCost } from './app';

// количество: граница снизу
test('0 штук — нельзя', () => expectEq(isValidQty(0), false));
test('1 штука — можно', () => expectEq(isValidQty(1), true));
// количество: граница сверху
test('10 штук — можно', () => expectEq(isValidQty(10), true));
test('11 штук — нельзя', () => expectEq(isValidQty(11), false));
// класс «не целое число»
test('2.5 штуки — нельзя', () => expectEq(isValidQty(2.5), false));
// доставка: граница 3000
test('2999 ₽ — доставка 299', () => expectEq(shippingCost(2999), 299));
test('3000 ₽ — доставка бесплатна', () => expectEq(shippingCost(3000), 0));
`,
    explanation: 'Ошибки чаще всего прячутся на границах: `>` вместо `>=`, `<` вместо `<=`, сдвиг на единицу. Для границы берут значение на ней и ближайшее за ней: 0 и 1, 10 и 11, 2999 и 3000. Значения из середины (5, 100, 500) этих ошибок не видят — они лежат в тех же классах при любой из сломанных версий. Отдельный класс — дробное число: правило «целое» тоже часть требования.',
    hints: [
      'Найдите в требованиях все места, где поведение меняется: «от 1», «до 10», «от 3000», «целое».',
      'Для каждой границы нужна пара значений: на самой границе и сразу за ней (0/1, 10/11, 2999/3000). Плюс одно дробное количество.',
      '`test(\'10 штук — можно\', () => expectEq(isValidQty(10), true));` и `test(\'3000 ₽ — бесплатно\', () => expectEq(shippingCost(3000), 0));`',
    ],
    mistakes: [
      'Проверять только 0 и 100: ошибки вида `< 10` вместо `<= 10` останутся незамеченными.',
      'Ожидать для 3000 ₽ платную доставку: требование говорит «от 3000 включительно» — тест упадёт на исправной версии.',
    ],
    good: qtyGood,
    broken: [
      { name: 'Сломано: 0 штук принимается', code: qtyGood.replace('qty >= 1', 'qty >= 0') },
      { name: 'Сломано: 1 штука отклоняется', code: qtyGood.replace('qty >= 1', 'qty > 1') },
      { name: 'Сломано: 10 штук отклоняется', code: qtyGood.replace('qty <= 10', 'qty < 10') },
      { name: 'Сломано: 11 штук принимается', code: qtyGood.replace('qty <= 10', 'qty <= 11') },
      { name: 'Сломано: дробное количество принимается', code: qtyGood.replace('Number.isInteger(qty) && ', '') },
      { name: 'Сломано: при сумме ровно 3000 ₽ доставка платная', code: qtyGood.replace('subtotal >= 3000', 'subtotal > 3000') },
    ],
  },
  {
    id: 'm2-promo-negative',
    lesson: 'qa-negative',
    kind: 'ts-test',
    title: 'Негативные проверки промокода',
    goal: 'Функция `applyPromo(total, code)` из модуля `app`: `null` или пустая строка — сумма не меняется; `SPRING` — скидка 10 % (вниз до рубля) при сумме от 1000 ₽ включительно, при меньшей — ошибка; любой другой код — ошибка. Стартовые тесты только позитивные. Допишите проверки так, чтобы они проходили на исправной версии и ловили все четыре сломанные.',
    starter: `import { applyPromo } from './app';

test('SPRING даёт скидку 10 %', () => expectEq(applyPromo(2000, 'SPRING'), 1800));
test('без промокода сумма не меняется', () => expectEq(applyPromo(2000, null), 2000));

// TODO: проверьте отказы: неизвестный код, сумма меньше 1000 ₽.
// Не забудьте граничный случай и пустое поле промокода.
`,
    solution: `import { applyPromo } from './app';

test('SPRING даёт скидку 10 %', () => expectEq(applyPromo(2000, 'SPRING'), 1800));
test('без промокода сумма не меняется', () => expectEq(applyPromo(2000, null), 2000));
test('пустое поле — как без промокода', () => expectEq(applyPromo(2000, ''), 2000));
test('ровно 1000 ₽ — SPRING действует', () => expectEq(applyPromo(1000, 'SPRING'), 900));

test('неизвестный код — ошибка', async () => {
  await expectThrows(() => applyPromo(2000, 'FREE100'), 'код FREE100 должен отклоняться');
});
test('999 ₽ со SPRING — ошибка', async () => {
  await expectThrows(() => applyPromo(999, 'SPRING'), 'SPRING не должен действовать на 999 ₽');
});
`,
    explanation: 'Позитивные проверки отвечают на вопрос «работает ли правильное», негативные — «отказывает ли система, когда должна». Сломанная версия, которая молча игнорирует неизвестный код или даёт скидку на 500 ₽, проходит все позитивные тесты. `expectThrows` падает, если ошибки не было. Две проверки защищают от «перестраховки»: пустое поле и ровно 1000 ₽ должны работать, а не отклоняться — негативные правила не должны ломать позитивные случаи.',
    hints: [
      'Для каждого правила «иначе — ошибка» нужен тест, который ожидает ошибку. И проверьте, что отказ не задевает допустимые значения рядом.',
      'Ошибку проверяют так: `await expectThrows(() => вызов, \'сообщение\')` внутри `async`-теста. Значения для проверки: неизвестный код, 999 ₽ со SPRING, ровно 1000 ₽ со SPRING, пустая строка.',
      '`test(\'неизвестный код — ошибка\', async () => { await expectThrows(() => applyPromo(2000, \'FREE100\'), \'код должен отклоняться\'); });`',
    ],
    mistakes: [
      'Вызвать `applyPromo(999, \'SPRING\')` без `expectThrows`: тест упадёт и на исправной версии — ошибка там и ожидается.',
      'Забыть `await` перед `expectThrows`: проверка не дождётся результата, и тест пройдёт при любом поведении.',
    ],
    good: promoGood,
    broken: [
      { name: 'Сломано: неизвестный код молча игнорируется', code: promoGood.replace("if (code !== 'SPRING') throw new Error('Неизвестный промокод');", "if (code !== 'SPRING') return total;") },
      { name: 'Сломано: SPRING действует на любую сумму', code: promoGood.replace("  if (total < 1000) throw new Error('SPRING действует от 1000 ₽');\n", '') },
      { name: 'Сломано: ровно 1000 ₽ — отказ', code: promoGood.replace('total < 1000', 'total <= 1000') },
      { name: 'Сломано: пустое поле промокода вызывает ошибку', code: promoGood.replace("code === null || code === ''", 'code === null') },
    ],
  },
  {
    id: 'm2-test-level',
    lesson: 'qa-risk',
    kind: 'ts',
    title: 'Где проверять правило: unit, API или UI',
    goal: 'Для каждого правила магазина выберите самый дешёвый уровень, на котором его можно надёжно проверить: `\'unit\'` (функция в коде), `\'api\'` (HTTP-запрос к серверу) или `\'ui\'` (браузер). Стартовый вариант «всё через UI» — типичная ошибка.',
    starter: `export type Level = 'unit' | 'api' | 'ui';

export const levels: Record<
  'promoRounding' | 'freeShippingBoundary' | 'ordersNeedLogin' | 'priceIsNumber' | 'addButtonUpdatesCounter' | 'checkoutJourney',
  Level
> = {
  promoRounding: 'ui',           // функция applyPromo: SPRING −10 %, округление вниз до рубля
  freeShippingBoundary: 'ui',    // функция shippingCost: 2999 ₽ → 299 ₽, 3000 ₽ → 0 ₽
  ordersNeedLogin: 'ui',         // POST /api/orders без входа отвечает 401
  priceIsNumber: 'ui',           // в ответе GET /api/products поле price — число
  addButtonUpdatesCounter: 'ui', // кнопка «В корзину» меняет счётчик в шапке страницы
  checkoutJourney: 'ui',         // покупатель входит, кладёт товар, оформляет заказ и видит его номер
};
`,
    solution: `export type Level = 'unit' | 'api' | 'ui';

export const levels: Record<
  'promoRounding' | 'freeShippingBoundary' | 'ordersNeedLogin' | 'priceIsNumber' | 'addButtonUpdatesCounter' | 'checkoutJourney',
  Level
> = {
  promoRounding: 'unit',         // функция applyPromo: SPRING −10 %, округление вниз до рубля
  freeShippingBoundary: 'unit',  // функция shippingCost: 2999 ₽ → 299 ₽, 3000 ₽ → 0 ₽
  ordersNeedLogin: 'api',        // POST /api/orders без входа отвечает 401
  priceIsNumber: 'api',          // в ответе GET /api/products поле price — число
  addButtonUpdatesCounter: 'ui', // кнопка «В корзину» меняет счётчик в шапке страницы
  checkoutJourney: 'ui',         // покупатель входит, кладёт товар, оформляет заказ и видит его номер
};
`,
    explanation: 'Правило проверяют там, где оно живёт, и на самом дешёвом уровне, который его видит. Расчёт скидки и порог доставки — чистые функции: unit-тест выполняется за миллисекунды и легко перебирает много значений. Код 401 и тип поля в JSON — контракт сервера, их видно в HTTP-ответе без браузера. Счётчик в шапке существует только на странице, а путь покупателя целиком — это и есть то, что проверяет UI-тест. Через UI можно проверить всё, но это дороже и медленнее, а падение хуже локализует причину.',
    hints: [
      'Спросите про каждое правило: где оно реализовано — в функции, в ответе сервера или на странице?',
      'Если правило — вычисление внутри одной функции, хватит unit. Если речь о коде ответа или поле JSON — api. Если о том, что видит пользователь на странице, — ui.',
      'Два правила — `unit`, два — `api`, два — `ui`. Например, `ordersNeedLogin: \'api\'`.',
    ],
    mistakes: [
      'Всё через UI: тесты медленные, нестабильные, и при падении непонятно, где ошибка.',
      'Проверять счётчик в шапке unit-тестом: функция может считать правильно, а страница — не обновляться.',
    ],
    check: `import { levels } from './student';
test('округление скидки', () => expectEq(levels.promoRounding, 'unit', 'расчёт внутри одной функции — unit-тест быстрее и точнее'));
test('граница бесплатной доставки', () => expectEq(levels.freeShippingBoundary, 'unit', 'граничные значения удобно перебирать unit-тестом'));
test('заказ без входа — 401', () => expectEq(levels.ordersNeedLogin, 'api', 'код ответа виден в HTTP-ответе, браузер не нужен'));
test('price в JSON — число', () => expectEq(levels.priceIsNumber, 'api', 'формат ответа сервера проверяют на уровне API'));
test('счётчик в шапке', () => expectEq(levels.addButtonUpdatesCounter, 'ui', 'счётчик существует только на странице'));
test('путь покупателя целиком', () => expectEq(levels.checkoutJourney, 'ui', 'сквозной сценарий пользователя проверяют в браузере'));
`,
  },
];
export default ex;
