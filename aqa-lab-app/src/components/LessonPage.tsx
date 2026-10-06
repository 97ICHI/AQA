// Страница урока: текст из Markdown, виджеты (задания, песочницы) через порталы, предпосылки, отметка «прочитано».
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ALL_LESSONS, lessonById } from '../content/course';
import { loadLesson, hasLesson } from '../lib/lessons';
import { renderLesson } from '../lib/markdown';
import { store, useStore } from '../lib/store';
import { EXERCISE_BY_ID, EXERCISES_BY_LESSON } from '../content/exercises';
import { Exercise } from '../widgets/Exercise';
import { Playground, type PlaygroundSpec } from '../widgets/Playground';
import { LocatorLab } from '../widgets/LocatorLab';

const V3 = 'v3/AQA_Lab_v3.html';

export function LessonPage({ id, anchor }: { id: string; anchor?: string }) {
  const meta = lessonById.get(id);
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const read = useStore((s) => !!s.progress.read[id]);
  const readMap = useStore((s) => s.progress.read);
  const body = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<{ el: Element; node: ReactNode }[]>([]);

  useEffect(() => {
    let alive = true;
    setHtml(null); setFailed(false);
    if (!hasLesson(id)) return;
    loadLesson(id).then((t) => { if (alive) t === null ? setFailed(true) : setHtml(renderLesson(t)); }, () => alive && setFailed(true));
    return () => { alive = false; };
  }, [id]);

  useLayoutEffect(() => {
    if (!html || !body.current) { setSlots([]); return; }
    const found: { el: Element; node: ReactNode }[] = [];
    body.current.querySelectorAll('.widget-slot').forEach((el, i) => {
      let spec: Record<string, unknown>;
      try { spec = JSON.parse(el.getAttribute('data-widget') || '{}'); } catch { found.push({ el, node: <p className="warn-line">Ошибка в описании виджета.</p> }); return; }
      if (spec.type === 'exercise') {
        const ex = EXERCISE_BY_ID.get(String(spec.id));
        found.push({ el, node: ex ? <Exercise ex={ex} /> : <p className="warn-line">Задание {String(spec.id)} не найдено.</p> });
      } else if (spec.type === 'playground') found.push({ el, node: <Playground spec={{ id: `${id}-${i}`, ...spec } as PlaygroundSpec} /> });
      else if (spec.type === 'locator-lab') found.push({ el, node: <LocatorLab task={spec.task as string | undefined} /> });
      else found.push({ el, node: <p className="warn-line">Неизвестный виджет.</p> });
    });
    setSlots(found);
  }, [html, id]);

  useEffect(() => {
    if (!html) return;
    const target = anchor ? document.getElementById(anchor) : null;
    if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 50);
    else document.querySelector('.content')?.scrollTo?.(0, 0), window.scrollTo(0, 0);
  }, [html, anchor]);

  if (!meta) return <div className="page"><h1>Урок не найден</h1><p><a href="#/">К содержанию</a></p></div>;
  const idx = ALL_LESSONS.findIndex((l) => l.id === id);
  const prev = ALL_LESSONS[idx - 1], next = ALL_LESSONS[idx + 1];
  const needs = (meta.needs || []).map((n) => lessonById.get(n)!).filter(Boolean);
  const missing = needs.filter((n) => !readMap[n.id]);
  const exercises = EXERCISES_BY_LESSON[id] || [];
  const embedded = new Set([...(html?.matchAll(/&quot;id&quot;:\s*&quot;([\w-]+)&quot;/g) ?? [])].map((m) => m[1]).concat([...(html?.matchAll(/"id":\s*"([\w-]+)"/g) ?? [])].map((m) => m[1])));
  const extra = exercises.filter((e) => !embedded.has(e.id));

  return (
    <article className="lesson" aria-labelledby="lesson-title">
      <nav className="crumbs" aria-label="Положение в курсе"><a href="#/">Курс</a> › <span>Модуль {meta.module.num}. {meta.module.title}</span></nav>
      <h1 id="lesson-title">{meta.title}</h1>
      <p className="lesson-goal"><strong>После урока вы сможете:</strong> {meta.goal}</p>
      {needs.length > 0 && (
        <p className={'needs' + (missing.length ? ' missing' : '')}>
          Опирается на: {needs.map((n, i) => <span key={n.id}>{i ? ', ' : ''}<a href={`#/l/${n.id}`}>{n.title}</a>{readMap[n.id] ? ' ✓' : ''}</span>)}
          {missing.length ? '. Если что-то непонятно — начните с них.' : '.'}
        </p>
      )}
      {!hasLesson(id) && (
        <div className="planned-box">
          <p><span className="tag tag-plan">план</span> Этот урок ещё не переписан в новом формате. Ниже — цель урока; подробный материал есть в главе учебника v3.</p>
          {meta.v3?.length ? <p>Читать в v3: {meta.v3.map((c, i) => <span key={c}>{i ? ', ' : ''}<a href={`${V3}#/${c}`} target="_blank" rel="noopener">{c}</a></span>)}</p> : null}
        </div>
      )}
      {failed && <p className="warn-line">Не удалось загрузить текст урока. Обновите страницу.</p>}
      {hasLesson(id) && !html && !failed && <p className="muted">Загрузка…</p>}
      {html && <div className="lesson-body" ref={body} dangerouslySetInnerHTML={{ __html: html }} />}
      {slots.map((s, i) => createPortal(s.node, s.el, `w${i}`))}
      {extra.length > 0 && <section className="extra-ex"><h2>Практика</h2>{extra.map((e) => <Exercise key={e.id} ex={e} />)}</section>}
      {meta.v3?.length && hasLesson(id) ? <p className="muted small">Подробнее и с другими примерами — в учебнике v3: {meta.v3.map((c, i) => <span key={c}>{i ? ', ' : ''}<a href={`${V3}#/${c}`} target="_blank" rel="noopener">{c}</a></span>)}.</p> : null}
      <div className="lesson-foot">
        <label className="read-toggle"><input type="checkbox" checked={read} onChange={(e) => store.markRead(id, e.target.checked)} /> Прочитано</label>
        <span className="muted small">«Прочитано» — ваша отметка. Практика засчитывается только после успешной проверки задания.</span>
      </div>
      <nav className="pager" aria-label="Соседние уроки">
        {prev ? <a href={`#/l/${prev.id}`} className="pager-prev"><small>← Назад</small>{prev.title}</a> : <span />}
        {next ? <a href={`#/l/${next.id}`} className="pager-next"><small>Дальше →</small>{next.title}</a> : <span />}
      </nav>
    </article>
  );
}
