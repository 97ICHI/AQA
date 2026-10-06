# -*- coding: utf-8 -*-
"""Новые и полностью переписанные тексты v3 (введение, первый запуск, справочная глава)."""

ICO = lambda body: f'<svg class="ico" viewbox="0 0 24 24" aria-hidden="true" focusable="false">{body}</svg>'
I_CLOCK = ICO('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5l3 2"></path>')
I_INFO = ICO('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 11v5M12 8h.01"></path>')
I_BULB = ICO('<path d="M9 18h6M10 21h4"></path><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"></path>')
I_CHECK = ICO('<path d="M5 12.5l4.5 4.5L19 7"></path>')

READ_BTN = f'<button type="button" class="btn-read" data-read-toggle aria-pressed="false">{I_CHECK}<span>Отметить как изученную</span></button>'


def code(lang, text, title=None):
    t = f'<span class="code-title">{title}</span>' if title else ''
    return (f'<div class="code"><div class="code-head"><span class="code-lang">{lang}</span>{t}'
            f'<button type="button" class="code-copy" aria-label="Скопировать код">Копировать</button></div>'
            f'<pre><code>{text}</code></pre></div>')


def callout(kind, title, body, icon=I_INFO):
    return (f'<div class="callout c-{kind}"><div class="callout-head">{icon}<span>{title}</span></div>'
            f'<div class="callout-body">{body}</div></div>')


def h2(cid, anchor, title):
    return (f'<h2 id="/{cid}/{anchor}" data-anchor="{anchor}">{title}'
            f'<a class="h-anchor" href="#/{cid}/{anchor}" aria-label="Ссылка на раздел">#</a></h2>')


def recall(core, points, caution=None, links=None, terms=None):
    pts = ''.join(f'<li>{p}</li>' for p in points)
    tm = ''
    if terms:
        tm = '<h3>Термины</h3><dl class="recall-terms">' + ''.join(f'<div><dt>{a}</dt><dd>{b}</dd></div>' for a, b in terms) + '</dl>'
    ca = f'<p class="recall-caution"><strong>Частая ошибка:</strong> {caution}</p>' if caution else ''
    return (f'<section class="recall" aria-label="Кратко о главе"><h2>Кратко</h2><p class="recall-core">{core}</p>'
            f'<h3>Главное</h3><ul class="recall-points">{pts}</ul>{tm}{ca}<div class="recall-links"></div></section>')


def article(cid, section, kicker, title, lead, meta_min, prose, prev, nxt, rcl=None):
    """Каркас главы без «Основной идеи». toc и recall-links заполняются Chap.regen_toc()."""
    meta = f'<span>{I_CLOCK}≈ {meta_min} мин чтения</span>' if meta_min else ''
    rc = rcl or ''
    src = ('<div class="src-bar"><button type="button" class="btn btn-sm" data-src-toggle aria-expanded="false">'
           '<span>Открыть полный материал</span></button></div>') if rcl else ''
    foot_prev = (f'<a class="foot-link prev" href="#/{prev[0]}"><small>← Назад</small><span>{prev[1]}</span></a>' if prev else '<span></span>')
    foot_next = (f'<a class="foot-link next" href="#/{nxt[0]}"><small>Дальше →</small><span>{nxt[1]}</span></a>' if nxt else '')
    return (f'<article class="chapter" id="/{cid}" data-chapter="{cid}" data-section="{section}" aria-labelledby="h1-{cid}">'
            f'<header class="ch-head no-idea"><div class="ch-head-main"><div class="ch-kicker">{kicker}</div>'
            f'<h1 class="ch-title" id="h1-{cid}" tabindex="-1">{title}</h1><p class="ch-lead">{lead}</p>'
            f'<div class="ch-meta">{meta}{READ_BTN if rcl else ""}</div></div></header>{rc}{src}'
            f'<nav class="ch-toc" aria-label="Содержание главы"><div class="ch-toc-label">В этой главе</div></nav>'
            f'<div class="prose">{prose}</div>'
            f'<footer class="ch-foot"><div class="ch-foot-nav">{foot_prev}{foot_next}</div></footer></article>')


