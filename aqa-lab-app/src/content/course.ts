// Единый источник структуры курса: модули, уроки, предпосылки, связь с главами v3.
// Урок считается написанным, если есть файл lessons/<id>.md; иначе показывается план урока и подробная глава v3.

export type Route = 'start' | 'practice' | 'middle';
export interface LessonMeta {
  id: string;
  title: string;
  /** что ученик сможет сделать после урока */
  goal: string;
  /** id уроков, которые нужно пройти раньше */
  needs?: string[];
  /** главы v3 (id в AQA_Lab_v3.html) с подробным материалом */
  v3?: string[];
}
export interface ModuleMeta {
  id: string;
  num: number;
  title: string;
  route: Route;
  summary: string;
  lessons: LessonMeta[];
}

export const ROUTES: Record<Route, { title: string; text: string }> = {
  start: { title: 'С нуля', text: 'Что такое тест, основы программирования, первый осмысленный тест.' },
  practice: { title: 'Уверенная практика', text: 'UI, API и SQL, отладка, данные, небольшой проект.' },
  middle: { title: 'Подготовка к Middle', text: 'Поддерживаемость, изоляция, параллельность, CI, расследование падений.' },
};

export const COURSE: ModuleMeta[] = [
  {
    id: 'm1', num: 1, title: 'Знакомство', route: 'start',
    summary: 'Что мы проверяем, как выглядит тест, что означают успех и падение.',
    lessons: [
      { id: 'intro-what-is-test', title: 'Что такое автотест', goal: 'Отличать проверку от действия и понимать, что значит «тест прошёл».', v3: ['aqa-intro'] },
      { id: 'intro-first-test', title: 'Первый тест Playwright', goal: 'Запустить готовый тест магазина и назвать каждую его часть.', needs: ['intro-what-is-test'], v3: ['first-run', 'pw-arch'] },
      { id: 'intro-failure', title: 'Тест упал: дефект или ошибка теста?', goal: 'Прочитать сообщение о падении и отличить дефект приложения от ошибки в тесте.', needs: ['intro-first-test'], v3: ['debugging'] },
    ],
  },
  {
    id: 'm2', num: 2, title: 'Основа тестирования', route: 'start',
    summary: 'Требования, риски, ожидаемый результат, данные, границы, позитивные и негативные проверки.',
    lessons: [
      { id: 'qa-expected', title: 'Требование и ожидаемый результат', goal: 'Записать ожидаемый результат до запуска проверки.', needs: ['intro-what-is-test'], v3: ['aqa-intro', 'test-design'] },
      { id: 'qa-boundaries', title: 'Классы и границы значений', goal: 'Выбрать небольшой набор данных, который ловит типичные ошибки на границах.', needs: ['qa-expected'], v3: ['test-design'] },
      { id: 'qa-negative', title: 'Позитивные и негативные проверки', goal: 'Проверить, что система правильно отказывает, а не только правильно работает.', needs: ['qa-boundaries'], v3: ['test-design', 'api-basics'] },
      { id: 'qa-risk', title: 'Риски и выбор уровня проверки', goal: 'Решить, где проверять правило: unit, API или UI.', needs: ['qa-negative'], v3: ['test-types', 'test-quality'] },
    ],
  },
  {
    id: 'm3', num: 3, title: 'JavaScript → TypeScript', route: 'start',
    summary: 'Программирование с нуля и постепенное введение типов — ровно то, что нужно для чтения и написания тестов.',
    lessons: [
      { id: 'ts-js-vs-ts', title: 'JavaScript и TypeScript', goal: 'Понимать, что выполняется, а что проверяется до выполнения.', needs: ['intro-first-test'], v3: ['ts-basics'] },
      { id: 'ts-values', title: 'Значения, переменные, const и let', goal: 'Хранить данные в переменных и понимать, почему const не делает объект неизменяемым.', needs: ['ts-js-vs-ts'], v3: ['ts-basics'] },
      { id: 'ts-primitives', title: 'Строки, числа, boolean, null и undefined', goal: 'Работать с основными типами значений и видеть разницу между null и undefined.', needs: ['ts-values'], v3: ['ts-basics'] },
      { id: 'ts-conditions', title: 'Сравнения и условия', goal: 'Писать условия с ===, &&, || и ?? без неожиданных приведений типов.', needs: ['ts-primitives'], v3: ['ts-basics'] },
      { id: 'ts-arrays-objects', title: 'Массивы и объекты', goal: 'Читать и менять данные заказа: свойства, элементы, вложенные объекты.', needs: ['ts-conditions'], v3: ['ts-basics', 'code-org'] },
      { id: 'ts-loops', title: 'Циклы, map, filter, find', goal: 'Обходить список товаров сначала циклом, затем методами массивов.', needs: ['ts-arrays-objects'], v3: ['ts-basics'] },
      { id: 'ts-functions', title: 'Функции', goal: 'Выносить проверку в функцию с параметрами и возвращаемым значением.', needs: ['ts-loops'], v3: ['ts-basics'] },
      { id: 'ts-arrows', title: 'Стрелочные функции, callbacks, destructuring', goal: 'Читать запись `async ({ page }) => { … }` в тестах Playwright.', needs: ['ts-functions'], v3: ['ts-basics'] },
      { id: 'ts-modules', title: 'Импорт, экспорт и npm-проект', goal: 'Понимать import/export, package.json и откуда берутся пакеты.', needs: ['ts-arrows'], v3: ['ts-basics', 'project-arch'] },
      { id: 'ts-types', title: 'Типы переменных и функций, type и interface', goal: 'Описывать форму данных и получать ошибку типа до запуска.', needs: ['ts-modules'], v3: ['ts-basics'] },
      { id: 'ts-union', title: 'Optional, union и narrowing', goal: 'Описывать необязательные поля и варианты значений и безопасно их проверять.', needs: ['ts-types'], v3: ['ts-basics'] },
      { id: 'ts-unknown', title: 'any, unknown и проверка ответа API', goal: 'Понимать, почему тип не проверяет JSON от сервера, и проверять его во время выполнения.', needs: ['ts-union'], v3: ['ts-basics', 'contracts'] },
      { id: 'ts-async', title: 'Promise, async/await и забытый await', goal: 'Дожидаться асинхронных операций и обрабатывать их ошибки.', needs: ['ts-unknown'], v3: ['async'] },
      { id: 'ts-parallel', title: 'Последовательно или Promise.all', goal: 'Выбирать между последовательным и параллельным выполнением.', needs: ['ts-async'], v3: ['async'] },
      { id: 'ts-classes', title: 'Классы и композиция', goal: 'Написать небольшой класс — подготовку к Page Object.', needs: ['ts-parallel'], v3: ['code-org', 'pom'] },
      { id: 'ts-generics', title: 'Generics на одном примере', goal: 'Понимать запись `Promise<Order>` и писать простую обобщённую функцию.', needs: ['ts-classes'], v3: ['ts-basics'] },
      { id: 'ts-config', title: 'tsconfig и отдельная проверка типов', goal: 'Знать, почему Playwright не проверяет типы при запуске, и запускать tsc --noEmit.', needs: ['ts-generics'], v3: ['ts-basics', 'project-arch'] },
    ],
  },
  {
    id: 'm4', num: 4, title: 'Веб и HTTP', route: 'practice',
    summary: 'Интерфейс, DOM, браузер, запрос и ответ, cookies, сессия, авторизация.',
    lessons: [
      { id: 'web-dom', title: 'Страница, HTML и DOM', goal: 'Видеть страницу как дерево элементов с ролями и подписями.', needs: ['ts-arrays-objects'], v3: ['web-arch', 'locators'] },
      { id: 'web-http', title: 'Запрос и ответ', goal: 'Читать метод, путь, заголовки, тело и код ответа.', needs: ['web-dom'], v3: ['http-rest'] },
      { id: 'web-status', title: 'Коды ответов и идемпотентность', goal: 'Знать, какой код ожидать, и проверять повтор запроса.', needs: ['web-http'], v3: ['http-rest'] },
      { id: 'web-auth', title: 'Cookies, сессия и авторизация', goal: 'Различать 401 и 403 и понимать, где хранится вход.', needs: ['web-status'], v3: ['web-arch', 'api-basics'] },
    ],
  },
  {
    id: 'm5', num: 5, title: 'Playwright с нуля', route: 'practice',
    summary: 'Первый тест, поиск элементов, действия, проверки и ожидания.',
    lessons: [
      { id: 'pw-install', title: 'Установка и структура проекта', goal: 'Установить Node.js, Playwright и браузеры и запустить тесты.', needs: ['ts-modules'], v3: ['first-run', 'pw-arch'] },
      { id: 'pw-library-vs-test', title: 'Playwright Library и Playwright Test', goal: 'Понимать роль раннера, test, expect и конфигурации.', needs: ['pw-install'], v3: ['pw-arch'] },
      { id: 'pw-first-test-lines', title: 'Первый тест построчно', goal: 'Объяснить каждую строку теста магазина.', needs: ['pw-library-vs-test', 'ts-async'], v3: ['pw-arch'] },
      { id: 'pw-context', title: 'Browser, BrowserContext и Page', goal: 'Видеть, почему тесты не делят cookies и состояние.', needs: ['pw-first-test-lines'], v3: ['pw-arch', 'pw-advanced'] },
      { id: 'pw-roles', title: 'Role и accessible name', goal: 'Находить элемент так, как его находит пользователь.', needs: ['web-dom', 'pw-first-test-lines'], v3: ['locators'] },
      { id: 'pw-locators', title: 'getByRole, getByLabel, getByText, getByTestId', goal: 'Выбирать устойчивый locator и уточнять его через chaining и filter.', needs: ['pw-roles'], v3: ['locators'] },
      { id: 'pw-strict', title: 'Неоднозначные locators и strictness', goal: 'Исправлять strict mode violation без слепого first().', needs: ['pw-locators'], v3: ['locators'] },
      { id: 'pw-actions', title: 'Действия: click, fill, check, selectOption и другие', goal: 'Выполнять действия пользователя, включая загрузку файла, диалоги и новые вкладки.', needs: ['pw-strict'], v3: ['assertions', 'pw-advanced'] },
      { id: 'pw-autowait', title: 'Auto-waiting и actionability', goal: 'Знать, чего ждёт действие и чего оно не гарантирует.', needs: ['pw-actions'], v3: ['assertions'] },
      { id: 'pw-assertions', title: 'Web-first assertions', goal: 'Отличать ожидающую проверку от разового чтения значения.', needs: ['pw-autowait'], v3: ['assertions'] },
      { id: 'pw-waits', title: 'Ожидание события или состояния', goal: 'Начинать ожидание до действия, которое его вызывает.', needs: ['pw-assertions'], v3: ['assertions', 'async'] },
      { id: 'pw-timeouts', title: 'Таймауты, polling и retries', goal: 'Понимать, почему sleep и повтор прогона не исправляют причину.', needs: ['pw-waits'], v3: ['assertions', 'flaky'] },
    ],
  },
  {
    id: 'm6', num: 6, title: 'Надёжный Playwright', route: 'practice',
    summary: 'Fixtures, данные, изоляция, API, POM, mocks, диагностика, CI.',
    lessons: [
      { id: 'pw-fixtures', title: 'Hooks и fixtures', goal: 'Готовить и убирать состояние через fixtures и понимать scope.', needs: ['pw-timeouts'], v3: ['fixtures'] },
      { id: 'pw-data', title: 'Независимые тесты и данные', goal: 'Создавать уникальные данные и очищать их даже после падения.', needs: ['pw-fixtures'], v3: ['isolation', 'mocking'] },
      { id: 'pw-auth-state', title: 'Авторизация и storageState', goal: 'Входить один раз и не делить аккаунт между тестами.', needs: ['pw-data', 'web-auth'], v3: ['pw-advanced'] },
      { id: 'pw-params', title: 'Параметризация и data-driven тесты', goal: 'Запускать одну проверку на таблице данных.', needs: ['pw-data', 'qa-boundaries'], v3: ['mocking'] },
      { id: 'pw-api', title: 'APIRequestContext: UI + API', goal: 'Готовить данные через API и проверять ответ.', needs: ['pw-params', 'web-status'], v3: ['api-auto', 'api-basics'] },
      { id: 'pw-mocks', title: 'Перехват сети и mocks', goal: 'Подменять ответ сервера и знать, что тогда перестаёт проверяться.', needs: ['pw-api'], v3: ['pw-advanced', 'mocking'] },
      { id: 'pw-pom', title: 'Небольшой Page Object', goal: 'Сделать тест читаемее без лишних слоёв.', needs: ['pw-api', 'ts-classes'], v3: ['pom'] },
      { id: 'pw-parallel', title: 'Projects, workers, parallel, sharding', goal: 'Запускать тесты параллельно, когда они изолированы.', needs: ['pw-pom'], v3: ['parallel'] },
      { id: 'pw-debug', title: 'Inspector, UI Mode, Trace Viewer, отчёты', goal: 'Находить причину падения по артефактам.', needs: ['pw-parallel'], v3: ['debugging', 'reporting'] },
      { id: 'pw-visual', title: 'Визуальные проверки', goal: 'Понимать, от чего зависят снимки экрана и почему они различаются.', needs: ['pw-debug'], v3: ['pw-advanced'] },
      { id: 'pw-ci', title: 'Playwright в CI', goal: 'Запускать тесты, проверку типов и сохранять артефакты в CI.', needs: ['pw-debug'], v3: ['cicd'] },
    ],
  },
  {
    id: 'm7', num: 7, title: 'SQL для тестировщика', route: 'practice',
    summary: 'Чтение, подготовка и проверка данных на настоящем PostgreSQL (PGlite).',
    lessons: [
      { id: 'sql-select', title: 'SELECT, WHERE, ORDER BY, LIMIT', goal: 'Выбирать нужные строки и столбцы.', v3: ['sql'] },
      { id: 'sql-null', title: 'NULL и IS NULL', goal: 'Находить пустые значения и понимать, почему NULL не равен NULL.', needs: ['sql-select'], v3: ['sql'] },
      { id: 'sql-join', title: 'JOIN без лишних и пропавших строк', goal: 'Соединять таблицы и объяснять лишние строки.', needs: ['sql-null'], v3: ['sql'] },
      { id: 'sql-group', title: 'GROUP BY, агрегаты и HAVING', goal: 'Считать суммы и количества по группам.', needs: ['sql-join'], v3: ['sql'] },
      { id: 'sql-subquery', title: 'Подзапросы и CTE', goal: 'Разбивать запрос на понятные шаги.', needs: ['sql-group'], v3: ['sql'] },
      { id: 'sql-dml', title: 'INSERT, UPDATE, DELETE', goal: 'Готовить и очищать тестовые данные.', needs: ['sql-subquery'], v3: ['sql'] },
      { id: 'sql-constraints', title: 'Ключи и ограничения', goal: 'Использовать ограничения как проверки целостности.', needs: ['sql-dml'], v3: ['sql'] },
      { id: 'sql-transactions', title: 'Транзакции и ROLLBACK', goal: 'Понимать «всё или ничего» и откат изменений.', needs: ['sql-constraints'], v3: ['sql'] },
      { id: 'sql-check-order', title: 'Проверка заказа после API-действия', goal: 'Найти заказ, созданный тестом, и проверить его данные.', needs: ['sql-transactions', 'pw-api'], v3: ['sql', 'shop-e2e'] },
      { id: 'sql-params', title: 'Параметризованные запросы в коде', goal: 'Передавать значения параметрами, а не склеивать строки.', needs: ['sql-check-order'], v3: ['sql'] },
      { id: 'sql-windows', title: 'Оконные функции и индексы', goal: 'Нумеровать строки внутри групп и понимать, зачем нужен индекс.', needs: ['sql-params'], v3: ['sql'] },
    ],
  },
  {
    id: 'm8', num: 8, title: 'Python для задач AQA', route: 'practice',
    summary: 'Отдельный маршрут: Python и pytest для тех, кто хочет Python-AQA или инструменты подготовки данных.',
    lessons: [
      { id: 'py-values', title: 'Значения и переменные', goal: 'Хранить и печатать данные.', v3: ['alt-stacks'] },
      { id: 'py-strings-numbers', title: 'Строки и числа', goal: 'Форматировать строки и считать суммы.', needs: ['py-values'] },
      { id: 'py-lists-dicts', title: 'Списки и словари', goal: 'Описывать заказ и пользователей структурами Python.', needs: ['py-strings-numbers'] },
      { id: 'py-conditions-loops', title: 'Условия и циклы', goal: 'Находить некорректные записи в списке.', needs: ['py-lists-dicts'] },
      { id: 'py-functions', title: 'Функции', goal: 'Выносить проверку в функцию.', needs: ['py-conditions-loops'] },
      { id: 'py-exceptions', title: 'Исключения', goal: 'Обрабатывать ошибку и не прятать её.', needs: ['py-functions'] },
      { id: 'py-json', title: 'JSON, модули и файлы', goal: 'Читать и преобразовывать JSON ответа.', needs: ['py-exceptions'] },
      { id: 'py-venv', title: 'Виртуальное окружение и зависимости', goal: 'Создать venv и зафиксировать зависимости.', needs: ['py-json'] },
      { id: 'py-pytest', title: 'pytest: первые тесты', goal: 'Писать тест с assert и читать отчёт pytest.', needs: ['py-functions'] },
      { id: 'py-fixtures', title: 'pytest: fixtures и параметризация', goal: 'Готовить данные fixture и параметризовать тест.', needs: ['py-pytest'] },
      { id: 'py-http', title: 'HTTP-клиент и API-проверки', goal: 'Отправлять запрос requests и проверять ответ.', needs: ['py-fixtures', 'web-http'], v3: ['alt-stacks'] },
    ],
  },
  {
    id: 'm9', num: 9, title: 'Рабочий проект', route: 'practice',
    summary: 'Git, окружение, отчёты, Docker и CI/CD.',
    lessons: [
      { id: 'proj-git', title: 'Git: ветка, коммит, merge request', goal: 'Вести изменения теста через ветку и ревью.', v3: ['git-linux'] },
      { id: 'proj-env', title: 'Окружение: терминал, сеть, DevTools', goal: 'Отличать проблему окружения от дефекта.', needs: ['proj-git'], v3: ['workstation-tech', 'git-linux'] },
      { id: 'proj-structure', title: 'Структура тестового проекта', goal: 'Разложить тесты, fixtures и клиенты по слоям.', needs: ['pw-pom'], v3: ['project-arch'] },
      { id: 'proj-reports', title: 'Отчёты и логи', goal: 'Сделать отчёт, после которого не нужно перезапускать тест.', needs: ['proj-structure'], v3: ['reporting'] },
      { id: 'proj-docker', title: 'Docker и Compose для тестов', goal: 'Запустить приложение и тесты в контейнерах и дождаться готовности.', needs: ['proj-reports'], v3: ['docker'] },
      { id: 'proj-ci', title: 'CI/CD: pipeline и quality gates', goal: 'Собрать pipeline, сохраняющий код возврата и артефакты.', needs: ['proj-docker', 'pw-ci'], v3: ['cicd'] },
    ],
  },
  {
    id: 'm10', num: 10, title: 'Практика Middle', route: 'middle',
    summary: 'Нестабильность, параллельность, архитектура и инженерные компромиссы.',
    lessons: [
      { id: 'mid-flaky', title: 'Расследование нестабильного теста', goal: 'Найти причину flaky-теста по артефактам и воспроизвести её.', needs: ['pw-debug'], v3: ['flaky'] },
      { id: 'mid-isolation', title: 'Общие данные и параллельные тесты', goal: 'Найти конфликт двух тестов и устранить его.', needs: ['pw-parallel', 'pw-data'], v3: ['isolation', 'parallel'] },
      { id: 'mid-speed', title: 'Ускорение без потери проверок', goal: 'Сократить время прогона, сохранив важные проверки.', needs: ['mid-isolation'], v3: ['optimization'] },
      { id: 'mid-contracts', title: 'Схемы и контракты API', goal: 'Проверять структуру ответа и совместимость изменений.', needs: ['pw-api', 'ts-unknown'], v3: ['contracts'] },
      { id: 'mid-design', title: 'Стратегия автоматизации нового проекта', goal: 'Предложить план автоматизации и обосновать компромиссы.', needs: ['mid-speed'], v3: ['aqa-design', 'shop-e2e'] },
    ],
  },
  {
    id: 'm11', num: 11, title: 'Подготовка к интервью', route: 'middle',
    summary: 'Вопросы, задачи и объяснение своих решений; связь с уроками и упражнениями.',
    lessons: [
      { id: 'iv-scenarios', title: 'Сценарии интервью', goal: 'Отвечать на 10 типовых сценариев за 30–60 секунд с примером.', v3: ['interview'] },
      { id: 'iv-final', title: 'Итоговая самостоятельная работа', goal: 'Собрать набор UI/API/SQL-проверок с диагностикой, отчётом и CI.', needs: ['iv-scenarios'], v3: ['competence'] },
    ],
  },
];

export const ALL_LESSONS = COURSE.flatMap((m) => m.lessons.map((l) => ({ ...l, module: m })));
export const lessonById = new Map(ALL_LESSONS.map((l) => [l.id, l]));
