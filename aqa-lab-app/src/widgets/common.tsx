import type { ReactNode } from 'react';
import type { Table } from '../exec/sql';

export type ExecKind = 'real' | 'model' | 'recorded';
const EXEC: Record<ExecKind, { label: string; title: string }> = {
  real: { label: 'Настоящее выполнение', title: 'Код действительно выполняется: компилятор TypeScript, PostgreSQL (PGlite), Python (Pyodide) или Playwright через локальный runner.' },
  model: { label: 'Учебная модель', title: 'Упрощённая модель для объяснения идеи. Это не настоящий Playwright/браузер — поведение реального инструмента полнее.' },
  recorded: { label: 'Записанный сценарий', title: 'Показан заранее записанный результат настоящего запуска. Код сейчас не выполняется.' },
};
export function ExecLabel({ kind, detail }: { kind: ExecKind; detail?: string }) {
  return <span className={'exec-label exec-' + kind} title={EXEC[kind].title}>{EXEC[kind].label}{detail ? <small> · {detail}</small> : null}</span>;
}

export function ResultTable({ t, caption }: { t: Table; caption?: string }) {
  if (!t.fields.length) return <p className="out-note">{t.command || 'Команда'} выполнена{t.affected !== undefined ? `, затронуто строк: ${t.affected}` : ''}.</p>;
  return (
    <div className="table-wrap" tabIndex={0}>
      <table className="result">
        {caption && <caption>{caption}</caption>}
        <thead><tr>{t.fields.map((f, i) => <th key={i} scope="col">{f}</th>)}</tr></thead>
        <tbody>{t.rows.slice(0, 200).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={c === 'NULL' ? 'null' : undefined}>{c}</td>)}</tr>)}</tbody>
      </table>
      <p className="out-note">{t.rows.length} {plural(t.rows.length, 'строка', 'строки', 'строк')}{t.rows.length > 200 ? ' (показаны первые 200)' : ''}</p>
    </div>
  );
}
export const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many;
};

export type OutLine = { kind: 'log' | 'warn' | 'error' | 'type' | 'info' | 'ok' | 'fail'; text: string };
export function OutputLines({ lines }: { lines: OutLine[] }) {
  if (!lines.length) return null;
  return <pre className="out-lines" tabIndex={0}>{lines.map((l, i) => <div key={i} className={'ol ol-' + l.kind}>{l.text}</div>)}</pre>;
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <div className="panel"><div className="panel-head"><span>{title}</span>{actions}</div>{children}</div>;
}

/** Мобильные вкладки: на узком экране показывается одна панель, на широком — все. */
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="m-tabs" role="tablist">
      {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={active === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>{t.label}</button>)}
    </div>
  );
}
