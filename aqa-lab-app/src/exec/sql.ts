// Клиент SQL-тренажёра. Worker пересоздаётся после таймаута или остановки.
import type { DatasetId, DatasetVerdict, SqlReq, Table } from './sql.worker';
export type { DatasetId, DatasetVerdict, Table };
export { DATASETS } from '../../shared/shop-data.mjs';

type Pending = { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
function get() {
  if (!worker) {
    worker = new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; clearTimeout(p.timer); pending.delete(e.data.id); p.resolve(e.data); };
  }
  return worker;
}
export function stopSql(reason = 'Выполнение остановлено.') {
  worker?.terminate(); worker = null;
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(reason)); }
  pending.clear();
}
type Body = SqlReq extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;
function call(body: Body, timeoutMs: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => stopSql(`Запрос выполнялся дольше ${timeoutMs / 1000} с и был остановлен. Проверьте условия соединения и бесконечные генераторы строк.`), timeoutMs);
    pending.set(id, { resolve, reject, timer });
    get().postMessage({ id, ...body });
  });
}
export async function runSql(sql: string, dataset: DatasetId, fresh = false) {
  const r = await call({ op: 'run', sql, dataset, fresh }, 8000 + (worker ? 0 : 20000));
  if (r.error) throw new Error(String(r.error));
  return r as unknown as { results: Table[]; ms: number };
}
export async function checkSql(p: { sql: string; reference: string; ordered: boolean; datasets: DatasetId[]; verify?: string }) {
  const r = await call({ op: 'check', ...p }, 15000 + (worker ? 0 : 20000));
  if (r.error) throw new Error(String(r.error));
  return r.verdicts as DatasetVerdict[];
}
export async function sqlSchema() {
  const r = await call({ op: 'schema' }, 30000);
  return r.schema as { table_name: string; column_name: string; data_type: string; is_nullable: string }[];
}
