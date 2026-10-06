// Статические проверки без браузера: порча кода подсказками, служебный язык, «Кратко», согласованность версий и архива.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Report, root, bookText } from '../lib/common.mjs';
import { starterFiles } from '../build.mjs';

const r = new Report('static');
const html = bookText();
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const chapters = main.split(/(?=<article class="chapter" id="\/)/).slice(1);

// текстовые узлы вне code/pre/script
function textNodes(h) {
  const out = []; const stack = [];
  for (const m of h.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (t.startsWith('<!--')) continue;
    if (t.startsWith('<')) {
      const mm = t.match(/^<(\/?)([a-zA-Z0-9]+)([^>]*)>/); if (!mm) continue;
      const tag = mm[2].toLowerCase();
      if (['br', 'img', 'input', 'hr', 'path', 'circle', 'rect', 'line', 'polyline', 'meta', 'link'].includes(tag) || mm[3].endsWith('/')) continue;
      const cls = (mm[3].match(/class="([^"]*)"/) || [])[1] || '';
      if (mm[1]) { const i = stack.map((s) => s.tag).lastIndexOf(tag); if (i >= 0) stack.length = i; } else stack.push({ tag, cls });
    } else out.push({ t, stack: stack.slice() });
  }
  return out;
}
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const BAD = [
  [/\b(?:HTTPS?):\/\//, 'URL-схема в верхнем регистре'],
  [/[a-z0-9)\]]\.(?:JSON|YAML|XML|TS|JS)\b/, 'расширение или метод в верхнем регистре'],
  [/\bnpx\s+[A-Z]/, 'команда npx с заглавной буквы'],
  [/\b(?:await|expect)\s*\(?\s*Page\./, 'Page. вместо page.'],
  [/\bpytest[.-](?:Fixture|Playwright)\b/, 'искажённое имя pytest'],
];
const JARGON = /маршрут v2|приложенн\w+ pdf|из pdf\b|в pdf\b|pmqa|интеграци\w+ предыдущего этапа|отчёте v2|конспект/i;

for (const ch of chapters) {
  const id = ch.match(/id="\/([^"]+)"/)[1];
  if (id === 'glossary') continue;
  const nodes = textNodes(ch);
  for (const { t, stack } of nodes) {
    const inCode = stack.some((s) => ['code', 'pre', 'script', 'style'].includes(s.tag));
    const inTitle = stack.some((s) => s.cls.includes('code-title'));
    if (!inCode) for (const [re, label] of BAD) if (re.test(t)) r.ok(`${id}: ${label}`, false, t.trim().slice(0, 90));
    if (inTitle && /\.(JSON|YAML)\b|[a-z]-[A-Z][a-z]+(?:[-.]|$)|^tests\/[A-Z]/.test(t)) r.ok(`${id}: имя файла в заголовке кода искажено`, false, t);
    if (JARGON.test(t) && id !== 'about') r.ok(`${id}: служебный язык`, false, t.trim().slice(0, 90));
  }
  // «Кратко»: не больше 6 правил и 5 терминов
  const rec = ch.match(/<section class="recall"[\s\S]*?<\/section>/);
  if (rec) {
    r.ok(`${id}: «Кратко» — правил не больше 6`, (rec[0].match(/<li>/g) || []).length <= 6);
    r.ok(`${id}: «Кратко» — терминов не больше 5`, (rec[0].match(/<dt>/g) || []).length <= 5);
  }
  // плотность подсказок
  const terms = (ch.match(/class="term"/g) || []).length;
  const len = nodes.reduce((n, x) => n + x.t.length, 0);
  r.ok(`${id}: плотность подсказок ≤ 3 на 1000 знаков`, terms * 1000 / Math.max(len, 1) <= 3, `${(terms * 1000 / len).toFixed(1)}`);
  // кнопки-термины не внутри запрещённых контекстов
  for (const { t, stack } of nodes) {
    if (stack.some((s) => s.tag === 'button' && s.cls.includes('term')) && stack.some((s) => ['a', 'summary', 'code', 'pre', 'h1', 'h2', 'h3', 'th'].includes(s.tag)))
      r.ok(`${id}: подсказка во вложенном контексте`, false, t);
  }
}

// версии: Playwright в тексте = версия в проекте
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'aqa-lab-starter/package.json'), 'utf8'));
const pw = pkg.devDependencies['@playwright/test'];
const mentioned = [...new Set([...main.matchAll(/(?:playwright:v|Playwright Test |@playwright\/test`?\D{0,20})(\d+\.\d+\.\d+)/g)].map((m) => m[1]))];
r.ok('версия Playwright в тексте совпадает с проектом', mentioned.every((v) => v === pw), `проект ${pw}, в тексте ${mentioned}`);
const toolsPw = JSON.parse(fs.readFileSync(path.join(root, 'tools/package.json'), 'utf8')).devDependencies['@playwright/test'];
r.ok('tools использует ту же версию Playwright, что учебный проект', toolsPw === pw, `${toolsPw} vs ${pw}`);

// встроенный архив = каталог проекта, без лишнего
const uri = html.match(/data:application\/zip;base64,([A-Za-z0-9+/=]+)/);
r.ok('в учебнике есть архив проекта', !!uri);
if (uri) {
  const buf = Buffer.from(uri[1], 'base64');
  const names = []; let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) { const csz = buf.readUInt32LE(p + 18); const nl = buf.readUInt16LE(p + 26); const el = buf.readUInt16LE(p + 28); const name = buf.toString('utf8', p + 30, p + 30 + nl); const comp = buf.subarray(p + 30 + nl + el, p + 30 + nl + el + csz); const data = zlib.inflateRawSync(comp); names.push([name, data]); p += 30 + nl + el + csz; }
  const expected = starterFiles();
  r.ok('архив содержит те же файлы, что aqa-lab-starter/', JSON.stringify(names.map((n) => n[0]).sort()) === JSON.stringify(expected.map((e) => e.name).sort()));
  r.ok('архив совпадает по содержимому', expected.every((e) => names.find((n) => n[0] === e.name)?.[1].equals(e.data)));
  r.ok('в архиве нет node_modules и секретов', !names.some(([n, d]) => /node_modules|\.env$/.test(n) || /BEGIN (RSA|PRIVATE)|AKIA[0-9A-Z]{16}/.test(d.toString('latin1'))));
}
r.done();
