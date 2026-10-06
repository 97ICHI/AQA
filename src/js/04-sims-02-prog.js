/* ===== sims/02-prog.js ===== */
/* ===== Раздел II: Event Loop и пошаговый отладчик ===== */
(function () {
  'use strict';
  const { el } = U;

  /* Сценарии Event Loop. Каждый шаг описывает состояние после шага.
     Код каждого сценария проверяется в Node.js тестом tests/check_eventloop.mjs:
     последовательность console последнего шага должна совпасть с реальным выводом. */
  const SNIPPETS = [
    {
      id: 'order', title: 'Promise против setTimeout',
      code: [
        "console.log('1: start');",
        "setTimeout(() => console.log('5: timeout'), 0);",
        "Promise.resolve().then(() => console.log('3: then'));",
        "queueMicrotask(() => console.log('4: microtask'));",
        "console.log('2: end');",
      ],
      steps: [
        { line: 0, stack: ['script'], log: ['1: start'], note: 'Синхронный код выполняется сразу: console.log выводит «1: start».' },
        { line: 1, stack: ['script', 'setTimeout'], web: ['таймер 0 мс → колбэк A'], log: ['1: start'], note: 'setTimeout передаёт таймер среде выполнения (Web API / Node). Сам колбэк пока не выполняется.' },
        { line: 1, stack: ['script'], macro: ['A: log «5: timeout»'], log: ['1: start'], note: 'Таймер на 0 мс истёк — колбэк A встал в очередь задач (macrotask). Он выполнится, только когда стек опустеет.' },
        { line: 2, stack: ['script'], micro: ['B: log «3: then»'], macro: ['A: log «5: timeout»'], log: ['1: start'], note: 'Promise уже выполнен, поэтому колбэк then сразу попадает в очередь микрозадач.' },
        { line: 3, stack: ['script'], micro: ['B: log «3: then»', 'C: log «4: microtask»'], macro: ['A: log «5: timeout»'], log: ['1: start'], note: 'queueMicrotask явно добавляет микрозадачу C.' },
        { line: 4, stack: ['script'], micro: ['B: log «3: then»', 'C: log «4: microtask»'], macro: ['A: log «5: timeout»'], log: ['1: start', '2: end'], note: 'Последняя синхронная строка: «2: end».' },
        { line: -1, stack: [], micro: ['B: log «3: then»', 'C: log «4: microtask»'], macro: ['A: log «5: timeout»'], log: ['1: start', '2: end'], note: 'Скрипт закончился, стек пуст. Event Loop сначала выполняет ВСЕ микрозадачи.' },
        { line: 2, stack: ['B'], micro: ['C: log «4: microtask»'], macro: ['A: log «5: timeout»'], log: ['1: start', '2: end', '3: then'], note: 'Микрозадача B: «3: then».' },
        { line: 3, stack: ['C'], macro: ['A: log «5: timeout»'], log: ['1: start', '2: end', '3: then', '4: microtask'], note: 'Микрозадача C: «4: microtask». Очередь микрозадач пуста.' },
        { line: 1, stack: ['A'], log: ['1: start', '2: end', '3: then', '4: microtask', '5: timeout'], note: 'Только теперь Event Loop берёт задачу A из очереди задач: «5: timeout».' },
      ],
    },
    {
      id: 'await', title: 'async/await и таймер',
      code: [
        'const fetchData = () => new Promise((r) => setTimeout(r, 100));',
        'async function load() {',
        "  console.log('2: load start');",
        '  await fetchData();',
        "  console.log('5: after await');",
        '}',
        "console.log('1: before');",
        'load();',
        "console.log('3: after load()');",
        "setTimeout(() => console.log('4: timer 0 ms'), 0);",
      ],
      steps: [
        { line: 6, stack: ['script'], log: ['1: before'], note: 'Синхронный код: «1: before».' },
        { line: 7, stack: ['script', 'load'], log: ['1: before'], note: 'Вызов load(): функция начинает выполняться синхронно.' },
        { line: 2, stack: ['script', 'load'], log: ['1: before', '2: load start'], note: 'До первого await тело async-функции выполняется как обычный код: «2: load start».' },
        { line: 3, stack: ['script', 'load', 'fetchData'], web: ['таймер 100 мс → resolve'], log: ['1: before', '2: load start'], note: 'fetchData запускает таймер на 100 мс и возвращает Promise в состоянии pending.' },
        { line: 3, stack: ['script'], web: ['таймер 100 мс → resolve'], wait: ['load: ждёт fetchData()'], log: ['1: before', '2: load start'], note: 'await приостанавливает load и возвращает управление вызывающему коду. Поток не блокируется.' },
        { line: 8, stack: ['script'], web: ['таймер 100 мс → resolve'], wait: ['load: ждёт fetchData()'], log: ['1: before', '2: load start', '3: after load()'], note: 'load() уже вернула Promise, поэтому выполняется следующая строка: «3: after load()».' },
        { line: 9, stack: ['script'], web: ['таймер 100 мс → resolve', 'таймер 0 мс → колбэк T'], wait: ['load: ждёт fetchData()'], log: ['1: before', '2: load start', '3: after load()'], note: 'Ставится ещё один таймер — на 0 мс.' },
        { line: -1, stack: [], web: ['таймер 100 мс → resolve'], macro: ['T: log «4: timer 0 ms»'], wait: ['load: ждёт fetchData()'], log: ['1: before', '2: load start', '3: after load()'], note: 'Скрипт закончился. Таймер 0 мс истёк — его колбэк в очереди задач.' },
        { line: 9, stack: ['T'], web: ['таймер 100 мс → resolve'], wait: ['load: ждёт fetchData()'], log: ['1: before', '2: load start', '3: after load()', '4: timer 0 ms'], note: 'Задача T: «4: timer 0 ms». Promise fetchData всё ещё pending.' },
        { line: 0, stack: ['resolve'], micro: ['продолжение load после await'], log: ['1: before', '2: load start', '3: after load()', '4: timer 0 ms'], note: 'Через 100 мс таймер вызвал resolve — Promise выполнен, продолжение load попало в очередь микрозадач.' },
        { line: 4, stack: ['load'], log: ['1: before', '2: load start', '3: after load()', '4: timer 0 ms', '5: after await'], note: 'Микрозадача продолжает load после await: «5: after await».' },
      ],
    },
    {
      id: 'forgot', title: 'Забытый await в тесте',
      code: [
        'const delay = (ms) => new Promise((r) => setTimeout(r, ms));',
        'async function click() {',
        '  await delay(50);',
        "  console.log('click done');",
        '}',
        'async function test() {',
        '  click();               // забыли await',
        "  console.log('assert: checking');",
        '}',
        "test().then(() => console.log('test finished'));",
      ],
      steps: [
        { line: 9, stack: ['script', 'test'], log: [], note: 'Тест запускается.' },
        { line: 6, stack: ['script', 'test', 'click'], log: [], note: 'Вызов click() без await.' },
        { line: 2, stack: ['script', 'test', 'click', 'delay'], web: ['таймер 50 мс → resolve'], log: [], note: 'click начинает «клик», который займёт 50 мс.' },
        { line: 6, stack: ['script', 'test'], web: ['таймер 50 мс → resolve'], wait: ['click: ждёт delay(50)'], log: [], note: 'click приостановилась на await и вернула Promise. Но test его не ждёт — без await она идёт дальше.' },
        { line: 7, stack: ['script', 'test'], web: ['таймер 50 мс → resolve'], wait: ['click: ждёт delay(50)'], log: ['assert: checking'], note: 'Проверка выполняется ДО завершения клика — это и есть гонка.' },
        { line: -1, stack: [], web: ['таймер 50 мс → resolve'], micro: ['then: log «test finished»'], wait: ['click: ждёт delay(50)'], log: ['assert: checking'], note: 'test завершилась, её Promise выполнен — колбэк then в очереди микрозадач.' },
        { line: 9, stack: ['then'], web: ['таймер 50 мс → resolve'], wait: ['click: ждёт delay(50)'], log: ['assert: checking', 'test finished'], note: '«test finished»: раннер считает тест завершённым.' },
        { line: 0, stack: ['resolve'], micro: ['продолжение click'], log: ['assert: checking', 'test finished'], note: 'Через 50 мс delay выполнился.' },
        { line: 3, stack: ['click'], log: ['assert: checking', 'test finished', 'click done'], note: 'Клик завершается уже ПОСЛЕ окончания теста. В Playwright это выглядит как «Target page, context or browser has been closed» или как ложно зелёный тест.' },
      ],
    },
  ];
  window.EVENT_LOOP_SNIPPETS = SNIPPETS;

  Sim.register('event-loop', (root) => {
    let si = 0, k = 0;
    const sh = UI.shell(root, {
      title: 'Async Visualizer: Event Loop по шагам', icon: 'clock', kicker: 'Визуализатор',
      help: 'Выберите фрагмент и проходите по шагам. Подсвечена выполняемая строка; колонки показывают стек вызовов, ожидающие операции среды, очереди микрозадач и задач, а также вывод консоли.',
      layout: 'one',
      onReset: () => { k = 0; runner.pause(); draw(); },
      note: 'Порядок вывода каждого фрагмента проверен запуском в Node.js. Время таймеров условное; браузер выполняет те же правила очередей.',
    });
    const runner = new Runner({ interval: 1400, back: () => { if (k > 0) { k--; draw(); } }, tick: () => { if (k < SNIPPETS[si].steps.length - 1) { k++; draw(); return true; } return false; } }).attach(sh.toolbar);
    const col = sh.col();
    const pick = el('div', { class: 'btn-row' });
    col.appendChild(pick);
    const pickBtns = SNIPPETS.map((s, i) => UI.button(pick, { label: s.title, onClick: () => { si = i; k = 0; runner.pause(); draw(); } }));
    const layout = el('div', { class: 'el-layout' });
    col.appendChild(layout);
    const codeBox = el('pre', { class: 'out-box el-code', 'aria-label': 'Код фрагмента' });
    const lanes = el('div', { class: 'el-lanes' });
    layout.append(codeBox, lanes);
    const lane = (title, cls) => { const b = el('div', { class: 'el-lane ' + cls }, [el('div', { class: 'el-lane-title', text: title })]); const list = el('div', { class: 'el-items' }); b.appendChild(list); lanes.appendChild(b); return list; };
    const L = { stack: lane('Call Stack', 'stack'), web: lane('Web APIs / среда', 'web'), wait: lane('Ожидают await', 'wait'), micro: lane('Microtask queue', 'micro'), macro: lane('Task queue (macrotask)', 'macro'), log: lane('Консоль', 'log') };
    const progress = el('div', { class: 'el-progress', 'aria-live': 'polite' });
    col.appendChild(progress);
    function draw() {
      const s = SNIPPETS[si], st = s.steps[k];
      pickBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === si)));
      codeBox.innerHTML = s.code.map((ln, i) => `<span class="el-line${i === st.line ? ' cur' : ''}"><span class="el-ln">${i + 1}</span>${U.hl(ln, 'ts')}</span>`).join('');
      const fill = (box, arr, stackOrder) => { U.clear(box); const items = (arr || []).slice(); if (stackOrder) items.reverse(); if (!items.length) box.appendChild(el('span', { class: 'el-empty', text: 'пусто' })); items.forEach((t) => box.appendChild(el('span', { class: 'el-item', text: t }))); };
      fill(L.stack, st.stack, true); fill(L.web, st.web); fill(L.wait, st.wait); fill(L.micro, st.micro); fill(L.macro, st.macro);
      U.clear(L.log); (st.log.length ? st.log : []).forEach((t) => L.log.appendChild(el('span', { class: 'el-item mono', text: t }))); if (!st.log.length) L.log.appendChild(el('span', { class: 'el-empty', text: 'пусто' }));
      progress.textContent = `Шаг ${k + 1} из ${s.steps.length}`;
      runner.backBtn.disabled = k === 0;
      runner.stepBtn.disabled = k >= s.steps.length - 1;
      sh.say(`<p>${st.note}</p>` + (k === s.steps.length - 1 ? `<p><b>Итоговый вывод:</b> <code>${st.log.join(' → ')}</code></p>` : ''));
    }
    draw();
  });

  /* ---------- Пошаговый отладчик ---------- */
  const PROGRAM = [
    'function lineTotal(item) {',
    '  return item.price * item.qty;',
    '}',
    'function applyPromo(total, promo) {',
    "  if (promo.percent > 100) throw new RangeError('Скидка больше 100%');",
    '  return total * (1 - promo.percent / 100);',
    '}',
    'function cartTotal(items, promo) {',
    '  let total = 0;',
    '  for (const item of items) {',
    '    total += lineTotal(item);',
    '  }',
    '  return applyPromo(total, promo);',
    '}',
    'const items = [{ price: 1000, qty: 2 }, { price: 500, qty: 1 }];',
    'const result = cartTotal(items, { percent: PERCENT });',
    'console.log(result);',
  ];
  /** Трасса выполнения строится инструментированной копией программы — значения настоящие. */
  function buildTrace(percent) {
    const ev = [];
    const frames = [];
    const snap = (line, cont) => ev.push({ line, cont: !!cont, frames: frames.map((f) => ({ fn: f.fn, line: f.line, vars: JSON.parse(JSON.stringify(f.vars)) })) });
    const at = (line, cont) => { frames[frames.length - 1].line = line; snap(line, cont); };
    const enter = (fn, vars, line) => { frames.push({ fn, vars, line }); snap(line); };
    const leave = () => frames.pop();
    function lineTotal(item) { enter('lineTotal', { item }, 1); const r = item.price * item.qty; frames[frames.length - 1].vars['← return'] = r; at(1, true); leave(); return r; }
    function applyPromo(total, promo) {
      enter('applyPromo', { total, promo }, 4);
      if (promo.percent > 100) { const e = new RangeError('Скидка больше 100%'); e.trace = frames.map((f) => `    at ${f.fn} (cart.js:${f.line + 1})`).reverse(); throw e; }
      at(5); const r = total * (1 - promo.percent / 100); frames[frames.length - 1].vars['← return'] = r; at(5, true); leave(); return r;
    }
    function cartTotal(items, promo) {
      enter('cartTotal', { items: '[2 элемента]', promo }, 8);
      let total = 0; frames[frames.length - 1].vars.total = total; at(8);
      for (const item of items) {
        frames[frames.length - 1].vars.item = item; at(9);
        at(10); total += lineTotal(item); frames[frames.length - 1].vars.total = total; at(10, true);
      }
      at(12); const r = applyPromo(total, promo); leave(); return r;
    }
    frames.push({ fn: '(модуль)', vars: {}, line: 14 });
    let error = null, result;
    try {
      snap(14); frames[0].vars.items = '[{price:1000,qty:2},{price:500,qty:1}]';
      at(15); result = cartTotal([{ price: 1000, qty: 2 }, { price: 500, qty: 1 }], { percent });
      frames.length = 1; frames[0].vars.result = result; at(16);
    } catch (e) { error = { name: e.name, message: e.message, trace: e.trace }; }
    return { ev, error, result };
  }

  Sim.register('debugger-stepper', (root) => {
    let percent = 150, trace = buildTrace(percent), k = 0;
    const bps = new Set([10]);
    const sh = UI.shell(root, {
      title: 'Пошаговая отладка небольшой программы', icon: 'bug', kicker: 'Отладчик',
      help: 'Нажмите на номер строки, чтобы поставить или снять breakpoint. Step into заходит внутрь вызова, Step over выполняет строку целиком, Step out — до выхода из функции, Continue — до следующего breakpoint.',
      onReset: () => { percent = 150; seg.set(150, true); bps.clear(); bps.add(10); trace = buildTrace(percent); k = 0; draw(); },
      note: 'Трасса строится выполнением настоящего кода с записью кадров стека и значений переменных.',
    });
    const left = sh.col(), right = sh.col();
    const seg = UI.seg(right, { label: 'Скидка в вызове', value: 150, options: [{ value: 10, label: '10%' }, { value: 150, label: '150% (ошибка)' }], onChange: (v) => { percent = +v; trace = buildTrace(percent); k = 0; draw(); } });
    const bar = el('div', { class: 'btn-row dbg-bar' });
    right.appendChild(bar);
    const depth = (i) => trace.ev[i].frames.length;
    const go = (pred) => { for (let i = k + 1; i < trace.ev.length; i++) if (pred(i)) { k = i; draw(); return; } k = trace.ev.length; draw(); };
    UI.button(bar, { label: 'Step into', icon: 'step', onClick: () => go(() => true) });
    UI.button(bar, { label: 'Step over', icon: 'chevron-right', onClick: () => { const d = depth(Math.min(k, trace.ev.length - 1)); go((i) => depth(i) < d || (depth(i) === d && !trace.ev[i].cont)); } });
    UI.button(bar, { label: 'Step out', icon: 'chevron-left', onClick: () => { const d = depth(Math.min(k, trace.ev.length - 1)); go((i) => depth(i) < d); } });
    UI.button(bar, { label: 'Continue', icon: 'play', primary: true, onClick: () => go((i) => bps.has(trace.ev[i].line) && !trace.ev[i].cont) });
    const code = el('div', { class: 'dbg-code', role: 'list', 'aria-label': 'Код программы' });
    left.appendChild(code);
    const stackCard = UI.card(right, { title: 'Call Stack' });
    const varsCard = UI.card(right, { title: 'Переменные текущего кадра' });
    const outCard = UI.card(left, { title: 'Консоль' });
    function draw() {
      const done = k >= trace.ev.length;
      const st = done ? null : trace.ev[k];
      U.clear(code);
      PROGRAM.forEach((ln, i) => {
        const txt = ln.replace('PERCENT', String(percent));
        const b = el('button', { type: 'button', class: 'dbg-ln' + (bps.has(i) ? ' bp' : ''), 'aria-pressed': String(bps.has(i)), 'aria-label': `Breakpoint на строке ${i + 1}`, text: String(i + 1) });
        b.addEventListener('click', () => { if (bps.has(i)) bps.delete(i); else bps.add(i); draw(); });
        code.appendChild(el('div', { class: 'dbg-row' + (st && st.line === i ? ' cur' : '') + (done && trace.error && i === 4 ? ' err' : ''), role: 'listitem' }, [b, el('code', { html: U.hl(txt, 'ts') })]));
      });
      U.clear(stackCard.body);
      if (st) st.frames.slice().reverse().forEach((f, i) => stackCard.body.appendChild(el('div', { class: 'dbg-frame' + (i === 0 ? ' top' : ''), text: `${f.fn}  — строка ${f.line + 1}` })));
      else stackCard.body.appendChild(el('div', { class: 'muted-t', text: trace.error ? 'Выполнение прервано исключением' : 'Программа завершена' }));
      U.clear(varsCard.body);
      if (st) { const top = st.frames[st.frames.length - 1]; const dl = el('dl', { class: 'kv' }); Object.entries(top.vars).forEach(([n, v]) => dl.append(el('dt', { text: n }), el('dd', { class: 'mono', text: typeof v === 'string' ? v : JSON.stringify(v) }))); varsCard.body.appendChild(Object.keys(top.vars).length ? dl : el('span', { class: 'muted-t', text: 'нет локальных переменных' })); }
      U.clear(outCard.body);
      if (done) {
        if (trace.error) outCard.body.appendChild(el('pre', { class: 'out-box', text: `${trace.error.name}: ${trace.error.message}\n${trace.error.trace.join('\n')}` }));
        else outCard.body.appendChild(el('pre', { class: 'out-box', text: String(trace.result) }));
      } else outCard.body.appendChild(el('span', { class: 'muted-t', text: 'вывода пока нет' }));
      if (done && trace.error) sh.say('<p>Исключение выброшено в <b>applyPromo</b> (строка 5). Stack trace читается сверху вниз: верхний кадр — место выброса, ниже — кто вызвал: <b>cartTotal</b> на строке 13 и код модуля на строке 16. Причина — в данных вызова на строке 16 (<code>percent: 150</code>), а не в applyPromo: проверка делает свою работу.</p>');
      else if (done) sh.say(`<p>Программа завершилась: результат <b>${trace.result}</b> = (1000 × 2 + 500 × 1) × 0,9.</p>`);
      else sh.say(`<p>Остановка на строке <b>${st.line + 1}</b>, глубина стека ${st.frames.length}. ${bps.has(st.line) ? 'Здесь стоит breakpoint.' : ''} Посмотрите, как меняются <code>total</code> и <code>item</code> в цикле.</p>`);
    }
    draw();
  });
})();

;
