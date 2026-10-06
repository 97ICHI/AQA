// Редактор кода на CodeMirror 6: номера строк, подсветка, история, Ctrl+Enter — запуск.
// Tab вставляет отступ; чтобы выйти из редактора клавиатурой: Esc, затем Tab.
import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';

export type Lang = 'ts' | 'sql' | 'py';
const langExt = (l: Lang) => (l === 'sql' ? sql({ dialect: PostgreSQL, upperCaseKeywords: true }) : l === 'py' ? python() : javascript({ typescript: true }));

export interface EditorHandle { setValue(v: string): void; focus(): void }
export function CodeEditor({ value, onChange, lang, label, onRun, handle, minLines = 6 }: {
  value: string; onChange: (v: string) => void; lang: Lang; label: string; onRun?: () => void; handle?: (h: EditorHandle) => void; minLines?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cbs = useRef({ onChange, onRun });
  cbs.current = { onChange, onRun };
  useEffect(() => {
    const langC = new Compartment();
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          keymap.of([{ key: 'Mod-Enter', run: () => { cbs.current.onRun?.(); return true; } }, indentWithTab]),
          basicSetup,
          langC.of(langExt(lang)),
          EditorView.contentAttributes.of({ 'aria-label': label + ' (Esc, затем Tab — выйти из редактора; Ctrl+Enter — запуск)' }),
          EditorView.updateListener.of((u) => { if (u.docChanged) cbs.current.onChange(u.state.doc.toString()); }),
          EditorView.theme({ '.cm-content, .cm-gutter': { minHeight: `${minLines * 1.55}em` } }),
        ],
      }),
    });
    view.current = v;
    handle?.({
      setValue: (s) => v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: s } }),
      focus: () => v.focus(),
    });
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  return <div className="editor" ref={host} />;
}
