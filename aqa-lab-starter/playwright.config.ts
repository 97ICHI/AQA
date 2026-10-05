import { defineConfig } from '@playwright/test';

const port = 3000;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // забытый test.only не должен пройти в CI
  retries: 0, // повторы маскируют нестабильность; включайте осознанно (см. главу «Flaky Tests»)
  workers: 2,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }], ['allure-playwright', { resultsDir: 'allure-results' }]],
  use: {
    baseURL: process.env.BASE_URL || `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Необязательно: путь к уже установленному браузеру, если Playwright не может скачать свой.
    launchOptions: process.env.AQA_BROWSER_PATH
      ? { executablePath: process.env.AQA_BROWSER_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] }
      : undefined,
  },
  // Если BASE_URL задан (например, в Docker Compose), приложение уже запущено снаружи.
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'node server.mjs', url: `http://127.0.0.1:${port}/ready`, reuseExistingServer: false },
});
