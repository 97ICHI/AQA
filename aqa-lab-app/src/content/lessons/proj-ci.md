:::why
Тесты, которые запускают «когда вспомнят», не защищают от регрессий. CI запускает их на каждое изменение, и merge request нельзя влить, пока проверки не прошли. Но pipeline полезен только если он честный: красный, когда что-то сломано, и с артефактами, по которым можно понять, что именно.
:::

## Pipeline, задачи и шаги

[[continuous-integration|Непрерывная интеграция]] — практика, при которой каждое изменение автоматически собирается и проверяется. [[pipeline|Pipeline]] — описание этой проверки: набор [[ci-job|задач]] (jobs), каждая из которых выполняется на [[ci-runner|исполнителе]] и состоит из шагов. Задача считается упавшей, если любой шаг завершился с ненулевым [[exit-code|кодом возврата]]. На этом держится вся логика CI: **код возврата — единственный сигнал, который понимает pipeline**.

В учебном проекте pipeline для [[github-actions|GitHub Actions]] лежит в `.github/workflows/tests.yml`:

```yaml .github/workflows/tests.yml
name: AQA Lab
on: [push, pull_request]
permissions:
  contents: read
jobs:
  tests:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - name: Install and static checks
        run: |
          npm ci
          npm run lint
          npm run typecheck
      - name: Build and run
        run: docker compose up --build --abort-on-container-exit --exit-code-from tests
      - name: Compose logs
        if: always()
        run: docker compose logs --no-color > compose.log
      - name: Generate Allure
        if: always()
        run: npm run report:allure
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: diagnostic-artifacts
          path: |
            playwright-report/
            test-results/
            allure-results/
            allure-report/
            compose.log
          if-no-files-found: warn
      - name: Cleanup
        if: always()
        run: docker compose down
```

Разберём решения, которые в нём приняты:

- **Быстрые проверки первыми.** `lint` и `typecheck` занимают секунды и ловят опечатки до долгого запуска браузеров — короткий [[feedback-loop|цикл обратной связи]].
- **`npm ci`, а не `npm install`.** Ставит ровно то, что записано в `package-lock.json`, и падает при расхождении. Прогон воспроизводим.
- **Код возврата сохраняется.** `--exit-code-from tests` передаёт код сервиса тестов шагу; упавшие тесты делают шаг и задачу красными.
- **`if: always()`.** Шаги с этим условием выполняются и после падения. Без него логи, отчёт Allure и загрузка артефактов пропускались бы ровно тогда, когда они нужнее всего.
- **`timeout-minutes`.** Зависший браузер не займёт исполнитель на шесть часов (значение по умолчанию в GitHub Actions).
- **`permissions: contents: read`.** Минимальные права токена задачи: тестам не нужно писать в репозиторий.
- **`setup-java`.** Нужна только для генерации отчёта Allure (`allure-commandline` работает на Java).

:::mistake
`npx playwright test || true` — «чтобы pipeline дошёл до загрузки отчёта». Шаг всегда зелёный, и merge request с упавшими тестами вливается. Для загрузки артефактов после падения есть `if: always()`; код возврата трогать не нужно.
:::

## Quality gate

[[quality-gate|Quality gate]] — условие, без выполнения которого изменение не проходит дальше. Минимальный набор для тестового проекта:

1. lint и проверка типов без ошибок;
2. ни одного упавшего теста;
3. выполнился хотя бы один тест (опечатка в `--grep` даёт зелёный пустой прогон);
4. число нестабильных тестов не выше порога;
5. обязательная проверка в настройках репозитория (branch protection): без зелёного pipeline кнопка merge недоступна.

Playwright уже возвращает ненулевой код при упавших тестах. Пункты 3 и 4 он сам не проверяет: тест, прошедший на повторе, считается `flaky`, и прогон зелёный. Для строгих наборов есть настройка `failOnFlakyTests: true`, для порогов — своя проверка по JSON-отчёту.

:::try Gate по статистике прогона
Напишите проверку, которая читает `stats` из JSON-отчёта Playwright и решает, пропускать ли изменение. Её можно запустить отдельным шагом после тестов.
:::

```widget
{"type":"exercise","id":"m9-ci-gate"}
```

:::happened
Gate возвращает код возврата и причины. Код нужен pipeline, причины — человеку, который откроет лог задачи. Пустой прогон — отдельная причина: «0 упавших» не значит «всё проверено».
:::

## Что ещё ускоряет и упрощает CI

```bash
npx playwright test --shard=1/4          # одна четверть набора на исполнителе
npx playwright test --grep @smoke        # быстрый набор на каждый push
npx playwright test --only-changed=origin/main   # тесты, затронутые изменёнными файлами
```

[[sharding|Шардирование]] делит набор между несколькими задачами; отчёты потом объединяются (`merge-reports`). Smoke-набор на каждый push и полная регрессия по расписанию или перед релизом — обычный компромисс между скоростью и полнотой.

:::deep CI, CD и место тестов
[[continuous-delivery|Непрерывная поставка]] — каждое изменение, прошедшее pipeline, готово к выкладке; [[continuous-deployment|непрерывное развёртывание]] — выкладывается автоматически. Чем больше автоматики после тестов, тем выше цена ложного зелёного: в continuous deployment зелёный pipeline с пропущенным дефектом означает дефект в продакшене через минуты. Поэтому честность кода возврата и пустые прогоны — не мелочи, а основа доверия к процессу.
:::

:::tech GitLab CI в двух словах
В [[gitlab-ci|GitLab]] pipeline описывается в `.gitlab-ci.yml`: `stages`, задачи с `script`, `artifacts: when: always` (аналог `if: always()` для загрузки), `rules` для условий запуска. Секреты задаются в CI/CD Variables с флагами masked/protected. Идеи те же: быстрые проверки раньше, код возврата не глушить, артефакты сохранять всегда.
:::

:::interview
**Вопрос:** «Как вы встроили автотесты в CI?» **Ответ по сути:** на каждый merge request — lint, типы и smoke/API-набор, полная регрессия — по расписанию и перед релизом. Код возврата тестов не подавляется, отчёт и trace загружаются всегда (`if: always()`), версии закреплены через `npm ci` и образ. Quality gate: нет упавших, есть выполненные тесты, flaky не выше порога; merge закрыт без зелёного pipeline.
:::

:::terms
[[continuous-integration]], [[pipeline]], [[ci-job]], [[ci-runner]], [[github-actions]], [[gitlab-ci]], [[quality-gate]], [[exit-code]], [[sharding]], [[feedback-loop]]
:::
