import { test, expect } from '@playwright/test';

// Каждое задание проверяется настоящими исполнителями в браузере:
// эталонное решение должно проходить проверку, стартовый код — нет (иначе задание засчитывается без работы).
// Задания Playwright проверяются, только если задан AQA_RUNNER_TOKEN и запущен runner.
type Ex = { id: string; kind: string; starter: string; solution: string };
type Report = { ok: boolean; summary: string; items: { label: string; ok: boolean; detail?: string; output?: string }[] };
declare global { interface Window { aqaSelftest?: { runCheck: (ex: unknown, code: string) => Promise<Report>; exercises: Ex[] } } }

const token = process.env.AQA_RUNNER_TOKEN;
const only = process.env.EX_ONLY?.split(',');

test('эталон проходит проверку, стартовый код — нет', async ({ page }) => {
  test.setTimeout(30 * 60_000);
  if (token) await page.addInitScript((t) => localStorage.setItem('aqalab-app:runner-token', JSON.stringify(t)), token);
  await page.goto('/?selftest#/');
  await page.waitForFunction(() => !!window.aqaSelftest);
  const list = await page.evaluate(() => window.aqaSelftest!.exercises.map((e) => ({ id: e.id, kind: e.kind })));
  const problems: string[] = [];
  let checked = 0;
  for (const ex of list) {
    if (only && !only.includes(ex.id)) continue;
    if (ex.kind === 'pw' && !token) { test.info().annotations.push({ type: 'skip', description: `${ex.id}: нет runner` }); continue; }
    for (const which of ['solution', 'starter'] as const) {
      const r = await page.evaluate(async ([id, w]) => { const s = window.aqaSelftest!; const e = s.exercises.find((x) => x.id === id)!; return s.runCheck(e, e[w as 'solution' | 'starter']); }, [ex.id, which]);
      const want = which === 'solution';
      if (r.ok !== want) problems.push(`${ex.id} [${which}] ожидалось ok=${want}: ${r.summary}\n` + r.items.filter((i) => i.ok !== want || !want).map((i) => `   ${i.ok ? '✓' : '✗'} ${i.label} ${i.detail ?? ''} ${(i.output ?? '').slice(0, 400)}`).join('\n'));
      console.log(`${r.ok === want ? 'OK  ' : 'FAIL'} ${ex.id} [${which}] ${r.summary}`);
    }
    checked++;
  }
  console.log(`проверено заданий: ${checked} из ${list.length}`);
  expect(problems, problems.join('\n')).toEqual([]);
});
