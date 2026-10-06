// Локальный runner: запускает настоящий Playwright Test для кода из приложения AQA Lab.
// Слушает только 127.0.0.1. Принимает запросы с токеном (печатается при старте) и только с разрешённых Origin.
// ВАЖНО: это не песочница. Код ученика выполняется с правами текущего пользователя. Ограничения: таймаут, отдельная папка, один запуск за раз.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createShop, VARIANTS } from './shop.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PW_VERSION = require('@playwright/test/package.json').version;
const CLI = require.resolve('@playwright/test/cli');
const PORT = Number(process.env.AQA_RUNNER_PORT) || 7357;
const TOKEN = process.env.AQA_RUNNER_TOKEN || randomBytes(16).toString('hex');
const ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173', ...(process.env.AQA_ALLOWED_ORIGINS || '').split(',').filter(Boolean)]);
const WORK = path.join(here, '.work');
const MAX_BODY = 200 * 1024;
const MAX_TIMEOUT = 120_000;
let current = null; // { child, aborted } — текущий запуск (все варианты)

const strip = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINS.has(o)) {
    res.setHeader('access-control-allow-origin', o);
    res.setHeader('vary', 'origin');
    res.setHeader('access-control-allow-headers', 'content-type, x-runner-token');
    res.setHeader('access-control-allow-methods', 'GET, POST');
    res.setHeader('access-control-allow-private-network', 'true');
  }
  return !o || ORIGINS.has(o);
}
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };

function collect(suite, out = [], prefix = []) {
  for (const s of suite.suites || []) collect(s, out, s.title && !s.title.endsWith('.ts') ? [...prefix, s.title] : prefix);
  for (const spec of suite.specs || []) for (const t of spec.tests || []) {
    const r = t.results?.[t.results.length - 1] || {};
    const err = r.error || r.errors?.[0];
    out.push({ title: [...prefix, spec.title].join(' › '), status: r.status || 'skipped', duration: r.duration || 0, error: err ? strip(err.message || err.value || '').split('\n').slice(0, 18).join('\n') : undefined });
  }
  return out;
}

async function runVariant(code, variant, timeoutMs) {
  const t0 = Date.now();
  const dir = path.join(WORK, `${Date.now()}-${randomBytes(3).toString('hex')}`);
  await mkdir(dir, { recursive: true });
  const shop = await createShop({ defects: VARIANTS[variant].defects });
  const baseURL = await shop.listen(0);
  const exe = process.env.AQA_BROWSER_PATH;
  await writeFile(path.join(dir, 'student.spec.ts'), code);
  await writeFile(path.join(dir, 'playwright.config.mjs'), `export default {
  testDir: '.', timeout: 10000, expect: { timeout: 3000 }, retries: 0, workers: 1, forbidOnly: false,
  reporter: [['json', { outputFile: 'report.json' }]], outputDir: 'test-results',
  use: { baseURL: ${JSON.stringify(baseURL)}, headless: true, trace: 'off', screenshot: 'off', video: 'off'${exe ? `, launchOptions: { executablePath: ${JSON.stringify(exe)} }` : ''} },
};`);
  let stderr = '', timedOut = false;
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, 'test', '-c', 'playwright.config.mjs'], { cwd: dir, env: { ...process.env, BASE_URL: baseURL, FORCE_COLOR: '0', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    current.child = child;
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => { if (stderr.length < 20000) stderr += d; });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('close', (c) => { clearTimeout(timer); resolve(c); });
  });
  const aborted = current.aborted;
  current.child = null;
  let report = null;
  try { report = JSON.parse(await readFile(path.join(dir, 'report.json'), 'utf8')); } catch { /* отчёта нет: остановка или сбой запуска */ }
  const tests = report ? collect(report) : [];
  const globalErr = report?.errors?.map((e) => strip(e.message)).join('\n');
  await shop.close();
  await rm(dir, { recursive: true, force: true });
  const ok = exitCode === 0 && tests.length > 0 && tests.every((t) => t.status === 'passed' || t.status === 'skipped');
  return { variant, label: VARIANTS[variant].label, ok, exitCode, tests, timedOut, aborted, stderr: [timedOut ? `Остановлено: запуск дольше ${timeoutMs / 1000} с.` : '', aborted ? 'Остановлено пользователем.' : '', globalErr, strip(stderr).trim()].filter(Boolean).join('\n').slice(0, 6000), ms: Date.now() - t0 };
}

const server = http.createServer(async (req, res) => {
  if (!cors(req, res)) return json(res, 403, { error: 'origin not allowed' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const authed = req.headers['x-runner-token'] === TOKEN;
  const url = new URL(req.url, 'http://runner');
  if (url.pathname === '/health') return authed ? json(res, 200, { ok: true, playwright: PW_VERSION, variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.label])) }) : json(res, 401, { needsToken: true });
  if (!authed) return json(res, 401, { error: 'нужен токен runner' });
  if (req.method === 'POST' && url.pathname === '/stop') { if (current) { current.aborted = true; current.child?.kill('SIGKILL'); } return json(res, 200, { stopped: !!current }); }
  if (req.method === 'POST' && url.pathname === '/run') {
    if (current) return json(res, 409, { error: 'уже идёт запуск — дождитесь окончания или остановите его' });
    let raw = '';
    for await (const c of req) { raw += c; if (raw.length > MAX_BODY) return json(res, 413, { error: 'слишком большой код' }); }
    let b; try { b = JSON.parse(raw); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    const variants = Array.isArray(b.variants) ? b.variants.filter((v) => typeof v === 'string') : [];
    if (typeof b.code !== 'string' || !variants.length || variants.some((v) => !VARIANTS[v])) return json(res, 400, { error: 'нужны code и variants из списка: ' + Object.keys(VARIANTS).join(', ') });
    const timeoutMs = Math.min(Number(b.timeoutMs) || 30000, MAX_TIMEOUT);
    current = { child: null, aborted: false };
    const runs = [];
    try {
      for (const v of variants) {
        const r = await runVariant(b.code, v, timeoutMs);
        runs.push(r);
        if (r.aborted) break;
      }
    } catch (err) { current = null; return json(res, 500, { error: String(err?.message || err), runs }); }
    current = null;
    return json(res, 200, { runs });
  }
  json(res, 404, { error: 'not found' });
});

if (existsSync(WORK)) await rm(WORK, { recursive: true, force: true });
server.listen(PORT, '127.0.0.1', () => {
  console.log(`AQA Lab runner: http://127.0.0.1:${PORT}  (Playwright ${PW_VERSION})`);
  console.log(`Токен для приложения: ${TOKEN}`);
  console.log('Вставьте токен на странице «О приложении» → Runner. Остановить: Ctrl+C.');
  console.log('Внимание: код из приложения выполняется на этом компьютере с вашими правами. Это не песочница.');
});
