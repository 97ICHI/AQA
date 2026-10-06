// Клиент Python-тренажёра. Остановка = завершение Worker (Pyodide перезагружается при следующем запуске).
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void; timer?: ReturnType<typeof setTimeout> }>();
let loaded = false;
const listeners = new Set<(s: PyState) => void>();
export type PyState = 'idle' | 'loading' | 'ready';
let state: PyState = 'idle';
const setState = (s: PyState) => { state = s; listeners.forEach((f) => f(s)); };
export const pyState = () => state;
export const onPyState = (f: (s: PyState) => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

function get() {
  if (!worker) {
    worker = new Worker(new URL('./py.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; if (p.timer) clearTimeout(p.timer); pending.delete(e.data.id); p.resolve(e.data); };
    loaded = false;
  }
  return worker;
}
export function stopPy(reason = 'Выполнение остановлено.') {
  worker?.terminate(); worker = null; loaded = false; setState('idle');
  for (const p of pending.values()) { if (p.timer) clearTimeout(p.timer); p.reject(new Error(reason)); }
  pending.clear();
}
function call(body: object, timeoutMs: number): Promise<Record<string, unknown>> {
  const firstLoad = !loaded;
  if (firstLoad) setState('loading');
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const id = ++seq;
    const base = new URL('./', document.baseURI).href;
    const timer = setTimeout(() => stopPy(`Код выполнялся дольше ${timeoutMs / 1000} с и был остановлен. Частая причина — бесконечный цикл.`), timeoutMs + (firstLoad ? 60000 : 0));
    pending.set(id, { resolve, reject, timer });
    get().postMessage({ id, base, ...body });
  }).then((r) => { loaded = true; setState('ready'); return r; });
}
export async function runPy(code: string) {
  const r = await call({ op: 'run', code }, 8000);
  if (r.error && r.output === undefined) throw new Error(String(r.error));
  return r as { output: string; error?: string; ms: number };
}
export async function pytest(files: Record<string, string>) {
  const r = await call({ op: 'pytest', files }, 15000);
  if (r.error) throw new Error(String(r.error));
  return r as { output: string; exitCode: number };
}
