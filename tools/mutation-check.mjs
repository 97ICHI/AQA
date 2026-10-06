// Контролируемое падение: ломаем расчёт суммы в копии учебного проекта и убеждаемся, что тесты это обнаруживают.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const src = path.join(root, 'aqa-lab-starter');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aqa-mut-'));
fs.cpSync(src, tmp, { recursive: true, filter: (p) => !/node_modules|test-results|playwright-report|allure-/.test(p) });
if (!fs.existsSync(path.join(src, 'node_modules'))) { console.error('Сначала выполните npm ci в aqa-lab-starter'); process.exit(2); }
fs.symlinkSync(path.join(src, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
const run = (cmd) => spawnSync(cmd, { cwd: tmp, shell: true, encoding: 'utf8', env: process.env });
const server = path.join(tmp, 'server.mjs');
const original = fs.readFileSync(server, 'utf8');

const base = run('npm run test:api'); if (base.status !== 0) { console.error('Исходный код: API-тест не проходит', base.stdout); process.exit(1); }
console.log('исходный код: API-тест зелёный');
const broken = original.replace('body.quantity * PRICE', 'body.quantity * 1001');
if (broken === original) { console.error('Не найдено место для мутации в server.mjs'); process.exit(1); }
fs.writeFileSync(server, broken);
const api = run('npm run test:api');
console.log('мутация × 1001: API-тест', api.status === 0 ? 'НЕ упал' : 'упал (ожидаемо)');
let ui = { status: 0 };
if (process.env.MUTATION_UI !== '0') { ui = run('npm test'); console.log('мутация × 1001: Playwright', ui.status === 0 ? 'НЕ упал' : 'упал (ожидаемо)'); }
fs.writeFileSync(server, original);
const after = run('npm run test:api');
console.log('после восстановления: API-тест', after.status === 0 ? 'зелёный' : 'КРАСНЫЙ');
fs.rmSync(tmp, { recursive: true, force: true });
if (api.status === 0 || ui.status === 0 || after.status !== 0) { console.error('Проверка контролируемого падения не пройдена'); process.exit(1); }
console.log('контролируемое падение обнаружено, код восстановлен');
