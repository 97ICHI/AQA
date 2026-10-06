import { useEffect, useRef } from 'react';
import { COURSE, ROUTES } from '../content/course';
import { hasLesson } from '../lib/lessons';
import { useStore } from '../lib/store';
import { EXERCISES_BY_LESSON } from '../content/exercises';
import type { Route } from '../lib/router';

export function Sidebar({ open, onClose, route }: { open: boolean; onClose: () => void; route: Route }) {
  const read = useStore((s) => s.progress.read);
  const practice = useStore((s) => s.progress.practice);
  const ref = useRef<HTMLElement>(null);
  const current = route.page === 'lesson' ? route.id : null;
  useEffect(() => {
    if (open) setTimeout(() => (ref.current?.querySelector('[aria-current="page"]') as HTMLElement | null ?? ref.current?.querySelector('a'))?.focus(), 30);
  }, [open]);
  useEffect(() => { ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' }); }, [current]);
  return (
    <aside ref={ref} className={'sidebar' + (open ? ' open' : '')} aria-label="Содержание курса">
      <div className="brand">
        <a href="#/" className="brand-link"><span className="brand-title">AQA Lab</span><span className="brand-sub">Автоматизация тестирования: учебник и практика</span></a>
        <button type="button" className="icon-btn nav-close" onClick={onClose} aria-label="Закрыть меню">✕</button>
      </div>
      <nav className="toc">
        {COURSE.map((m) => {
          const lessons = m.lessons;
          const done = lessons.filter((l) => read[l.id]).length;
          const isCur = lessons.some((l) => l.id === current);
          return (
            <details key={m.id} className="toc-mod" open={isCur || m.num <= 1}>
              <summary>
                <span className="mod-num">{m.num}</span>
                <span className="mod-title">{m.title}<small>{ROUTES[m.route].title}</small></span>
                <span className="mod-prog" aria-label={`прочитано ${done} из ${lessons.length}`}>{done}/{lessons.length}</span>
              </summary>
              <ol className="toc-list">
                {lessons.map((l, i) => {
                  const ex = EXERCISES_BY_LESSON[l.id] || [];
                  const pr = ex.length && ex.every((e) => practice[e.id]);
                  return (
                    <li key={l.id}>
                      <a href={`#/l/${l.id}`} className={'toc-link' + (hasLesson(l.id) ? '' : ' planned')} aria-current={l.id === current ? 'page' : undefined}>
                        <span className="toc-num">{m.num}.{i + 1}</span>
                        <span className="toc-text">{l.title}</span>
                        <span className="toc-state">
                          {!hasLesson(l.id) && <span className="tag tag-plan" title="Урок ещё не переписан: открывается план и подробная глава v3">план</span>}
                          {read[l.id] && <span className="tick" title="Прочитано" aria-label="прочитано">✓</span>}
                          {pr ? <span className="dot" title="Практика выполнена" aria-label="практика выполнена">●</span> : null}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </nav>
      <div className="side-foot">
        <a href="#/glossary">Глоссарий A–Z</a>
        <a href="#/progress">Прогресс и экспорт</a>
        <a href="#/about">О приложении</a>
      </div>
    </aside>
  );
}
