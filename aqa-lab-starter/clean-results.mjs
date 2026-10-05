import { rmSync } from 'node:fs';
// Не смешивать результаты разных запусков Allure.
rmSync('allure-results', { recursive: true, force: true });
