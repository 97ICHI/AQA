import { COURSE, ROUTES, ALL_LESSONS } from '../content/course';
import { hasLesson, writtenLessonIds } from '../lib/lessons';
import { useStore } from '../lib/store';
import { EXERCISES } from '../content/exercises';

export function Home() {
  const read = useStore((s) => s.progress.read);
  const practice = useStore((s) => s.progress.practice);
  const nextLesson = ALL_LESSONS.find((l) => hasLesson(l.id) && !read[l.id]) ?? ALL_LESSONS[0];
  const readCount = Object.keys(read).length;
  const doneEx = EXERCISES.filter((e) => practice[e.id]).length;
  return (
    <div className="home">
      <section className="hero">
        <h1>AQA Lab</h1>
        <p className="lead">Учебник и тренажёр по автоматизации тестирования: от первого теста до уровня Middle. Объяснение, пример и практика с настоящим выполнением кода — в одном месте.</p>
        <div className="hero-actions">
          <a className="btn primary" href={`#/l/${nextLesson.id}`}>{readCount ? 'Продолжить' : 'Начать с первого урока'}: {nextLesson.title}</a>
          <a className="btn ghost" href="#/about">Как устроено приложение</a>
        </div>
        <p className="muted small">Прочитано уроков: {readCount} из {ALL_LESSONS.length} · выполнено заданий: {doneEx} из {EXERCISES.length} · написано в новом формате: {writtenLessonIds.length} уроков (остальные — план + подробная глава v3).</p>
      </section>
      <section className="routes" aria-labelledby="routes-h">
        <h2 id="routes-h">Три маршрута</h2>
        <div className="route-grid">
          {(Object.keys(ROUTES) as (keyof typeof ROUTES)[]).map((r) => (
            <div key={r} className="route-card">
              <h3>{ROUTES[r].title}</h3>
              <p>{ROUTES[r].text}</p>
              <p className="small">Модули: {COURSE.filter((m) => m.route === r).map((m) => m.num).join(', ')}</p>
            </div>
          ))}
        </div>
        <p className="muted small">Основной язык курса — TypeScript (Playwright Test). Python — отдельный маршрут (модуль 8): его можно проходить параллельно или вместо модуля 3, если вы целитесь в Python-AQA.</p>
      </section>
      <section aria-labelledby="mods-h">
        <h2 id="mods-h">Модули</h2>
        <ol className="mod-grid">
          {COURSE.map((m) => {
            const written = m.lessons.filter((l) => hasLesson(l.id)).length;
            const done = m.lessons.filter((l) => read[l.id]).length;
            return (
              <li key={m.id} className="mod-card">
                <a href={`#/l/${m.lessons[0].id}`}>
                  <span className="mod-num">{m.num}</span>
                  <span className="mod-body"><strong>{m.title}</strong><span>{m.summary}</span>
                    <small>{m.lessons.length} уроков · прочитано {done} · {written === m.lessons.length ? 'все уроки в новом формате' : written ? `в новом формате: ${written}` : 'план + глава v3'}</small></span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="legend" aria-labelledby="legend-h">
        <h2 id="legend-h">Что означают метки у тренажёров</h2>
        <dl>
          <dt><span className="exec-label exec-real">Настоящее выполнение</span></dt><dd>Код действительно выполняется: компилятор TypeScript и JavaScript в изолированном Worker, PostgreSQL (PGlite), Python и pytest (Pyodide), Playwright — через локальный runner.</dd>
          <dt><span className="exec-label exec-model">Учебная модель</span></dt><dd>Упрощённая модель для объяснения идеи (например, лаборатория локаторов). Это не браузер с Playwright.</dd>
          <dt><span className="exec-label exec-recorded">Записанный сценарий</span></dt><dd>Заранее записанный вывод настоящего запуска — показывается, когда runner не подключён.</dd>
        </dl>
      </section>
    </div>
  );
}
