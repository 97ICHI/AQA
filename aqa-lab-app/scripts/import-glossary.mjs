// Переносит глоссарий v3 (src/book.json) в единый источник приложения src/content/glossary.json.
// Поля: en, ru, def (HTML), example (короткий пример из тестирования, если задан), lesson (урок нового курса), v3 (глава и якорь v3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const book = JSON.parse(fs.readFileSync(path.join(here, '../../src/book.json'), 'utf8'));
const courseSrc = fs.readFileSync(path.join(here, '../src/content/course.ts'), 'utf8');
// уроки с главами v3, в порядке курса
const lessons = [...courseSrc.matchAll(/\{ id: '([^']+)', title: '[^']*', goal: '[^']*'(?:, needs: \[[^\]]*\])?(?:, v3: \[([^\]]*)\])? \}/g)]
  .map((m) => ({ id: m[1], v3: (m[2] || '').split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean) }));
const firstLessonFor = (ch) => lessons.find((l) => l.v3.includes(ch))?.id;
const examplesPath = path.join(here, '../src/content/glossary-examples.json');
const examples = fs.existsSync(examplesPath) ? JSON.parse(fs.readFileSync(examplesPath, 'utf8')) : {};
const out = {};
for (const [id, g] of Object.entries(book.glossary)) {
  out[id] = { en: g.en, ru: g.ru, def: g.def, aliases: g.aliases || '', lesson: firstLessonFor(g.ch) || null, v3: { ch: g.ch, anchor: g.anchor || null } };
  if (examples[id]) out[id].example = examples[id];
}
// Термины, которых нет в v3, и уточнения связи «термин → урок» — в glossary-extra.json (тот же формат; поля перекрывают импорт).
const extraPath = path.join(here, '../src/content/glossary-extra.json');
const extra = fs.existsSync(extraPath) ? JSON.parse(fs.readFileSync(extraPath, 'utf8')) : {};
// дополнительные файлы по модулям: src/content/glossary-extra.d/*.json
const extraDir = path.join(here, '../src/content/glossary-extra.d');
if (fs.existsSync(extraDir)) for (const f of fs.readdirSync(extraDir).filter((f) => f.endsWith('.json')).sort()) Object.assign(extra, JSON.parse(fs.readFileSync(path.join(extraDir, f), 'utf8')));
for (const [id, g] of Object.entries(extra)) {
  if (id.startsWith('$')) continue;
  out[id] = { aliases: '', lesson: null, v3: { ch: null, anchor: null }, ...(out[id] || {}), ...g };
}
fs.writeFileSync(path.join(here, '../src/content/glossary.json'), JSON.stringify(out, null, 1) + '\n');
console.log('терминов:', Object.keys(out).length, 'без урока:', Object.values(out).filter((t) => !t.lesson).length);
