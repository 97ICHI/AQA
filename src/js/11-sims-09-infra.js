/* ===== sims/09-infra.js ===== */
/* ===== Раздел VII: Docker Compose, CI/CD Pipeline Visualizer, оптимизация, Flaky Test Debugger ===== */
(function () {
  'use strict';
  const { el } = U;

  /* ---------- Контейнерное окружение ---------- */
  Sim.register('docker-compose-env', (root) => {
    const D = { url: 'service', health: true, net: true, vol: true, ipc: true, ver: true };
    const s = Object.assign({}, D);
    const sh = UI.shell(root, {
      title: 'Тестовое окружение в Docker Compose', icon: 'box', kicker: 'Модель', layout: 'side-left',
      help: 'Сервисы из <code>docker-compose.yml</code> этой главы. Меняйте настройки и смотрите, что выведет <code>docker compose run --rm tests</code>.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Логи сокращены, но сообщения об ошибках соответствуют тем, что выводят Playwright, Node.js и Docker в таких ситуациях.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const diag = el('div', { class: 'dc-diag' });
    const log = el('pre', { class: 'out-box dc-log' });
    const roBox = el('div');
    main.append(diag, log, roBox);
    function build() {
      U.clear(box);
      UI.seg(box, { label: 'BASE_URL в сервисе tests', value: s.url, options: [{ value: 'service', label: 'http://app:3000' }, { value: 'localhost', label: 'http://localhost:3000' }], onChange: (v) => { s.url = v; update(); } });
      const tg = (k, l) => UI.toggle(box, { label: l, value: s[k], onChange: (v) => { s[k] = v; update(); } });
      tg('health', 'healthcheck + depends_on: condition: service_healthy');
      tg('net', 'tests в той же сети Compose (docker compose run)');
      tg('vol', 'Том для отчёта: ./playwright-report');
      tg('ipc', 'ipc: host для Chromium');
      tg('ver', 'Версия образа Playwright = версии @playwright/test');
      update();
    }
    function update() {
      const svc = (name, sub, state) => el('div', { class: 'flow-node ' + (state === 'bad' ? 'is-bad' : state === 'warn' ? 'is-on' : 'is-good') }, [el('b', { text: name }), el('span', { class: 'sub', text: sub })]);
      U.clear(diag);
      const fatal = !s.ver ? 'ver' : !s.net ? 'net' : s.url === 'localhost' ? 'url' : null;
      diag.append(
        svc('tests', `mcr.microsoft.com/playwright:${s.ver ? 'v1.63.0' : 'v1.62.0'}-noble · BASE_URL=${s.url === 'service' ? 'http://app:3000' : 'http://localhost:3000'}`, fatal ? 'bad' : (!s.health || !s.ipc) ? 'warn' : 'ok'),
        el('span', { class: 'flow-arrow', text: s.net ? '→' : '✕', 'aria-hidden': 'true' }),
        svc('app', 'registry…/shop/app · :3000 · healthcheck /api/health', s.health ? 'ok' : 'warn'),
        el('span', { class: 'flow-arrow', text: '→', 'aria-hidden': 'true' }),
        svc('db', 'postgres:16 · pg_isready', 'ok'),
        svc('payments-mock', 'wiremock/wiremock:3.9.1', 'ok'),
      );
      const lines = ['$ docker compose up -d db app payments-mock'];
      lines.push(s.health ? ' ✔ Container shop-db-1             Healthy\n ✔ Container shop-app-1            Healthy' : ' ✔ Container shop-db-1             Started\n ✔ Container shop-app-1            Started');
      lines.push('$ docker compose run --rm tests');
      let passed = 48, failed = 0, flaky = 0, exit = 0;
      if (!s.net) lines.push('# тесты запущены через docker run вне сети Compose', "Error: page.goto: net::ERR_NAME_NOT_RESOLVED at http://app:3000/catalog", '  48 failed');
      if (!s.ver) lines.push("Error: browserType.launch: Executable doesn't exist at /ms-playwright/chromium_headless_shell-…/chrome-linux/headless_shell", '╔════════════════════════════════════════════════════╗', '║ Looks like Playwright was just updated to 1.63.0.  ║', '║ Please update docker image as well.                ║', '║ -  current: mcr.microsoft.com/playwright:v1.62.0   ║', '║ - required: mcr.microsoft.com/playwright:v1.63.0   ║', '╚════════════════════════════════════════════════════╝', '  48 failed');
      if (fatal) { passed = 0; failed = 48; exit = 1; }
      if (!fatal && s.url === 'localhost') { /* недостижимо */ }
      if (s.url === 'localhost' && s.net && s.ver) { lines.push('Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/catalog', '# localhost внутри контейнера tests — это сам контейнер tests', '  48 failed'); passed = 0; failed = 48; exit = 1; }
      if (!fatal) {
        lines.push('Running 48 tests using 4 workers');
        if (!s.health) { lines.push('  ✘ [api] › orders/create.spec.ts:12 › 201 и заказ доступен по Location', '    Error: apiRequestContext.post: connect ECONNREFUSED 172.18.0.4:3000', '  ✘ [ui] › cart/promo.spec.ts:8 › SALE10 уменьшает сумму на 10%', '    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://app:3000/cart', '  … приложение стало отвечать через ~9 с, дальше тесты проходят'); failed = 3; passed = 45; exit = 1; }
        if (!s.ipc) { lines.push('  ✘ [ui] › e2e/checkout.spec.ts:5 › покупка от каталога до оплаты (retry #1 прошёл)', '    Error: page.goto: Target page, context or browser has been closed', '    # Chromium упал: не хватило /dev/shm (64 МБ по умолчанию в контейнере)'); flaky = 1; passed -= 1; }
        lines.push(`  ${failed ? failed + ' failed\n  ' : ''}${flaky ? flaky + ' flaky\n  ' : ''}${passed} passed`);
        lines.push(s.vol ? '  To open last HTML report run: npx playwright show-report  (файлы в ./playwright-report на хосте)' : '# отчёт записан в /tests/playwright-report внутри контейнера и удалён вместе с ним (--rm)');
      }
      lines.push(`$ echo $?\n${exit}`);
      log.textContent = lines.join('\n');
      U.clear(roBox);
      const ro = UI.readout(roBox, [{ key: 'r', label: 'Результат' }, { key: 'rep', label: 'Отчёт на хосте' }, { key: 'x', label: 'Код выхода' }]);
      ro.set('r', fatal || s.url === 'localhost' ? 'всё упало' : failed ? `${failed} упали, ${passed} прошли` : flaky ? 'зелёный, 1 flaky' : 'все прошли', fatal || s.url === 'localhost' || failed ? 'bad-t' : flaky ? 'warn-t' : 'ok-t');
      ro.set('rep', s.vol && !fatal && s.url !== 'localhost' ? 'есть' : 'нет', s.vol && !fatal && s.url !== 'localhost' ? 'ok-t' : 'bad-t');
      ro.set('x', String(exit), exit ? 'bad-t' : 'ok-t');
      const m = [];
      if (!s.ver) m.push('Образ содержит браузеры для своей версии Playwright. Если в package.json другая версия, она ищет браузеры, которых в образе нет. Версия образа и @playwright/test должны совпадать — обновляйте их вместе.');
      else if (!s.net) m.push('Имя сервиса app разрешается только внутри сети Compose. Контейнер, запущенный отдельно через docker run без --network, этого имени не знает.');
      else if (s.url === 'localhost') m.push('localhost в контейнере — это сам контейнер. До приложения нужно обращаться по имени сервиса: http://app:3000.');
      else {
        if (!s.health) m.push('Без healthcheck depends_on ждёт только запуска контейнера, а не готовности приложения. Первые тесты стучатся в ещё не готовый сервис — падения выглядят как случайные.');
        if (!s.ipc) m.push('Без ipc: host (или увеличенного shm_size) Chromium в контейнере может падать на тяжёлых страницах — ещё один источник «случайных» падений.');
        if (!s.vol) m.push('Тесты прошли, но отчёт и trace остались внутри удалённого контейнера. Для CI нужен том или копирование артефактов.');
        if (!m.length) m.push('Окружение настроено: тесты обращаются к приложению по имени сервиса, стартуют после готовности зависимостей, отчёт сохраняется на хосте.');
      }
      sh.say(m.map((x) => `<p>${x}</p>`).join(''));
    }
    build();
  });

  /* ---------- CI/CD Pipeline Visualizer ---------- */
  const JOBS = [
    { id: 'lint', stage: 'verify', dur: 1.5, needs: [] },
    { id: 'typecheck', stage: 'verify', dur: 1, needs: [] },
    { id: 'build-image', stage: 'build', dur: 4, needs: [] },
    { id: 'api-tests', stage: 'test', dur: 5, needs: ['build-image'], art: 'junit.xml, playwright-report/' },
    { id: 'e2e-tests', stage: 'test', dur: 16, needs: ['build-image'], shard: true, art: 'blob-report/' },
    { id: 'merge-report', stage: 'report', dur: 1, needs: ['e2e-tests'], always: true, art: 'playwright-report/ (общий)' },
    { id: 'deploy-staging', stage: 'deploy', dur: 3, needs: ['api-tests', 'e2e-tests'], gate: true },
  ];
  const STAGES = ['verify', 'build', 'test', 'report', 'deploy'];
  Sim.register('pipeline-visualizer', (root) => {
    const D = { fail: 'none', kind: 'real', allow: false, retry: false, shards: 2, needs: false };
    const s = Object.assign({}, D);
    const sh = UI.shell(root, {
      title: 'CI/CD Pipeline Visualizer', icon: 'pipeline', kicker: 'Модель', layout: 'side-left',
      help: 'Учебный pipeline merge request: проверки, сборка, тесты, отчёт и деплой на стенд. Внедрите падение и меняйте настройки — диаграмма покажет, что выполнится, что будет пропущено и пройдут ли ворота.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Длительности условные (минуты). Стадии выполняются последовательно, задачи стадии — параллельно; с needs задача стартует сразу после своих зависимостей. Задачи с when: always выполняются и после падений.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const chart = el('div', { class: 'pv-chart' });
    const roBox = el('div');
    const arts = el('div', { class: 'pv-arts' });
    main.append(chart, roBox, arts);
    function build() {
      U.clear(box);
      UI.select(box, { label: 'Внедрить падение', value: s.fail, options: [{ value: 'none', label: 'Без падений' }, { value: 'lint', label: 'lint: ошибка ESLint' }, { value: 'build-image', label: 'build-image: сборка упала' }, { value: 'api-tests', label: 'api-tests: тест упал' }, { value: 'e2e-tests', label: 'e2e-tests: тест упал в шарде 2' }], onChange: (v) => { s.fail = v; build(); } });
      if (s.fail === 'api-tests' || s.fail === 'e2e-tests') UI.seg(box, { label: 'Природа падения', value: s.kind, options: [{ value: 'real', label: 'Дефект' }, { value: 'flaky', label: 'Нестабильный тест' }], onChange: (v) => { s.kind = v; update(); } });
      if (s.fail === 'lint') UI.toggle(box, { label: 'allow_failure: true для lint', value: s.allow, onChange: (v) => { s.allow = v; update(); } });
      if (s.fail === 'api-tests' || s.fail === 'e2e-tests') UI.toggle(box, { label: 'retry: 1 (перезапуск задачи CI)', value: s.retry, onChange: (v) => { s.retry = v; update(); } });
      UI.seg(box, { label: 'Шарды e2e (parallel)', value: s.shards, options: [1, 2, 4].map((v) => ({ value: v, label: String(v) })), onChange: (v) => { s.shards = +v; update(); } });
      UI.toggle(box, { label: 'Граф needs вместо стадий', value: s.needs, onChange: (v) => { s.needs = v; update(); } });
      update();
    }
    function simulate() {
      const st = {};
      const rows = [];
      const exp = [];
      JOBS.forEach((j) => {
        if (j.shard && s.shards > 1) for (let k = 1; k <= s.shards; k++) exp.push(Object.assign({}, j, { id: `${j.id} ${k}/${s.shards}`, base: j.id, k, dur: j.dur / s.shards + 1.5 }));
        else exp.push(Object.assign({}, j, { base: j.id, k: 1, dur: j.shard ? j.dur + 1.5 : j.dur }));
      });
      const done = {}; // base -> {end, ok}
      const stageEnd = {};
      const stageFail = {};
      let prevEnd = 0, blocked = false;
      for (const stage of STAGES) {
        const js = exp.filter((j) => j.stage === stage);
        let end = prevEnd;
        js.forEach((j) => {
          let start = prevEnd;
          let skip = blocked && !j.always;
          if (s.needs && j.needs.length) {
            const deps = j.needs.map((n) => done[n]);
            if (deps.some((d) => !d || d.status === 'skipped')) skip = true;
            else { start = Math.max(...deps.map((d) => d.end)); skip = deps.some((d) => d.status === 'failed') && !j.always; }
          } else if (s.needs && !j.needs.length) { start = 0; skip = false; }
          if (j.gate && Object.values(done).some((d) => d.status === 'failed')) skip = true;
          let status = 'success', dur = j.dur, retried = false;
          const failsHere = s.fail === j.base && (j.base !== 'e2e-tests' || j.k === Math.min(2, s.shards));
          if (skip) { status = 'skipped'; dur = 0; }
          else if (failsHere) {
            if (j.base === 'lint' && s.allow) status = 'allowed';
            else if (s.retry && s.kind === 'flaky' && (j.base === 'api-tests' || j.base === 'e2e-tests')) { status = 'success'; retried = true; dur = j.dur * 2; }
            else { status = 'failed'; if (s.retry && (j.base === 'api-tests' || j.base === 'e2e-tests')) { retried = true; dur = j.dur * 2; } }
          }
          const r = { id: j.id, base: j.base, stage, start, end: start + dur, status, retried, art: j.art, always: j.always };
          rows.push(r);
          const prev = done[j.base];
          done[j.base] = { end: Math.max(prev ? prev.end : 0, r.end), status: prev && prev.status === 'failed' ? 'failed' : status === 'allowed' ? 'success' : status };
          if (status !== 'skipped') end = Math.max(end, r.end);
          if (status === 'failed') stageFail[stage] = true;
        });
        stageEnd[stage] = end;
        if (!s.needs) { if (stageFail[stage]) blocked = true; prevEnd = end; }
      }
      return rows;
    }
    function update() {
      const rows = simulate();
      const total = Math.max(...rows.map((r) => r.end));
      const W = 600, rowH = 22, l = 120, H = rows.length * (rowH + 6) + 26;
      const x = (t) => l + (t / Math.max(total, 1)) * (W - l - 40);
      const svg = U.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Диаграмма выполнения pipeline' });
      const COL = { success: 'var(--good)', failed: 'var(--bad)', skipped: 'var(--surface-3)', allowed: 'var(--warn)' };
      let lastStage = null;
      rows.forEach((r, i) => {
        const y = 4 + i * (rowH + 6);
        if (r.stage !== lastStage && !s.needs) { svg.appendChild(U.svg('line', { x1: 0, x2: W, y1: y - 3, y2: y - 3, stroke: 'var(--border)' })); lastStage = r.stage; }
        svg.appendChild(U.svg('text', { x: 4, y: y + 15, class: 'p-muted', text: r.id }));
        if (r.status === 'skipped') { svg.appendChild(U.svg('text', { x: l, y: y + 15, class: 'p-muted', text: 'пропущена' })); return; }
        svg.appendChild(U.svg('rect', { x: x(r.start), y, width: Math.max(3, x(r.end) - x(r.start)), height: rowH, rx: 5, fill: COL[r.status] }));
        if (r.retried) svg.appendChild(U.svg('line', { x1: (x(r.start) + x(r.end)) / 2, x2: (x(r.start) + x(r.end)) / 2, y1: y, y2: y + rowH, stroke: 'var(--surface)', 'stroke-width': 2, 'stroke-dasharray': '3 2' }));
        svg.appendChild(U.svg('text', { x: x(r.end) + 4, y: y + 15, class: 'p-muted', text: U.fmt(r.end - r.start, 1) + ' мин' }));
      });
      U.clear(chart); chart.appendChild(svg);
      chart.appendChild(UI.legend([{ color: COL.success, label: 'успех' }, { color: COL.failed, label: 'падение' }, { color: COL.allowed, label: 'падение, allow_failure' }, { color: 'var(--surface-3)', label: 'пропущена' }]));
      const failed = rows.some((r) => r.status === 'failed');
      const deploy = rows.find((r) => r.base === 'deploy-staging');
      U.clear(roBox);
      const ro = UI.readout(roBox, [{ key: 'st', label: 'Статус pipeline' }, { key: 't', label: 'Время' }, { key: 'g', label: 'Quality gate (слияние)' }, { key: 'd', label: 'Деплой' }]);
      const warn = rows.some((r) => r.status === 'allowed');
      ro.set('st', failed ? 'failed' : warn ? 'passed with warnings' : 'passed', failed ? 'bad-t' : warn ? 'warn-t' : 'ok-t');
      ro.set('t', U.fmt(total, 1) + ' мин');
      ro.set('g', failed ? 'закрыт' : 'открыт', failed ? 'bad-t' : 'ok-t');
      ro.set('d', deploy.status === 'success' ? 'выполнен' : 'пропущен', deploy.status === 'success' ? 'ok-t' : 'bad-t');
      U.clear(arts);
      arts.appendChild(el('div', { class: 'card-sub', text: 'Артефакты' }));
      const saved = rows.filter((r) => r.art && r.status !== 'skipped' && r.status !== undefined);
      arts.appendChild(el('ul', { class: 'pv-list' }, saved.length ? saved.map((r) => el('li', {}, [el('code', { text: r.id }), ' → ' + r.art + (r.status === 'failed' ? ' (сохранены благодаря when: always)' : '')])) : [el('li', { text: 'нет: тестовые задачи не выполнялись' })]));
      const m = [];
      if (s.fail === 'none') m.push(s.needs ? 'С needs тесты стартуют сразу после сборки образа, не дожидаясь lint и typecheck; merge-report — сразу после e2e.' : 'Все стадии выполнены по очереди. Включите граф needs и сравните время.');
      if (s.fail === 'lint') m.push(s.allow ? 'allow_failure: задача красная, но pipeline продолжается и считается успешным с предупреждением. Для линтера это обычно плохая идея: предупреждения перестают читать.' : (s.needs ? 'С needs тесты не зависят от lint и выполнились, но pipeline всё равно failed — ворота закрыты.' : 'Упал lint на первой стадии — следующие стадии пропущены: быстрый и дешёвый сигнал.'));
      if (s.fail === 'build-image') m.push('Без образа нечего тестировать: зависимые задачи пропущены. merge-report с when: always запускается, но объединять ему нечего.');
      if (s.fail === 'api-tests' || s.fail === 'e2e-tests') {
        if (s.retry && s.kind === 'flaky') m.push('retry: 1 перезапустил всю задачу, и она прошла: pipeline зелёный, но время задачи удвоилось, а нестабильность скрыта. Ретраи в самом Playwright дешевле (повторяется только упавший тест) и оставляют статус flaky в отчёте.');
        else if (s.retry) m.push('Перезапуск задачи не помогает при настоящем дефекте: время удвоилось, результат тот же.');
        else m.push(`Тестовая задача упала: деплой пропущен, ворота закрыты. Отчёты и trace сохранены (artifacts: when: always)${s.fail === 'e2e-tests' ? ', merge-report собрал общий отчёт из blob-отчётов всех шардов' : ''}.`);
      }
      if (s.shards > 1 && s.fail !== 'build-image') m.push(`e2e разделён на ${s.shards} ${U.plural(s.shards, 'шард', 'шарда', 'шардов')}: каждый тратит ~1,5 мин на подготовку, поэтому ускорение меньше, чем в ${s.shards} раза.`);
      sh.say(m.map((x) => `<p>${x}</p>`).join(''));
    }
    build();
  });

  /* ---------- Время, стоимость и обратная связь ---------- */
  Sim.register('optimization-calc', (root) => {
    const D = { n: 400, avg: 30, longest: 120, workers: 4, setup: 2, price: 5, shards: 2 };
    const s = Object.assign({}, D);
    const K = 1.1; // неравномерность распределения
    const sh = UI.shell(root, {
      title: 'Время прогона и стоимость в зависимости от числа шардов', icon: 'chart', kicker: 'Калькулятор', layout: 'side-left',
      help: 'Формулы из главы: время ≈ подготовка + max(самый долгий тест, сумма / (шарды × воркеры)) × 1,1; стоимость ≈ шарды × время × цена минуты агента.',
      onReset: () => { Object.assign(s, D); build(); },
      note: 'Коэффициент 1,1 учитывает неравномерное распределение тестов. Очередь ожидания агентов не учитывается: при нехватке агентов шарды стартуют не одновременно.',
    });
    const ctl = sh.col(), main = sh.col();
    const box = el('div', { class: 'ctl-stack' });
    ctl.appendChild(box);
    const charts = el('div', { class: 'oc-charts' });
    const roBox = el('div');
    main.append(roBox, charts);
    function build() {
      U.clear(box);
      const sl = (k, label, min, max, step, fmt) => UI.slider(box, { label, min, max, step, value: s[k], fmt, onInput: (v) => { s[k] = v; update(); } });
      sl('n', 'Тестов', 50, 3000, 50);
      sl('avg', 'Средняя длительность теста', 2, 120, 1, (v) => v + ' с');
      sl('longest', 'Самый долгий тест', 5, 900, 5, (v) => v + ' с');
      sl('workers', 'Воркеров на агенте', 1, 16, 1);
      sl('setup', 'Подготовка шарда', 0, 10, 0.5, (v) => U.fmt(v, 1) + ' мин');
      sl('price', 'Цена минуты агента', 0.5, 30, 0.5, (v) => U.fmt(v, 1) + ' ₽');
      sl('shards', 'Шардов', 1, 16, 1);
      update();
    }
    const timeOf = (sh) => s.setup + (Math.max(s.longest, (s.n * s.avg) / (sh * s.workers)) * K) / 60;
    const costOf = (sh) => sh * timeOf(sh) * s.price;
    function mini(title, f, fmt, color) {
      const W = 300, H = 170, l = 40, b = 24, t = 12, r = 8;
      const xs = Array.from({ length: 16 }, (_, i) => i + 1);
      const ys = xs.map(f);
      const maxY = Math.max(...ys) * 1.08;
      const x = (v) => l + ((v - 1) / 15) * (W - l - r);
      const y = (v) => H - b - (v / maxY) * (H - t - b);
      const svg = U.svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
      for (let k = 0; k <= 3; k++) { const v = (maxY * k) / 3; svg.appendChild(U.svg('line', { x1: l, x2: W - r, y1: y(v), y2: y(v), stroke: 'var(--border)' })); svg.appendChild(U.svg('text', { x: l - 4, y: y(v) + 4, 'text-anchor': 'end', class: 'p-muted', text: fmt(v) })); }
      [1, 4, 8, 12, 16].forEach((v) => svg.appendChild(U.svg('text', { x: x(v), y: H - 6, 'text-anchor': 'middle', class: 'p-muted', text: String(v) })));
      svg.appendChild(U.svg('path', { d: xs.map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5 }));
      svg.appendChild(U.svg('circle', { cx: x(s.shards), cy: y(f(s.shards)), r: 5.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }));
      return el('div', { class: 'oc-chart' }, [el('div', { class: 'card-sub', text: title }), svg]);
    }
    function update() {
      U.clear(charts);
      charts.append(mini('Время прогона, мин (по оси X — шарды)', timeOf, (v) => U.fmt(v, v < 10 ? 1 : 0), 'var(--accent)'), mini('Стоимость прогона, ₽', costOf, (v) => U.fmt(v), 'var(--violet)'));
      const t1 = timeOf(1), t = timeOf(s.shards);
      const floor = s.setup + (s.longest * K) / 60;
      U.clear(roBox);
      const ro = UI.readout(roBox, [{ key: 't', label: 'Время' }, { key: 'c', label: 'Стоимость' }, { key: 'sp', label: 'Ускорение к 1 шарду' }, { key: 'e', label: 'Эффективность шардов' }]);
      ro.set('t', U.fmt(t, 1) + ' мин');
      ro.set('c', U.fmt(costOf(s.shards)) + ' ₽');
      ro.set('sp', '×' + U.fmt(t1 / t, 1));
      ro.set('e', U.pct(t1 / t / s.shards));
      const limited = (s.n * s.avg) / (s.shards * s.workers) <= s.longest;
      sh.say(`<p>${limited ? `Время упёрлось в самый долгий тест (${s.longest} с) и подготовку: ниже ≈ ${U.fmt(floor, 1)} мин не опуститься, дополнительные шарды только добавляют стоимость. Ускорять нужно сам долгий тест.` : `При ${s.shards} ${U.plural(s.shards, 'шарде', 'шардах', 'шардах')} прогон занимает ${U.fmt(t, 1)} мин вместо ${U.fmt(t1, 1)}; стоимость ${costOf(s.shards) > costOf(1) * 1.05 ? 'растёт' : 'почти не меняется'}, потому что каждый шард платит за подготовку (${U.fmt(s.setup, 1)} мин).`} Сокращение средней длительности теста уменьшает и время, и стоимость одновременно — в отличие от добавления шардов.</p>`);
    }
    build();
  });

  /* ---------- Flaky Test Debugger ---------- */
  const CAUSES = [
    ['race', 'Race condition в тесте'],
    ['order', 'Зависимость от порядка тестов'],
    ['data', 'Общие тестовые данные'],
    ['time', 'Время и часовой пояс'],
    ['env', 'Нестабильное окружение'],
    ['product', 'Дефект продукта'],
  ];
  const CASES = [
    {
      title: 'Количество в корзине',
      code: "test('увеличение количества', async ({ page }) => {\n  await page.goto('/cart');\n  await page.getByRole('button', { name: 'Увеличить количество' }).click();\n  const qty = await page.getByTestId('qty').textContent();\n  expect(qty).toBe('2');\n});",
      history: 'PPFPPPFPPFPPPPFPPPPP', hist: 'Локально проходит всегда, в CI падает примерно в каждом пятом прогоне.',
      log: "Error: expect(received).toBe(expected)\n\nExpected: \"2\"\nReceived: \"1\"\n\n  at tests/cart.spec.ts:6:15",
      trace: 'Trace упавшей попытки: click → textContent() через 3 мс → POST /api/cart/items отвечает через 180 мс → счётчик становится «2».',
      answer: 'race',
      why: 'Тест читает значение один раз сразу после клика и не ждёт ответа сервера. На быстрой машине ответ успевает, на загруженном агенте CI — нет. Это гонка в тесте, а не в продукте: интерфейс корректно обновляется через 180 мс.',
      fix: "await page.getByRole('button', { name: 'Увеличить количество' }).click();\nawait expect(page.getByTestId('qty')).toHaveText('2');   // web-first: повторяет до таймаута",
    },
    {
      title: 'Оформление заказа',
      code: "let orderId: number;\n\ntest('создание заказа', async ({ request }) => {\n  const res = await request.post('/api/orders', { data: { items: [{ productId: 1, qty: 1 }] } });\n  orderId = (await res.json()).id;\n});\n\ntest('оплата заказа', async ({ request }) => {\n  const res = await request.post(`/api/orders/${orderId}/pay`, { data: { cardToken: 'tok_visa' } });\n  expect(res.status()).toBe(200);\n});",
      history: 'PPPPPPPFPPPPPPPPFPPP', hist: 'Падает «оплата заказа»: при запуске с --grep "оплата", на ретрае и после включения fullyParallel.',
      log: 'Error: expect(received).toBe(expected)\n\nExpected: 200\nReceived: 404\n\n  request: POST /api/orders/undefined/pay',
      trace: 'В упавшей попытке тест «оплата заказа» выполнялся в новом воркере (retry #1) — первый тест в этом процессе не запускался.',
      answer: 'order',
      why: 'Второй тест использует переменную модуля, которую заполняет первый. При запуске отдельно, на ретрае (новый воркер) или параллельно переменная не определена — запрос уходит на /orders/undefined.',
      fix: "test('оплата заказа', async ({ request, createdOrder }) => {   // фикстура создаёт заказ для этого теста\n  const res = await request.post(`/api/orders/${createdOrder.id}/pay`, { data: { cardToken: 'tok_visa' } });\n  expect(res.status()).toBe(200);\n});",
    },
    {
      title: 'Регистрация',
      code: "test('регистрация нового пользователя', async ({ page }) => {\n  await page.goto('/register');\n  await page.getByLabel('Email').fill('qa-autotest@example.com');\n  await page.getByLabel('Пароль').fill('Str0ngPass!');\n  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();\n  await expect(page.getByRole('heading')).toHaveText('Добро пожаловать');\n});",
      history: 'PFFFFFFFFFFFFFFFFFFF', hist: 'Прошёл один раз после очистки стенда, с тех пор падает. Иногда «чинится» после ручного удаления пользователя.',
      log: "Error: expect(locator).toHaveText(expected) failed\n\nLocator:  getByRole('heading')\nExpected: \"Добро пожаловать\"\nReceived: \"Регистрация\"\n\nNetwork: POST /api/register → 409 {\"code\":\"EMAIL_TAKEN\"}",
      trace: 'После клика форма показывает «Этот email уже зарегистрирован».',
      answer: 'data',
      why: 'Фиксированный email: после первого успешного прогона пользователь уже существует, и следующие прогоны получают 409. В параллельных прогонах (MR и main одновременно) тесты мешают друг другу так же.',
      fix: "const email = `autotest-reg-${Date.now()}-${test.info().parallelIndex}@example.com`;\nawait page.getByLabel('Email').fill(email);\n// + удалить пользователя в teardown фикстуры",
    },
    {
      title: 'Дата доставки',
      code: "test('курьер привезёт завтра', async ({ page }) => {\n  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);\n  await page.goto('/checkout');\n  await expect(page.getByTestId('delivery-date')).toHaveAttribute('datetime', tomorrow);\n});",
      history: 'PPPPPPPPPPPPPPPPFFFP', hist: 'Ночной прогон в 02:30 по Москве падает, дневные прогоны проходят. Локально у разработчика из Новосибирска падал утром.',
      log: "Error: expect(locator).toHaveAttribute(expected) failed\n\nExpected: \"2025-10-06\"\nReceived: \"2025-10-07\"",
      trace: 'Агент CI работает в UTC (23:30 5 октября), приложение считает дату по Москве (02:30 6 октября).',
      answer: 'time',
      why: 'Ожидаемое значение вычисляется в часовом поясе агента (UTC), а приложение — в часовом поясе магазина. Около полуночи даты расходятся на сутки.',
      fix: "test.use({ timezoneId: 'Europe/Moscow' });\n\ntest('курьер привезёт завтра', async ({ page }) => {\n  await page.clock.setFixedTime(new Date('2025-10-06T10:00:00+03:00'));   // фиксированное «сейчас»\n  await page.goto('/checkout');\n  await expect(page.getByTestId('delivery-date')).toHaveAttribute('datetime', '2025-10-07');\n});",
    },
    {
      title: 'Массовое падение',
      code: "// 37 разных тестов из api/ и ui/ упали в одном прогоне",
      history: 'PPPPPPPPPPFPPPPPPPPP', hist: 'Один красный прогон за две недели: 37 тестов разом. Перезапуск pipeline через 10 минут — зелёный.',
      log: "14:05:12  POST /api/orders → 502 Bad Gateway\n14:05:13  GET /catalog → net::ERR_CONNECTION_RESET\n14:05:40  GET /api/health → 503 Service Unavailable\n14:06:55  GET /api/health → 200",
      trace: 'Журнал деплоев: в 14:04 на staging начался деплой новой версии app.',
      answer: 'env',
      why: 'Одновременное падение многих несвязанных тестов с 502/503 в узком окне времени — признак проблемы окружения, а не тестов: прогон совпал с деплоем на общий стенд. Исправлять тесты бесполезно.',
      fix: "# В pipeline: проверка готовности перед тестами и блокировка стенда на время прогона\nnpx wait-on --timeout 120000 https://staging.shop.example.com/api/health\n# или эфемерное окружение на каждый прогон",
    },
    {
      title: 'Двойная оплата',
      code: "test('повторный клик не создаёт второй платёж', async ({ page, ordersApi, createdOrder }) => {\n  await page.goto(`/orders/${createdOrder.id}/pay`);\n  const pay = page.getByRole('button', { name: 'Оплатить' });\n  await pay.click();\n  await pay.click({ force: true });   // имитация двойного клика\n  await expect(page.getByText('Оплачено')).toBeVisible();\n  expect((await ordersApi.payments(createdOrder.id)).length).toBe(1);\n});",
      history: 'PPPPFPPPPPPPFPPPPPPP', hist: 'Падает примерно в 10% прогонов на любом агенте, в том числе при запуске одного теста с --repeat-each=50.',
      log: 'Error: expect(received).toBe(expected)\n\nExpected: 1\nReceived: 2',
      trace: 'Network упавшей попытки: два POST /api/orders/105/pay с разницей 40 мс, оба 200. В успешных попытках второй запрос получает 409.',
      answer: 'product',
      why: 'Тест проверяет правильную вещь и делает это корректно: ожидание web-first, свой заказ, нет общих данных. Двойной платёж при быстром повторном запросе — гонка в самом приложении (нет блокировки или ключа идемпотентности). Это дефект, тест нашёл его.',
      fix: '# Не «чинить» тест ретраями. Завести дефект с trace и шагами:\n#   два запроса /pay с интервалом < 50 мс → два платежа.\n# Предложение: Idempotency-Key на оплату и блокировка кнопки после первого клика.',
    },
  ];
  Sim.register('flaky-debugger', (root) => {
    let ci = 0, answered = null;
    const sh = UI.shell(root, {
      title: 'Flaky Test Debugger', icon: 'bug', kicker: 'Тренажёр', layout: 'one',
      help: 'Шесть учебных расследований. Изучите код, историю запусков, лог и фрагмент trace, затем выберите наиболее вероятную причину.',
      onReset: () => { ci = 0; answered = null; draw(); },
      note: 'Ситуации учебные, но собраны из типичных причин нестабильности. История: P — прошёл, F — упал, слева направо от старых к новым.',
    });
    const col = sh.col();
    const nav = el('div', { class: 'fd-nav' });
    const body = el('div', { class: 'fd-body' });
    const opts = el('div', { class: 'tr-opts' });
    const fix = el('div');
    col.append(nav, body, el('div', { class: 'card-sub', text: 'Наиболее вероятная причина' }), opts, fix);
    function draw() {
      const c = CASES[ci];
      U.clear(nav);
      CASES.forEach((x, i) => { const b = UI.button(nav, { label: `${i + 1}. ${x.title}`, cls: i === ci ? 'is-on' : '', onClick: () => { ci = i; answered = null; draw(); } }); b.setAttribute('aria-pressed', String(i === ci)); });
      U.clear(body);
      const hist = el('div', { class: 'fd-hist', 'aria-label': 'История запусков: ' + c.history }, [...c.history].map((h) => el('span', { class: 'fd-run ' + (h === 'P' ? 'ok' : 'bad'), text: h === 'P' ? '✓' : '✕' })));
      body.append(
        el('div', { class: 'fd-grid' }, [
          el('div', {}, [el('div', { class: 'card-sub', text: 'Код теста' }), el('pre', { class: 'out-box', html: U.hl(c.code, 'ts') })]),
          el('div', {}, [el('div', { class: 'card-sub', text: 'История последних 20 запусков' }), hist, el('p', { class: 'muted-t fd-p', text: c.hist }), el('div', { class: 'card-sub', text: 'Ошибка / лог' }), el('pre', { class: 'out-box sql-err', text: c.log }), el('div', { class: 'card-sub', text: 'Trace и контекст' }), el('p', { class: 'fd-p', text: c.trace })]),
        ]),
      );
      U.clear(opts);
      CAUSES.forEach(([k, l]) => { const b = UI.button(opts, { label: l, cls: answered ? (k === c.answer ? 'is-right' : k === answered ? 'is-wrong' : '') : '', onClick: () => { answered = k; draw(); } }); b.setAttribute('aria-pressed', String(answered === k)); });
      U.clear(fix);
      if (answered) fix.append(el('div', { class: 'card-sub', text: 'Исправление' }), el('pre', { class: 'out-box', html: U.hl(c.fix, /^#/.test(c.fix) ? 'yaml' : 'ts') }));
      sh.say(answered ? `<p><b>${answered === c.answer ? 'Верно.' : `Не совсем: правильный ответ — «${CAUSES.find((x) => x[0] === c.answer)[1]}».`}</b> ${c.why}</p>` : '<p>Обратите внимание на закономерность в истории: где и когда тест падает. Она часто сужает круг причин сильнее, чем текст ошибки.</p>');
    }
    draw();
  });
})();

;
