# -*- coding: utf-8 -*-
"""Сокращение блоков «Кратко»: не больше 6 правил и 5 терминов."""
import re, html

# keep — индексы сохраняемых пунктов; repl — замена текста пункта (HTML) по исходному индексу
EDITS = {
 'test-design': dict(keep=[0,1,2,3,4,5], repl={5: 'Risk-based Testing: приоритет = вероятность × влияние. Каждая проверка связывает риск, данные и oracle, а отчёт о дефекте содержит воспроизводимые шаги и evidence.'}),
 'ts-basics': dict(keep=[0,1,3,4,5,7], repl={}),
 'async': dict(keep=[0,2,3,4,5,6], repl={
    0: 'Один поток: call stack выполняет синхронный код до конца; после каждой задачи (macrotask: таймер, I/O) выполняются все microtasks — поэтому <code>Promise.then</code> срабатывает раньше <code>setTimeout(…, 0)</code>. В Node.js цикл устроен сложнее, чем в браузере.',
    5: '<code>Promise.all</code> выполняет независимые операции параллельно и падает при первой ошибке, но не отменяет остальные; <code>allSettled</code> ждёт все.'}),
 'http-rest': dict(keep=[0,1,2,3,4,5], repl={
    1: 'Идемпотентный метод даёт тот же эффект при повторе, но не обязательно тот же статус: GET, PUT, DELETE, HEAD, OPTIONS. POST и PATCH — в общем случае нет.',
    5: 'Пагинация: offset/limit или курсор; проверяют границы, пустую страницу и стабильность порядка. Превышение лимита запросов — 429 и <code>Retry-After</code>.'}),
 'sql': dict(keep=[0,2,3,4,5,6], repl={
    0: 'Логический порядок SELECT: FROM/JOIN → WHERE (фильтр строк до группировки) → GROUP BY → HAVING (фильтр групп) → SELECT → ORDER BY → LIMIT.'}),
 'git-linux': dict(keep=[0,1,2,3,4,5], repl={
    5: 'Linux для AQA: логи (<code>tail -F</code>, <code>grep</code>), процессы и порты (<code>ps</code>, <code>ss</code>), права (<code>chmod</code>), <code>curl</code> для проверки API. Zombie-процесс сигналом не завершить — разбирайтесь с родителем.'}),
 'pw-arch': dict(keep=[0,1,2,3,4,5], repl={}),
 'locators': dict(keep=[0,1,3,4,5,6], repl={
    1: '<code>getByRole(role, { name })</code> ищет по ARIA-роли и доступному имени; имя и <code>getByText</code> по умолчанию сравниваются как подстрока без учёта регистра, <code>exact: true</code> — точное совпадение.'}),
 'assertions': dict(keep=[0,1,2,3,5,6], repl={
    3: 'События, которые не выражаются состоянием элемента, ждут явно (<code>waitForResponse</code>, <code>waitForURL</code>, <code>waitForEvent</code>); для произвольных условий — <code>expect.poll</code> и <code>toPass</code>. <code>waitForTimeout</code> — только для отладки, <code>networkidle</code> не рекомендуется.'}),
 'fixtures': dict(keep=[0,1,3,4,5,6], repl={}),
 'pw-advanced': dict(keep=[0,1,2,4,5,6], repl={}),
 'api-basics': dict(keep=[0,1,2,3,4,6], repl={}),
 'api-auto': dict(keep=[0,1,2,3,4,6], repl={}),
 'reporting': dict(keep=[0,1,2,3,4,5], repl={
    5: 'Разбор прогона: классифицировать каждое падение (дефект продукта, ошибка теста, данные, окружение), начинать с первичной ошибки, версии и данных; повтор запуска проверяет гипотезу, но не заменяет диагностику.'}),
 'docker': dict(keep=[0,1,2,3,5], repl={
    3: 'Running ≠ readiness: <code>depends_on</code> с <code>condition: service_healthy</code> и healthcheck ждут готовности приложения, а не старта процесса.'}),
 'cicd': dict(keep=[0,1,2,3,4,5], repl={
    5: 'Артефакты (JUnit XML, отчёт, trace, скриншоты) сохраняются и при падении, но <code>always</code>-шаги и cleanup не должны скрывать код возврата тестов.'}),
 'flaky': dict(keep=[0,1,2,3,4,6], repl={
    6: 'Flaky rate считают с явным знаменателем; нестабильность может быть дефектом продукта; успешные повторы не доказывают стабильность.'}),
}
MAX_TERMS = 5


def plain(x): return html.unescape(re.sub(r'<[^>]+>', '', x)).lower()


def apply(chap):
    h = chap.h
    m = re.search(r'(<ul class="recall-points">)(.*?)(</ul>)', h, re.S)
    if not m: return
    items = re.findall(r'<li>.*?</li>', m.group(2), re.S)
    ed = EDITS.get(chap.id)
    if ed:
        out = []
        for i in ed['keep']:
            out.append(f'<li>{ed["repl"][i]}</li>' if i in ed['repl'] else items[i])
        items = out
        h = h[:m.start(2)] + ''.join(items) + h[m.end(2):]
    # термины: не больше MAX_TERMS, приоритет у тех, что упомянуты в пунктах
    tm = re.search(r'(<dl class="recall-terms">)(.*?)(</dl>)', h, re.S)
    if tm:
        terms = re.findall(r'<div><dt>.*?</dd></div>', tm.group(2), re.S)
        if len(terms) > MAX_TERMS:
            body = plain(' '.join(items))
            score = []
            for i, t in enumerate(terms):
                name = plain(re.search(r'<dt>(.*?)</dt>', t, re.S).group(1))
                key = name.split()[0].strip('-')
                score.append((1 if (name in body or key in body) else 0, -i, i))
            keep = sorted(sorted(score, reverse=True)[:MAX_TERMS], key=lambda s: s[2])
            h = h[:tm.start(2)] + ''.join(terms[s[2]] for s in keep) + h[tm.end(2):]
    chap.h = h
