# -*- coding: utf-8 -*-
import sys, os, re, json, html as H, collections
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import content as C
import terms as T
import assets as AS

OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/user/AQA/AQA_Lab_v3.html'
t = load()
m0, m1 = t.index('<main'), t.index('</main>')
head, main, tail = t[:m0], t[m0:m1], t[m1:]
starts = [m.start() for m in re.finditer(r'<article class="chapter" id="/', main)]
pre_main = main[:starts[0]]
chaps = collections.OrderedDict(); REC = {}
for i, a in enumerate(starts):
    chunk = main[a:(starts[i + 1] if i + 1 < len(starts) else len(main))]
    cid = re.match(r'<article class="chapter" id="/([^"]+)"', chunk).group(1)
    h, rec = strip_terms(chunk); chaps[cid] = Chap(cid, h); REC[cid] = rec
post_main = ''
LOG = []

# ============ 1. Исправление порчи регистра (код, команды, имена файлов) ============
TITLE_FIX = {'tests/order-Logging.spec.ts': 'tests/order-logging.spec.ts', 'tests/Locator-lazy.spec.ts': 'tests/locator-lazy.spec.ts',
             'tests/css-XPath.spec.ts': 'tests/css-xpath.spec.ts', 'tests/Worker-fixtures.ts': 'tests/worker-fixtures.ts',
             'tests/data/shipping-cases.JSON': 'tests/data/shipping-cases.json', 'package.JSON (фрагмент)': 'package.json (фрагмент)',
             'tests/fixtures/per-Worker-account.ts': 'tests/fixtures/per-worker-account.ts'}
TEXT_FIX = [
    (r'HTTPS://', 'https://'), (r'HTTP://', 'http://'),
    (r'await response\.JSON\(\)', '<code>await response.json()</code>'),
    (r'\bpackage-lock\.JSON\b', '<code>package-lock.json</code>'),
    (r'\bnpx Playwright show-report\b', '<code>npx playwright show-report</code>'),
    (r'\bnpx Playwright Test tests/cart --repeat-each=30 --workers=8 --retries=0', '<code>npx playwright test tests/cart --repeat-each=30 --workers=8 --retries=0</code>'),
    (r'eslint-plugin-Playwright', '<code>eslint-plugin-playwright</code>'),
    (r'pytest\+ Playwright', 'pytest + Playwright'),
    (r'\bpytest-Playwright\b', 'pytest-playwright'),
    (r'\bpytest\.Fixture\b', '<code>@pytest.fixture</code>'),
    (r'\bpytest-Fixture\b', 'fixture pytest'),
    (r"expect\(Page\.getByRole\('status'\)\)", "expect(page.getByRole('status'))"),
]


def fix_text(txt, stack):
    tags = [s[0] for s in stack]
    if any(x in ('pre', 'code', 'script', 'style') for x in tags): return txt
    if any('code-title' in s[1] for s in stack):
        return TITLE_FIX.get(txt, txt)
    for pat, rep in TEXT_FIX:
        txt = re.sub(pat, rep, txt)
    return txt


for c in chaps.values():
    c.h = walk(c.h, fix_text)
# хвост `npx playwright test tests/cart ...` : закрыть <code>
# (проверяется ниже: если открывающий <code> остался без пары, сборка падает)

# ============ 2. Нормализация мелочей разметки ============
for c in chaps.values():
    c.h = c.h.replace('<button type="button" class="code-copy">Копировать</button>', '<button type="button" class="code-copy" aria-label="Скопировать код">Копировать</button>')
    c.h = c.h.replace('<span class="toc-read" title="Изучено">✓</span>', '')

# ============ 3. Содержательные правки глав ============
c = chaps['assertions']
# fill/clear: Visible, Enabled, Editable (Stable и Receives Events не проверяются)
c.sub('<td><code>fill</code>, <code>clear</code></td>\n<td>✓</td>\n<td></td>\n<td>✓</td>\n<td>✓</td>\n<td>✓</td>',
      '<td><code>fill</code>, <code>clear</code></td>\n<td>✓</td>\n<td></td>\n<td></td>\n<td>✓</td>\n<td>✓</td>')

