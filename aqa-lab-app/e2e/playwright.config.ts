import { defineConfig } from '@playwright/test';

// e2e самого приложения. Перед запуском: npm run build. Для заданий Playwright нужен runner (см. exercises.spec.ts).
const exe = process.env.AQA_BROWSER_PATH;
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${process.env.APP_PORT || 4173}`, ...(exe ? { launchOptions: { executablePath: exe } } : {}) },
  webServer: { command: `npx vite preview --port ${process.env.APP_PORT || 4173} --strictPort --outDir ${process.env.APP_DIST || 'dist'}`, url: `http://localhost:${process.env.APP_PORT || 4173}`, reuseExistingServer: true, cwd: '..' },
});
