// Печатает весь учебник в PDF: node tools/print-pdf.mjs [dist/AQA_Lab_v3.pdf]
import fs from 'node:fs';
import path from 'node:path';
import { launch, bookUrl, root } from './lib/common.mjs';
const out = path.resolve(process.argv[2] || path.join(root, 'dist/AQA_Lab_v3.pdf'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.goto(bookUrl('#/intro')); await p.waitForTimeout(400);
await p.evaluate(() => { BOOK.chapters.forEach((c) => APP.prepare(APP.artOf(c.id))); document.querySelectorAll('.sim-mount').forEach((n) => { try { Sim.mount(n); } catch (e) { /* демонстрация без JS-вывода */ } }); document.body.classList.add('print-all'); document.querySelectorAll('details:not([open])').forEach((d) => (d.open = true)); });
await p.waitForTimeout(1500); await p.emulateMedia({ media: 'print' });
await p.pdf({ path: out, format: 'A4', margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
const pages = (fs.readFileSync(out).toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;
console.log(`PDF: ${path.relative(root, out)}, страниц: ${pages}`);
if (pages < 300) { console.error('Ожидалось не меньше 300 страниц: печать всего учебника сломана'); process.exit(1); }
await b.close();
