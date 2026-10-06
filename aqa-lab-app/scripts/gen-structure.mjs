// Генерирует docs/02-STRUCTURE.md: новая структура курса и соответствие «глава v3 → уроки» из course.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chaptersDir = path.join(root, '../src/chapters');
const v3 = new Map();
for (const f of fs.readdirSync(chaptersDir).filter((f) => f.endsWith('.html')).sort()) {
  const t = fs.readFileSync(path.join(chaptersDir, f), 'utf8');
  const id = /data-chapter="([^"]+)"/.exec(t)?.[1];
  const title = /<h1 class="ch-title"[^>]*>([^<]+)/.exec(t)?.[1];
  if (id) v3.set(id, { title, file: f });
}
const course = fs.readFileSync(path.join(root, 'src/content/course.ts'), 'utf8');
const lessons = fs.readdirSync(path.join(root, 'src/content/lessons')).map((f) => f.replace(/\.md$/, ''));
const written = new Set(lessons);
const mods = [];
for (const block of course.split(/\n  \{\n    id: 'm/).slice(1)) {
  const head = /^(\d+)', num: (\d+), title: '([^']+)', route: '(\w+)',\n\s+summary: '([^']+)'/.exec(block);
  if (!head) continue;
  const ls = [...block.matchAll(/\{ id: '([^']+)', title: '([^']+)', goal: '([^']+)'(?:, needs: \[([^\]]*)\])?(?:, v3: \[([^\]]*)\])? \}/g)].map((m) => ({ id: m[1], title: m[2], goal: m[3], v3: (m[5] || '').replace(/'/g, '').split(',').map((s) => s.trim()).filter(Boolean) }));
  mods.push({ num: +head[2], title: head[3], route: head[4], summary: head[5], lessons: ls });
}
const exFiles = fs.readdirSync(path.join(root, 'src/content/exercises')).filter((f) => /^ex-.*\.ts$/.test(f));
const exCount = {};
for (const f of exFiles) for (const m of fs.readFileSync(path.join(root, 'src/content/exercises', f), 'utf8').matchAll(/lesson: '([^']+)'/g)) exCount[m[1]] = (exCount[m[1]] || 0) + 1;

let md = `# Структура курса\n\n_Сгенерировано \`node scripts/gen-structure.mjs\` из \`src/content/course.ts\`. Не редактировать вручную._\n\n`;
const total = mods.reduce((n, m) => n + m.lessons.length, 0);
md += `Модулей: ${mods.length}, уроков: ${total}, написано в новом формате: ${mods.reduce((n, m) => n + m.lessons.filter((l) => written.has(l.id)).length, 0)}, заданий с автоматической проверкой: ${Object.values(exCount).reduce((a, b) => a + b, 0)}.\n\n`;
md += `Маршруты: **С нуля** (start), **Уверенная практика** (practice), **Подготовка к Middle** (middle).\n\n`;
for (const m of mods) {
  md += `## ${m.num}. ${m.title} _(${m.route})_\n\n${m.summary}\n\n| # | Урок | Цель | Статус | Заданий | Главы v3 |\n|---|---|---|---|---|---|\n`;
  m.lessons.forEach((l, i) => { md += `| ${m.num}.${i + 1} | ${l.title} | ${l.goal} | ${written.has(l.id) ? 'написан' : 'план + v3'} | ${exCount[l.id] || 0} | ${l.v3.join(', ') || '—'} |\n`; });
  md += '\n';
}
md += `## Соответствие глав v3 и новых уроков\n\nКаждая глава v3 сохранена (приложение открывает её офлайн) и разнесена по урокам, где её материал используется.\n\n| Глава v3 | Уроки нового курса |\n|---|---|\n`;
const all = mods.flatMap((m) => m.lessons);
for (const [id, c] of v3) {
  const ls = all.filter((l) => l.v3.includes(id));
  md += `| ${c.title} (\`${id}\`) | ${ls.length ? ls.map((l) => l.title).join('; ') : '— (справочный материал, доступен в v3)'} |\n`;
}
fs.writeFileSync(path.join(root, 'docs/02-STRUCTURE.md'), md);
console.log('docs/02-STRUCTURE.md: модулей', mods.length, 'уроков', total);