# --- aqa-intro
c = chaps['aqa-intro']
c.move('oracle-limits', 'goals')
# --- test-design
c = chaps['test-design']
c.move('defect-evidence', 'mistakes')
c.sub('<p>Требование: количество товара', '<p>Соберём всё вместе на примере учебного магазина из главы <a href="#/first-run">«Первый запуск»</a>. Требование: количество товара')
# --- async
c = chaps['async']
c.cut_sec('node-boundaries')
c.sub('<div class="sim-mount" data-sim="event-loop">',
      '<h3 id="/async/event-loop-node" data-anchor="event-loop-node">Event Loop в Node.js и в браузере</h3>'
      '<p>Тест Playwright выполняется в Node.js, а страница — в браузере: у них два независимых Event Loop. Схема «задача → микрозадачи → следующая задача» '
      'верна для обоих и достаточна для написания тестов. Но в Node.js цикл устроен сложнее: у него есть фазы (timers, poll, check и другие), а очередь '
      '<code>process.nextTick</code> обрабатывается раньше микрозадач Promise. Порядок <code>setTimeout(fn, 0)</code> и <code>setImmediate(fn)</code> в главном модуле '
      'не гарантирован, а внутри колбэка ввода-вывода <code>setImmediate</code> всегда срабатывает первым. Поэтому порядок в примерах выше — модель, а не закон для любой среды.</p>'
      '<div class="sim-mount" data-sim="event-loop">')
c.sub('<p>Где это полезно в тестах: подготовка независимых данных через API (<code>Promise.all</code> для создания трёх товаров), параллельные запросы в API-тестах, ожидание ответа одновременно с действием.</p>',
      '<p>Где это полезно в тестах: подготовка независимых данных через API (<code>Promise.all</code> для создания трёх товаров), параллельные запросы в API-тестах, ожидание ответа одновременно с действием.</p>'
      '<p><code>Promise.all</code> получает уже запущенные операции: они стартуют в момент вызова функций, а не внутри <code>all</code>. После первого отказа остальные операции '
      'продолжаются — <code>all</code> их не отменяет. Если вы создаёте несколько сущностей параллельно, учитывайте частично успешный результат и очищайте всё созданное: '
      '<code>allSettled</code> помогает собрать результаты, но сам ничего не удаляет.</p>')
# --- http-rest
c = chaps['http-rest']
c.move('protocol-corrections', 'pagination')
c.retitle('protocol-corrections', 'Распространённые заблуждения о HTTP')
c.sub('<p><strong>Безопасный</strong> метод не меняет состояние сервера. <strong>Идемпотентный</strong> — повтор того же запроса не меняет результат на сервере после первого выполнения.</p>',
      '<p><strong>Безопасный</strong> метод не предполагает, что клиент просит изменить состояние ресурса (журнал запросов на сервере при этом может вестись). '
      '<strong>Идемпотентный</strong> — несколько одинаковых запросов дают тот же предполагаемый эффект, что и один; коды ответов при этом могут отличаться. '
      'Подробнее — в разделе «Распространённые заблуждения о HTTP» ниже.</p>')
c.sub('<p>В старом PDF встречается сравнение GET/POST по числу TCP-пакетов и разрыву соединения. Это неверно:',
      '<p>Нередко GET и POST сравнивают по числу TCP-пакетов и разрыву соединения. Это неверно:')
c.sub('<p>Источник: <a href="https://www.rfc-editor.org/rfc/rfc9110.html" target="_blank" rel="noopener">RFC 9110, HTTP Semantics</a>.</p>',
      '<p>Первоисточник: <a href="https://www.rfc-editor.org/rfc/rfc9110.html" target="_blank" rel="noopener">RFC 9110, HTTP Semantics</a> (нужен интернет).</p>')
