// Задание: редактор с черновиком, проверка по поведению, ступенчатые подсказки, разбор.
import { useEffect, useRef, useState } from 'react';
import type { Exercise as Ex } from '../content/exercises/types';
import { CodeEditor, type EditorHandle, type Lang } from './CodeEditor';
import { ExecLabel, ResultTable, Tabs } from './common';
import { runCheck, stopTsCheck, type CheckReport } from '../exec/check';
import { stopSql } from '../exec/sql';
import { stopPy, onPyState, pyState, type PyState } from '../exec/py';
import { stopPlaywright, useRunnerStatus } from '../exec/runner';
import { store, useStore } from '../lib/store';
import { highlight } from '../lib/highlight';
import { renderInline } from '../lib/markdown';

const LANG: Record<Ex['kind'], Lang> = { ts: 'ts', 'ts-test': 'ts', sql: 'sql', py: 'py', 'py-test': 'py', pw: 'ts' };
const ENGINE: Record<Ex['kind'], string> = { ts: 'TypeScript + Web Worker', 'ts-test': 'TypeScript + Web Worker', sql: 'PostgreSQL (PGlite)', py: 'Python + pytest (Pyodide)', 'py-test': 'Python + pytest (Pyodide)', pw: 'Playwright через локальный runner' };
const HINT_STEP = ['Направление', 'Идея', 'Фрагмент'];

