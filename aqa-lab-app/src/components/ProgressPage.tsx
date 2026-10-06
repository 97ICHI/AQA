import { useRef, useState } from 'react';
import { COURSE } from '../content/course';
import { EXERCISES_BY_LESSON } from '../content/exercises';
import { exportAll, importAll, storageStatus } from '../lib/storage';
import { store, useStore } from '../lib/store';

export function ProgressPage() {
  const read = useStore((s) => s.progress.read);
  const practice = useStore((s) => s.progress.practice);
  const drafts = useStore((s) => s.drafts);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const doExport = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `aqa-lab-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doImport = async (f: File) => {
    const r = importAll(await f.text());
    if (r.ok) store.reload();
    setMsg(r.message);
  };
  const st = storageStatus();
  return (
    <div className="page progress">
      <h1>Прогресс</h1>
      {st !== 'ok' && <p className="warn-line">Хранилище браузера недоступно (приватный режим или запрет сайта). Прогресс и черновики живут только до закрытия вкладки — используйте экспорт.</p>}
      <p className="muted">Данные хранятся только в этом браузере. «Прочитано» — ваша отметка; «практика» — успешная проверка задания. Черновиков: {Object.keys(drafts).length}.</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={doExport}>Экспорт в файл</button>
        <button type="button" className="btn" onClick={() => file.current?.click()}>Импорт из файла</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        <button type="button" className="btn danger" onClick={() => { if (confirm('Сбросить отметки «прочитано» и выполненные задания? Черновики останутся.')) { store.resetProgress(); setMsg('Прогресс сброшен.'); } }}>Сбросить прогресс</button>
      </div>
      {msg && <p role="status" className="status-line">{msg}</p>}
      <table className="prog-table">
        <thead><tr><th scope="col">Модуль</th><th scope="col">Прочитано</th><th scope="col">Задания</th></tr></thead>
        <tbody>
          {COURSE.map((m) => {
            const ex = m.lessons.flatMap((l) => EXERCISES_BY_LESSON[l.id] || []);
            return (
              <tr key={m.id}>
                <th scope="row">{m.num}. {m.title}</th>
                <td>{m.lessons.filter((l) => read[l.id]).length} / {m.lessons.length}</td>
                <td>{ex.length ? `${ex.filter((e) => practice[e.id]).length} / ${ex.length}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
