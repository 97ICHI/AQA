// Лаборатория локаторов — УЧЕБНАЯ МОДЕЛЬ. Поддерживает часть API Playwright и упрощённо вычисляет роль и доступное имя.
// Настоящий Playwright использует полный алгоритм accessible name и больше ролей; для проверки на реальной странице — runner.
import { useMemo, useRef, useState, useEffect } from 'react';
import { ExecLabel } from './common';

const FIXTURE = `
<header class="ll-top"><a href="#catalog">Каталог</a> <a href="#cart">Корзина (0)</a></header>
<h2>Аудио</h2>
<label for="ll-q">Поиск товара</label> <input id="ll-q" type="search" placeholder="Например, наушники">
<ul class="ll-list">
  <li class="ll-card"><img alt="Наушники Pulse" src=""><h3>Наушники Pulse</h3><p>4 990 ₽</p><button type="button">В корзину</button></li>
  <li class="ll-card"><img alt="Наушники Pulse Pro" src=""><h3>Наушники Pulse Pro</h3><p>7 990 ₽</p><button type="button">В корзину</button></li>
  <li class="ll-card"><img alt="Кабель USB-C" src=""><h3>Кабель USB-C</h3><p>590 ₽</p><button type="button" aria-label="Добавить кабель в корзину">+</button></li>
</ul>
<label><input type="checkbox"> Только в наличии</label>
<button type="button" data-testid="checkout">Оформить заказ</button>
`;

const ROLE_OF: Record<string, (el: Element) => string | null> = {
  A: (e) => (e.hasAttribute('href') ? 'link' : null), BUTTON: () => 'button', H1: () => 'heading', H2: () => 'heading', H3: () => 'heading',
  LI: () => 'listitem', UL: () => 'list', IMG: (e) => (e.getAttribute('alt') === '' ? null : 'img'), HEADER: () => 'banner',
  INPUT: (e) => { const t = (e as HTMLInputElement).type; return t === 'checkbox' ? 'checkbox' : t === 'search' ? 'searchbox' : t === 'radio' ? 'radio' : 'textbox'; },
};
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
function labelText(el: Element, root: Element): string {
  const id = el.id;
  const byFor = id ? root.querySelector(`label[for="${id}"]`) : null;
  const wrap = el.closest('label');
  return norm((byFor?.textContent || '') + ' ' + (wrap?.textContent || ''));
}
function accName(el: Element, root: Element): string {
  if (el.getAttribute('aria-label')) return norm(el.getAttribute('aria-label')!);
  if (el.tagName === 'IMG') return norm(el.getAttribute('alt') || '');
  if (el.tagName === 'INPUT') return labelText(el, root);
  return norm(el.textContent || '');
}
const match = (actual: string, want: string, exact?: boolean) => (exact ? actual === want : actual.toLowerCase().includes(want.toLowerCase()));