# ------------------------------------------------------------------ ВВЕДЕНИЕ
def intro_prose(topics_nav):
    return (
        h2('intro', 'map', 'Что внутри')
        + '<p>AQA Lab ведёт от первой автоматической проверки к системе автоматизации: тестирование и тест-дизайн, TypeScript, веб и HTTP, SQL, '
          'Playwright для UI и API, архитектура проекта, Docker и CI/CD. Каждая глава опирается на предыдущие, но любую можно открыть отдельно: '
          'в шапке указано, что стоит прочитать до неё.</p>'
        + topics_nav
        + h2('intro', 'how', 'Как читать')
        + '<p>Режим <strong>«Разобраться»</strong> — полный текст главы: механизм, пример, типичные ошибки, вопросы собеседования и самопроверка. '
          'Режим <strong>«Кратко»</strong> нужен для повторения: основная мысль, ключевые правила и одна частая ошибка. Кнопка «Открыть полный материал» '
          'разворачивает главу, не меняя режим.</p>'
        + '<p>Профессиональные термины написаны по-английски, как в рабочей документации. Слова с пунктирным подчёркиванием можно навести курсором, '
          'выбрать с клавиатуры или коснуться — появятся перевод и определение, например у слов Locator, Assertion и Flaky Test. Каждый термин подчёркнут один раз в разделе, где он впервые встречается; '
          'все определения собраны в <a href="#/glossary">глоссарии</a>.</p>'
        + callout('key', 'Клавиши',
                  '<p><kbd>Ctrl</kbd> + <kbd>K</kbd> или <kbd>/</kbd> — поиск, <kbd>[</kbd> и <kbd>]</kbd> — предыдущая и следующая глава, '
                  '<kbd>Esc</kbd> — закрыть подсказку или меню. Отметки «изучено», ответы на тесты и настройки хранятся только в этом браузере.</p>', I_BULB)
        + h2('intro', 'stack', 'Основной стек')
        + '<p>Основной поток написан на одном стеке: <strong>TypeScript</strong>, <strong>Playwright Test</strong> и <strong>Node.js</strong>; '
          'вокруг него — REST API, PostgreSQL, Git, Docker и CI/CD. Другие языки и инструменты вынесены в главу <a href="#/alt-stacks">«Альтернативные стеки»</a>, '
          'включая отдельное дополнение для Python backend.</p>'
        + '<div class="stack-list"><span class="main">TypeScript</span><span class="main">Playwright Test</span><span class="main">Node.js</span>'
          '<span>REST API</span><span>PostgreSQL</span><span>Git</span><span>Docker</span><span>GitHub Actions · GitLab CI</span><span>Allure Report</span><span>Linux</span></div>'
        + '<p>К учебнику прилагается небольшой проект с настоящим локальным API и формой: его можно скачать в главе <a href="#/first-run/starter">«Первый запуск»</a> '
          'и использовать для практики.</p>'
        + h2('intro', 'routes', 'Маршруты по уровню')
        + '<div class="table-wrap"><table><thead><tr><th>Цель</th><th>Что читать</th></tr></thead><tbody>'
          '<tr><td>С нуля</td><td><a href="#/first-run">Первый запуск</a>, затем разделы I–III по порядку</td></tr>'
          '<tr><td>Junior: первые автотесты</td><td>Разделы I–III, затем <a href="#/locators">Locators</a>, <a href="#/assertions">Assertions</a>, '
          '<a href="#/fixtures">Fixtures</a>, <a href="#/api-basics">основы API Testing</a></td></tr>'
          '<tr><td>Junior → Middle: поддерживаемый проект</td><td><a href="#/pom">Page Object Model</a>, <a href="#/pw-advanced">продвинутый Playwright</a>, '
          'разделы V и VI</td></tr>'
          '<tr><td>Middle → Middle+: система автоматизации</td><td>Раздел VII, <a href="#/aqa-design">AQA System Design</a>, '
          '<a href="#/contracts">Contract Testing</a>, <a href="#/optimization">оптимизация</a></td></tr>'
          '<tr><td>Подготовка к собеседованию</td><td>Режим «Кратко» по всем главам и <a href="#/interview">вопросы по уровням</a></td></tr>'
          '</tbody></table></div>'
        + '<p>Отметка «изучено» фиксирует чтение главы. Самостоятельный уровень подтверждается решёнными задачами и ревью — для этого есть глава '
          '<a href="#/competence">«Практика Junior → Middle+»</a>.</p>'
        + h2('intro', 'limits', 'Границы учебника')
        + '<p>Интерактивы работают на небольших учебных данных и упрощённых моделях; каждый из них подписан, что именно моделирует. Учебник не заменяет практику: '
          'важные навыки появляются, когда вы пишете и чините тесты в настоящем проекте. Версии, источники и список выполненных проверок собраны на странице '
          '<a href="#/about">«О учебнике»</a>. Открытие и чтение не требуют интернета; установка инструментов и внешние ссылки — требуют. '
          'На телефоне нужен браузер или просмотрщик, который исполняет JavaScript локального HTML-файла.</p>'
    )


