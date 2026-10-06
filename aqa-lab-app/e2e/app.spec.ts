import { test, expect, type Page } from '@playwright/test';

// e2e интерфейса приложения: навигация, термины, поиск, прогресс, мобильная версия, исполнители.
const errorsOf = (page: Page) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/127\.0\.0\.1:7357|ERR_CONNECTION_REFUSED|401/.test(m.text() + (m.location().url || ''))) errs.push(m.text()); });
  return errs;
};

test('главная и переход к уроку через содержание', async ({ page }) => {
  const errs = errorsOf(page);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'AQA Lab' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: /Первый тест Playwright/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Первый тест Playwright' })).toBeVisible();
  await expect(page).toHaveTitle(/Первый тест Playwright/);
  await page.getByRole('link', { name: /Дальше/ }).click();
  await expect(page.locator('h1')).toHaveText('Тест упал: дефект или ошибка теста?');
  expect(errs).toEqual([]);
});

test('урок без текста показывает план и ссылку на главу v3', async ({ page }) => {
  await page.goto('/#/l/pw-ci');
  const h = await page.locator('h1').textContent();
  expect(h).toBeTruthy();
  const plan = page.locator('.planned-box');
  if (await plan.count()) await expect(plan.getByRole('link').first()).toHaveAttribute('href', /^v3\/AQA_Lab_v3\.html#\//);
});

test('подсказка термина: фокус, Escape, нажатие, ссылка в глоссарий', async ({ page }) => {
  await page.goto('/#/l/intro-first-test');
  const term = page.locator('button.term').first();
  await term.focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); // фокус с клавиатуры → :focus-visible
  const pop = page.getByRole('tooltip');
  await expect(pop).toBeVisible();
  await expect(term).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(term).toBeFocused();
  await term.click();
  await expect(pop).toBeVisible();
  const box = await pop.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  await pop.getByRole('link', { name: 'В глоссарии' }).click();
  await expect(page.locator('h1')).toHaveText('Глоссарий');
  await expect(page.locator('.g-item.current')).toBeVisible();
});

test('поиск находит уроки, термины и текст ошибки', async ({ page }) => {
  await page.goto('/#/');
  const box = page.getByRole('combobox', { name: 'Поиск по учебнику' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(box).toBeFocused();
  await box.fill('strict mode');
  await expect(page.getByRole('option').first()).toBeVisible();
  await box.fill('Received: "0"');
  await expect(page.getByRole('listbox')).toContainText('Первый тест Playwright');
  await box.fill('auto-waiting');
  await expect(page.getByRole('option').first()).toBeVisible();
  await box.press('Enter');
  await expect(page).toHaveURL(/#\/(l|glossary)\//);
});

test('прогресс: отметка, экспорт, сброс и импорт', async ({ page }) => {
  await page.goto('/#/l/intro-first-test');
  await page.getByRole('checkbox', { name: 'Прочитано' }).check();
  await page.goto('/#/progress');
  await expect(page.getByRole('row', { name: /Знакомство/ })).toContainText('1 / 3');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Экспорт в файл' }).click()]);
  const file = await dl.path();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click();
  await expect(page.getByRole('row', { name: /Знакомство/ })).toContainText('0 / 3');
  await page.locator('input[type=file]').setInputFiles(file!);
  await expect(page.getByRole('status')).toContainText('восстановлены');
  await expect(page.getByRole('row', { name: /Знакомство/ })).toContainText('1 / 3');
});

test('повреждённое хранилище не ломает приложение', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('aqalab-app:progress', '{не json'); localStorage.setItem('aqalab-app:drafts', '[1,2]'); });
  const errs = errorsOf(page);
  await page.goto('/#/progress');
  await expect(page.locator('h1')).toHaveText('Прогресс');
  expect(errs).toEqual([]);
});

test('светлая тема сохраняется', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Светлая тема' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test.describe('телефон', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('меню открывается и закрывается Escape; нет горизонтальной прокрутки', async ({ page }) => {
    for (const h of ['#/', '#/l/intro-first-test', '#/glossary', '#/progress', '#/about']) {
      await page.goto('/' + h);
      await page.waitForTimeout(200);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sw, h).toBeLessThanOrEqual(0);
    }
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Открыть меню курса' }).click();
    const nav = page.getByRole('complementary', { name: 'Содержание курса' });
    await expect(nav).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(nav).not.toBeInViewport();
  });
  test('задание: вкладки Задача / Код / Результат', async ({ page }) => {
    await page.goto('/#/l/intro-first-test');
    const ex = page.locator('.exercise').first();
    await ex.scrollIntoViewIfNeeded();
    await ex.getByRole('tab', { name: 'Код' }).click();
    await expect(ex.locator('.cm-editor')).toBeVisible();
    await expect(ex.locator('.ex-task')).toBeHidden();
    await ex.getByRole('tab', { name: 'Задача' }).click();
    await expect(ex.locator('.ex-task')).toBeVisible();
  });
});

test('TypeScript: ошибка типов отдельно от выполнения, бесконечный цикл останавливается', async ({ page }) => {
  await page.goto('/?selftest#/');
  await page.waitForFunction(() => !!(window as unknown as { aqaSelftest?: unknown }).aqaSelftest);
  const r = await page.evaluate(async () => {
    const s = (window as unknown as { aqaSelftest: { runCheck: (e: unknown, c: string) => Promise<{ ok: boolean; stage: string; summary: string }>; exercises: { id: string }[] } }).aqaSelftest;
    const ex = s.exercises.find((e) => e.id === 'ts-fn-total')!;
    const typeErr = await s.runCheck(ex, 'export function cartTotal(items: { price: number; qty: number }[]): number { return "0"; }');
    const loop = await s.runCheck(ex, 'export function cartTotal(items: { price: number; qty: number }[]): number { while (true) {} }');
    const rt = await s.runCheck(ex, 'export function cartTotal(items: { price: number; qty: number }[]): number { throw new Error("boom"); }');
    return { typeErr, loop, rt };
  });
  expect(r.typeErr.stage).toBe('types');
  expect(r.loop.ok).toBe(false);
  expect(r.rt.ok).toBe(false);
});

test('редактор задания: черновик сохраняется после перезагрузки', async ({ page }) => {
  await page.goto('/#/l/intro-first-test');
  const ed = page.locator('.exercise .cm-content').first();
  await ed.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n// мой черновик');
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('.exercise .cm-content').first()).toContainText('// мой черновик');
});
