// Копирует в public/ то, что нужно приложению без сети: Pyodide, колёса pytest, подробные главы v3.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

const pyo = path.join(root, 'node_modules/pyodide');
for (const f of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) copy(path.join(pyo, f), path.join(pub, 'pyodide', f));
const wheels = fs.readdirSync(path.join(root, 'vendor/py-wheels')).filter((f) => f.endsWith('.whl')).sort();
for (const w of wheels) copy(path.join(root, 'vendor/py-wheels', w), path.join(pub, 'py-wheels', w));
fs.writeFileSync(path.join(pub, 'py-wheels/index.json'), JSON.stringify(wheels));
const v3 = path.join(root, '../AQA_Lab_v3.html');
if (fs.existsSync(v3)) copy(v3, path.join(pub, 'v3/AQA_Lab_v3.html'));
console.log('assets: pyodide, %d wheels, v3 %s', wheels.length, fs.existsSync(v3) ? 'ok' : 'нет');
