// Песочница: свободный запуск кода (TypeScript, SQL, Python или Playwright через runner).
import { useEffect, useRef, useState } from 'react';
import { CodeEditor, type EditorHandle } from './CodeEditor';
import { ExecLabel, OutputLines, ResultTable, Tabs, type OutLine } from './common';
import { compileTs, runJs, type Running } from '../exec/ts';
import { runSql, stopSql, DATASETS, sqlSchema, type DatasetId, type Table } from '../exec/sql';
import { runPy, stopPy, onPyState, type PyState } from '../exec/py';
import { runPlaywright, stopPlaywright, useRunnerStatus } from '../exec/runner';
import { store, useStore } from '../lib/store';

export interface PlaygroundSpec { type: 'playground'; id: string; lang: 'ts' | 'sql' | 'py' | 'pw'; code: string; title?: string; dataset?: DatasetId; variant?: string; recorded?: { variant: string; output: string } }
const ENGINE = { ts: 'TypeScript в Web Worker', sql: 'PostgreSQL (PGlite)', py: 'Python (Pyodide)', pw: 'Playwright через runner' };

export function Playground({ spec }: { spec: PlaygroundSpec }) {
  const key = 'pg-' + spec.id;
  const draft = useStore((s) => s.drafts[key]);
  const runner = useRunnerStatus();
  const [code, setCode] = useState(draft ?? spec.code);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<OutLine[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [ds, setDs] = useState<DatasetId>(spec.dataset ?? 'base');
  const [tab, setTab] = useState('code');
  const [pyS, setPyS] = useState<PyState>('idle');
  const [schema, setSchema] = useState<Record<string, string[]> | null>(null);
  const [showRecorded, setShowRecorded] = useState(false);
  const run = useRef<Running | null>(null);
  const ed = useRef<EditorHandle | null>(null);
  useEffect(() => onPyState(setPyS), []);
  useEffect(() => { const t = setTimeout(() => store.saveDraft(key, code === spec.code ? null : code), 400); return () => clearTimeout(t); }, [code, key, spec.code]);

  const exec = async () => {
    if (busy) return;
    setBusy(true); setLines([]); setTables([]); setTab('result'); setShowRecorded(false);
    const out: OutLine[] = [];
    const push = (l: OutLine) => { out.push(l); setLines([...out]); };
    try {
      if (spec.lang === 'ts') {
        const c = await compileTs({ '/main.ts': code });
        for (const d of c.diagnostics) push({ kind: 'type', text: `main.ts:${d.line}:${d.col} — error TS${d.code}: ${d.message}` });
        if (c.diagnostics.length) push({ kind: 'info', text: 'Проверка типов не пройдена. TypeScript всё равно может выдать JavaScript, и мы его запускаем — но в проекте с noEmitOnError или tsc --noEmit в CI такой код не прошёл бы.' });
        run.current = runJs({ main: c.js.main }, 'main', (e) => {
          if (e.type === 'log') push({ kind: e.level === 'error' ? 'error' : e.level === 'warn' ? 'warn' : 'log', text: e.text });
          else if (e.type === 'error') push({ kind: 'error', text: `${e.name}: ${e.message}` });
          else if (e.type === 'timeout') push({ kind: 'error', text: `Остановлено: дольше ${e.ms / 1000} с.` });
          else if (e.type === 'stopped') push({ kind: 'info', text: 'Остановлено.' });
          else if (e.type === 'done') push({ kind: 'info', text: `Готово за ${e.ms} мс.` });
        }, 5000);
        await run.current.done;
      } else if (spec.lang === 'sql') {
        const r = await runSql(code, ds);
        setTables(r.results);
        push({ kind: 'info', text: `PostgreSQL: выполнено за ${r.ms} мс. Изменения сохраняются до «Сбросить базу».` });
      } else if (spec.lang === 'py') {
        const r = await runPy(code);
        if (r.output) push({ kind: 'log', text: r.output });
        if (r.error) push({ kind: 'error', text: r.error });
        push({ kind: 'info', text: `Готово за ${r.ms} мс.` });
      } else {
        const r = await runPlaywright(code, [spec.variant ?? 'ok']);
        for (const run of r.runs) {
          push({ kind: 'info', text: `Магазин: ${run.label}` });
          for (const t of run.tests) push({ kind: t.status === 'passed' ? 'ok' : 'fail', text: `${t.status === 'passed' ? '✓' : '✗'} ${t.title} (${t.duration} мс)${t.error ? '\n' + t.error : ''}` });
          if (run.stderr) push({ kind: 'error', text: run.stderr });
          if (!run.tests.length) push({ kind: 'error', text: 'Тесты не найдены.' });
        }
      }
    } catch (err) { push({ kind: 'error', text: (err as Error).message }); }
    run.current = null; setBusy(false);
  };
  const stop = () => { if (spec.lang === 'ts') run.current?.stop(); else if (spec.lang === 'sql') stopSql(); else if (spec.lang === 'py') stopPy(); else void stopPlaywright(); };
  const loadSchema = async () => {
    const rows = await sqlSchema();
    const s: Record<string, string[]> = {};
    for (const r of rows) (s[r.table_name] ||= []).push(`${r.column_name} ${r.data_type}${r.is_nullable === 'YES' ? '' : ' NOT NULL'}`);
    setSchema(s);
  };
  const pwOffline = spec.lang === 'pw' && runner !== 'online';

  return (
    <section className="playground" aria-label={spec.title || 'Песочница'}>
      <header className="pg-head">
        <span className="pg-title">{spec.title || 'Попробуйте сами'}</span>
        {pwOffline && spec.recorded && showRecorded ? <ExecLabel kind="recorded" detail="runner не подключён" /> : <ExecLabel kind="real" detail={ENGINE[spec.lang]} />}
      </header>
      <Tabs tabs={[{ id: 'code', label: 'Код' }, { id: 'result', label: 'Результат' }]} active={tab} onChange={setTab} />
      <div className={'pg-body tab-' + tab}>
        <div className="pane-code">
          <div className="ex-toolbar">
            <button type="button" className="btn primary" onClick={exec} disabled={busy || pwOffline}>{busy ? 'Выполняется…' : 'Запустить'}</button>
            {busy && <button type="button" className="btn" onClick={stop}>Остановить</button>}
            <button type="button" className="btn ghost" onClick={() => { ed.current?.setValue(spec.code); setCode(spec.code); }} disabled={busy}>Исходный код</button>
            {spec.lang === 'sql' && (
              <>
                <label className="ds-pick">Данные: <select value={ds} onChange={(e) => setDs(e.target.value as DatasetId)}>{Object.entries(DATASETS).map(([k, d]) => <option key={k} value={k}>{d.title}</option>)}</select></label>
                <button type="button" className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); try { await runSql('select 1', ds, true); setLines([{ kind: 'info', text: `База пересоздана: «${DATASETS[ds].title}».` }]); setTables([]); } finally { setBusy(false); } }}>Сбросить базу</button>
                <button type="button" className="btn ghost" onClick={loadSchema}>Схема</button>
              </>
            )}
          </div>
          <CodeEditor value={code} onChange={setCode} lang={spec.lang === 'pw' ? 'ts' : spec.lang} label={spec.title || 'Код песочницы'} onRun={exec} handle={(h) => (ed.current = h)} minLines={4} />
          {pwOffline && (
            <p className="warn-line">Runner Playwright не подключён — запуск недоступен. <a href="#/about/runner">Как запустить runner</a>.{spec.recorded && !showRecorded && <> Или <button type="button" className="link-btn" onClick={() => { setShowRecorded(true); setTab('result'); }}>показать записанный результат</button>.</>}</p>
          )}
          {spec.lang === 'sql' && <p className="muted small">{DATASETS[ds].description}</p>}
          {schema && (
            <div className="schema">{Object.entries(schema).map(([t, cols]) => <div key={t}><strong>{t}</strong><ul>{cols.map((c) => <li key={c}><code>{c}</code></li>)}</ul></div>)}</div>
          )}
        </div>
        <div className="pane-result" aria-live="polite">
          {busy && spec.lang === 'py' && pyS === 'loading' && <p className="muted small">Загружается Python (около 15 МБ, один раз за сессию)…</p>}
          {showRecorded && spec.recorded && pwOffline && (
            <div className="recorded"><p className="muted small">Записанный результат настоящего запуска (магазин: {spec.recorded.variant}). Сейчас код не выполнялся; ваши изменения в редакторе на этот вывод не влияют.</p><pre className="out-lines">{spec.recorded.output}</pre></div>
          )}
          {tables.map((t, i) => <ResultTable key={i} t={t} />)}
          <OutputLines lines={lines} />
          {!busy && !lines.length && !tables.length && !showRecorded && <p className="muted">Нажмите «Запустить» (или Ctrl+Enter в редакторе).</p>}
        </div>
      </div>
    </section>
  );
}