# ------------------------------------------------------------------ ПЕРВЫЙ ЗАПУСК
FIRST_RECALL = recall(
    'Один рабочий цикл: запустить учебный магазин, прогнать проверки, намеренно сломать одну и прочитать падение.',
    ['Нужны Node.js 22+ и терминал; браузер для Playwright ставится одной командой.',
     '<code>node --test tests/api.node.test.mjs</code> проверяет настоящий API без внешних зависимостей; <code>node server.mjs</code> запускает магазин на порту 3000.',
     '<code>npm ci</code> ставит ровно те версии, что записаны в <code>package-lock.json</code>; <code>npm test</code> сам поднимает сервер через <code>webServer</code>.',
     'Падение читают сверху вниз: первая ошибка, <code>Expected</code> / <code>Received</code>, строка кода, затем report и trace.',
     'Сначала ломают ожидание теста, потом поведение приложения — так видно, что тест ловит реальный дефект.'],
    'править ожидание «до зелёного», не выяснив, ошибся тест или приложение.',
)


def first_run_prose():
    return (
        callout('note', 'Если слова пока незнакомы',
                '<p>TypeScript, Playwright, API и остальное объясняются в следующих главах. Здесь цель другая: увидеть полный цикл '
                '«запуск → проверка → падение → диагностика» на маленьком работающем проекте и вернуться к нему с теорией.</p>')
        + h2('first-run', 'environment', 'Что понадобится')
        + '<p>Установите актуальную LTS-версию Node.js (проекту нужна 22 или новее) и любой редактор кода. Команды выполняются в терминале: '
          'в Windows — PowerShell или терминал редактора, не консоль Python. Git для первого запуска не нужен, он пригодится в <a href="#/git-linux">главе 12</a>.</p>'
        + code('Terminal', 'node --version\nnpm --version')
        + '<p>Каждая команда должна напечатать номер версии. Если команда не найдена, проверьте установку и переменную <code>PATH</code>, затем откройте '
          'новый терминал. Установка инструментов и зависимостей требует интернета, сам учебник открывается без него.</p>'
        + h2('first-run', 'starter', 'Запустить учебный магазин')
        + '<p>Скачайте архив, распакуйте его и откройте терминал в папке <code>aqa-lab-starter</code>. Это отдельное приложение: интерактивы учебника '
          'не запускают настоящий сервер.</p>'
        + '<p><a class="btn btn-primary" download="AQA_Lab_starter.zip" href="__ZIP__">Скачать учебный проект</a></p>'
        + code('Terminal', 'node --test tests/api.node.test.mjs\nnode server.mjs')
        + '<p>Первая команда запускает сервер на свободном порту, проверяет API и завершается; в конце вывода должно быть <code># pass 1</code> и <code># fail 0</code>. '
          'Вторая запускает магазин: откройте <code>http://localhost:3000</code>, оформите заказ с количеством 2 — появится «Заказ создан: 2000 ₽». '
          'Остановить сервер — <kbd>Ctrl</kbd> + <kbd>C</kbd>; данные хранятся в памяти и исчезают при остановке.</p>'
        + '<p>Если порт 3000 занят, остановите процесс, который его использует: тесты ниже ждут именно этот адрес. Ошибка <code>ECONNREFUSED</code> '
          'обычно означает, что по этому адресу никто не слушает. Не держите сервер запущенным вручную, когда запускаете Playwright: он стартует свой экземпляр.</p>'
        + h2('first-run', 'playwright', 'Первый Playwright-тест')
        + code('Terminal', 'npm ci\nnpx playwright install chromium\nnpm run lint\nnpm run typecheck\nnpm test')
        + '<ul><li><code>npm ci</code> устанавливает зависимости строго по <code>package-lock.json</code> — результат воспроизводится на любой машине;</li>'
          '<li><code>npx playwright install chromium</code> скачивает браузер, которым управляет Playwright;</li>'
          '<li><code>lint</code> и <code>typecheck</code> находят ошибки в коде тестов до запуска;</li>'
          '<li><code>npm test</code> запускает Playwright: он сам поднимает сервер (<code>webServer</code> в <code>playwright.config.ts</code>), открывает форму в браузере, '
          'проверяет HTTP-ответ, сумму и сохранённый заказ, а затем удаляет созданные данные.</li></ul>'
        + '<p>Ожидаемый итог — <code>2 passed</code>. HTML-отчёт открывается командой <code>npx playwright show-report</code>. '
          'Команда <code>npm run report:allure</code> дополнительно строит отчёт Allure; для неё нужна Java.</p>'
        + '<p>Версии зависимостей закреплены (в том числе Playwright Test 1.58.2) ради воспроизводимости — это не утверждение, что версия самая новая. '
          'Перед обновлением читайте release notes; подробности — на странице <a href="#/about/tools">«О учебнике»</a>. '
          'Если браузер не запускается из-за системных библиотек, на Linux поможет <code>npx playwright install --with-deps chromium</code>.</p>'
        + h2('first-run', 'failure', 'Сломать тест и прочитать падение')
        + '<ol><li>Откройте <code>tests/shop.spec.ts</code> и в строке <code>expect(body.total).toBe(2000)</code> замените 2000 на 1999.</li>'
          '<li>Запустите <code>npm test</code>. Тест должен упасть.</li>'
          '<li>Найдите первую ошибку в выводе и сравните <code>Expected</code> и <code>Received</code>.</li>'
          '<li>Откройте отчёт: <code>npx playwright show-report</code> — там снимок экрана и trace упавшего теста.</li>'
          '<li>Верните 2000 и убедитесь, что тест снова зелёный.</li></ol>'
        + code('Текст', 'Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: 1999\nReceived: 2000\n\n'
                       '  13 |     id = body.id;\n  14 |     expect(response.status()).toBe(201);\n> 15 |     expect(body.total).toBe(1999);')
        + '<p>Теперь сломайте приложение, а не тест: в <code>server.mjs</code> замените <code>body.quantity * 1000</code> на <code>body.quantity * 1001</code>. '
          'Тесты должны упасть — значит, они действительно обнаруживают ошибку расчёта. Верните исходный код. Разница важна: тест, который остаётся зелёным при сломанном '
          'приложении, бесполезен, а тест, который падает без причины, отнимает время.</p>'
        + '<p>Если процесс убить во время теста, очистка данных может не выполниться; перезапуск учебного сервера очищает память.</p>'
        + h2('first-run', 'limits', 'Что умеет проект и что дальше')
        + '<p>Сервер поддерживает <code>GET /ready</code>, <code>POST /api/orders</code>, <code>GET</code> и <code>DELETE /api/orders/:id</code>. Количество — целое число '
          'от 1 до 10, сумма равна количеству × 1000. Некорректный JSON даёт 400, недопустимое количество — 422, отсутствующий заказ — 404; '
          '<code>DELETE</code> отвечает 204 и при повторе. Это учебная модель: без базы данных, оплаты и авторизации.</p>'
        + '<p>Что где разбирается: Promise и <code>await</code> — <a href="#/async">глава 6</a>, HTTP-коды — <a href="#/http-rest">глава 10</a>, '
          'локаторы — <a href="#/locators">глава 14</a>, проверки и ожидания — <a href="#/assertions">глава 15</a>, фикстуры и очистка — '
          '<a href="#/fixtures">глава 16</a>, Docker и CI — <a href="#/docker">главы 27</a> и <a href="#/cicd">28</a>. Задания для самостоятельной работы собраны в README архива '
          'и в главе <a href="#/competence">«Практика Junior → Middle+»</a>.</p>'
    )