export function Exercise({ ex }: { ex: Ex }) {
  const draft = useStore((s) => s.drafts[ex.id]);
  const done = useStore((s) => !!s.progress.practice[ex.id]);
  const runner = useRunnerStatus();
  const [code, setCode] = useState(draft ?? ex.starter);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [hints, setHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [tab, setTab] = useState('task');
  const [py, setPy] = useState<PyState>(pyState());
  const editor = useRef<EditorHandle | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => onPyState(setPy), []);
  useEffect(() => {
    const t = setTimeout(() => setSaveFailed(!store.saveDraft(ex.id, code === ex.starter ? null : code)), 400);
    return () => clearTimeout(t);
  }, [code, ex.id, ex.starter]);

  const needsRunner = ex.kind === 'pw' && runner !== 'online';
  const check = async () => {
    if (busy || needsRunner) return;
    setBusy(true); setReport(null); setTab('result');
    const r = await runCheck(ex, code);
    setReport(r); setBusy(false);
    if (r.ok) store.markPractice(ex.id);
    setTimeout(() => resultRef.current?.focus(), 30);
  };
  const stop = () => {
    if (ex.kind === 'sql') stopSql(); else if (ex.kind === 'py' || ex.kind === 'py-test') stopPy(); else if (ex.kind === 'pw') void stopPlaywright(); else stopTsCheck();
  };
  const reset = () => {
    if (code !== ex.starter && !confirm('Вернуть стартовый код? Ваш черновик будет удалён.')) return;
    editor.current?.setValue(ex.starter); setCode(ex.starter); setReport(null);
  };

  return (
    <section className={'exercise' + (done ? ' done' : '')} id={'ex-' + ex.id} aria-labelledby={'ex-t-' + ex.id}>
      <header className="ex-head">
        <div>
          <span className="ex-kicker">Задание{done ? ' · выполнено ✓' : ''}</span>
          <h3 id={'ex-t-' + ex.id}>{ex.title}</h3>
        </div>
        <ExecLabel kind="real" detail={ENGINE[ex.kind]} />
      </header>
      <Tabs tabs={[{ id: 'task', label: 'Задача' }, { id: 'code', label: 'Код' }, { id: 'result', label: 'Результат' }]} active={tab} onChange={setTab} />
      <div className={'ex-body tab-' + tab}>
        <div className="ex-task pane-task">
          <p dangerouslySetInnerHTML={{ __html: renderInline(ex.goal) }} />
          {ex.kind === 'sql' && <p className="muted small">Проверка: ваш запрос и эталон выполняются на {ex.datasets.length} {ex.datasets.length === 1 ? 'наборе' : 'наборах'} данных; {ex.ordered ? 'порядок строк важен' : 'порядок строк не важен'}, имена столбцов не сравниваются.</p>}
          {(ex.kind === 'ts-test' || ex.kind === 'py-test') && (
            <details className="tested-code"><summary>Код, который вы тестируете ({ex.kind === 'ts-test' ? 'app.ts' : 'shop.py'}, исправная версия)</summary>
              <pre><code dangerouslySetInnerHTML={{ __html: highlight(ex.good, LANG[ex.kind]) }} /></pre></details>
          )}
          {(ex.kind === 'ts-test' || ex.kind === 'py-test') && <p className="muted small">Проверка: ваши тесты запускаются на исправной версии (должны пройти) и на {ex.broken.length} версиях с дефектами (каждая должна быть поймана).</p>}
          {ex.kind === 'pw' && <p className="muted small">Проверка: тест запускается настоящим Playwright на учебном магазине — исправном и с включёнными дефектами.</p>}
        </div>
        <div className="ex-code pane-code">
          <div className="ex-toolbar">
            <button type="button" className="btn primary" onClick={check} disabled={busy || needsRunner} aria-describedby={needsRunner ? 'nr-' + ex.id : undefined}>{busy ? 'Проверяю…' : 'Проверить'}</button>
            {busy && <button type="button" className="btn" onClick={stop}>Остановить</button>}
            <button type="button" className="btn ghost" onClick={reset} disabled={busy}>Сбросить</button>
            <button type="button" className="btn ghost" onClick={() => navigator.clipboard?.writeText(code)}>Копировать</button>
            <span className="kbd-hint">Ctrl+Enter — проверить</span>
          </div>
          <CodeEditor value={code} onChange={setCode} lang={LANG[ex.kind]} label={`Код задания «${ex.title}»`} onRun={check} handle={(h) => (editor.current = h)} />
          {saveFailed && <p className="warn-line" role="status">Черновик не сохраняется: хранилище браузера недоступно. Скопируйте код перед закрытием вкладки.</p>}
          {needsRunner && <p className="warn-line" id={'nr-' + ex.id}>Для этого задания нужен локальный runner Playwright: <a href="#/about/runner">как запустить</a>. Код можно писать и без него — черновик сохраняется.</p>}
          {busy && (ex.kind === 'py' || ex.kind === 'py-test') && py === 'loading' && <p className="muted small" role="status">Загружается Python (около 15 МБ, один раз за сессию)…</p>}
        </div>
        <div className="ex-result pane-result" ref={resultRef} tabIndex={-1} aria-live="polite">
          {!report && !busy && <p className="muted">Здесь появится результат проверки.</p>}
          {busy && <p className="muted">Выполняю проверку…</p>}
          {report && <Report r={report} />}
          {report?.ok && (
            <div className="ex-explain">
              <h4>Разбор</h4>
              <p dangerouslySetInnerHTML={{ __html: renderInline(ex.explanation) }} />
            </div>
          )}
        </div>
      </div>
      <div className="ex-help">
        {ex.hints.slice(0, hints).map((h, i) => (
          <div key={i} className="hint"><span className="hint-step">Подсказка {i + 1}. {HINT_STEP[i]}</span> <span dangerouslySetInnerHTML={{ __html: renderInline(h) }} /></div>
        ))}
        <div className="ex-help-actions">
          {hints < 3 && <button type="button" className="btn ghost" onClick={() => setHints(hints + 1)}>{hints === 0 ? 'Нужна подсказка' : 'Следующая подсказка'}</button>}
          {hints >= 3 && !showSolution && <button type="button" className="btn ghost" onClick={() => setShowSolution(true)}>Показать решение и разбор</button>}
        </div>
        {showSolution && (
          <div className="solution">
            <h4>Эталонное решение</h4>
            <pre><code dangerouslySetInnerHTML={{ __html: highlight(ex.solution, LANG[ex.kind]) }} /></pre>
            <p dangerouslySetInnerHTML={{ __html: renderInline(ex.explanation) }} />
            <button type="button" className="btn ghost" onClick={() => { editor.current?.setValue(ex.solution); setCode(ex.solution); }}>Вставить в редактор</button>
          </div>
        )}
        {ex.mistakes?.length ? (
          <details className="mistakes"><summary>Частые ошибки</summary><ul>{ex.mistakes.map((m, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(m) }} />)}</ul></details>
        ) : null}
      </div>
    </section>
  );
}

function Report({ r }: { r: CheckReport }) {
  const stage = r.stage === 'types' ? 'Ошибка типов (до запуска)' : r.stage === 'runtime' ? 'Ошибка при выполнении' : r.stage === 'error' ? 'Проверка не выполнена' : r.ok ? 'Готово' : 'Пока не совпадает';
  return (
    <div className={'report ' + (r.ok ? 'ok' : 'bad')}>
      <p className="report-head"><strong>{stage}.</strong> {r.summary}</p>
      <ul className="report-items">
        {r.items.map((it, i) => (
          <li key={i} className={it.ok ? 'ok' : 'bad'}>
            <span className="ri-mark" aria-hidden="true">{it.ok ? '✓' : '✗'}</span>
            <span className="ri-label">{it.label}<span className="sr-only">{it.ok ? ' — пройдено' : ' — не пройдено'}</span></span>
            {it.detail && <pre className="ri-detail">{it.detail}</pre>}
            {it.output && <details open={!it.ok}><summary>Вывод</summary><pre className="ri-output">{it.output}</pre></details>}
            {(it.expected || it.actual) && (
              <div className="ri-tables">
                {it.expected && <ResultTable t={it.expected} caption="Ожидается" />}
                {it.actual && <ResultTable t={it.actual} caption="Ваш результат" />}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
