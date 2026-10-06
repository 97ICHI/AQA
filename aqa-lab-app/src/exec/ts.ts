// Клиент TypeScript-тренажёра: компиляция в постоянном Worker, выполнение в одноразовом Worker с таймаутом.
import type { CompileResult } from './ts-compile.worker';
export type RunEvent = { type: 'log'; level: string; text: string } | { type: 'error'; phase: 'runtime'; name: string; message: string; stack?: string } | { type: 'test'; name: string; ok: boolean; message?: string } | { type: 'done'; ms: number } | { type: 'timeout'; ms: number } | { type: 'stopped' };

let compiler: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (r: { result?: CompileResult; error?: string }) => void>();
function getCompiler() {
  if (!compiler) {
    compiler = new Worker(new URL('./ts-compile.worker.ts', import.meta.url), { type: 'module' });
    compiler.onmessage = (e) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
  }
  return compiler;
}
export function compileTs(files: Record<string, string>): Promise<CompileResult> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, (r) => (r.result ? resolve(r.result) : reject(new Error(r.error))));
    getCompiler().postMessage({ id, files });
  });
}

export interface Running { stop(): void; done: Promise<void> }
export function runJs(modules: Record<string, string>, entry: string, onEvent: (e: RunEvent) => void, timeoutMs = 3000): Running {
  const w = new Worker(new URL('./ts-run.worker.ts', import.meta.url), { type: 'module' });
  let finished = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  const finish = (e?: RunEvent) => { if (finished) return; finished = true; clearTimeout(timer); w.terminate(); if (e) onEvent(e); resolveDone(); };
  const timer = setTimeout(() => finish({ type: 'timeout', ms: timeoutMs }), timeoutMs);
  w.onmessage = (e: MessageEvent<RunEvent>) => { onEvent(e.data); if (e.data.type === 'done') finish(); };
  w.onerror = (e) => { e.preventDefault(); finish({ type: 'error', phase: 'runtime', name: 'Error', message: e.message || 'Ошибка загрузки кода' }); };
  w.postMessage({ modules, entry });
  return { stop: () => finish({ type: 'stopped' }), done };
}
