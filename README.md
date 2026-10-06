# AQA Lab

Интерактивный учебник по автоматизации тестирования: TypeScript, Playwright, API, SQL, Docker, CI/CD. Готовая версия — один самостоятельный файл **`AQA_Lab_v3.html`** (работает без интернета).

| Что | Где |
| --- | --- |
| Учебник | `AQA_Lab_v3.html` |
| Исходники учебника | `src/` (главы, CSS, JS, `book.json`, оболочка страницы) |
| Сборка и проверки | `tools/` |
| Учебный проект (архив встроен в учебник) | `aqa-lab-starter/` |
| Отчёт о версии 3.0 | `REPORT_v3.md` |
| Исходный файл версии 2 | `AQA_Lab_v2.html` |

## Как вносить правки

```bash
node tools/build.mjs        # собрать AQA_Lab_v3.html из src/
cd tools && npm ci          # зависимости проверок
npm run check               # сборка = файл, ссылки, вёрстка, поведение, интерактивы, офлайн, actionability, SQL
npm run pdf                 # весь учебник в PDF (dist/AQA_Lab_v3.pdf)
npm run mutation            # контролируемое падение учебного проекта
```

Главы лежат в `src/chapters/NN-id.html` — это готовая разметка со всеми подсказками терминов; порядок сборки задаёт `src/manifest.json`, список глав и глоссарий — `src/book.json`. Если Playwright обновлён, `npm run check:actionability` сверит таблицу actionability в главе «Assertions» с исходниками установленной библиотеки. Для запуска на машине без загрузки браузеров Playwright задайте `AQA_BROWSER_PATH` — путь к Chromium.

CI (`.github/workflows/ci.yml`) на каждый push собирает учебник из `src/`, прогоняет все проверки, печатает PDF и запускает учебный проект в Docker Compose.

> Исходный генератор версии 2 в репозитории отсутствовал, поэтому `src/` получен разбором собранного файла (скрипты — в `tools/legacy-v2-to-v3/`).
