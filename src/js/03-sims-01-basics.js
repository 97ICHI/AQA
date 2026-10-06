/* ===== sims/01-basics.js ===== */
/* ===== Раздел I: ROI, пирамида, BVA, таблица решений, надёжность набора ===== */
(function () {
  'use strict';
  const { el } = U;

  /* ---------- ROI автоматизации ---------- */
  Sim.register('roi-calc', (root) => {
    const D0 = { M: 16, runs: 4, D: 240, m: 2, months: 12 };
    const nf = (v) => (Number.isInteger(v) ? U.fmt(v) : U.fmt(v, 1));
    const s = Object.assign({}, D0);
    const sh = UI.shell(root, {
      title: 'Когда автоматизация регрессии окупится', icon: 'chart', kicker: 'Калькулятор',
      help: 'Модель из главы: ручной прогон стоит <code>M</code> часов, автоматизация — <code>D</code> часов разработки и <code>m</code> часов поддержки на прогон. Меняйте параметры и смотрите на накопленные затраты.',
      onReset: () => { Object.assign(s, D0); ctl.forEach((c) => c.set(s[c.key], true)); update(); },
      note: 'Модель учебная: не учитывает инфраструктуру CI и косвенные выгоды (раннее обнаружение дефектов, частые релизы).',
    });
    const left = sh.col(), right = sh.col();
    const card = UI.card(left, { title: 'Накопленные затраты, часы', legend: [{ label: 'вручную: n · M', color: 'var(--blue)' }, { label: 'автоматизация: D + n · m', color: 'var(--accent)' }] });
    const plot = new Plot(card.body, { aspect: 0.55, x: { label: 'месяц', domain: [0, 12] }, y: { label: 'часы', domain: [0, 100] }, label: 'График накопленных затрат' });
    const ctlBox = UI.stack(right);
    const ctl = [];
    const add = (key, o) => { const c = UI.slider(ctlBox, Object.assign({ value: s[key], onInput: (v) => { s[key] = v; update(); } }, o)); c.key = key; ctl.push(c); };
    add('M', { label: 'Ручной прогон регрессии, <b>M</b>, ч', min: 1, max: 80, step: 1 });
    add('runs', { label: 'Прогонов в месяц', min: 1, max: 40, step: 1 });
    add('D', { label: 'Разработка автотестов, <b>D</b>, ч', min: 10, max: 1500, step: 10 });
    add('m', { label: 'Поддержка на прогон, <b>m</b>, ч', min: 0, max: 30, step: 0.5, hint: 'Починка тестов после изменений и разбор ложных падений' });
    add('months', { label: 'Горизонт, месяцев', min: 3, max: 36, step: 1 });
    const ro = UI.readout(right, [{ key: 'be', label: 'Окупится после прогона' }, { key: 'bem', label: 'Это месяц' }, { key: 'save', label: 'Экономия к концу горизонта' }, { key: 'roi', label: 'ROI к концу горизонта' }]);
    const draw = () => {
      const n = s.runs * s.months;
      plot.x.domain = [0, s.months];
      plot.y.domain = [0, Math.max(n * s.M, s.D + n * s.m) * 1.08 || 10];
      plot.fn = (p) => {
        const pts = (f) => { const a = []; for (let i = 0; i <= 60; i++) { const t = (s.months * i) / 60; a.push([t, f(t * s.runs)]); } return a; };
        p.line(pts((k) => k * s.M), { color: 'var(--blue)' });
        p.line(pts((k) => s.D + k * s.m), { color: 'var(--accent)' });
        if (s.M > s.m) {
          const be = s.D / (s.M - s.m), month = be / s.runs;
          if (month <= s.months) { p.vline(month, { color: 'var(--good)' }); p.dot(month, be * s.M, { color: 'var(--good)' }); p.text(month, be * s.M, 'окупаемость', { dx: 8, dy: -8, cls: 'p-strong' }); }
        }
      };
      plot.redraw();
    };
    function update() {
      const n = s.runs * s.months;
      const manual = n * s.M, auto = s.D + n * s.m;
      if (s.M <= s.m) {
        ro.set('be', 'никогда', 'bad'); ro.set('bem', '—'); ro.set('save', U.fmt(manual - auto) + ' ч', 'bad'); ro.set('roi', U.pct((manual - auto) / auto), 'bad');
        sh.say(`<p>Поддержка одного прогона (<b>${nf(s.m)} ч</b>) не меньше ручного прогона (<b>${s.M} ч</b>): разница <code>M − m ≤ 0</code>, и автоматизация не окупится ни при каком числе прогонов. Так выглядят хрупкие тесты, которые чинят после каждого изменения.</p>`);
      } else {
        const be = s.D / (s.M - s.m), runNo = Math.floor(be) + 1, month = runNo / s.runs;
        ro.set('be', '№ ' + U.fmt(runNo), month <= s.months ? 'good' : 'warn');
        ro.set('bem', month <= s.months ? U.fmt(Math.ceil(month)) + '-й' : `после ${s.months}-го`);
        ro.set('save', U.fmt(manual - auto) + ' ч', manual >= auto ? 'good' : 'bad');
        ro.set('roi', U.pct((manual - auto) / auto), manual >= auto ? 'good' : 'bad');
        sh.say(`<p>Точка окупаемости: <code>D / (M − m) = ${s.D} / (${s.M} − ${nf(s.m)}) ≈ ${U.fmt(be, 1)}</code> прогона, начиная с прогона № ${runNo} автоматизация дешевле. ` +
          (month <= s.months ? `При ${s.runs} прогонах в месяц это ${U.fmt(Math.ceil(month))}-й месяц.` : `При ${s.runs} прогонах в месяц это позже горизонта в ${s.months} мес.`) +
          ` Обратите внимание: рост <b>m</b> сдвигает окупаемость сильнее, чем такой же рост <b>D</b>, — поддержка повторяется каждый прогон.</p>`);
      }
      draw();
    }
    update();
  });

  /* ---------- Пирамида тестирования ---------- */
  const LEVELS = [
    { id: 'e2e', name: 'E2E', color: '#ec80b9', w: 0.22, dur: 25, flaky: 0.03, what: 'Сквозной пользовательский путь через все слои: UI → бэкенд → БД → интеграции.', speed: 'десятки секунд', cost: 'очень высокая', stab: 'низкая', diag: 'размытая: сломаться могло что угодно', ex: 'Зарегистрироваться → найти товар → оплатить → получить письмо' },
    { id: 'ui', name: 'UI', color: '#a78bfa', w: 0.42, dur: 8, flaky: 0.01, what: 'Поведение интерфейса в браузере; бэкенд может быть реальным или подменённым.', speed: 'секунды', cost: 'высокая (вёрстка меняется часто)', stab: 'средняя', diag: 'экран и шаг', ex: 'Ошибка под полем «Промокод» при неверном коде' },
    { id: 'api', name: 'API / Contract', color: '#b183f0', w: 0.62, dur: 0.15, flaky: 0.001, what: 'Бизнес-правила, валидация, права доступа и контракты через HTTP без браузера.', speed: 'десятки миллисекунд', cost: 'средняя', stab: 'высокая', diag: 'конкретный эндпоинт и запрос', ex: 'Просроченный промокод → 422 с кодом PROMO_EXPIRED' },
    { id: 'int', name: 'Integration', color: '#6cb6ff', w: 0.8, dur: 0.4, flaky: 0.002, what: 'Совместная работа компонентов: сервис + настоящая БД, очередь, кэш.', speed: 'сотни миллисекунд', cost: 'средняя', stab: 'высокая', diag: 'стык компонентов', ex: 'Заказ со скидкой сохраняется в БД с правильной суммой' },
    { id: 'unit', name: 'Unit', color: '#72d69a', w: 1, dur: 0.01, flaky: 0.0001, what: 'Функция или класс изолированно от сети и БД.', speed: 'миллисекунды', cost: 'низкая', stab: 'очень высокая', diag: 'конкретная функция', ex: 'applyDiscount(2000, 15) = 1700' },
  ];
  const PRESETS = {
    pyramid: { label: 'Пирамида', counts: { e2e: 5, ui: 30, api: 300, int: 150, unit: 1500 } },
    cone: { label: 'Рожок мороженого', counts: { e2e: 120, ui: 400, api: 40, int: 10, unit: 100 } },
    trophy: { label: 'Трофей', counts: { e2e: 5, ui: 60, api: 250, int: 600, unit: 300 } },
  };
  Sim.register('test-pyramid', (root) => {
    let sel = 'api';
    const counts = Object.assign({}, PRESETS.pyramid.counts);
    let workers = 4;
    const sh = UI.shell(root, {
      title: 'Пирамида автоматизации и состав набора', icon: 'layers', kicker: 'Визуализация',
      help: 'Нажмите на уровень пирамиды, чтобы увидеть его свойства. Ниже соберите набор тестов: число тестов по уровням и воркеров — модель покажет время прогона и вероятность ложного красного прогона.',
      onReset: () => { sel = 'api'; Object.assign(counts, PRESETS.pyramid.counts); workers = 4; sliders.forEach((c) => c.set(counts[c.key], true)); wSl.set(4, true); renderPyr(); info(); calc(); },
      note: 'Длительности и доли ложных падений — иллюстративные средние значения для модели, а не нормы. Пропорции набора выводятся из рисков продукта.',
    });
    const left = sh.col(), right = sh.col();
    const pyrCard = UI.card(left, { title: 'Уровни' });
    const svg = U.svg('svg', { viewBox: '0 0 420 296', role: 'group', 'aria-label': 'Пирамида тестирования' });
    pyrCard.body.appendChild(svg);
    const infoBox = el('div', { class: 'pyr-info' });
    pyrCard.body.appendChild(infoBox);
    function renderPyr() {
      U.clear(svg);
      const H = 250, h = H / LEVELS.length;
      LEVELS.forEach((lv, i) => {
        const wTop = i === 0 ? 0.08 : LEVELS[i - 1].w, wBot = lv.w;
        const y0 = 22 + i * h, y1 = y0 + h - 3, cx = 210, half0 = 200 * wTop, half1 = 200 * wBot;
        const g = U.svg('g', { class: 'pyr-level' + (sel === lv.id ? ' on' : ''), tabindex: 0, role: 'button', 'aria-pressed': String(sel === lv.id), 'aria-label': lv.name });
        g.appendChild(U.svg('path', { d: `M${cx - half0},${y0} L${cx + half0},${y0} L${cx + half1},${y1} L${cx - half1},${y1} Z`, fill: lv.color, 'fill-opacity': sel === lv.id ? 0.9 : 0.45, stroke: sel === lv.id ? 'var(--text-strong)' : 'none', 'stroke-width': 2 }));
        g.appendChild(U.svg('text', { x: cx, y: (y0 + y1) / 2 + 5, 'text-anchor': 'middle', class: 'pyr-label', text: lv.name }));
        const pick = () => { sel = lv.id; renderPyr(); info(); };
        g.addEventListener('click', pick);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        svg.appendChild(g);
      });
      svg.appendChild(U.svg('text', { x: 4, y: 12, class: 'p-muted', text: '↑ медленнее, дороже, меньше тестов' }));
      svg.appendChild(U.svg('text', { x: 4, y: 292, class: 'p-muted', text: '↓ быстрее, стабильнее, больше тестов' }));
    }
    function info() {
      const lv = LEVELS.find((l) => l.id === sel);
      infoBox.innerHTML = `<h4 style="color:${lv.color}">${lv.name}</h4><p>${lv.what}</p><dl class="kv"><dt>Скорость</dt><dd>${lv.speed}</dd><dt>Стоимость поддержки</dt><dd>${lv.cost}</dd><dt>Стабильность</dt><dd>${lv.stab}</dd><dt>Диагностика при падении</dt><dd>${lv.diag}</dd><dt>Пример</dt><dd>${lv.ex}</dd></dl>`;
    }
    const comp = UI.card(right, { title: 'Состав набора' });
    const segBox = el('div', { class: 'btn-row', style: 'margin-bottom:10px' });
    comp.body.appendChild(segBox);
    Object.entries(PRESETS).forEach(([k, p]) => UI.button(segBox, { label: p.label, onClick: () => { Object.assign(counts, p.counts); sliders.forEach((c) => c.set(counts[c.key], true)); calc(); } }));
    const stack = UI.stack(comp.body);
    const sliders = LEVELS.map((lv) => { const c = UI.slider(stack, { label: `${lv.name}: тестов`, min: 0, max: 2000, step: 5, value: counts[lv.id], color: lv.color, onInput: (v) => { counts[lv.id] = v; calc(); } }); c.key = lv.id; return c; });
    const wSl = UI.slider(stack, { label: 'Воркеров', min: 1, max: 16, step: 1, value: workers, onInput: (v) => { workers = v; calc(); } });
    const ro = UI.readout(right, [{ key: 'n', label: 'Всего тестов' }, { key: 'seq', label: 'Последовательно' }, { key: 'par', label: `Параллельно` }, { key: 'green', label: 'P(зелёный без дефектов)' }]);
    function calc() {
      let n = 0, sum = 0, longest = 0, pGreen = 1;
      const share = [];
      for (const lv of LEVELS) { const c = counts[lv.id]; n += c; sum += c * lv.dur; if (c) longest = Math.max(longest, lv.dur); pGreen *= Math.pow(1 - lv.flaky, c); share.push([lv, c * lv.dur]); }
      const par = Math.max(longest, sum / workers);
      ro.set('n', U.fmt(n)); ro.set('seq', U.dur(sum * 1000)); ro.set('par', U.dur(par * 1000));
      ro.set('green', U.pct(pGreen, 1), pGreen > 0.9 ? 'good' : pGreen > 0.5 ? 'warn' : 'bad');
      const top = share.filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
      sh.say(`<p>Набор из ${U.fmt(n)} тестов идёт ${U.dur(sum * 1000)} последовательно и около ${U.dur(par * 1000)} на ${workers} воркерах. ` +
        (top ? `Больше всего времени (${U.pct(top[1] / (sum || 1))}) уходит на уровень <b>${top[0].name}</b>. ` : '') +
        `Вероятность зелёного прогона при отсутствии дефектов — <b>${U.pct(pGreen, 1)}</b>: ложные падения верхних уровней складываются, поэтому их число ограничивают.</p>`);
    }
    renderPyr(); info(); calc();
  });

  /* ---------- Конструктор граничных значений ---------- */
  Sim.register('bva-builder', (root) => {
    const D0 = { min: 18, max: 65, step: 1, mode: 2, probe: 17 };
    const s = Object.assign({}, D0);
    const sh = UI.shell(root, {
      title: 'Классы эквивалентности и граничные значения', icon: 'grid', kicker: 'Конструктор',
      help: 'Задайте допустимый диапазон (включительно) и шаг — минимальную единицу значения: 1 для целых, 0,01 для денег. Проверьте любое значение в поле справа.',
      onReset: () => { Object.assign(s, D0); inputs.min.value = s.min; inputs.max.value = s.max; inputs.step.value = s.step; modeSeg.set(2, true); inputs.probe.value = s.probe; update(); },
    });
    const left = sh.col(), right = sh.col();
    const card = UI.card(left, { title: 'Числовая ось', legend: [{ label: 'невалидный класс', color: 'var(--bad)' }, { label: 'валидный класс', color: 'var(--good)' }, { label: 'граничное значение', color: 'var(--accent)', dot: true }] });
    const svg = U.svg('svg', { viewBox: '0 0 600 120', class: 'bva-svg', role: 'img', 'aria-label': 'Классы и границы на числовой оси' });
    card.body.appendChild(svg);
    const tableBox = el('div');
    left.appendChild(tableBox);
    const form = UI.card(right, { title: 'Параметры' });
    const inputs = {};
    const field = (key, label, attrs) => {
      const id = U.uid('bva');
      const inp = el('input', Object.assign({ id, class: 'inp', type: 'number', value: s[key], step: 'any' }, attrs || {}));
      inp.addEventListener('input', () => { const v = parseFloat(inp.value.replace(',', '.')); if (Number.isFinite(v)) { s[key] = v; update(); } });
      form.body.appendChild(el('label', { class: 'sel', for: id }, [el('span', { text: label }), inp]));
      inputs[key] = inp;
    };
    field('min', 'Минимум (включительно)');
    field('max', 'Максимум (включительно)');
    field('step', 'Шаг (минимальная единица)', { min: '0.0001' });
    const modeSeg = UI.seg(form.body, { label: 'Вариант BVA', value: 2, options: [{ value: 2, label: 'Двухточечный' }, { value: 3, label: 'Трёхточечный' }], onChange: (v) => { s.mode = +v; update(); } });
    const probeCard = UI.card(right, { title: 'Проверить значение' });
    const pid = U.uid('probe');
    inputs.probe = el('input', { id: pid, class: 'inp', type: 'number', step: 'any', value: s.probe, 'aria-label': 'Проверяемое значение' });
    inputs.probe.addEventListener('input', () => { const v = parseFloat(inputs.probe.value.replace(',', '.')); s.probe = Number.isFinite(v) ? v : NaN; update(); });
    probeCard.body.appendChild(inputs.probe);
    const probeOut = el('p', { class: 'muted-t', style: 'margin:8px 0 0', 'aria-live': 'polite' });
    probeCard.body.appendChild(probeOut);
    const dec = (st) => { const t = String(st); return t.includes('e-') ? +t.split('e-')[1] : (t.split('.')[1] || '').length; };
    function update() {
      const d = dec(s.step), r = (v) => +v.toFixed(d), f = (v) => U.fmt(v, d);
      if (!(s.step > 0) || !(s.min <= s.max)) {
        U.clear(svg); tableBox.innerHTML = '';
        sh.say('<p class="bad-t">Некорректные параметры: шаг должен быть больше нуля, минимум — не больше максимума.</p>');
        probeOut.textContent = '';
        return;
      }
      const pts = s.mode === 2 ? [r(s.min - s.step), s.min, s.max, r(s.max + s.step)] : [r(s.min - s.step), s.min, r(s.min + s.step), r(s.max - s.step), s.max, r(s.max + s.step)];
      const uniq = [...new Set(pts.map((v) => r(v)))].sort((a, b) => a - b);
      const cls = (v) => (v < s.min ? 'below' : v > s.max ? 'above' : 'valid');
      // ось
      U.clear(svg);
      const span = Math.max(s.max - s.min, s.step * 4), lo = s.min - span * 0.35, hi = s.max + span * 0.35;
      const X = (v) => 30 + ((v - lo) / (hi - lo)) * 540;
      svg.appendChild(U.svg('rect', { x: 30, y: 52, width: X(s.min) - 30, height: 16, fill: 'var(--bad)', opacity: 0.35, rx: 3 }));
      svg.appendChild(U.svg('rect', { x: X(s.min), y: 52, width: X(s.max) - X(s.min), height: 16, fill: 'var(--good)', opacity: 0.4, rx: 3 }));
      svg.appendChild(U.svg('rect', { x: X(s.max), y: 52, width: 570 - X(s.max), height: 16, fill: 'var(--bad)', opacity: 0.35, rx: 3 }));
      svg.appendChild(U.svg('text', { x: (30 + X(s.min)) / 2, y: 44, 'text-anchor': 'middle', class: 'p-muted', text: '< min' }));
      svg.appendChild(U.svg('text', { x: (X(s.min) + X(s.max)) / 2, y: 44, 'text-anchor': 'middle', class: 'p-muted', text: 'допустимо' }));
      svg.appendChild(U.svg('text', { x: (X(s.max) + 570) / 2, y: 44, 'text-anchor': 'middle', class: 'p-muted', text: '> max' }));
      uniq.forEach((v, i) => {
        const x = X(v);
        svg.appendChild(U.svg('circle', { cx: x, cy: 60, r: 6, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2 }));
        svg.appendChild(U.svg('text', { x, y: i % 2 ? 100 : 88, 'text-anchor': 'middle', class: 'p-label', text: f(v) }));
      });
      if (Number.isFinite(s.probe) && s.probe >= lo && s.probe <= hi) svg.appendChild(U.svg('path', { d: `M${X(s.probe)},26 l-6,-10 h12 z`, fill: 'var(--blue)' }));
      // таблица
      U.clear(tableBox);
      const rows = [
        ['Меньше минимума', `… ${f(r(s.min - s.step))}`, 'Ошибка валидации', f(r(s.min - Math.max(s.step, span * 0.3)))],
        ['Допустимый', `${f(s.min)} … ${f(s.max)}`, 'Принято', f(r(Math.round((s.min + s.max) / 2 / s.step) * s.step))],
        ['Больше максимума', `${f(r(s.max + s.step))} …`, 'Ошибка валидации', f(r(s.max + Math.max(s.step, span * 0.3)))],
        ['Не число / пусто', '"abc", "", null', 'Ошибка формата', '"abc"'],
      ];
      tableBox.appendChild(el('h4', { text: 'Классы эквивалентности', style: 'margin:14px 0 6px' }));
      UI.table(tableBox, ['Класс', 'Значения', 'Ожидание', 'Представитель'], rows);
      tableBox.appendChild(el('h4', { text: `Граничные значения (${s.mode === 2 ? 'двухточечный' : 'трёхточечный'} BVA)`, style: 'margin:14px 0 6px' }));
      UI.table(tableBox, ['Значение', 'Класс', 'Ожидание'], uniq.map((v) => [f(v), cls(v) === 'valid' ? 'допустимый' : cls(v) === 'below' ? 'меньше минимума' : 'больше максимума', cls(v) === 'valid' ? '<span class="ok-t">принято</span>' : '<span class="bad-t">ошибка</span>']));
      const code = 'const cases = [\n' + uniq.map((v) => `  { value: ${v}, valid: ${cls(v) === 'valid'} },`).join('\n') + '\n];';
      tableBox.appendChild(el('h4', { text: 'Данные для параметризованного теста', style: 'margin:14px 0 6px' }));
      tableBox.appendChild(el('pre', { class: 'out-box', html: U.hl(code, 'ts') }));
      // проверка значения
      if (!Number.isFinite(s.probe)) probeOut.innerHTML = 'Введите число — или проверьте класс «не число»: <span class="bad-t">ошибка формата</span>.';
      else {
        const c = cls(s.probe), onGrid = Math.abs((s.probe - s.min) / s.step - Math.round((s.probe - s.min) / s.step)) < 1e-9;
        const isB = uniq.some((v) => Math.abs(v - s.probe) < 1e-9);
        probeOut.innerHTML = `${f(s.probe)}: класс «${c === 'valid' ? 'допустимый' : c === 'below' ? 'меньше минимума' : 'больше максимума'}» → ${c === 'valid' ? '<span class="ok-t">принято</span>' : '<span class="bad-t">ошибка валидации</span>'}` +
          (isB ? ' · это граничное значение' : '') + (!onGrid ? ' · <span class="warn-t">значение не кратно шагу — отдельный негативный случай (например, 18,5 для целых)</span>' : '');
      }
      sh.say(`<p>Для диапазона <b>${f(s.min)}…${f(s.max)}</b> с шагом ${f(s.step)} ${s.mode === 2 ? 'двухточечный' : 'трёхточечный'} BVA даёт ${uniq.length} значений: <b>${uniq.map(f).join(', ')}</b>. Вместе с представителями классов и «не числом» — ${uniq.length + 4} случаев вместо перебора всего диапазона.` +
        (s.mode === 3 ? ' Соседи внутри диапазона ловят ошибки вида «== min» вместо «>= min».' : '') + '</p>');
    }
    update();
  });

  /* ---------- Таблица решений: доставка ---------- */
  Sim.register('decision-table', (root) => {
    const s = { member: false, big: false, express: false };
    const cost = (m, b, e) => (e ? (m ? 400 : 600) : (m || b ? 0 : 300));
    const sh = UI.shell(root, {
      title: 'Таблица решений: стоимость доставки', icon: 'grid', kicker: 'Конструктор',
      help: 'Правила: стандартная доставка бесплатна участникам программы и при заказе от 3000 ₽, иначе 300 ₽. Экспресс никогда не бесплатен: 400 ₽ для участников, 600 ₽ для остальных.',
      onReset: () => { Object.assign(s, { member: false, big: false, express: false }); tg.forEach((t) => t.set(false, true)); update(); },
    });
    const left = sh.col(), right = sh.col();
    const tgCard = UI.card(right, { title: 'Условия заказа' });
    const tg = [
      UI.toggle(tgCard.body, { label: 'Участник программы лояльности', value: false, onChange: (v) => { s.member = v; update(); } }),
      UI.toggle(tgCard.body, { label: 'Сумма заказа ≥ 3000 ₽', value: false, onChange: (v) => { s.big = v; update(); } }),
      UI.toggle(tgCard.body, { label: 'Экспресс-доставка', value: false, onChange: (v) => { s.express = v; update(); } }),
    ];
    tgCard.body.style.display = 'grid'; tgCard.body.style.gap = '12px';
    const ro = UI.readout(right, [{ key: 'cost', label: 'Стоимость доставки' }, { key: 'rule', label: 'Правило полной таблицы' }, { key: 'rrule', label: 'Правило сокращённой' }]);
    const full = el('div'), reduced = el('div');
    left.append(el('h4', { text: 'Полная таблица: 2³ = 8 правил', style: 'margin:0 0 6px' }), full, el('h4', { text: 'Сокращённая таблица: 5 правил («—» — условие не влияет)', style: 'margin:14px 0 6px' }), reduced);
    const YN = (v) => (v ? 'да' : 'нет');
    const RED = [
      { m: true, b: null, e: true, c: 400 }, { m: false, b: null, e: true, c: 600 }, { m: true, b: null, e: false, c: 0 }, { m: false, b: true, e: false, c: 0 }, { m: false, b: false, e: false, c: 300 },
    ];
    function table(box, rules, cur) {
      U.clear(box);
      const wrap = el('div', { class: 'dt-wrap' });
      const t = el('table', { class: 'dt dtable' });
      const hd = el('tr', {}, [el('th', { text: 'Условие / правило' })].concat(rules.map((_, i) => el('th', { class: 'num' + (i === cur ? ' hl' : ''), text: 'R' + (i + 1) }))));
      t.appendChild(el('thead', {}, hd));
      const tb = el('tbody');
      const row = (label, f, isAct) => tb.appendChild(el('tr', { class: isAct ? 'act' : '' }, [el('th', { text: label })].concat(rules.map((r, i) => el('td', { class: 'num' + (i === cur ? ' hl' : ''), text: f(r) })))));
      row('Участник', (r) => (r.m === null ? '—' : YN(r.m)));
      row('Сумма ≥ 3000', (r) => (r.b === null ? '—' : YN(r.b)));
      row('Экспресс', (r) => (r.e === null ? '—' : YN(r.e)));
      row('Доставка, ₽', (r) => String(r.c), true);
      t.appendChild(tb); wrap.appendChild(t); box.appendChild(wrap);
    }
    const FULL = [];
    for (const m of [true, false]) for (const b of [true, false]) for (const e of [true, false]) FULL.push({ m, b, e, c: cost(m, b, e) });
    function update() {
      const c = cost(s.member, s.big, s.express);
      const fi = FULL.findIndex((r) => r.m === s.member && r.b === s.big && r.e === s.express);
      const ri = RED.findIndex((r) => (r.m === null || r.m === s.member) && (r.b === null || r.b === s.big) && (r.e === null || r.e === s.express));
      table(full, FULL, fi); table(reduced, RED, ri);
      ro.set('cost', c + ' ₽', c === 0 ? 'good' : ''); ro.set('rule', 'R' + (fi + 1)); ro.set('rrule', 'R' + (ri + 1));
      sh.say(`<p>Сработало правило R${fi + 1} полной таблицы и R${ri + 1} сокращённой: доставка <b>${c} ₽</b>. ` +
        (s.express ? 'Для экспресса сумма заказа не влияет на цену — поэтому в сокращённой таблице у этих правил стоит «—», и из 4 комбинаций остаётся 2.' :
          s.member ? 'Для участника сумма не важна: стандартная доставка бесплатна в любом случае.' : 'Для не участника решает сумма: граница 3000 ₽ — кандидат для граничных значений 2999 и 3000.') +
        ' Минимальный набор тестов — по одному на каждое из 5 правил сокращённой таблицы.</p>');
    }
    update();
  });

  /* ---------- Надёжность набора ---------- */
  Sim.register('suite-reliability', (root) => {
    const D0 = { n: 300, p: 0.5, r: 0, dur: 10 };
    const s = Object.assign({}, D0);
    const sh = UI.shell(root, {
      title: 'Ложные падения складываются', icon: 'chart', kicker: 'Калькулятор',
      help: 'Каждый тест независимо даёт ложное падение с вероятностью <code>p</code>. Ретрай повторяет упавший тест: тест ложно красный, только если упали все <code>r + 1</code> попыток.',
      onReset: () => { Object.assign(s, D0); ctl.forEach((c) => c.set(s[c.key], true)); update(); },
      note: 'Модель предполагает независимость падений; на практике причины часто общие (окружение), и реальная картина хуже.',
    });
    const left = sh.col(), right = sh.col();
    const card = UI.card(left, { title: 'Вероятность зелёного прогона от размера набора', legend: [{ label: 'без ретраев', color: 'var(--bad)' }, { label: 'с ретраями', color: 'var(--good)' }] });
    const plot = new Plot(card.body, { aspect: 0.5, x: { label: 'тестов в наборе', domain: [0, 1000] }, y: { label: 'P(зелёный)', domain: [0, 1], fmt: (v) => U.pct(v) } });
    const stack = UI.stack(right);
    const ctl = [];
    const add = (key, o) => { const c = UI.slider(stack, Object.assign({ value: s[key], onInput: (v) => { s[key] = v; update(); } }, o)); c.key = key; ctl.push(c); };
    add('n', { label: 'Тестов в наборе, N', min: 1, max: 2000, step: 1 });
    add('p', { label: 'Ложных падений одного теста, %', min: 0, max: 5, step: 0.05, fmt: (v) => v + '%' });
    add('r', { label: 'Ретраев, r', min: 0, max: 3, step: 1 });
    add('dur', { label: 'Средняя длительность теста, с', min: 1, max: 60, step: 1 });
    const ro = UI.readout(right, [{ key: 'g0', label: 'Зелёный без ретраев' }, { key: 'g', label: 'Зелёный с ретраями' }, { key: 'flaky', label: 'Ожидаемо flaky-тестов' }, { key: 'extra', label: 'Доп. время на повторы' }]);
    plot.onRender((p) => {
      const p1 = s.p / 100, pr = Math.pow(p1, s.r + 1), maxN = p.x.domain[1];
      const pts = (q) => { const a = []; for (let i = 0; i <= 80; i++) { const n = (maxN * i) / 80; a.push([n, Math.pow(1 - q, n)]); } return a; };
      p.line(pts(p1), { color: 'var(--bad)' });
      if (s.r > 0) p.line(pts(pr), { color: 'var(--good)' });
      p.vline(s.n, { color: 'var(--text-muted)' });
      p.dot(s.n, Math.pow(1 - (s.r ? pr : p1), s.n), { color: s.r ? 'var(--good)' : 'var(--bad)' });
    });
    function update() {
      const p1 = s.p / 100, pr = Math.pow(p1, s.r + 1);
      const g0 = Math.pow(1 - p1, s.n), g = Math.pow(1 - pr, s.n);
      const flaky = s.n * (p1 - pr), extraRuns = s.n * (s.r ? (p1 * (1 - Math.pow(p1, s.r))) / (1 - p1 || 1) : 0);
      ro.set('g0', U.pct(g0, 1), g0 > 0.9 ? 'good' : g0 > 0.5 ? 'warn' : 'bad');
      ro.set('g', U.pct(s.r ? g : g0, 1), (s.r ? g : g0) > 0.9 ? 'good' : 'warn');
      ro.set('flaky', s.r ? U.fmt(flaky, 1) : '—');
      ro.set('extra', s.r ? U.dur(extraRuns * s.dur * 1000) : '—');
      plot.x.domain = [0, Math.max(100, Math.ceil((s.n * 1.6) / 100) * 100)];
      plot.redraw();
      sh.say(`<p>При ${U.fmt(s.n)} тестах и ${U.fmt(s.p, 2)}% ложных падений набор зелёный только в <b>${U.pct(g0, 1)}</b> прогонов без дефектов: <code>(1 − ${U.fmt(p1, 4)})^${s.n}</code>. ` +
        (s.r ? `С ${s.r} ретра${s.r === 1 ? 'ем' : 'ями'} — в ${U.pct(g, 1)}, но в каждом прогоне в среднем ${U.fmt(flaky, 1)} тестов получают статус flaky: нестабильность не исчезла, а стала менее заметной.` : 'Ретраи повысят долю зелёных прогонов, но скроют нестабильность — попробуйте r = 1.') + '</p>');
    }
    update();
  });
})();

;
