// Связь с локальным runner Playwright (127.0.0.1:7357). Runner запускается учеником на своём компьютере: npm run runner.
// Защита: runner принимает /run только с токеном, который печатает при запуске (иначе любой сайт мог бы отправить код на localhost).
import { useSyncExternalStore } from 'react';
import { load, save } from '../lib/storage';
let token: string = load<string>('runner-token', '');
export const runnerToken = () => token;
export function setRunnerToken(t: string) { token = t.trim(); save('runner-token', token); void runnerStatus(); }
export const RUNNER_URL = 'http://127.0.0.1:7357';
export type RunnerStatus = 'checking' | 'online' | 'offline' | 'token';
let status: RunnerStatus = 'checking';
let info: { playwright?: string; browsers?: string[] } = {};
const subs = new Set<() => void>();
const set = (s: RunnerStatus) => { status = s; subs.forEach((f) => f()); };

export async function runnerStatus(): Promise<RunnerStatus> {
  set('checking');
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(RUNNER_URL + '/health', { signal: ctl.signal, headers: token ? { 'x-runner-token': token } : {} });
    clearTimeout(t);
    info = await r.json();
    set(r.ok ? 'online' : r.status === 401 ? 'token' : 'offline');
  } catch { set('offline'); }
  return status;
}
export const runnerInfo = () => info;
export const useRunnerStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => status);

export interface PwTestResult { title: string; status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'; duration: number; error?: string; steps?: string[] }
export interface PwRunResult { variant: string; label: string; ok: boolean; exitCode: number | null; tests: PwTestResult[]; stderr?: string; timedOut?: boolean; ms: number }
export interface PwRunResponse { runs: PwRunResult[]; error?: string }

let current: AbortController | null = null;
export async function runPlaywright(code: string, variants: string[], opts: { timeoutMs?: number } = {}): Promise<PwRunResponse> {
  current?.abort();
  current = new AbortController();
  const r = await fetch(RUNNER_URL + '/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-runner-token': token }, body: JSON.stringify({ code, variants, timeoutMs: opts.timeoutMs ?? 30000 }), signal: current.signal });
  const j = (await r.json()) as PwRunResponse;
  if (!r.ok) throw new Error(j.error || `runner ответил ${r.status}`);
  return j;
}
export async function stopPlaywright() {
  current?.abort(); current = null;
  try { await fetch(RUNNER_URL + '/stop', { method: 'POST', headers: { 'x-runner-token': token } }); } catch { /* runner недоступен */ }
}
