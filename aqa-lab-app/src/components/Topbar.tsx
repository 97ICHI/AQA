import { useEffect, useRef, useState } from 'react';
import { search, type Hit } from '../lib/search';
import { store, useStore } from '../lib/store';
import { runnerStatus, useRunnerStatus } from '../exec/runner';

const KIND: Record<Hit['kind'], string> = { lesson: 'Урок', section: 'Раздел', term: 'Термин', exercise: 'Задание', text: 'Текст' };

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const theme = useStore((s) => s.settings.theme);
  const runner = useRunnerStatus();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { void runnerStatus(); }, []);
  useEffect(() => {
    let alive = true;
    if (q.trim().length < 2) { setHits(null); return; }
    const t = setTimeout(() => search(q).then((h) => { if (alive) { setHits(h); setSel(0); } }), 120);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName || '') || (document.activeElement as HTMLElement)?.isContentEditable || (document.activeElement as HTMLElement)?.closest?.('.cm-editor');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); }
      else if (e.key === '/' && !typing) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const go = (h: Hit) => { location.hash = h.href; setQ(''); setHits(null); input.current?.blur(); };
  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Открыть меню курса">☰</button>
      <div className="search" role="search">
        <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: уроки, термины, ошибки…" aria-label="Поиск по учебнику"
          role="combobox" aria-expanded={!!hits} aria-controls="search-list"
          onKeyDown={(e) => {
            if (!hits?.length) { if (e.key === 'Escape') { setQ(''); input.current?.blur(); } return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % hits.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + hits.length) % hits.length); }
            else if (e.key === 'Enter') { e.preventDefault(); go(hits[sel]); }
            else if (e.key === 'Escape') { setQ(''); setHits(null); }
          }} />
        {hits && (
          <div id="search-list" className="search-results" role="listbox">
            {hits.length === 0 && <div className="sr-empty">Ничего не найдено. Попробуйте английский термин или другую форму слова.</div>}
            {hits.map((h, i) => (
              <a key={h.href + i} href={h.href} role="option" aria-selected={i === sel} className="sr-item" onMouseDown={(e) => { e.preventDefault(); go(h); }}>
                <span className="sr-kind">{KIND[h.kind]}</span><span className="sr-title">{h.title}</span><span className="sr-where">{h.where}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      <span className={'runner-pill ' + runner} title={runner === 'online' ? 'Локальный runner Playwright подключён: тесты запускаются по-настоящему' : runner === 'token' ? 'Runner запущен, но нужен токен из его консоли — вставьте на странице «О приложении»' : 'Runner не запущен: уроки читаются, Playwright-тесты не запускаются. Подробнее — «О приложении»'}>
        <span className="pill-dot" aria-hidden="true" />Runner: {runner === 'online' ? 'подключён' : runner === 'checking' ? 'проверка…' : runner === 'token' ? 'нужен токен' : 'нет'}
      </span>
      <button type="button" className="icon-btn" onClick={() => store.setSettings({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>{theme === 'dark' ? '☀' : '☾'}</button>
    </header>
  );
}