# --- sql
c = chaps['sql']
c.move('diagnostic-sql', 'example')
# --- git-linux
c = chaps['git-linux']
c.move('linux-diagnostics', 'example')
c.retitle('linux-diagnostics', 'Linux: права, процессы и логи на практике')
# --- locators
c = chaps['locators']
c.move('localization', 'example')
c.sub('<p>В PDF предлагается подобрать XPath и адаптировать элементы для ru, azb, it и ja. Переносим цель задания — устойчивость — на локальную форму. Accessible Name',
      '<p>Интерфейс на нескольких языках и изменчивая разметка — частые причины ложных падений. Нужны локаторы, устойчивые к переводу и к структуре DOM. Accessible Name')
c.sub('<p>Дополнительное задание: 14 элементов из PDF распределите на label, input, checkbox, button, link, image. Для каждого запишите XPath и пользовательский Locator, ожидаемое число совпадений и зависимость от локализации. Текущую разметку Wikipedia нужно проверять отдельно: скриншот не задаёт действующий DOM.</p>',
      '<p>Дополнительное задание: на любой странице с формой разберите до 14 элементов по типам (label, input, checkbox, button, link, image). Для каждого запишите XPath и пользовательский Locator, ожидаемое число совпадений и зависимость от локализации.</p>')
# --- fixtures
c = chaps['fixtures']
c.move('cleanup-limits', 'isolation')
c.retitle('cleanup-limits', 'Очистка не гарантирована: падения и частичный setup')
# --- api-basics
c = chaps['api-basics']
JWT = ('<p>JWT не обязательно зашифрован: payload обычно читается. Сервер должен проверять подпись, срок и необходимые claims. 401 означает проблему аутентификации; '
       '403 — отказ в доступе согласно контракту. Проверяйте доступ к чужим ресурсам, истёкший токен и недостаточную роль, а не только happy path.</p>')
c.sub(JWT, '')
c.sub('<h2 id="/api-basics/validation"', JWT.replace('JWT не обязательно', 'JWT не обязательно') + '<h2 id="/api-basics/validation"')
c.move('eventual', 'errors')
c.retitle('eventual', 'Асинхронные операции и повторные запросы')
# --- api-auto
c = chaps['api-auto']
c.move('layers', 'example')
c.retitle('layers', 'Слои API-тестового проекта')
c.sub('<p>Это интеграция плана Framework Back-End.pdf. Видео и приватная схема не предоставлены: описана общая архитектура, а не их дословное содержание. Helpers должны',
      '<p>Это общая схема, а не обязательное дерево папок. Helpers должны')
# --- mocking
c = chaps['mocking']
c.move('determinism', 'example')
# --- isolation: убрать дубль с mocking
c = chaps['isolation']
c.sub('<h2 id="/isolation/determinism" data-anchor="determinism">Детерминированность<a class="h-anchor" href="#/isolation/determinism" aria-label="Ссылка на раздел">#</a></h2>',
      '<h2 id="/isolation/determinism" data-anchor="determinism">Детерминированность<a class="h-anchor" href="#/isolation/determinism" aria-label="Ссылка на раздел">#</a></h2>'
      '<p>Источники недетерминированности и способы их контроля разобраны в главе <a href="#/mocking/determinism">«Mocking и Test Data»</a>. Для набора в целом полезен чек-лист:</p>')
# --- reporting
c = chaps['reporting']
c.move('triage-workflow', 'example')
# --- docker
c = chaps['docker']
c.move('readiness-network', 'run-modes')
c.sub('. Это исправляет запись &lt;container_id&gt; в примере docker run из PDF.</p>', '. В <code>docker run</code> указывают образ, а не идентификатор контейнера.</p>')
c.sub('<p>Источник: <a href="https://docs.docker.com/compose/how-tos/startup-order/" target="_blank" rel="noopener">Docker: порядок запуска Compose</a>.</p>',
      '<p>Первоисточник: <a href="https://docs.docker.com/compose/how-tos/startup-order/" target="_blank" rel="noopener">Docker: порядок запуска Compose</a> (нужен интернет).</p>')
