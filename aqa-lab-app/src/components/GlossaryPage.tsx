import { useEffect, useMemo, useState } from 'react';
import { GLOSSARY, termIds } from '../lib/glossary';
import { lessonById } from '../content/course';

export function GlossaryPage({ term }: { term?: string }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = q.toLowerCase().replace(/ё/g, 'е').trim();
    return termIds.filter((id) => { if (!n) return true; const g = GLOSSARY[id]; return `${g.en} ${g.ru} ${g.aliases}`.toLowerCase().replace(/ё/g, 'е').includes(n); });
  }, [q]);
  useEffect(() => { if (term) setTimeout(() => document.getElementById('t-' + term)?.scrollIntoView({ block: 'center' }), 30); }, [term]);
  const letters = [...new Set(list.map((id) => GLOSSARY[id].en[0].toUpperCase()))];
  return (
    <div className="page glossary">
      <h1>Глоссарий</h1>
      <p className="muted">Единый источник терминов: те же определения показываются в подсказках внутри уроков. {termIds.length} терминов.</p>
      <input type="search" className="g-filter" placeholder="Фильтр: английский или русский термин" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Фильтр терминов" />
      <nav className="g-letters" aria-label="Буквы">{letters.map((l) => <a key={l} href={`#/glossary/${list.find((id) => GLOSSARY[id].en[0].toUpperCase() === l)}`}>{l}</a>)}</nav>
      <dl className="g-list">
        {list.map((id) => {
          const g = GLOSSARY[id];
          const lesson = g.lesson ? lessonById.get(g.lesson) : null;
          return (
            <div key={id} id={'t-' + id} className={'g-item' + (term === id ? ' current' : '')}>
              <dt><span className="g-en">{g.en}</span> <span className="g-ru">— {g.ru}</span></dt>
              <dd>
                <p dangerouslySetInnerHTML={{ __html: g.def }} />
                {g.example && <pre className="g-example"><code>{g.example}</code></pre>}
                {g.aliases && <p className="small muted">Также: {g.aliases}</p>}
                {lesson && <p className="small"><a href={`#/l/${lesson.id}`}>Урок: {lesson.title}</a></p>}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