# ------------------------------------------------------------------ О УЧЕБНИКЕ
def about_prose(checks_rows, tools_rows):
    chk = ''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>' for a, b, c in checks_rows)
    tl = ''.join(f'<tr><td><code>{a}</code></td><td>{b}</td></tr>' for a, b in tools_rows)
    return (
        h2('about', 'version', 'Версия и история')
        + '<p>Текущая версия — <strong>3.0</strong> (сборка от 5 октября 2026). Это один HTML-файл: содержание, поиск, глоссарий, интерактивы и учебный проект '
          'находятся внутри него.</p>'
          '<ul><li><strong>2.0</strong> — к основному курсу добавлены «Первый запуск» с учебным проектом, рабочее окружение, практика Junior → Middle+, дополнение для Python backend.</li>'
          '<li><strong>3.0</strong> — редактура и переработка: добавления версии 2.0 встроены в логику глав, подсказки терминов стали реже и перестали портить код '
          'и команды, исправлена таблица actionability, единая дизайн-система и мобильная вёрстка шапок глав, переписаны введение, «Первый запуск» и учебный проект.</li></ul>'
        + h2('about', 'tools', 'Версии инструментов')
        + '<p>Учебный проект собран на закреплённых версиях: их фиксирует <code>package-lock.json</code>, поэтому <code>npm ci</code> даёт один и тот же результат.</p>'
        + f'<div class="table-wrap"><table><thead><tr><th>Инструмент</th><th>Версия в проекте</th></tr></thead><tbody>{tl}</tbody></table></div>'
        + '<p>Закреплённая версия — не «последняя». На дату сборки реестр npm публиковал более новые релизы (например, Playwright 1.63.0 и TypeScript 7.0.2). '
          'Обновление — отдельная задача: прочитайте release notes, поднимите версии вместе с lockfile, прогоните тесты, при необходимости обновите браузеры '
          'командой <code>npx playwright install</code>. Для нового проекта выбирайте поддерживаемую LTS-версию Node.js.</p>'
        + h2('about', 'checks', 'Что проверялось в этой сборке')
        + '<p>Ниже — то, что действительно выполнялось при подготовке версии 3.0, и границы каждой проверки.</p>'
        + f'<div class="table-wrap"><table><thead><tr><th>Проверка</th><th>Результат</th><th>Граница</th></tr></thead><tbody>{chk}</tbody></table></div>'
        + h2('about', 'limits', 'Ограничения')
        + '<ul><li>Docker, Docker Compose и GitHub Actions workflow в этой сборке <strong>не запускались</strong>: в среде подготовки не было Docker-демона и доступа к GitHub Actions. '
          'Файлы <code>Dockerfile</code>, <code>compose.yaml</code> и <code>.github/workflows/tests.yml</code> проверены чтением и разбором синтаксиса.</li>'
          '<li>Playwright-тесты проекта выполнялись в Chromium; Firefox, WebKit и реальные мобильные браузеры не проверялись. Вёрстка учебника проверялась в Chromium на нескольких '
          'ширинах экрана; поведение в конкретном мобильном просмотрщике локальных файлов зависит от самого просмотрщика.</li>'
          '<li>Фрагменты кода в главах — учебные примеры: часть из них неполная и требует приложения, фикстур или схемы БД. Выполнение каждого фрагмента не гарантируется.</li>'
          '<li>SQL Playground выполняет запросы учебным движком MiniSQL, а не PostgreSQL: поддерживается подмножество синтаксиса; например, группировка по номеру столбца '
          '(<code>GROUP BY 1</code>) и оконные функции не поддерживаются.</li>'
          '<li>Интерактивы — упрощённые модели с условными числами; они объясняют механизм и не заменяют измерений на вашем проекте.</li></ul>'
        + h2('about', 'sources', 'Источники')
        + '<p>Технические утверждения сверяются с официальной документацией. Ссылки ведут во внешний интернет и в этой сборке автоматически не проверялись.</p>'
          '<ul><li><a href="https://playwright.dev/docs/locators" target="_blank" rel="noopener">Playwright: Locators</a></li>'
          '<li><a href="https://playwright.dev/docs/actionability" target="_blank" rel="noopener">Playwright: Auto-waiting</a></li>'
          '<li><a href="https://playwright.dev/docs/test-fixtures" target="_blank" rel="noopener">Playwright: Fixtures</a></li>'
          '<li><a href="https://playwright.dev/docs/test-retries" target="_blank" rel="noopener">Playwright: Retries</a></li>'
          '<li><a href="https://www.rfc-editor.org/rfc/rfc9110.html" target="_blank" rel="noopener">RFC 9110: HTTP Semantics</a></li>'
          '<li><a href="https://docs.docker.com/compose/how-tos/startup-order/" target="_blank" rel="noopener">Docker: порядок запуска Compose</a></li>'
          '<li><a href="https://www.gnu.org/software/coreutils/manual/html_node/chmod-invocation.html" target="_blank" rel="noopener">GNU: chmod</a></li>'
          '<li><a href="https://man7.org/linux/man-pages/man1/ps.1.html" target="_blank" rel="noopener">Linux: ps</a></li></ul>'
    )