# --- cicd
c = chaps['cicd']
c.move('pr-pipeline', 'example')
c.sub('<p>Задание CI-CD.pdf переносим на основной стек: линтер для TypeScript, typecheck, Compose, Readiness, тесты и отчёт. Ruff предназначен для Python и относится к дополнительному Backend-маршруту.</p>',
      '<p>Типичный конвейер проверки pull request для TypeScript-проекта: линтер, typecheck, окружение через Compose с проверкой Readiness, тесты и отчёт. '
      'Ruff — линтер для Python и относится к дополнительному <a href="#/alt-stacks/python-backend">Python-маршруту</a>.</p>')
c.sub_re(r'<p>Приложенный starter содержит GitHub Actions workflow: [^<]*</p>',
         '<p>Учебный проект из главы <a href="#/first-run/starter">«Первый запуск»</a> содержит такой workflow для GitHub Actions: ESLint, typecheck, Compose, тесты, генерация Allure, '
         'артефакты с условием <code>always()</code>, логи и cleanup. Его запуск в GitHub в этом учебнике не проверялся — см. <a href="#/about/limits">«О учебнике»</a>.</p>')
c.sub('<p>В starter включён', '<p>В учебный проект включён')
# --- flaky
c = chaps['flaky']
c.move('metrics-defined', 'example')
# --- alt-stacks
c = chaps['alt-stacks']
c.move('python-backend', 'choose')
c.retitle('python-backend', 'Python backend: те же идеи, другие инструменты')
c.sub('<p>Этот маршрут переносит темы Requests, typing, decorators, Pydantic, Ruff и Allure из Framework Back-End.pdf. Основной TypeScript-маршрут остаётся самодостаточным.</p>',
      '<p>Этот маршрут показывает, как те же идеи — клиент API, типы, runtime validation, линтер и отчёт — выглядят в Python (Requests, Pydantic, Ruff, Allure). '
      'Основной TypeScript-маршрут от него не зависит.</p>')
# --- workstation-tech
c = chaps['workstation-tech']
c.sub('<div class="ch-kicker">Маршрут V2</div>', '<div class="ch-kicker">Раздел III · Дополнение</div>')
c.sub('Узкие административные темы вынесены в справочник.</p>', 'Узкие административные темы собраны в конце в одну таблицу.</p>')
c.retitle('specializations', 'Администрирование: когда углубляться')
c.sub('<p>Эти специализации не являются универсальным экзаменом на Middle AQA. Все группы исходной технической матрицы учтены, но подробное администрирование зависит от проекта. Старые инструкции по браузерам, сети и ОС нельзя переносить без проверки актуальности.</p>',
      '<p>Эти темы не обязательны для каждого Middle AQA: глубина зависит от проекта. Инструкции по браузерам, сети и ОС быстро устаревают — сверяйтесь с актуальной документацией.</p>')
c.sub_re(r'<section class="recall".*?</section>', C.recall(
    'Сначала выясните, на каком уровне ломается связь: имя, адрес, порт, TLS, HTTP или само приложение.',
    ['DNS, connection refused, timeout, ошибка сертификата и HTTP 500 — разные причины; ping проверяет только ICMP.',
     'Во вкладке Network DevTools сравнивайте method, URL, headers, payload, status и response; HAR может содержать токены и cookies — очищайте перед отправкой.',
     'Служба Windows работает от другой учётной записи и с другими переменными, чем ваша консоль; WSL — отдельная Linux-среда.',
     'Автоматический аудит доступности находит лишь часть проблем; один UI-тест не заменяет нагрузочное тестирование.',
     'Эмуляция устройства в браузере не заменяет реальное устройство.'],
    'отключать проверку TLS-сертификата, чтобы «заработало», вместо исправления доверия или имени хоста.'), count=1)
