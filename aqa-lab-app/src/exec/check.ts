// Проверка заданий по поведению. Каждая проверка запускает код по-настоящему и возвращает понятный отчёт.
import type { Exercise } from '../content/exercises/types';
import { compileTs, runJs, type RunEvent, type Running } from './ts';
import { checkSql, DATASETS, type Table } from './sql';
import { pytest } from './py';
import { runPlaywright } from './runner';

export interface CheckItem { label: string; ok: boolean; detail?: string; expected?: Table; actual?: Table; output?: string }
export interface CheckReport { ok: boolean; stage: 'types' | 'runtime' | 'behaviour' | 'error'; summary: string; items: CheckItem[] }

let activeRun: Running | null = null;
export function stopTsCheck() { activeRun?.stop(); }

async function runTs(files: Record<string, string>, entry: string): Promise<{ events: RunEvent[] }> {
  const events: RunEvent[] = [];
  const compiled = await compileTs(files);
  const mods: Record<string, string> = {};
  for (const [k, v] of Object.entries(compiled.js)) mods[k] = v;
  activeRun = runJs(mods, entry, (e) => events.push(e), 4000);
  await activeRun.done;
  activeRun = null;
  return { events };
}
const failText = (ev: RunEvent[]) => ev.map((e) => (e.type === 'error' ? `${e.name}: ${e.message}` : e.type === 'timeout' ? `Остановлено: код выполнялся дольше ${e.ms / 1000} с (возможен бесконечный цикл или Promise, который никогда не завершается).` : e.type === 'stopped' ? 'Остановлено вручную.' : '')).filter(Boolean).join('\n');