type Step = { fn: string; args: string };
function parse(src: string): Step[] | string {
  const s = src.trim().replace(/^await\s+/, '').replace(/;$/, '');
  if (!s.startsWith('page.')) return 'Начните с page. — например, page.getByRole(\'button\', { name: \'В корзину\' })';
  const steps: Step[] = [];
  const re = /\.(\w+)\(((?:[^()'"]|'[^']*'|"[^"]*")*)\)/gy;
  re.lastIndex = 4;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) { steps.push({ fn: m[1], args: m[2] }); if (re.lastIndex === s.length) return steps; }
  return 'Не удалось разобрать выражение. Учебная модель понимает getByRole, getByText, getByLabel, getByPlaceholder, getByAltText, getByTestId, locator(css), filter({ hasText }), first(), last(), nth(i).';
}
function str(a: string): string | null { const m = a.match(/^\s*(['"`])(.*?)\1/); return m ? m[2] : null; }
function opt(a: string, k: string): string | boolean | null {
  const m = a.match(new RegExp(k + "\\s*:\\s*(?:(['\"`])(.*?)\\1|(true|false|\\d+))"));
  return m ? (m[2] !== undefined ? m[2] : m[3] === 'true' ? true : m[3] === 'false' ? false : m[3]) : null;
}

function evaluate(steps: Step[], root: Element): { els: Element[]; error?: string; note?: string } {
  let cur: Element[] = [root];
  let note: string | undefined;
  const all = (scope: Element[]) => scope.flatMap((s) => [...s.querySelectorAll('*')]);
  for (const st of steps) {
    const a = st.args;
    const exact = opt(a, 'exact') === true;
    switch (st.fn) {
      case 'getByRole': {
        const role = str(a); const name = opt(a, 'name');
        if (!role) return { els: [], error: 'getByRole ждёт роль строкой: getByRole(\'button\').' };
        cur = all(cur).filter((e) => ROLE_OF[e.tagName]?.(e) === role && (typeof name !== 'string' || match(accName(e, root), name, exact)));
        if (role === 'textbox' && !cur.length) note = 'Поле type="search" имеет роль searchbox, а не textbox.';
        break;
      }
      case 'getByText': { const t = str(a); if (t === null) return { els: [], error: 'getByText ждёт строку.' };
        cur = all(cur).filter((e) => !['SCRIPT', 'STYLE'].includes(e.tagName) && match(norm(e.textContent || ''), t, exact) && ![...e.children].some((c) => match(norm(c.textContent || ''), t, exact))); break; }
      case 'getByLabel': { const t = str(a); if (t === null) return { els: [], error: 'getByLabel ждёт строку.' };
        cur = all(cur).filter((e) => (e.tagName === 'INPUT' && match(labelText(e, root), t, exact)) || (!!e.getAttribute('aria-label') && match(e.getAttribute('aria-label')!, t, exact))); break; }
      case 'getByPlaceholder': { const t = str(a); cur = all(cur).filter((e) => t !== null && match(e.getAttribute('placeholder') || '', t, exact) && e.hasAttribute('placeholder')); break; }
      case 'getByAltText': { const t = str(a); cur = all(cur).filter((e) => t !== null && e.hasAttribute('alt') && match(e.getAttribute('alt')!, t, exact)); break; }
      case 'getByTestId': { const t = str(a); cur = all(cur).filter((e) => e.getAttribute('data-testid') === t); break; }
      case 'locator': { const css = str(a); if (!css) return { els: [], error: 'locator ждёт CSS-селектор строкой.' };
        try { cur = cur.flatMap((s) => [...s.querySelectorAll(css)]); } catch { return { els: [], error: 'Некорректный CSS-селектор.' }; } break; }
      case 'filter': { const t = opt(a, 'hasText'); if (typeof t !== 'string') return { els: [], error: 'Модель понимает filter({ hasText: \'…\' }).' };
        cur = cur.filter((e) => match(norm(e.textContent || ''), t, false)); break; }
      case 'first': cur = cur.slice(0, 1); note = 'first() убирает неоднозначность, но если порядок карточек изменится, тест молча возьмёт другой элемент.'; break;
      case 'last': cur = cur.slice(-1); break;
      case 'nth': { const n = Number(a.trim()); cur = Number.isInteger(n) ? cur.slice(n, n + 1) : []; break; }
      default: return { els: [], error: `Метод ${st.fn}() учебная модель не поддерживает.` };
    }
  }
  return { els: cur, note };
}

export function LocatorLab({ task }: { task?: string }) {
  const [expr, setExpr] = useState("page.getByRole('button', { name: 'В корзину' })");
  const host = useRef<HTMLDivElement>(null);
  const [res, setRes] = useState<{ els: Element[]; error?: string; note?: string }>({ els: [] });
  const steps = useMemo(() => parse(expr), [expr]);
  useEffect(() => {
    const root = host.current; if (!root) return;
    root.querySelectorAll('.ll-hit').forEach((e) => e.classList.remove('ll-hit'));
    const r = typeof steps === 'string' ? { els: [], error: steps } : evaluate(steps, root);
    r.els.forEach((e) => e.classList.add('ll-hit'));
    setRes(r);
  }, [steps]);
  const n = res.els.length;
  return (
    <section className="locator-lab" aria-label="Лаборатория локаторов">
      <header className="pg-head"><span className="pg-title">Лаборатория локаторов</span><ExecLabel kind="model" detail="упрощённые правила ролей и имён" /></header>
      {task && <p className="ll-task">{task}</p>}
      <label className="ll-label" htmlFor="ll-expr">Локатор</label>
      <input id="ll-expr" className="ll-input" value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} autoComplete="off" />
      <p className={'ll-status ' + (res.error ? 'bad' : n === 1 ? 'ok' : 'warn')} role="status">
        {res.error ? res.error : n === 0 ? 'Совпадений нет. Действие с таким локатором ждало бы появления элемента и упало бы по таймауту.' : n === 1 ? 'Ровно один элемент — с таким локатором можно выполнять действия.' : `Совпадений: ${n}. Действие (click, fill) упало бы с ошибкой strict mode violation: Playwright не выбирает элемент за вас.`}
        {res.note && <><br /><small>{res.note}</small></>}
      </p>
      <div className="ll-page" ref={host} dangerouslySetInnerHTML={{ __html: FIXTURE }} onClick={(e) => e.preventDefault()} />
      <p className="muted small">Это учебная модель страницы, а не браузер с Playwright. Роль и имя вычисляются по упрощённым правилам; в настоящем Playwright совпадение по name без exact тоже ищет подстроку без учёта регистра.</p>
    </section>
  );
}
