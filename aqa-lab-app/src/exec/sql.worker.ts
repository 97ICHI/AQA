/// <reference lib="webworker" />
// Настоящий PostgreSQL (PGlite, WASM) в отдельном Worker. Каждая проверка идёт на свежей базе.
import { PGlite } from '@electric-sql/pglite';
import { SCHEMA, DATASETS } from '../../shared/shop-data.mjs';

export type DatasetId = keyof typeof DATASETS;
export interface Table { fields: string[]; rows: string[][]; affected?: number; command?: string }
export type SqlReq =
  | { id: number; op: 'run'; sql: string; dataset: DatasetId; fresh?: boolean }
  | { id: number; op: 'check'; sql: string; reference: string; ordered: boolean; datasets: DatasetId[]; verify?: string }
  | { id: number; op: 'schema' };
export interface DatasetVerdict { dataset: DatasetId; ok: boolean; reason?: string; expected?: Table; actual?: Table; error?: string }

const TEXT_TYPES = [1082, 1083, 1114, 1184, 1186]; // date, time, timestamp, timestamptz, interval — показываем как в psql
const parsers = Object.fromEntries(TEXT_TYPES.map((t) => [t, (v: string) => v]));
async function freshDb(ds: DatasetId) {
  const db = new PGlite({ parsers });
  await db.exec(SCHEMA);
  await db.exec(DATASETS[ds].sql);
  return db;
}
const cell = (v: unknown): string => (v === null || v === undefined ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v));
function toTable(r: { fields: { name: string }[]; rows: Record<string, unknown>[] | unknown[][]; affectedRows?: number }, command?: string): Table {
  const fields = r.fields.map((f) => f.name);
  const rows = (r.rows as unknown[]).map((row) => (Array.isArray(row) ? row.map(cell) : fields.map((f) => cell((row as Record<string, unknown>)[f]))));
  return { fields, rows, affected: r.affectedRows, command };
}
async function execLast(db: PGlite, sql: string): Promise<{ all: Table[]; last: Table | null }> {
  const res = await db.exec(sql, { rowMode: 'array' });
  const all = res.map((r) => toTable(r as never));
  const withFields = all.filter((t) => t.fields.length);
  return { all, last: withFields.length ? withFields[withFields.length - 1] : null };
}

let playDb: PGlite | null = null;
let playDs: DatasetId | null = null;

function sameRows(a: string[][], b: string[][], ordered: boolean) {
  const key = (r: string[]) => JSON.stringify(r);
  const A = a.map(key), B = b.map(key);
  if (!ordered) { A.sort(); B.sort(); }
  return A.length === B.length && A.every((x, i) => x === B[i]);
}
function explain(exp: Table, act: Table, ordered: boolean): string {
  if (exp.fields.length !== act.fields.length) return `Ожидалось столбцов: ${exp.fields.length} (${exp.fields.join(', ')}), в вашем результате: ${act.fields.length} (${act.fields.join(', ')}).`;
  if (exp.rows.length !== act.rows.length) return `Ожидалось строк: ${exp.rows.length}, получено: ${act.rows.length}.`;
  if (ordered && sameRows(exp.rows, act.rows, false)) return 'Строки те же, но порядок другой. В задании порядок важен — проверьте ORDER BY.';
  const ek = new Set(exp.rows.map((r) => JSON.stringify(r)));
  const extra = act.rows.find((r) => !ek.has(JSON.stringify(r)));
  return extra ? `Строка ${extra.join(' | ')} не ожидалась на этих данных.` : 'Значения отличаются от ожидаемых.';
}

self.onmessage = async (e: MessageEvent<SqlReq>) => {
  const m = e.data;
  const reply = (body: object) => (self as unknown as Worker).postMessage({ id: m.id, ...body });
  try {
    if (m.op === 'schema') {
      const db = await freshDb('base');
      const r = await db.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(`select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema='public' order by table_name, ordinal_position`);
      await db.close();
      return reply({ schema: r.rows });
    }
    if (m.op === 'run') {
      if (!playDb || playDs !== m.dataset || m.fresh) { await playDb?.close(); playDb = await freshDb(m.dataset); playDs = m.dataset; }
      const t0 = performance.now();
      const { all } = await execLast(playDb, m.sql);
      return reply({ results: all, ms: Math.round(performance.now() - t0) });
    }
    if (m.op === 'check') {
      const verdicts: DatasetVerdict[] = [];
      for (const ds of m.datasets) {
        const ref = await freshDb(ds), stu = await freshDb(ds);
        try {
          const e1 = await execLast(ref, m.reference);
          let expected = e1.last;
          let actual: Table | null = null;
          try {
            const s = await execLast(stu, m.sql);
            actual = s.last;
          } catch (err) { verdicts.push({ dataset: ds, ok: false, error: (err as Error).message }); continue; }
          if (m.verify) { expected = (await execLast(ref, m.verify)).last; actual = (await execLast(stu, m.verify)).last; }
          if (!expected) throw new Error('эталон не вернул таблицу');
          if (!actual) { verdicts.push({ dataset: ds, ok: false, reason: 'Запрос не вернул таблицу. Нужен SELECT (или выполните изменение, если задание про INSERT/UPDATE/DELETE).', expected }); continue; }
          const ok = expected.fields.length === actual.fields.length && sameRows(expected.rows, actual.rows, m.ordered);
          verdicts.push({ dataset: ds, ok, expected, actual, reason: ok ? undefined : explain(expected, actual, m.ordered) });
        } finally { await ref.close(); await stu.close(); }
      }
      return reply({ verdicts });
    }
  } catch (err) {
    reply({ error: (err as Error).message });
  }
};
