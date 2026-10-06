import { useEffect, useRef, useState } from 'react';
import { useRoute } from './lib/router';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Home } from './components/Home';
import { LessonPage } from './components/LessonPage';
import { GlossaryPage } from './components/GlossaryPage';
import { ProgressPage } from './components/ProgressPage';
import { AboutPage } from './components/AboutPage';
import { TermPopover } from './components/TermPopover';
import { lessonById } from './content/course';

export function App() {
  const route = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { setNavOpen(false); }, [route.page, route.page === 'lesson' ? route.id : '']);
  useEffect(() => {
    const title = route.page === 'lesson' ? lessonById.get(route.id)?.title : route.page === 'glossary' ? 'Глоссарий' : route.page === 'progress' ? 'Прогресс' : route.page === 'about' ? 'О приложении' : null;
    document.title = title ? `${title} — AQA Lab` : 'AQA Lab — учебник и практика автоматизации тестирования';
  }, [route]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && navOpen) setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);
  // код: копирование из статических блоков
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest('.code-copy');
      if (!b) return;
      const code = b.closest('figure')?.querySelector('pre')?.innerText ?? '';
      navigator.clipboard?.writeText(code).then(() => { b.textContent = 'Скопировано'; setTimeout(() => (b.textContent = 'Копировать'), 1400); }, () => { b.textContent = 'Не удалось'; });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Перейти к содержанию</a>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} route={route} />
      {navOpen && <div className="backdrop" onClick={() => setNavOpen(false)} />}
      <div className="main-col">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main id="main" ref={mainRef} tabIndex={-1} className="content">
          {route.page === 'home' && <Home />}
          {route.page === 'lesson' && <LessonPage key={route.id} id={route.id} anchor={route.anchor} />}
          {route.page === 'glossary' && <GlossaryPage term={route.term} />}
          {route.page === 'progress' && <ProgressPage />}
          {route.page === 'about' && <AboutPage anchor={route.anchor} />}
          {route.page === 'notfound' && <div className="page"><h1>Страница не найдена</h1><p><a href="#/">На главную</a></p></div>}
        </main>
      </div>
      <TermPopover />
    </div>
  );
}
