/* ===== sims/07-api.js ===== */
/* ===== Раздел V: валидатор JSON Schema, совместимость изменений API, жизненный цикл тестовых данных ===== */
(function (root) {
  'use strict';
  /* ---------- Учебный валидатор JSON Schema (подмножество draft 2020-12 / draft-07) ----------
     Ключевые слова: type, enum, const, properties, required, additionalProperties, items (схема), minItems, maxItems,
     uniqueItems, minimum, maximum, exclusiveMinimum, exclusiveMaximum, minLength, maxLength, pattern, format
     (date-time, date, email, uuid, uri), $ref (#/$defs/…, #/definitions/…), allOf, anyOf, oneOf, not.
     Сообщения — в стиле Ajv 8: instancePath + message. Сверено с Ajv тестом tests/check_schema.mjs. */
  const FORMATS = {
    'date-time': /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:?\d{2})$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
    uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
    uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
  };
  function validDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return false;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return mo >= 1 && mo <= 12 && d >= 1 && d <= dim[mo - 1];
  }
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
    return typeof v;
  }
  const matchesType = (v, t) => { const a = typeOf(v); return t === a || (t === 'number' && a === 'integer'); };
  const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
  function equal(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }
  function canon(v) { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = canon(v[k]); }); return o; } return v; }

  function validate(schema, data, opts = {}) {
    const errors = [];
    const rootSchema = schema;
    const allErrors = opts.allErrors !== false;
    function resolveRef(ref) {
      const m = /^#\/(\$defs|definitions)\/(.+)$/.exec(ref);
      if (!m || !rootSchema[m[1]] || !rootSchema[m[1]][m[2]]) throw new Error(`can't resolve reference ${ref}`);
      return rootSchema[m[1]][m[2]];
    }
    function v(s, d, path, sp, out) {
      if (s === true || s === undefined) return true;
      if (s === false) { out.push({ instancePath: path, schemaPath: sp, keyword: 'false schema', params: {}, message: 'boolean schema is false' }); return false; }
      const start = out.length;
      const add = (keyword, params, message, extraPath) => { out.push({ instancePath: extraPath !== undefined ? extraPath : path, schemaPath: sp + '/' + keyword, keyword, params, message }); };
      const stop = () => !allErrors && out.length > start;
      if (s.$ref) { if (!v(resolveRef(s.$ref), d, path, s.$ref, out) && stop()) return false; }
      if (s.type !== undefined) {
        const ts = Array.isArray(s.type) ? s.type : [s.type];
        if (!ts.some((t) => matchesType(d, t))) { add('type', { type: ts.join(',') }, 'must be ' + ts.join(',')); return false; }
      }
      if (s.enum && !s.enum.some((e) => equal(e, d))) { add('enum', { allowedValues: s.enum }, 'must be equal to one of the allowed values'); if (stop()) return false; }
      if (s.const !== undefined && !equal(s.const, d)) { add('const', { allowedValue: s.const }, 'must be equal to constant'); if (stop()) return false; }
      const t = typeOf(d);
      if (t === 'integer' || t === 'number') {
        if (s.maximum !== undefined && !(d <= s.maximum)) { add('maximum', { comparison: '<=', limit: s.maximum }, 'must be <= ' + s.maximum); if (stop()) return false; }
        if (s.minimum !== undefined && !(d >= s.minimum)) { add('minimum', { comparison: '>=', limit: s.minimum }, 'must be >= ' + s.minimum); if (stop()) return false; }
        if (s.exclusiveMaximum !== undefined && !(d < s.exclusiveMaximum)) { add('exclusiveMaximum', { comparison: '<', limit: s.exclusiveMaximum }, 'must be < ' + s.exclusiveMaximum); if (stop()) return false; }
        if (s.exclusiveMinimum !== undefined && !(d > s.exclusiveMinimum)) { add('exclusiveMinimum', { comparison: '>', limit: s.exclusiveMinimum }, 'must be > ' + s.exclusiveMinimum); if (stop()) return false; }
      }
      if (t === 'string') {
        const len = [...d].length;
        if (s.maxLength !== undefined && len > s.maxLength) { add('maxLength', { limit: s.maxLength }, `must NOT have more than ${s.maxLength} characters`); if (stop()) return false; }
        if (s.minLength !== undefined && len < s.minLength) { add('minLength', { limit: s.minLength }, `must NOT have fewer than ${s.minLength} characters`); if (stop()) return false; }
        if (s.pattern !== undefined && !new RegExp(s.pattern, 'u').test(d)) { add('pattern', { pattern: s.pattern }, `must match pattern "${s.pattern}"`); if (stop()) return false; }
        if (s.format && FORMATS[s.format] && (!FORMATS[s.format].test(d) || ((s.format === 'date' || s.format === 'date-time') && !validDate(d)))) { add('format', { format: s.format }, `must match format "${s.format}"`); if (stop()) return false; }
      }
      if (t === 'array') {
        if (s.maxItems !== undefined && d.length > s.maxItems) { add('maxItems', { limit: s.maxItems }, `must NOT have more than ${s.maxItems} items`); if (stop()) return false; }
        if (s.minItems !== undefined && d.length < s.minItems) { add('minItems', { limit: s.minItems }, `must NOT have fewer than ${s.minItems} items`); if (stop()) return false; }
        if (s.items && typeof s.items === 'object' && !Array.isArray(s.items)) {
          for (let i = 0; i < d.length; i++) { if (!v(s.items, d[i], path + '/' + i, sp + '/items', out) && stop()) return false; }
        }
        if (s.uniqueItems) {
          outer: for (let i = d.length - 1; i > 0; i--) for (let j = i - 1; j >= 0; j--) if (equal(d[i], d[j])) { add('uniqueItems', { i, j }, `must NOT have duplicate items (items ## ${j} and ${i} are identical)`); break outer; }
          if (stop()) return false;
        }
      }
      if (t === 'object') {
        if (s.required) for (const k of s.required) if (!Object.prototype.hasOwnProperty.call(d, k)) { add('required', { missingProperty: k }, `must have required property '${k}'`); if (stop()) return false; }
        const props = s.properties || {};
        if (s.additionalProperties === false) for (const k of Object.keys(d)) if (!Object.prototype.hasOwnProperty.call(props, k)) { add('additionalProperties', { additionalProperty: k }, 'must NOT have additional properties'); if (stop()) return false; }
        for (const k of Object.keys(props)) if (Object.prototype.hasOwnProperty.call(d, k)) { if (!v(props[k], d[k], path + '/' + esc(k), sp + '/properties/' + esc(k), out) && stop()) return false; }
        if (s.additionalProperties && typeof s.additionalProperties === 'object') for (const k of Object.keys(d)) if (!Object.prototype.hasOwnProperty.call(props, k)) { if (!v(s.additionalProperties, d[k], path + '/' + esc(k), sp + '/additionalProperties', out) && stop()) return false; }
      }
      if (s.allOf) s.allOf.forEach((sub, i) => { v(sub, d, path, sp + '/allOf/' + i, out); });
      if (s.anyOf) {
        const tmp = []; const ok = s.anyOf.some((sub, i) => { const e = []; const r = v(sub, d, path, sp + '/anyOf/' + i, e); tmp.push(...e); return r; });
        if (!ok) { out.push(...tmp); add('anyOf', {}, 'must match a schema in anyOf'); }
      }
      if (s.oneOf) {
        const tmp = []; const passing = [];
        s.oneOf.forEach((sub, i) => { const e = []; if (v(sub, d, path, sp + '/oneOf/' + i, e)) passing.push(i); else tmp.push(...e); });
        if (passing.length === 0) { out.push(...tmp); add('oneOf', { passingSchemas: null }, 'must match exactly one schema in oneOf'); }
        else if (passing.length > 1) add('oneOf', { passingSchemas: passing }, 'must match exactly one schema in oneOf');
      }
      if (s.not !== undefined) { const e = []; if (v(s.not, d, path, sp + '/not', e)) add('not', {}, 'must NOT be valid'); }
      return out.length === start;
    }
    const valid = v(schema, data, '', '#', errors);
    return { valid, errors };
  }
  root.MiniSchema = { validate, FORMATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MiniSchema;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof Sim === 'undefined') return;
  const { el } = U;

  /* ---------- Валидатор схемы ---------- */
  const ORDER_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['id', 'status', 'items', 'total'],
    additionalProperties: false,
    properties: {
      id: { type: 'integer', minimum: 1 },
      status: { enum: ['created', 'paid', 'shipped', 'delivered', 'cancelled'] },
      total: { type: 'integer', minimum: 0 },
      promoCode: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productId', 'qty'],
          properties: {
            productId: { type: 'integer' },
            qty: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  };
  const BASE = { id: 101, status: 'paid', items: [{ productId: 1, qty: 2 }], total: 9980, promoCode: null, createdAt: '2025-09-12T12:30:00Z' };
  const mut = (f) => { const o = JSON.parse(JSON.stringify(BASE)); f(o); return o; };
  const CASES = [
    ['Корректный ответ', BASE, 'Все правила выполнены. promoCode: null допустим — тип ["string", "null"].'],
    ['Нет обязательного поля', mut((o) => { delete o.total; }), 'Провайдер перестал отдавать поле — потребители, которые читают total, сломаются.'],
    ['Число пришло строкой', mut((o) => { o.total = '9980'; }), 'Частое изменение при смене сериализации (например, decimal → string). JavaScript-клиент сложит строки вместо чисел.'],
    ['Новый статус', mut((o) => { o.status = 'refunded'; }), 'В enum нет нового значения. Если статус добавлен намеренно — обновите схему и предупредите потребителей.'],
    ['Лишнее поле', mut((o) => { o.deliveryDate = '2025-09-15'; }), 'additionalProperties: false запрещает неописанные поля. Это ловит недокументированные изменения, но делает схему строгой к добавлению полей.'],
    ['Переименование поля', mut((o) => { o.amount = o.total; delete o.total; }), 'Две ошибки одного изменения: поле total пропало, появилось неизвестное amount.'],
    ['Количество 0', mut((o) => { o.items[0].qty = 0; }), 'Путь /items/0/qty указывает точное место нарушения во вложенном массиве.'],
    ['Пустой список позиций', mut((o) => { o.items = []; }), 'Заказ без позиций нарушает minItems: 1.'],
    ['Неверный формат даты', mut((o) => { o.createdAt = '12.09.2025 12:30'; }), 'format проверяется, только если валидатор настроен проверять форматы (в Ajv 8 — пакет ajv-formats).'],
    ['Несколько ошибок сразу', mut((o) => { o.id = 0; o.status = 'PAID'; o.items[0].productId = '1'; }), 'С allErrors: true валидатор собирает все ошибки — отчёт сразу показывает масштаб изменений.'],
  ];
  Sim.register('schema-validator', (root) => {
    let allErrors = true;
    const sh = UI.shell(root, {
      title: 'Валидатор схемы ответа', icon: 'shield', kicker: 'Тренажёр', layout: 'two',
      help: 'Слева — схема заказа из главы. Справа — ответ API: выберите вариант или отредактируйте JSON. Ошибки выводятся в формате Ajv: путь к полю и нарушенное правило.',
      onReset: () => { allErrors = true; aeTgl.set(true, true); caseSel.set(0, true); ta.value = JSON.stringify(BASE, null, 2); run(); },
      note: 'Учебный валидатор поддерживает основные ключевые слова JSON Schema (type, enum, const, required, properties, additionalProperties, items, min/max, pattern, format, $ref, allOf/anyOf/oneOf/not) и формирует сообщения как Ajv 8; результат сверен с Ajv. Схему в этом тренажёре не редактируют.',
    });
    const left = sh.col(), right = sh.col();
    left.appendChild(el('div', { class: 'card-sub', text: 'order.schema.json' }));
    left.appendChild(el('pre', { class: 'out-box sv-schema', html: U.hl(JSON.stringify(ORDER_SCHEMA, null, 2), 'json') }));
    const caseSel = UI.select(right, { label: 'Вариант ответа', value: 0, options: CASES.map((c, i) => ({ value: i, label: c[0] })), onChange: (v) => { ta.value = JSON.stringify(CASES[+v][1], null, 2); run(); } });
    const aeTgl = UI.toggle(right, { label: 'allErrors: true (собрать все ошибки)', value: true, onChange: (v) => { allErrors = v; run(); } });
    const ta = el('textarea', { class: 'inp mono sv-json', rows: 14, spellcheck: 'false', 'aria-label': 'JSON ответа' });
    ta.value = JSON.stringify(BASE, null, 2);
    right.appendChild(ta);
    const out = el('div', { class: 'sv-out', 'aria-live': 'polite' });
    right.appendChild(out);
    ta.addEventListener('input', U.debounce(() => run(true), 300));
    function run(edited) {
      U.clear(out);
      let data;
      try { data = JSON.parse(ta.value); } catch (e) {
        out.appendChild(el('div', { class: 'badge bad', text: 'Некорректный JSON' }));
        out.appendChild(el('pre', { class: 'out-box sql-err', text: e.message }));
        sh.say('<p>Это не JSON: тело не удастся даже разобрать. В тесте упадёт <code>await res.json()</code> раньше проверки схемы.</p>');
        return;
      }
      const r = MiniSchema.validate(ORDER_SCHEMA, data, { allErrors });
      out.appendChild(el('div', { class: 'badge ' + (r.valid ? 'good' : 'bad'), text: r.valid ? 'valid: true' : `valid: false · ошибок: ${r.errors.length}` }));
      if (!r.valid) out.appendChild(el('pre', { class: 'out-box sql-err', text: r.errors.map((e) => `${e.instancePath || '(корень)'} ${e.message}` + (e.keyword === 'additionalProperties' ? ` ('${e.params.additionalProperty}')` : e.keyword === 'enum' ? ` (${e.params.allowedValues.join(', ')})` : '')).join('\n') }));
      const c = CASES[+caseSel.get()];
      const same = !edited && JSON.stringify(JSON.parse(ta.value)) === JSON.stringify(c[1]);
      sh.say(`<p>${same ? c[2] : r.valid ? 'Ответ соответствует схеме.' : 'Каждая строка — путь к полю (JSON Pointer) и нарушенное правило. По ним видно, что именно изменилось в API.'}${!allErrors && !r.valid ? ' Сейчас валидатор останавливается на первой ошибке — остальные проблемы обнаружатся только после исправления первой.' : ''}</p>`);
    }
    run();
  });

  /* ---------- Совместимость изменений API ---------- */
  const CONSUMERS = [
    { id: 'web', name: 'Веб-фронтенд', uses: 'id, status, total; GET /orders без параметров' },
    { id: 'mobile', name: 'Мобильное приложение', uses: 'id, status, total, promoCode; строгий разбор статуса' },
    { id: 'delivery', name: 'Сервис доставки', uses: 'id, items[].productId, items[].qty' },
    { id: 'analytics', name: 'Аналитика', uses: 'status, createdAt' },
  ];
  const CHANGES = {
    add: { label: 'Добавить необязательное поле deliveryDate', breaks: [], schema: { r: 'warn', t: 'Падает, если схема провайдера с additionalProperties: false не обновлена вместе с кодом, — и это полезно: изменение не прошло незамеченным.' }, cdc: { r: 'ok', t: 'Проходит: контракты описывают только поля, которые читают потребители, лишние поля им не мешают.' }, note: 'Совместимое изменение. Риск только у клиентов, которые сами строго запрещают неизвестные поля.' },
    rename: { label: 'Переименовать total → amount', breaks: ['web', 'mobile'], schema: { r: 'miss', t: 'Не ловит: команда провайдера обновила схему вместе с кодом, с её точки зрения всё корректно.' }, cdc: { r: 'catch', t: 'Ловит: проверка провайдера по контрактам веб-фронтенда и мобильного приложения падает — им нужно поле total.' }, note: 'Ломающее изменение. Безопасный путь: добавить amount, пометить total как deprecated, дождаться перехода потребителей, затем удалить.' },
    type: { label: 'Сменить тип id: integer → string (UUID)', breaks: ['web', 'mobile', 'delivery'], schema: { r: 'miss', t: 'Не ловит, если схема обновлена. Ловит только как «тест провайдера упал», когда схему забыли обновить.' }, cdc: { r: 'catch', t: 'Ловит: в контрактах трёх потребителей id сопоставляется по типу integer.' }, note: 'Ломающее изменение типа. Обычно выпускается как новая версия API (/v2).' },
    remove: { label: 'Удалить поле promoCode', breaks: ['mobile'], schema: { r: 'miss', t: 'Не ловит: схема обновлена, поля в ней больше нет.' }, cdc: { r: 'catch', t: 'Ловит только для мобильного приложения и показывает, что остальным потребителям поле не нужно — удаление безопасно после доработки одного клиента.' }, note: 'Контракты дают карту реального использования полей.' },
    enum: { label: 'Добавить статус refunded', breaks: ['mobile'], schema: { r: 'miss', t: 'Не ловит: enum в схеме расширили.' }, cdc: { r: 'miss', t: 'Обычно не ловит: контракт проверяет примеры взаимодействий (заказ в статусе paid), а не все возможные значения.' }, note: 'Опасное изменение для клиентов со строгим разбором значений. Нужны договорённость «неизвестный статус обрабатывается как прочий» и тест клиента на неизвестное значение.' },
    required: { label: 'Сделать параметр status обязательным в GET /orders', breaks: ['web'], schema: { r: 'miss', t: 'Схема ответа не описывает правила запроса; проверка ответов ничего не заметит.' }, cdc: { r: 'catch', t: 'Ловит: контракт веб-фронтенда содержит запрос без параметра, провайдер отвечает 400 вместо ожидаемых 200.' }, note: 'Изменение требований к запросу ломает клиентов, даже если ответ не изменился.' },
    meaning: { label: 'total теперь в рублях, а не в копейках', breaks: ['web', 'mobile'], schema: { r: 'miss', t: 'Не ловит: имя и тип поля те же.' }, cdc: { r: 'miss', t: 'Обычно не ловит: сопоставление по типу (like) пропускает любое целое число.' }, note: 'Изменение смысла не видно ни схеме, ни контракту. Его ловят только проверки бизнес-значений (API-тест: сумма = Σ qty × price) и E2E.' },
  };
  Sim.register('contract-compat', (root) => {
    let ch = 'rename';
    const sh = UI.shell(root, {
      title: 'Кто сломается от изменения API', icon: 'link', kicker: 'Модель', layout: 'one',
      help: 'Провайдер — сервис «Заказы». У него четыре потребителя. Выберите изменение и сравните, что увидят проверка схемы провайдера и контрактные тесты.',
      onReset: () => { ch = 'rename'; sel.set('rename', true); update(); },
    });
    const col = sh.col();
    const sel = UI.select(col, { label: 'Изменение у провайдера', value: ch, options: Object.entries(CHANGES).map(([k, c]) => ({ value: k, label: c.label })), onChange: (v) => { ch = v; update(); } });
    const grid = el('div', { class: 'cc-grid' });
    const checks = el('div', { class: 'cc-checks' });
    col.append(grid, checks);
    function update() {
      const c = CHANGES[ch];
      U.clear(grid);
      CONSUMERS.forEach((k) => {
        const br = c.breaks.includes(k.id);
        grid.appendChild(el('div', { class: 'flow-node ' + (br ? 'is-bad' : 'is-good') }, [el('b', { text: k.name }), el('span', { class: 'sub', text: 'использует: ' + k.uses }), el('span', { class: 'sub ' + (br ? 'bad-t' : 'ok-t'), text: br ? 'сломается' : 'не затронут' })]));
      });
      U.clear(checks);
      const mark = { ok: ['good', 'проходит'], warn: ['warn', 'падает'], catch: ['good', 'ловит'], miss: ['bad', 'не ловит'] };
      [['Проверка схемы у провайдера', c.schema], ['Контрактные тесты (CDC)', c.cdc]].forEach(([n, x]) => {
        checks.appendChild(el('div', { class: 'cc-check' }, [el('div', { class: 'cc-h' }, [el('b', { text: n }), el('span', { class: 'badge ' + mark[x.r][0], text: mark[x.r][1] })]), el('p', { text: x.t })]));
      });
      sh.say(`<p>${c.breaks.length ? `Сломаются: ${c.breaks.map((b) => CONSUMERS.find((k) => k.id === b).name).join(', ')}.` : 'Никто из потребителей не сломается.'} ${c.note}</p>`);
    }
    update();
  });

  /* ---------- Жизненный цикл тестовых данных ---------- */
  const STRAT = {
    none: { label: 'Без очистки', color: 'var(--bad)' },
    end: { label: 'Удаление в конце теста', color: 'var(--warn)' },
    teardown: { label: 'afterEach / teardown фикстуры', color: 'var(--blue)' },
    sweep: { label: 'Teardown + уборка по метке перед прогоном', color: 'var(--good)' },
  };
  Sim.register('entity-lifecycle', (root) => {
    const D = { runs: 30, tests: 40, fail: 5, abort: 5, sel: 'teardown', seed: 3 };
    const s = Object.assign({}, D);
    const ENT = 2; // пользователь и заказ на тест
    const sh = UI.shell(root, {
      title: 'Сколько мусора остаётся на стенде', icon: 'database', kicker: 'Модель', layout: 'side-left',
      help: 'Каждый тест создаёт пользователя и заказ. Часть тестов падает, часть прогонов прерывается (отменили CI-задачу, упал агент). Сравните накопление «мусора» при разных стратегиях очистки.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Модель: при падении теста код после места падения не выполняется, а afterEach и teardown фикстур выполняются; при прерванном прогоне не выполняется ничего, и данные тестов, шедших в этот момент (4 воркера), остаются. Уборка по метке удаляет сущности с префиксом autotest- от прошлых прогонов.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const chart = el('div', { class: 'el-chart' });
    main.appendChild(chart);
    const roBox = el('div');
    main.appendChild(roBox);
    function build() {
      U.clear(box);
      UI.select(box, { label: 'Стратегия (выделена на графике)', value: s.sel, options: Object.entries(STRAT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => { s.sel = v; update(); } });
      UI.slider(box, { label: 'Прогонов набора', min: 1, max: 60, value: s.runs, onInput: (v) => { s.runs = v; update(); } });
      UI.slider(box, { label: 'Тестов в наборе', min: 5, max: 200, step: 5, value: s.tests, onInput: (v) => { s.tests = v; update(); } });
      UI.slider(box, { label: 'Доля падающих тестов', min: 0, max: 50, value: s.fail, fmt: (v) => v + '%', onInput: (v) => { s.fail = v; update(); } });
      UI.slider(box, { label: 'Доля прерванных прогонов', min: 0, max: 30, value: s.abort, fmt: (v) => v + '%', onInput: (v) => { s.abort = v; update(); } });
      UI.button(box, { label: 'Другая случайная выборка', icon: 'repeat', onClick: () => { s.seed++; update(); } });
      update();
    }
    function simulate() {
      const rnd = U.rng(s.seed);
      const series = { none: [0], end: [0], teardown: [0], sweep: [0] };
      const acc = { none: 0, end: 0, teardown: 0, sweep: 0 };
      for (let r = 0; r < s.runs; r++) {
        const aborted = rnd() < s.abort / 100;
        const executed = aborted ? Math.floor(rnd() * s.tests) : s.tests; // сколько тестов успело завершиться
        let failed = 0;
        for (let i = 0; i < executed; i++) if (rnd() < s.fail / 100) failed++;
        const inflight = aborted ? Math.min(4, s.tests - executed) : 0;
        acc.none += (executed + inflight) * ENT;
        acc.end += failed * ENT + inflight * ENT;
        acc.teardown += inflight * ENT;
        acc.sweep = inflight * ENT; // перед следующим прогоном уборка удаляет всё старое
        Object.keys(acc).forEach((k) => series[k].push(acc[k]));
      }
      return series;
    }
    function update() {
      const ser = simulate();
      const W = 560, H = 230, l = 48, b = 28, t = 10, r = 10;
      // «Без очистки» растёт на порядки быстрее — масштаб по остальным стратегиям, если она не выбрана
      const scaleKeys = s.sel === 'none' ? Object.keys(ser) : Object.keys(ser).filter((k) => k !== 'none');
      const maxY = Math.max(4, ...scaleKeys.map((k) => Math.max(...ser[k]))) * (s.sel === 'none' ? 1 : 1.15);
      const x = (i) => l + (i / Math.max(1, s.runs)) * (W - l - r);
      const y = (v) => H - b - (v / maxY) * (H - t - b);
      const svg = U.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Накопление тестовых данных по прогонам' });
      for (let k = 0; k <= 4; k++) { const v = (maxY * k) / 4; svg.appendChild(U.svg('line', { x1: l, x2: W - r, y1: y(v), y2: y(v), stroke: 'var(--border)' })); svg.appendChild(U.svg('text', { x: l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'p-muted', text: U.fmt(v) })); }
      svg.appendChild(U.svg('text', { x: W - r, y: H - 6, 'text-anchor': 'end', class: 'p-muted', text: `прогоны 0…${s.runs}` }));
      const clipId = U.uid('elc');
      svg.appendChild(U.svg('clipPath', { id: clipId }, U.svg('rect', { x: l, y: t - 4, width: W - l - r, height: H - b - t + 4 })));
      if (s.sel !== 'none') svg.appendChild(U.svg('text', { x: l + 6, y: t + 10, class: 'p-muted', text: `«Без очистки» за пределами шкалы: до ${U.fmt(Math.max(...ser.none))}` }));
      Object.entries(ser).forEach(([k, a]) => {
        const d = a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        svg.appendChild(U.svg('path', { d, fill: 'none', stroke: STRAT[k].color, 'stroke-width': k === s.sel ? 3.5 : 1.5, opacity: k === s.sel ? 1 : 0.55, 'clip-path': `url(#${clipId})` }));
      });
      U.clear(chart); chart.appendChild(svg);
      chart.appendChild(UI.legend(Object.entries(STRAT).map(([k, v]) => ({ color: v.color, label: (k === s.sel ? '<b>' : '') + v.label + (k === s.sel ? '</b>' : '') }))));
      U.clear(roBox);
      const ro = UI.readout(roBox, Object.entries(STRAT).map(([k, v]) => ({ key: k, label: v.label })));
      Object.keys(STRAT).forEach((k) => ro.set(k, `${U.fmt(ser[k][ser[k].length - 1])} сущн.`, k === s.sel ? 'acc-t' : ''));
      const last = (k) => ser[k][ser[k].length - 1];
      const msg = {
        none: `Без очистки стенд растёт на ${s.tests * ENT} сущностей за прогон: поиск и списки замедляются, тесты начинают находить «чужие» данные.`,
        end: `Удаление последней строкой теста не выполняется, когда тест упал раньше: остаётся ${U.fmt(last('end'))} сущностей. Мусор копится именно тогда, когда что-то сломалось.`,
        teardown: `afterEach и teardown фикстуры выполняются и при падении теста. Остаются только данные прерванных прогонов (${U.fmt(last('teardown'))}): их не убрать изнутри теста.`,
        sweep: `Уборка по уникальной метке в начале прогона (global setup или отдельная задача) удаляет остатки прерванных прогонов. Мусор ограничен одним прогоном: сейчас ${U.fmt(last('sweep'))}.`,
      };
      sh.say(`<p>${msg[s.sel]}</p>`);
    }
    build();
  });
})();

;