# --- competence
c = chaps['competence']
c.sub('<div class="ch-kicker">Маршрут V2</div>', '<div class="ch-kicker">Раздел VIII · Практика</div>')
c.sub('Page.getByRole', 'page.getByRole', count=c.h.count('Page.getByRole')) if 'Page.getByRole' in c.h else None
c.sub_re(r'<section class="recall".*?</section>', C.recall(
    'Один проект и три этапа: написать проверки, организовать проект, обосновать инженерные решения.',
    ['Этап Junior: таблица данных, позитивный API-тест и один UI-тест; ожидаемый результат известен до запуска.',
     'Этап Middle: фикстуры создания и удаления, runtime validation, клиент API, linting и typecheck, запуск на двух workers.',
     'Этап Middle+: устранить гонку без sleep, определить quality gate и политику quarantine, обосновать выбор числом и знаменателем.',
     'Отметки практики — самооценка: уровень подтверждают ревью решения и наблюдаемая самостоятельная работа.'],
    'считать прочитанную главу освоенным навыком: «изучено» относится только к чтению.'), count=1)

# ---- версии образа Playwright согласованы с учебным проектом (1.58.2)
for cid in ('docker', 'cicd', 'shop-e2e'):
    chaps[cid].h = chaps[cid].h.replace('v1.63.0-noble', 'v1.58.2-noble')
c = chaps['docker']
c.sub('Образ <code>v1.60</code> и пакет <code>1.63</code> — Playwright не найдёт нужные сборки браузеров. Обновляйте вместе.',
      'Образ <code>v1.56</code> и пакет <code>1.58</code> — Playwright не найдёт нужные сборки браузеров. Обновляйте вместе.')
c.sub('(<code>mcr.microsoft.com/playwright:v1.58.2-noble</code>).</li>', '(<code>mcr.microsoft.com/playwright:v1.58.2-noble</code>; тег берите по версии из <code>package-lock.json</code>).</li>')
# ---- «Кратко»: actionability зависит от действия
c = chaps['assertions']
c.sub('Перед действием Playwright проверяет actionability: элемент виден, стабилен, принимает события, доступен (и редактируем для ввода).',
      'Перед действием Playwright проверяет actionability, набор проверок зависит от действия: для клика — виден, стабилен, принимает события, доступен; для <code>fill</code> — виден, доступен, редактируем.')

# ---- переименование служебных классов V2 в общие компоненты
for ch in chaps.values():
    for a, b in [('data-v2-skills-reset', 'data-practice-reset'), ('data-v2-skill', 'data-practice-step'), ('v2-skill-summary', 'practice-summary'),
                 ('data-v2-mutate', 'data-lab-mutate'), ('data-v2-dom', 'data-lab-dom'), ('data-v2-locator-result', 'data-lab-result'),
                 ('v2-task', 'task-card'), ('v2-skill', 'task-check'), ('v2-locator-lab', 'dom-lab'), ('v2-note', 'note-small')]:
        ch.h = ch.h.replace(a, b)

# ============ 4. Новые главы: введение, первый запуск, о учебнике ============
topics_nav = re.search(r'<nav class="home-topics".*?</nav>', chaps['intro'].h, re.S).group(0)
chaps['intro'].h = C.article('intro', 'start', 'Введение', 'AQA Lab: от первой проверки до системы автоматизации',
                             'Интерактивный учебник для Automation QA Engineer: тестирование, TypeScript, Playwright, API, SQL, Docker, CI/CD и архитектура тестового проекта — '
                             'в одном файле, который работает без интернета.', 4, C.intro_prose(topics_nav), None, ('first-run', 'Первый запуск'))
chaps['first-run'].h = C.article('first-run', 'start', 'Старт · практика', 'Первый запуск: от терминала до проверки',
                                 'Пятнадцать минут практики: запустить учебный магазин, прогнать первые проверки и намеренно сломать одну из них, чтобы научиться читать падение.',
                                 15, C.first_run_prose().replace('__ZIP__', AS.zip_data_uri()), ('intro', 'Введение'), ('aqa-intro', 'Введение в AQA'), C.FIRST_RECALL)
