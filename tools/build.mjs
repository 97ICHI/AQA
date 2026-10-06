#!/usr/bin/env node
// Сборка AQA_Lab_v3.html из src/: node tools/build.mjs [--out файл] [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeZip } from './lib/zip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const starter = path.join(root, 'aqa-lab-starter');
const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(root, 'AQA_Lab_v3.html');

const EXCLUDE_DIRS = new Set(['node_modules', 'playwright-report', 'test-results', 'allure-results', 'allure-report', '.git']);

export function starterFiles() {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.isDirectory()) { if (!EXCLUDE_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
      if (e.name === '.env' || e.name.endsWith('.log')) continue;
      files.push(path.join(dir, e.name));
    }
  })(starter);
  return files.map((p) => ({ name: 'aqa-lab-starter/' + path.relative(starter, p).split(path.sep).join('/'), data: fs.readFileSync(p) }));
}

export function build() {
  const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
  const zipUri = 'data:application/zip;base64,' + makeZip(starterFiles()).toString('base64');
  let html = '';
  for (const part of manifest) {
    const text = fs.readFileSync(path.join(src, part.path), 'utf8');
    if (part.kind === 'book') html += JSON.stringify(JSON.parse(text)).replaceAll('</', '<\\/');
    else if (part.kind === 'chapter') html += text.replaceAll('{{STARTER_ZIP}}', zipUri);
    else html += text;
  }
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const html = build();
  if (args.includes('--check')) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (cur !== html) { console.error(`${path.relative(root, out)} не совпадает со сборкой из src/. Выполните: node tools/build.mjs`); process.exit(1); }
    console.log('Сборка из src/ совпадает с', path.relative(root, out));
  } else {
    fs.writeFileSync(out, html);
    console.log('Записано', path.relative(root, out), (html.length / 1e6).toFixed(2), 'МБ');
  }
}
