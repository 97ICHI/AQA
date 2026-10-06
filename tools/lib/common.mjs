import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BOOK = process.env.BOOK_FILE ? path.resolve(process.env.BOOK_FILE) : path.join(root, 'AQA_Lab_v3.html');
export const bookUrl = (hash = '') => pathToFileURL(BOOK).href + hash;
export const bookText = () => fs.readFileSync(BOOK, 'utf8');

export async function launch() {
  const executablePath = process.env.AQA_BROWSER_PATH || undefined; // иначе — браузер Playwright
  return chromium.launch({ executablePath, args: executablePath ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] });
}

export class Report {
  constructor(name) { this.name = name; this.fails = []; this.passes = 0; }
  ok(label, cond, details = '') {
    if (cond) { this.passes++; return; }
    this.fails.push(details ? `${label} — ${details}` : label);
    console.error('FAIL', label, details);
  }
  done() {
    console.log(`${this.name}: ${this.passes} проверок прошло, ${this.fails.length} не прошло`);
    if (this.fails.length) { console.error(this.fails.map((f) => ' - ' + f).join('\n')); process.exit(1); }
  }
}

export async function chapterIds(page) {
  return page.evaluate(() => window.BOOK.chapters.map((c) => c.id));
}
