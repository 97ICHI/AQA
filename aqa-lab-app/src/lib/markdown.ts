// Рендер урока: Markdown + термины [[id|текст]] + блоки :::вид Заголовок … ::: + виджеты ```widget {json}```.
import MarkdownIt from 'markdown-it';
import { highlight } from './highlight';
import { GLOSSARY } from './glossary';

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LANG_LABEL: Record<string, string> = { ts: 'TypeScript', js: 'JavaScript', sql: 'SQL', py: 'Python', python: 'Python', bash: 'Terminal', sh: 'Terminal', powershell: 'PowerShell', text: 'Вывод', json: 'JSON', yaml: 'YAML', html: 'HTML', http: 'HTTP' };

md.renderer.rules.fence = (tokens, idx) => {
  const t = tokens[idx];
  const [lang, ...rest] = t.info.trim().split(/\s+/);
  if (lang === 'widget') {
    return `<div class="widget-slot" data-widget="${esc(t.content.trim())}"></div>`;
  }
  const title = rest.join(' ');
  const label = LANG_LABEL[lang] || lang || 'Код';
  return `<figure class="code"><figcaption><span class="code-lang">${esc(label)}</span>${title ? `<span class="code-title">${esc(title)}</span>` : ''}<button type="button" class="code-copy" aria-label="Скопировать код">Копировать</button></figcaption><pre tabindex="0"><code class="lang-${esc(lang || 'text')}">${highlight(t.content.replace(/\n$/, ''), lang)}</code></pre></figure>`;
};

// [[id]] или [[id|подпись]] → кнопка-термин; неизвестный термин — ошибка сборки контента (видно в check-content)
md.inline.ruler.before('link', 'term', (state, silent) => {
  const src = state.src, pos = state.pos;
  if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false;
  const end = src.indexOf(']]', pos + 2);
  if (end < 0) return false;
  const body = src.slice(pos + 2, end);
  const [id, label] = body.split('|');
  if (!/^[a-z0-9-]+$/.test(id)) return false;
  if (!silent) {
    const tok = state.push('html_inline', '', 0);
    const g = GLOSSARY[id];
    tok.content = g
      ? `<button type="button" class="term" data-term="${id}" aria-expanded="false">${esc(label || g.en)}</button>`
      : `<span class="term-missing" title="нет в глоссарии: ${esc(id)}">${esc(label || id)}</span>`;
  }
  state.pos = end + 2;
  return true;
});

export const slug = (s: string) => 'h-' + s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
md.renderer.rules.heading_open = (tokens, idx, opts, env, self) => {
  const inline = tokens[idx + 1];
  if (inline && !tokens[idx].attrGet('id')) tokens[idx].attrSet('id', slug(inline.content));
  return self.renderToken(tokens, idx, opts);
};

const KINDS: Record<string, string> = {
  why: 'Зачем это нужно', try: 'Попробуйте', happened: 'Что произошло', deep: 'Глубже', tech: 'Технические детали',
  interview: 'Для собеседования', note: 'Обратите внимание', warn: 'Осторожно', mistake: 'Типичная ошибка', terms: 'Термины урока',
};
const COLLAPSED = new Set(['deep', 'tech', 'interview']);

export function renderLesson(source: string): string {
  // блоки :::kind Заголовок … ::: (без вложенности)
  const out: string[] = [];
  const lines = source.split('\n');
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^:::(\w+)\s*(.*)$/);
    if (!m) { buf.push(lines[i]); continue; }
    out.push(md.render(buf.join('\n'))); buf = [];
    const kind = m[1], title = m[2] || KINDS[kind] || '';
    const inner: string[] = [];
    for (i++; i < lines.length && lines[i].trim() !== ':::'; i++) inner.push(lines[i]);
    const body = md.render(inner.join('\n'));
    if (COLLAPSED.has(kind)) out.push(`<details class="layer layer-${kind}"><summary><span class="layer-kind">${esc(KINDS[kind] || kind)}</span>${title && title !== KINDS[kind] ? `<span class="layer-title">${esc(title)}</span>` : ''}</summary><div class="layer-body">${body}</div></details>`);
    else out.push(`<section class="block block-${kind}"><h3 class="block-title">${esc(title)}</h3>${body}</section>`);
  }
  out.push(md.render(buf.join('\n')));
  return out.join('');
}

export function renderInline(s: string) { return md.renderInline(s); }