about = C.article('about', 'ref', 'Справочник', 'О учебнике: версии, источники и проверки',
                  'Что входит в версию 3.0, на каких версиях собран учебный проект, какие проверки действительно выполнялись и где у материала границы.', 4,
                  C.about_prose(AS.CHECKS, AS.TOOLS), ('interview', 'Собеседование'), None)
chaps['about'] = Chap('about', about)
chaps['interview'].sub_re(r'(<div class="ch-foot-nav">.*?)(</div></footer>)', r'\1<a class="foot-link next" href="#/about"><small>Дальше →</small><span>О учебнике</span></a>\2')
# prev для intro/first-run пересобраны в article(); у aqa-intro prev уже first-run

import recall_edits
for ch in chaps.values():
    recall_edits.apply(ch)

# ============ 5. Оглавления глав и «Кратко»-ссылки ============
for cid in ['intro', 'first-run', 'about', 'aqa-intro', 'test-design', 'async', 'http-rest', 'sql', 'git-linux', 'locators', 'fixtures', 'api-basics', 'api-auto', 'mocking',
            'reporting', 'docker', 'cicd', 'flaky', 'alt-stacks', 'workstation-tech', 'competence']:
    chaps[cid].regen_toc()
# у intro и about нет «Кратко»: убрать recall-links, оставшиеся пустыми не должны мешать
# ============ 6. Ссылки «глава N» ============
NUM = {'aqa-intro': 1, 'test-types': 2, 'test-design': 3, 'test-quality': 4, 'ts-basics': 5, 'async': 6, 'code-org': 7, 'debugging': 8, 'web-arch': 9, 'http-rest': 10,
       'sql': 11, 'git-linux': 12, 'pw-arch': 13, 'locators': 14, 'assertions': 15, 'fixtures': 16, 'pom': 17, 'pw-advanced': 18, 'api-basics': 19, 'api-auto': 20,
       'contracts': 21, 'mocking': 22, 'project-arch': 23, 'isolation': 24, 'parallel': 25, 'reporting': 26, 'docker': 27, 'cicd': 28, 'optimization': 29, 'flaky': 30}
BY_NUM = {v: k for k, v in NUM.items()}


def link_chapters(txt, stack):
    tags = [s[0] for s in stack]
    if any(x in ('a', 'code', 'pre', 'button', 'script', 'style', 'h1', 'h2', 'h3', 'summary') for x in tags): return txt
    def rep(m):
        n = int(m.group(2))
        if n not in BY_NUM: return m.group(0)
        return f'{m.group(1)}<a href="#/{BY_NUM[n]}">{m.group(3)} {n}</a>'
    return re.sub(r'(\(|\bсм\. |\bв )?(?<![\w-])(глав[аыеу]) (\d+)(?!\d)', lambda m: (m.group(1) or '') + (f'<a href="#/{BY_NUM[int(m.group(3))]}">{m.group(2)} {m.group(3)}</a>' if int(m.group(3)) in BY_NUM else m.group(0)), txt)


for cid, ch in chaps.items():
    if cid in ('glossary',): continue
    ch.h = walk(ch.h, link_chapters)

# ============ 7. Подсказки терминов ============
stats = T.rewrap(chaps, REC)
LOG.append(('terms', stats))

# ============ 8. Сборка ============
main2 = pre_main + ''.join(c.h if c.h.endswith('\n') else c.h + '\n' for c in chaps.values()) + post_main
out = head + main2 + tail
out = AS.patch_document(out, chaps)
for cid, ch in chaps.items():
    assert ch.h.count('<code>') == ch.h.count('</code>'), f'unbalanced <code> in {cid}'
open(OUT, 'w', encoding='utf8').write(out)
print('written', OUT, len(out))
print(LOG)
