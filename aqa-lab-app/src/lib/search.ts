// Поиск по урокам, разделам, глоссарию и заданиям. Тексты уроков подгружаются при первом поиске.
import { ALL_LESSONS } from '../content/course';
import { GLOSSARY } from './glossary';
import { EXERCISES } from '../content/exercises';
import { slug } from './markdown';

export interface Hit { kind: 'lesson' | 'section' | 'term' | 'exercise' | 'text'; title: string; where: string; href: string; snippet?: string; score: number }
interface Entry { kind: Hit['kind']; title: string; where: string; href: string; text: string; w: number }
let INDEX: Entry[] | null = null;
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

export async function buildIndex() {
  if (INDEX) return INDEX;
  const raw = import.meta.glob('../content/lessons/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const texts: Record<string, string> = {};
  for (const [p, t] of Object.entries(raw)) texts[p.replace(/^.*\/(.+)\.md$/, '$1')] = t;
  const idx: Entry[] = [];
  for (const l of ALL_LESSONS) {
    const where = `Модуль ${l.module.num}. ${l.module.title}`;
    idx.push({ kind: 'lesson', title: l.title, where, href: `#/l/${l.id}`, text: norm(l.title + ' ' + l.goal), w: 10 });
    const t = texts[l.id];
    if (!t) continue;
    for (const m of t.matchAll(/^#{2,3} (.+)$/gm)) idx.push({ kind: 'section', title: m[1].replace(/\[\[[^|\]]+\|?([^\]]*)\]\]/g, '$1'), where: l.title, href: `#/l/${l.id}/${slug(m[1])}`, text: norm(m[1]), w: 6 });
    for (const para of t.split(/\n{2,}/)) {
      const clean = para.replace(/```[\s\S]*?```/g, ' ').replace(/\[\[([^|\]]+)\|?([^\]]*)\]\]/g, (_, id, lab) => lab || GLOSSARY[id]?.en || id).replace(/[#*`>_:]/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean.length > 30) idx.push({ kind: 'text', title: clean.slice(0, 160), where: l.title, href: `#/l/${l.id}`, text: norm(clean), w: 1 });
    }
    const outputs = [...t.matchAll(/```(?:text|ts|bash|py|sql)[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
    for (const m of t.matchAll(/```widget\n([\s\S]*?)```/g)) { try { const w = JSON.parse(m[1]); if (w.recorded?.output) outputs.push(w.recorded.output); } catch { /* проверяется в check-content */ } }
    for (const out of outputs) for (const line of out.split('\n')) if (/Error|ERROR|Ошибка|error TS|expect\(|Timeout|violation|Expected|Received|Traceback|assert/.test(line)) idx.push({ kind: 'text', title: line.trim().slice(0, 160), where: `Ошибка в уроке «${l.title}»`, href: `#/l/${l.id}`, text: norm(line), w: 3 });
  }
  for (const [id, g] of Object.entries(GLOSSARY)) idx.push({ kind: 'term', title: `${g.en} — ${g.ru}`, where: 'Глоссарий', href: `#/glossary/${id}`, text: norm(`${g.en} ${g.ru} ${g.aliases} ${g.def.replace(/<[^>]+>/g, '')}`), w: 8 });
  for (const e of EXERCISES) idx.push({ kind: 'exercise', title: e.title, where: 'Задание', href: `#/l/${e.lesson}/ex-${e.id}`, text: norm(e.title + ' ' + e.goal), w: 7 });
  INDEX = idx;
  return idx;
}

export async function search(q: string): Promise<Hit[]> {
  const idx = await buildIndex();
  const words = norm(q).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  const hits: Hit[] = [];
  for (const e of idx) {
    if (!words.every((w) => e.text.includes(w))) continue;
    let score = e.w;
    for (const w of words) if (norm(e.title).includes(w)) score += e.w;
    hits.push({ kind: e.kind, title: e.title, where: e.where, href: e.href, score });
  }
  hits.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return hits.filter((h) => { const k = h.href + h.title; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 14);
}
