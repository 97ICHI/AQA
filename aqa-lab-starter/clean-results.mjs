import { existsSync, readdirSync, rmSync } from 'node:fs';
// Не смешивать результаты разных запусков Allure.
// Очищаем содержимое каталога, а не сам каталог: в Docker Compose он подключён как том, и его нельзя удалить (EBUSY).
const dir = 'allure-results';
if (existsSync(dir)) for (const entry of readdirSync(dir)) rmSync(`${dir}/${entry}`, { recursive: true, force: true });
