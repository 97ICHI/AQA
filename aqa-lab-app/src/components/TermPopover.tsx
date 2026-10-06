// Подсказка термина: наведение (с задержкой), фокус с клавиатуры, нажатие на телефоне; Esc закрывает; всегда в пределах экрана.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GLOSSARY } from '../lib/glossary';
import { lessonById } from '../content/course';

export function TermPopover() {
  const [cur, setCur] = useState<{ id: string; el: HTMLElement; pinned: boolean } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean }>({ left: 0, top: 0, above: false });
  const box = useRef<HTMLDivElement>(null);
  const hoverT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveT = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const termOf = (t: EventTarget | null) => (t instanceof HTMLElement ? (t.closest('button.term') as HTMLElement | null) : null);
    const open = (el: HTMLElement, pinned: boolean) => { clearTimeout(leaveT.current); setCur({ id: el.dataset.term!, el, pinned }); };
    const over = (e: MouseEvent) => {
      const el = termOf(e.target);
      if (el) { clearTimeout(leaveT.current); clearTimeout(hoverT.current); hoverT.current = setTimeout(() => open(el, false), 250); }
      else if (box.current?.contains(e.target as Node)) clearTimeout(leaveT.current);
    };
    const out = (e: MouseEvent) => {
      clearTimeout(hoverT.current);
      const to = e.relatedTarget as Node | null;
      if (box.current?.contains(to) || termOf(to)) return;
      leaveT.current = setTimeout(() => setCur((c) => (c && !c.pinned ? null : c)), 200);
    };
    const click = (e: MouseEvent) => {
      const el = termOf(e.target);
      if (el) { e.preventDefault(); setCur((c) => (c?.el === el && c.pinned ? null : { id: el.dataset.term!, el, pinned: true })); return; }
      if (!box.current?.contains(e.target as Node)) setCur(null);
    };
    const focus = (e: FocusEvent) => { const el = termOf(e.target); if (el && el.matches(':focus-visible')) open(el, false); };
    const blur = (e: FocusEvent) => { const to = e.relatedTarget as Node | null; if (termOf(e.target) && !box.current?.contains(to)) leaveT.current = setTimeout(() => setCur((c) => (c && !c.pinned ? null : c)), 150); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setCur((c) => { if (c) { c.el.focus(); } return null; }); };
    const hide = () => setCur(null);
    document.addEventListener('mouseover', over); document.addEventListener('mouseout', out);
    document.addEventListener('click', click); document.addEventListener('focusin', focus); document.addEventListener('focusout', blur);
    document.addEventListener('keydown', key); window.addEventListener('hashchange', hide);
    return () => {
      document.removeEventListener('mouseover', over); document.removeEventListener('mouseout', out);
      document.removeEventListener('click', click); document.removeEventListener('focusin', focus); document.removeEventListener('focusout', blur);
      document.removeEventListener('keydown', key); window.removeEventListener('hashchange', hide);
    };
  }, []);

  useEffect(() => {
    document.querySelectorAll('button.term[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (cur) { cur.el.setAttribute('aria-expanded', 'true'); cur.el.setAttribute('aria-controls', 'term-pop'); }
  }, [cur]);

  useLayoutEffect(() => {
    if (!cur || !box.current) return;
    const place = () => {
      if (!box.current || !cur.el.isConnected) return;
      const r = cur.el.getBoundingClientRect(), b = box.current.getBoundingClientRect();
      const vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8;
      const left = Math.max(m, Math.min(r.left + r.width / 2 - b.width / 2, vw - b.width - m));
      const above = r.bottom + b.height + m > vh && r.top - b.height - m > 0;
      setPos({ left, top: above ? r.top - b.height - 6 : r.bottom + 6, above });
    };
    place();
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [cur]);

  if (!cur) return null;
  const g = GLOSSARY[cur.id];
  if (!g) return null;
  const lesson = g.lesson ? lessonById.get(g.lesson) : null;
  return (
    <div id="term-pop" ref={box} className={'term-pop' + (pos.above ? ' above' : '')} role="tooltip" style={{ left: pos.left, top: pos.top }}
      onMouseEnter={() => clearTimeout(leaveT.current)} onMouseLeave={() => { if (!cur.pinned) leaveT.current = setTimeout(() => setCur(null), 200); }}>
      <div className="tp-head"><strong>{g.en}</strong> <span>— {g.ru}</span></div>
      <p className="tp-def" dangerouslySetInnerHTML={{ __html: g.def }} />
      {g.example && <pre className="tp-ex"><code>{g.example}</code></pre>}
      <div className="tp-links">
        <a href={`#/glossary/${cur.id}`}>В глоссарии</a>
        {lesson && <a href={`#/l/${lesson.id}`}>Урок: {lesson.title}</a>}
      </div>
    </div>
  );
}
