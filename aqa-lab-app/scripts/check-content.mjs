// Проверка контента: термины в уроках есть в глоссарии, виджеты корректны, задания привязаны к существующим урокам,
// у каждого написанного урока есть слои «Зачем» и практика, подсказок ровно три.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const glossary = JSON.parse(fs.readFileSync(path.join(root, 'src/content/glossary.json'), 'utf8'));
const course = fs.readFileSync(path.join(root, 'src/content/course.ts'), 'utf8');
const lessonIds = new Set([...course.matchAll(/\{ id: '([a-z0-9-]+)', title:/g)].map((m) => m[1]));
const errors = [], warns = [];
const exDir = path.join(root, 'src/content/exercises');
const exercises = [];
for (const f of fs.readdirSync(exDir).filter((f) => /^ex-.*\.ts$/.test(f))) {
  const mod = await import(pathToFileURL(path.join(exDir, f)).href);
  for (const e of mod.default) exercises.push({ ...e, file: f });
}
const exById = new Map();
for (const e of exercises) {
  if (exById.has(e.id)) errors.push(`задание ${e.id}: id повторяется (${e.file})`);
  exById.set(e.id, e);
  if (!lessonIds.has(e.lesson)) errors.push(`задание ${e.id}: нет урока ${e.lesson}`);
  if (!Array.isArray(e.hints) || e.hints.length !== 3) errors.push(`задание ${e.id}: нужно ровно 3 подсказки`);
  for (const k of ['title', 'goal', 'starter', 'solution', 'explanation']) if (!e[k] || typeof e[k] !== 'string') errors.push(`задание ${e.id}: пустое поле ${k}`);
  if (e.starter === e.solution) errors.push(`задание ${e.id}: стартовый код совпадает с решением`);
  if (e.kind === 'sql' && (!e.datasets?.length || e.datasets.length < 2)) warns.push(`задание ${e.id}: SQL лучше проверять минимум на двух наборах данных`);
  if ((e.kind === 'ts-test' || e.kind === 'py-test') && !e.broken?.length) errors.push(`задание ${e.id}: нет сломанных версий`);
  if (e.kind === 'pw' && (!e.mustPass?.includes('ok') || !e.mustFail?.length)) errors.push(`задание ${e.id}: pw-задание должно проходить на ok и падать хотя бы на одном дефекте`);
}
const lessonsDir = path.join(root, 'src/content/lessons');
const used = new Set();
for (const f of fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.md'))) {
  const id = f.replace(/\.md$/, '');
  const t = fs.readFileSync(path.join(lessonsDir, f), 'utf8');
  if (!lessonIds.has(id)) errors.push(`${f}: урока ${id} нет в course.ts`);
  if (!/^:::why/m.test(t)) errors.push(`${f}: нет блока :::why`);
  if (/^# /m.test(t)) errors.push(`${f}: заголовок H1 задаётся из course.ts — используйте ##`);
  const opens = (t.match(/^:::\w+/gm) || []).length, closes = (t.match(/^:::\s*$/gm) || []).length;
  if (opens !== closes) errors.push(`${f}: незакрытый блок ::: (${opens} открытых, ${closes} закрытых)`);
  for (const m of t.matchAll(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/g)) if (!glossary[m[1]]) errors.push(`${f}: термин [[${m[1]}]] не найден в глоссарии`);
  for (const m of t.matchAll(/```widget\n([\s\S]*?)```/g)) {
    let w; try { w = JSON.parse(m[1]); } catch (err) { errors.push(`${f}: некорректный JSON виджета: ${err.message}`); continue; }
    if (w.type === 'exercise') { used.add(w.id); if (!exById.has(w.id)) errors.push(`${f}: задание ${w.id} не найдено`); else if (exById.get(w.id).lesson !== id) errors.push(`${f}: задание ${w.id} принадлежит уроку ${exById.get(w.id).lesson}`); }
    else if (w.type === 'playground') { if (!['ts', 'sql', 'py', 'pw'].includes(w.lang) || typeof w.code !== 'string') errors.push(`${f}: playground без lang/code`); if (w.lang === 'pw' && !w.recorded) warns.push(`${f}: pw-песочница без recorded — без runner ученик ничего не увидит`); }
    else if (w.type !== 'locator-lab') errors.push(`${f}: неизвестный виджет ${w.type}`);
  }
  const hasPractice = /```widget\n\{"type":"(exercise|playground|locator-lab)"/.test(t) || exercises.some((e) => e.lesson === id);
  if (!hasPractice) warns.push(`${f}: нет практики (задание или песочница)`);
  let inFence = false;
  for (const line of t.split('\n')) if (line.startsWith('```')) { if (!inFence && line.trim() === '```') warns.push(`${f}: блок кода без языка`); inFence = !inFence; }
  if (inFence) errors.push(`${f}: незакрытый блок кода`);
}
for (const e of exercises) if (!used.has(e.id)) warns.push(`задание ${e.id} не встроено в текст урока (будет показано в конце урока)`);
const written = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.md')).length;
console.log(`уроков в курсе: ${lessonIds.size}, написано: ${written}, заданий: ${exercises.length}, терминов: ${Object.keys(glossary).length}`);
for (const w of warns) console.log('предупреждение: ' + w);
for (const e of errors) console.log('ОШИБКА: ' + e);
process.exit(errors.length ? 1 : 0);
