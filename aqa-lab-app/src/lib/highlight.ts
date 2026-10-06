// Статическая подсветка кода тем же парсером, что и в редакторе (Lezer), без отдельной библиотеки.
import { highlightTree, classHighlighter } from '@lezer/highlight';
import { typescriptLanguage, javascriptLanguage } from '@codemirror/lang-javascript';
import { PostgreSQL } from '@codemirror/lang-sql';
import { pythonLanguage } from '@codemirror/lang-python';
import type { Parser } from '@lezer/common';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PARSERS: Record<string, () => Parser> = {
  ts: () => typescriptLanguage.parser, typescript: () => typescriptLanguage.parser,
  js: () => javascriptLanguage.parser, javascript: () => javascriptLanguage.parser,
  sql: () => PostgreSQL.language.parser,
  py: () => pythonLanguage.parser, python: () => pythonLanguage.parser,
};

export function highlight(code: string, lang: string): string {
  const p = PARSERS[lang];
  if (!p) return esc(code);
  const tree = p().parse(code);
  let out = '', pos = 0;
  highlightTree(tree, classHighlighter, (from, to, cls) => {
    if (from > pos) out += esc(code.slice(pos, from));
    out += `<span class="${cls}">${esc(code.slice(from, to))}</span>`;
    pos = to;
  });
  return out + esc(code.slice(pos));
}
