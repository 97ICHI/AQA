# -*- coding: utf-8 -*-
import os, re, io, json, zipfile, base64, hashlib

STARTER = '/home/user/AQA/aqa-lab-starter'
HERE = os.path.dirname(__file__)
EXCLUDE_DIRS = {'node_modules', 'playwright-report', 'test-results', 'allure-results', 'allure-report', '.git'}
EXCLUDE_FILES = {'.env'}


def build_zip():
    buf = io.BytesIO()
    files = []
    for root, dirs, fs in os.walk(STARTER):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
        for f in sorted(fs):
            if f in EXCLUDE_FILES or f.endswith('.log'): continue
            files.append(os.path.join(root, f))
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            rel = 'aqa-lab-starter/' + os.path.relpath(p, STARTER).replace(os.sep, '/')
            zi = zipfile.ZipInfo(rel, date_time=(2026, 10, 5, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = (0o644 << 16)
            z.writestr(zi, open(p, 'rb').read())
    return buf.getvalue(), [os.path.relpath(p, STARTER) for p in files]


def zip_data_uri():
    data, _ = build_zip()
    return 'data:application/zip;base64,' + base64.b64encode(data).decode()


def _load(name, default):
    p = os.path.join(HERE, name)
    return json.load(open(p, encoding='utf8')) if os.path.exists(p) else default


CHECKS = [tuple(x) for x in _load('checks.json', [['—', 'не заполнено', '—']])]
TOOLS = [tuple(x) for x in _load('tools.json', [['—', '—']])]


# ----------------------------------------------------------------------------- CSS
def sub1(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'CSS: expected {count} got {n}: {old[:80]!r}'
    return s.replace(old, new)


def patch_css(css):
    # --- токены: единая шкала радиусов, отключаем свечение
    css = sub1(css, '--radius: 16px;\n  --radius-sm: 12px;\n  --radius-xs: 9px;', '--radius: 16px;\n  --radius-sm: 12px;\n  --radius-xs: 8px;\n  --topbar-h: 64px;')
    css = sub1(css, '--glow: 0 0 28px rgba(167, 139, 250, .05), 0 0 34px rgba(167, 139, 250, .04);', '--glow: none;')
    css = sub1(css, '--glow: 0 5px 24px rgba(109, 69, 117, .05);', '--glow: none;')
    css = sub1(css, 'html { font-size: var(--fs-base); -webkit-text-size-adjust: 100%; scroll-padding-top: 84px;', 'html { font-size: var(--fs-base); -webkit-text-size-adjust: 100%; scroll-padding-top: calc(var(--topbar-h) + 20px);')
    # --- цвета разделов: один набор, без дублей и жёлтого/зелёного
    css = sub1(css, '[data-section="arch"] { --sec: #f2c14e; }', '[data-section="arch"] { --sec: #c4b5fd; }')
    css = sub1(css, '[data-section="infra"] { --sec: #72d69a; }', '[data-section="infra"] { --sec: #86b6ff; }')
    css = sub1(css, ':root[data-theme="light"] [data-section="arch"] { --sec: #8a5f00; }', ':root[data-theme="light"] [data-section="arch"] { --sec: #6941b8; }')
    css = sub1(css, ':root[data-theme="light"] [data-section="infra"] { --sec: #17804a; }', ':root[data-theme="light"] [data-section="infra"] { --sec: #1c5fb8; }')
    css = sub1(css, '[data-section="start"] { --sec: #e8edf7; }', '[data-section="start"] { --sec: #aebbd8; }')
    css = sub1(css, '--pink: #b02f69;', '--pink: #0e7490;')
    css = sub1(css, '--pink-soft: rgba(176, 47, 105, .08);', '--pink-soft: rgba(14, 116, 144, .09);')
    css = sub1(css, ':root[data-theme="light"] [data-section="ui"] { --sec: #b02f69; }', ':root[data-theme="light"] [data-section="ui"] { --sec: #0e7490; }')
    css = sub1(css, '.callout-head .ico { width: 20px; height: 20px; }', '.callout-head .ico { width: 20px; height: 20px; }\n.callout-head strong { color: inherit; }')
    # --- фон бокового меню: градиент на самом элементе (псевдоэлемент покрывал только первый экран и обрывался при прокрутке)
    a = css.index('@media screen {\n  .sidebar::before')
    b = css.index('.brand { display: flex;')
    css = css[:a] + SIDEBAR_BG + css[b:]
    # --- убираем свечение и текстовые тени
    css = sub1(css, ' letter-spacing: -.03em; line-height: 1.15; text-shadow: 0 0 22px rgba(167, 139, 250, .25); }', ' letter-spacing: -.03em; line-height: 1.15; }')
    css = sub1(css, '@media screen { .ch-title { text-shadow: 0 0 36px rgba(167, 139, 250, .14); } }\n', '')
    css = sub1(css, ', 0 0 14px color-mix(in srgb, var(--sec) 10%, transparent); }', '; }')
    css = sub1(css, '.icon-btn:hover { color: var(--text-strong); border-color: var(--accent); box-shadow: 0 0 16px rgba(167, 139, 250, .12); }', '.icon-btn:hover { color: var(--text-strong); border-color: var(--accent); }')
    css = sub1(css, ' font-weight: 650; box-shadow: 0 0 17px rgba(167, 139, 250, .2); }', ' font-weight: 650; }')
    css = sub1(css, ', 0 0 18px -6px var(--accent); }', '; }')
    css = sub1(css, 'color: #fff; box-shadow: 0 0 16px -2px var(--pc); }', 'color: #fff; }')
    css = sub1(css, 'background: #fff3ea; border: 4px solid var(--c); box-shadow: 0 0 12px rgba(167, 139, 250, .25); }', 'background: var(--text-strong); border: 4px solid var(--c); }')
    css = sub1(css, 'background: #fff3ea; border: 4px solid var(--c); }', 'background: var(--text-strong); border: 4px solid var(--c); }')
    # --- градиентные линии-украшения → спокойная граница
    css = sub1(css, 'height: 1px; background: linear-gradient(90deg, var(--accent-soft), var(--accent), var(--pink), var(--violet), transparent); opacity: .55; }', 'height: 1px; background: var(--border); }')
    css = sub1(css, 'margin-top: 12px; border-radius: 3px; background: linear-gradient(90deg, var(--accent), var(--pink), var(--violet)); }', 'margin-top: 12px; border-radius: 3px; background: var(--accent); opacity: .8; }')
    css = sub1(css, '.tp-fill { display: block; height: 100%; width: 0; border-radius: 6px; background: linear-gradient(90deg, var(--accent), var(--pink), var(--violet));', '.tp-fill { display: block; height: 100%; width: 0; border-radius: 6px; background: var(--accent);')
    # --- шапка главы: спокойная линия и адаптив
    css = sub1(css, 'margin-bottom: 22px; border-top: 3px solid var(--sec); padding-top: 18px; }', 'margin-bottom: 22px; border-top: 2px solid color-mix(in srgb, var(--sec) 55%, var(--border)); padding-top: 18px; }')
    css = sub1(css, '.ch-head.no-idea { grid-template-columns: minmax(0, 1fr); }', '.ch-head.no-idea { grid-template-columns: minmax(0, 1fr); }\n@media (max-width: 960px) { .ch-head { grid-template-columns: minmax(0, 1fr); gap: 16px; } }')
    # --- закреплённые элементы учитывают высоту двухрядной шапки на телефоне
    css = sub1(css, 'html { scroll-padding-top: 120px; }', ':root { --topbar-h: 108px; }')
    css = sub1(css, 'position: sticky; top: 64px; z-index: 5;', 'position: sticky; top: var(--topbar-h); z-index: 5;')
    # --- оранжевые остатки в демонстрационной «странице магазина»
    css = sub1(css, '.lp-demo .btn-primary { background: #f59e0b; border-color: #f59e0b; color: #fff; font-weight: 600; }', '.lp-demo .btn-primary { background: #6d3fe0; border-color: #6d3fe0; color: #fff; font-weight: 600; }')
    css = sub1(css, '.lp-demo .lp-hit { outline: 2px solid #f97316 !important; outline-offset: 2px; box-shadow: 0 0 0 5px rgba(249, 115, 22, .22); position: relative; }', '.lp-demo .lp-hit { outline: 2px solid #6d3fe0 !important; outline-offset: 2px; position: relative; }')
    css = sub1(css, 'border-radius: 8px; background: #f97316; color: #fff;', 'border-radius: 8px; background: #6d3fe0; color: #fff;')
    css = sub1(css, '.tr-hl { outline: 2px solid #f97316; outline-offset: 2px; }', '.tr-hl { outline: 2px solid #6d3fe0; outline-offset: 2px; }')
    # --- радиусы: три ступени вместо одиннадцати
    def rad(m):
        n = int(m.group(1))
        if n in (14, 16, 18): return 'border-radius: var(--radius)'
        if n in (10, 11, 12, 13): return 'border-radius: var(--radius-sm)'
        if n in (5, 6, 7, 8, 9): return 'border-radius: var(--radius-xs)'
        return m.group(0)
    css = re.sub(r'border-radius: (\d+)px(?![\w%])', rad, css)
    # --- блок «V2» → именованные компоненты
    a = css.index('/* V2: supplementary teaching surfaces')
    b = css.index('</style>') if '</style>' in css else len(css)
    css = css[:a] + COMPONENTS_CSS + css[b:]
    # --- кнопки и длинные подписи
    css = sub1(css, 'font-weight: 600; font-size: .9rem; white-space: nowrap; transition', 'font-weight: 600; font-size: .9rem; max-width: 100%; white-space: nowrap; transition')
    return css


SIDEBAR_BG = '''@media screen {
  .sidebar { background: linear-gradient(rgba(0, 0, 0, calc(1 - var(--background-level))), rgba(0, 0, 0, calc(1 - var(--background-level)))), linear-gradient(155deg, #211a42, #10182b 48%, #142a3c); }
  :root[data-theme="light"] .sidebar { background: linear-gradient(rgba(255, 255, 255, calc(1 - var(--background-level))), rgba(255, 255, 255, calc(1 - var(--background-level)))), linear-gradient(155deg, #eef0ff, #f1f5ff 60%, #eaf6ff); }
}
'''

COMPONENTS_CSS = '''/* ============ Практика и учебные лаборатории ============ */
.task-card { border: 1px solid var(--border-2); border-radius: var(--radius); padding: 18px 20px; margin: 18px 0; background: var(--surface); }
.task-card h3 { margin: 0 0 10px; font-size: 1.12rem; }
.task-card p { margin: 0 0 .7em; }
.task-check { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; cursor: pointer; min-height: 44px; }
.task-check input { width: 20px; height: 20px; flex: none; margin-top: 2px; accent-color: var(--accent); }
.dom-lab { padding: 18px 20px; border: 1px solid var(--border-2); border-radius: var(--radius); background: var(--surface-2); margin: 18px 0; }
.dom-lab .legacy-form { padding: 14px; margin: 12px 0; border: 1px dashed var(--border-2); border-radius: var(--radius-sm); }
.dom-lab .legacy-form button { min-height: 40px; padding: 0 18px; border-radius: var(--radius-xs); border: 1px solid var(--accent); background: var(--surface); color: var(--text); }
.note-small { font-size: .85rem; color: var(--text-muted); }
.code-block pre, .table-wrap { max-width: 100%; overflow-x: auto; }
.iq-q, .check > summary > span { min-width: 0; overflow-wrap: anywhere; }
details.iq > summary .chev, details.check > summary .ico { flex: none; }
@media (max-width: 760px) {
  .ch-toc { flex-wrap: nowrap; overflow-x: auto; align-items: center; padding: 10px 12px; margin-bottom: 20px; }
  .ch-toc-label { width: auto; flex: none; margin: 0 4px 0 0; }
  .ch-toc a { flex: none; white-space: nowrap; padding: 7px 12px; }
  .code-head { flex-wrap: wrap; }
  .code-title { order: 3; flex: 1 1 100%; min-width: 0; }
}
/* закреплённая панель букв глоссария: сплошной фон, на телефоне не закрепляется */
.gl-letters { background: var(--bg); }
@media (max-width: 760px) { .gl-letters { position: static; } }
/* без JS меню всегда открыто, кнопки меню не нужны */
.no-js .sidebar-close, .no-js .menu-btn { display: none !important; }
@media (max-width: 480px) { .task-card, .dom-lab { padding: 14px; } .btn { white-space: normal; } }
@media print { h2, h3, h4 { break-after: avoid; } .js body.print-all .chapter { display: block !important; break-before: page; } .recall { break-inside: auto !important; } .js .chapter.is-active { display: block !important; } .task-card, .dom-lab { background: #fff; } .task-check, .dom-lab [data-lab-mutate], [data-practice-reset] { display: none; } }
'''

PRACTICE_JS = '''<script>
(function(){
 'use strict';
 var KEY='aqalab:practice', OLD='aqalab:skills-v2', STEPS=['junior','middle','middle-plus'], done={};
 function read(k){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch(e){return null;}}
 done=read(KEY)||read(OLD)||{};
 function summary(extra){
   var out=document.getElementById('practice-summary'); if(!out) return;
   var n=STEPS.filter(function(k){return done[k];}).length;
   out.textContent='Практических этапов отмечено: '+n+' из 3. Это самооценка, а не подтверждение квалификации.'+(extra||'');
 }
 function sync(){
   document.querySelectorAll('[data-practice-step]').forEach(function(x){x.checked=!!done[x.dataset.practiceStep];});
   summary();
 }
 function save(){
   try{localStorage.setItem(KEY,JSON.stringify(done));}
   catch(e){summary(' Отметки не сохранены: хранилище браузера недоступно.');}
 }
 document.addEventListener('change',function(e){
   var t=e.target; if(t.matches&&t.matches('[data-practice-step]')){done[t.dataset.practiceStep]=t.checked;sync();save();}
 });
 document.addEventListener('click',function(e){
   if(e.target.closest('[data-practice-reset]')){done={};sync();save();return;}
   var mutate=e.target.closest('[data-lab-mutate]'); if(!mutate) return;
   var lab=mutate.closest('.dom-lab'), dom=lab.querySelector('[data-lab-dom]'), button=dom.querySelector('button');
   if(dom.firstElementChild===button){var w=document.createElement('div');w.className='new-wrapper';button.replaceWith(w);w.append(button);mutate.textContent='Убрать обёртку';}
   else{dom.append(button);dom.querySelector('.new-wrapper').remove();mutate.textContent='Добавить обёртку';}
   var css=dom.querySelectorAll(':scope > button').length;
   var role=Array.from(dom.querySelectorAll('button')).filter(function(x){return x.getAttribute('aria-label')==='Войти';}).length;
   lab.querySelector('[data-lab-result]').textContent='CSS по прямому потомку: '+css+' совпадений. Кнопка с доступным именем «Войти»: '+role+' совпадение.';
 });
 sync();
})();
</script>'''


# ----------------------------------------------------------------------------- документ
def patch_document(doc, chaps):
    # заголовок
    doc = doc.replace('<title>AQA Lab V2 — от первых проверок до инженерной автоматизации</title>', '<title>AQA Lab — от первых проверок до инженерной автоматизации</title>')
    assert 'AQA Lab V2' not in doc.split('<body>')[0]
    # CSS
    s0 = doc.index('<style>') + 7
    s1 = doc.index('</style>')
    css = doc[s0:s1]
    k = css.index('/* =====')
    css = css[:k] + patch_css(css[k:])
    doc = doc[:s0] + css + doc[s1:]
    # sidebar TOC: единый значок «изучено», ссылка на «О учебнике»
    doc = doc.replace('<span class="toc-read" title="Изучено">✓</span>', '<span class="toc-read" title="Изучено"><svg class="ico" viewbox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span>')
    tick = '<span class="toc-read" title="Изучено"><svg class="ico" viewbox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7"></path></svg></span>'
    anchor = '<li><a class="toc-link" href="#/interview" data-id="interview">'
    i = doc.index(anchor); j = doc.index('</li>', i) + 5
    doc = doc[:j] + f'\n<li><a class="toc-link" href="#/about" data-id="about"><span class="toc-num">·</span><span>О учебнике</span>{tick}</a></li>' + doc[j:]
    # book-data
    m = re.search(r'(<script type="application/json" id="book-data">)(.*?)(</script>)', doc, re.S)
    d = json.loads(m.group(2))
    for s in d['sections']:
        if s['id'] == 'ref': s['chapters'].append('about')
    d['chapters'].append({'id': 'about', 'title': 'О учебнике: версии, источники и проверки', 'short': 'О учебнике', 'section': 'ref', 'num': None, 'countable': False})
    for c in d['chapters']:
        if c['id'] == 'first-run': c['title'] = 'Первый запуск: от терминала до проверки'
    blob = json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    doc = doc[:m.start(2)] + blob + doc[m.end(2):]
    # скрипт практики
    a = doc.index("<script>\n(function(){\n 'use strict';\n const KEY='aqalab:skills-v2';")
    b = doc.index('</script>', a) + 9
    doc = doc[:a] + PRACTICE_JS + doc[b:]
    doc = patch_js(doc)
    return doc


def patch_js(doc):
    # 1. Подсказка термина доступна с клавиатуры: фокус переходит внутрь, закрытие возвращает фокус на термин
    old = "    if (t) { e.preventDefault(); if (popFor === t && !pop.hidden) closePop(); else openPop(t); return; }"
    new = "    if (t) { e.preventDefault(); if (popFor === t && !pop.hidden) closePop(); else { openPop(t); if (e.detail === 0) pop.focus({ preventScroll: true }); } return; }"
    assert doc.count(old) == 1; doc = doc.replace(old, new)
    old = "    pop.hidden = false;\n    const r = btn.getBoundingClientRect()"
    new = "    pop.hidden = false; pop.tabIndex = -1;\n    const r = btn.getBoundingClientRect()"
    assert doc.count(old) == 1; doc = doc.replace(old, new)
    old = "  window.addEventListener('scroll', () => { if (popFor && !pop.contains(document.activeElement)) closePop(); }, { passive: true });"
    new = old + "\n  pop.addEventListener('focusout', (e) => { if (popFor && !pop.contains(e.relatedTarget) && e.relatedTarget !== popFor) closePop(); });"
    assert doc.count(old) == 1; doc = doc.replace(old, new)
    # 2. Подсказка «Клавиши»: Esc закрывает и меню
    doc = doc.replace('<kbd>Esc</kbd> — закрыть подсказку.</small>', '<kbd>Esc</kbd> — закрыть подсказку или меню.</small>')
    return doc
