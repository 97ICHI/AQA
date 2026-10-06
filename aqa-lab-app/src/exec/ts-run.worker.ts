/// <reference lib="webworker" />
// Одноразовый Worker для выполнения скомпилированного кода ученика. Нет доступа к DOM и данным приложения.
// Главный поток завершает его по таймауту или кнопке «Остановить».
type Out = { type: 'log'; level: string; text: string } | { type: 'error'; phase: 'runtime'; name: string; message: string; stack?: string } | { type: 'test'; name: string; ok: boolean; message?: string } | { type: 'done'; ms: number };
const post = (m: Out) => (self as unknown as Worker).postMessage(m);

function fmt(v: unknown, depth = 0): string {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : v;
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
  if (typeof v === 'bigint') return v + 'n';
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (v instanceof Promise) return 'Promise { <pending> }';
  if (typeof v !== 'object') return String(v);
  if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]';
  if (Array.isArray(v)) return '[ ' + v.map((x) => fmt(x, depth + 1)).join(', ') + ' ]';
  if (v instanceof Map) return `Map(${v.size}) { ${[...v].map(([k, x]) => fmt(k, depth + 1) + ' => ' + fmt(x, depth + 1)).join(', ')} }`;
  if (v instanceof Set) return `Set(${v.size}) { ${[...v].map((x) => fmt(x, depth + 1)).join(', ')} }`;
  const entries = Object.entries(v as Record<string, unknown>);
  return '{ ' + entries.map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${fmt(x, depth + 1)}`).join(', ') + ' }';
}
const g = self as unknown as Record<string, unknown>;
for (const level of ['log', 'info', 'warn', 'error']) {
  (console as unknown as Record<string, unknown>)[level] = (...a: unknown[]) => post({ type: 'log', level, text: a.map((x) => fmt(x)).join(' ') });
}
(console as unknown as Record<string, unknown>).table = (d: unknown) => post({ type: 'log', level: 'log', text: fmt(d) });

// таймеры с учётом незавершённых
let pending = 0;
const realST = setTimeout, realCT = clearTimeout, realSI = setInterval, realCI = clearInterval;
const live = new Set<number>();
g.setTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => { pending++; const id = realST(() => { if (live.delete(id)) pending--; fn(...args); }, ms) as unknown as number; live.add(id); return id; };
g.clearTimeout = (id: number) => { if (live.delete(id)) pending--; realCT(id); };
g.setInterval = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => { pending++; const id = realSI(fn, ms, ...args) as unknown as number; live.add(id); return id; };
g.clearInterval = (id: number) => { if (live.delete(id)) pending--; realCI(id); };
g.sleep = (ms: number) => new Promise((r) => (g.setTimeout as (f: () => void, m: number) => void)(() => r(undefined), ms));
g.fakeFetchOrder = (id: number) => new Promise((r) => (g.setTimeout as (f: () => void, m: number) => void)(() => r({ id, status: 'paid', total: id === 42 ? '9980' : 2990, items: [{ sku: 'PULSE-01', qty: 2 }] }), 50));

// мини-API для проверок заданий
const tests: { name: string; fn: () => unknown }[] = [];
g.test = (name: string, fn: () => unknown) => tests.push({ name, fn });
const show = (v: unknown) => fmt(v, 1);
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
g.expectEq = (actual: unknown, expected: unknown, msg?: string) => { if (!deepEq(actual, expected)) throw new Error(`${msg ? msg + ': ' : ''}ожидалось ${show(expected)}, получено ${show(actual)}`); };
g.expectTrue = (v: unknown, msg: string) => { if (!v) throw new Error(msg); };
g.expectThrows = async (fn: () => unknown, msg: string) => { try { await fn(); } catch { return; } throw new Error(msg); };

let unhandled: unknown[] = [];
self.addEventListener('unhandledrejection', (e) => { unhandled.push(e.reason); e.preventDefault(); });

self.onmessage = async (e: MessageEvent<{ modules: Record<string, string>; entry: string }>) => {
  const t0 = performance.now();
  // модули → blob URL; './x' в import заменяется на URL модуля
  const urls: Record<string, string> = {};
  const order = Object.keys(e.data.modules).sort((a) => (a === e.data.entry ? 1 : -1));
  for (const name of order) {
    const code = e.data.modules[name].replace(/from\s+['"]\.\/([\w-]+)(?:\.ts)?['"]/g, (m, n) => (urls[n] ? `from '${urls[n]}'` : m));
    urls[name] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  try {
    await import(/* @vite-ignore */ urls[e.data.entry]);
    for (const t of tests) {
      try { await t.fn(); post({ type: 'test', name: t.name, ok: true }); } catch (err) { post({ type: 'test', name: t.name, ok: false, message: (err as Error)?.message ?? String(err) }); }
    }
    // дождаться таймеров и микрозадач, запущенных кодом
    for (let i = 0; i < 400 && pending > 0; i++) await new Promise((r) => realST(r, 25));
    await new Promise((r) => realST(r, 0));
    for (const r of unhandled) post({ type: 'error', phase: 'runtime', name: 'UnhandledPromiseRejection', message: `Promise отклонён, и ошибку никто не обработал: ${fmt(r)}` });
  } catch (err) {
    const x = err as Error;
    post({ type: 'error', phase: 'runtime', name: x?.name || 'Error', message: x?.message ?? String(err), stack: x?.stack?.split('\n').slice(0, 4).join('\n') });
  }
  post({ type: 'done', ms: Math.round(performance.now() - t0) });
};