export async function runCheck(ex: Exercise, code: string): Promise<CheckReport> {
  try {
    if (ex.kind === 'ts' || ex.kind === 'ts-test') {
      const studentName = ex.kind === 'ts' ? '/student.ts' : '/student.test.ts';
      const typeFiles: Record<string, string> = ex.kind === 'ts' ? { '/student.ts': code, '/check.ts': ex.check } : { '/app.ts': ex.good, '/student.test.ts': code };
      const c = await compileTs(typeFiles);
      const own = c.diagnostics.filter((d) => '/' + d.file === studentName);
      if (own.length) return { ok: false, stage: 'types', summary: 'Компилятор TypeScript нашёл ошибки типов. Код не запускался: сначала исправьте их.', items: own.map((d) => ({ label: `Строка ${d.line}, столбец ${d.col} — TS${d.code}`, ok: false, detail: d.message })) };
      if (c.diagnostics.length) return { ok: false, stage: 'types', summary: 'Код не совместим с проверкой: проверьте имена и типы экспортируемых функций.', items: c.diagnostics.map((d) => ({ label: `${d.file}: строка ${d.line} — TS${d.code}`, ok: false, detail: d.message })) };
      if (ex.kind === 'ts') {
        const { events } = await runTs({ '/student.ts': code, '/check.ts': ex.check }, 'check');
        const tests = events.filter((e): e is Extract<RunEvent, { type: 'test' }> => e.type === 'test');
        const err = failText(events);
        const items: CheckItem[] = tests.map((t) => ({ label: t.name, ok: t.ok, detail: t.message }));
        if (err) items.push({ label: 'Ошибка во время выполнения', ok: false, detail: err });
        const ok = !err && tests.length > 0 && tests.every((t) => t.ok);
        return { ok, stage: err ? 'runtime' : 'behaviour', summary: ok ? `Все проверки пройдены (${tests.length}).` : `Пройдено ${tests.filter((t) => t.ok).length} из ${tests.length}.`, items };
      }
      // ts-test: тесты ученика должны проходить на исправной версии и падать на каждой сломанной
      const variants = [{ name: 'Исправная версия', code: ex.good, mustPass: true }, ...ex.broken.map((b) => ({ name: b.name, code: b.code, mustPass: false }))];
      const items: CheckItem[] = [];
      for (const v of variants) {
        const { events } = await runTs({ '/app.ts': v.code, '/student.test.ts': code }, 'student.test');
        const tests = events.filter((e): e is Extract<RunEvent, { type: 'test' }> => e.type === 'test');
        const err = failText(events);
        const passed = !err && tests.length > 0 && tests.every((t) => t.ok);
        if (!tests.length && !err) { items.push({ label: v.name, ok: false, detail: 'Не найдено ни одного теста. Объявите проверку через test(\'название\', () => { … }).' }); continue; }
        const failed = tests.filter((t) => !t.ok).map((t) => `✗ ${t.name}: ${t.message}`).join('\n');
        items.push(v.mustPass
          ? { label: `${v.name}: тесты должны пройти`, ok: passed, detail: passed ? `${tests.length} тест(ов) прошли.` : (failed || err) + '\nТест падает на исправном коде — значит, ожидание в тесте неверное.' }
          : { label: `${v.name}: тесты должны упасть`, ok: !passed, detail: !passed ? (failed || err) : 'Все тесты прошли на сломанной версии — этот дефект ваши проверки не замечают.' });
      }
      const ok = items.every((i) => i.ok);
      return { ok, stage: 'behaviour', summary: ok ? 'Ваши тесты отличают исправный код от каждого дефекта.' : 'Тесты пока не ловят все дефекты или падают на исправном коде.', items };
    }
    if (ex.kind === 'sql') {
      const verdicts = await checkSql({ sql: code, reference: ex.reference, ordered: ex.ordered, datasets: ex.datasets as never, verify: ex.verify });
      const items: CheckItem[] = verdicts.map((v) => ({ label: `Набор данных «${DATASETS[v.dataset].title}»`, ok: v.ok, detail: v.error ? `PostgreSQL: ${v.error}` : v.reason, expected: v.ok ? undefined : v.expected, actual: v.ok ? undefined : v.actual }));
      const ok = items.every((i) => i.ok);
      return { ok, stage: verdicts.some((v) => v.error) ? 'runtime' : 'behaviour', summary: ok ? `Результат совпал с эталоном на всех наборах данных (${items.length}).` : 'Результат отличается от эталона хотя бы на одном наборе данных.', items };
    }
    if (ex.kind === 'py') {
      const r = await pytest({ 'student.py': code, 'test_check.py': ex.check });
      const ok = r.exitCode === 0;
      return { ok, stage: 'behaviour', summary: ok ? 'pytest: все проверки прошли.' : r.exitCode === 5 ? 'pytest не нашёл тестов.' : 'pytest: есть упавшие проверки.', items: [{ label: 'pytest test_check.py', ok, output: r.output }] };
    }
    if (ex.kind === 'py-test') {
      const items: CheckItem[] = [];
      const good = await pytest({ 'shop.py': ex.good, 'test_student.py': code });
      items.push(good.exitCode === 5 ? { label: 'Исправная версия', ok: false, detail: 'pytest не нашёл тестов: имена функций должны начинаться с test_.', output: good.output } : { label: 'Исправная версия: тесты должны пройти', ok: good.exitCode === 0, output: good.output, detail: good.exitCode === 0 ? undefined : 'Тест падает на исправном коде — проверьте ожидание.' });
      for (const b of ex.broken) {
        const r = await pytest({ 'shop.py': b.code, 'test_student.py': code });
        items.push({ label: `${b.name}: тесты должны упасть`, ok: r.exitCode === 1, output: r.output, detail: r.exitCode === 0 ? 'Все тесты прошли на сломанной версии — этот дефект не пойман.' : undefined });
      }
      const ok = items.every((i) => i.ok);
      return { ok, stage: 'behaviour', summary: ok ? 'Ваши тесты отличают исправный код от каждого дефекта.' : 'Тесты пока не ловят все дефекты или падают на исправном коде.', items };
    }
    if (ex.kind === 'pw') {
      const res = await runPlaywright(code, [...ex.mustPass, ...ex.mustFail]);
      const items: CheckItem[] = res.runs.map((r) => {
        const must = ex.mustPass.includes(r.variant);
        const failedTests = r.tests.filter((t) => t.status !== 'passed' && t.status !== 'skipped');
        const out = [r.tests.map((t) => `${t.status === 'passed' ? '✓' : '✗'} ${t.title} (${t.duration} мс)${t.error ? '\n' + t.error : ''}`).join('\n'), r.stderr].filter(Boolean).join('\n');
        if (!r.tests.length) return { label: r.label, ok: false, detail: 'Playwright не нашёл тестов или файл не скомпилировался.', output: out };
        return must
          ? { label: `${r.label}: тест должен пройти`, ok: r.ok, output: out, detail: r.ok ? undefined : 'Тест падает на исправном магазине — проблема в самом тесте.' }
          : { label: `${r.label}: тест должен упасть`, ok: !r.ok && failedTests.length > 0, output: out, detail: r.ok ? 'Тест прошёл, хотя в магазине включён дефект: проверка его не замечает.' : undefined };
      });
      const ok = items.length > 0 && items.every((i) => i.ok);
      return { ok, stage: 'behaviour', summary: ok ? 'Настоящий Playwright: тест проходит на исправном магазине и ловит дефекты.' : 'Проверка не пройдена — смотрите результаты по каждому варианту магазина.', items };
    }
    return { ok: false, stage: 'error', summary: 'Неизвестный тип задания.', items: [] };
  } catch (err) {
    return { ok: false, stage: 'error', summary: (err as Error).message, items: [] };
  }
}
