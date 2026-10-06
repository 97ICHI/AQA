import { useEffect, useState } from 'react';
import { runnerStatus, runnerInfo, runnerToken, setRunnerToken, useRunnerStatus } from '../exec/runner';
import { store, useStore } from '../lib/store';

export function AboutPage({ anchor }: { anchor?: string }) {
  const runner = useRunnerStatus();
  const fs = useStore((s) => s.settings.fontSize);
  const [tok, setTok] = useState(runnerToken());
  useEffect(() => { if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }), 30); }, [anchor]);
  const info = runnerInfo();
  return (
    <div className="page about">
      <h1>О приложении</h1>
      <p>AQA Lab — учебник и тренажёр. Каждый урок: зачем это нужно → объяснение → пример → попробуйте сами → что произошло; дополнительные слои («Глубже», «Технические детали», «Для собеседования») свёрнуты и не мешают первому чтению.</p>

      <h2 id="exec">Что выполняется по-настоящему</h2>
      <table className="matrix">
        <thead><tr><th scope="col">Тренажёр</th><th scope="col">Как работает</th><th scope="col">Без интернета</th><th scope="col">Без runner</th></tr></thead>
        <tbody>
          <tr><th scope="row">TypeScript</th><td>Настоящий компилятор TypeScript (strict) в Web Worker; JavaScript выполняется в отдельном одноразовом Worker с таймаутом и кнопкой «Остановить». Ошибки типов и ошибки выполнения показываются отдельно.</td><td>да</td><td>да</td></tr>
          <tr><th scope="row">SQL</th><td>Настоящий PostgreSQL, собранный в WebAssembly (PGlite), в Web Worker. Учебная база магазина, три набора данных; проверка сравнивает ваш результат с эталоном на каждом наборе.</td><td>да</td><td>да</td></tr>
          <tr><th scope="row">Python</th><td>Настоящий CPython (Pyodide) в Web Worker, pytest из локальных пакетов. Первый запуск загружает около 15 МБ.</td><td>да, после сборки</td><td>да</td></tr>
          <tr><th scope="row">Playwright</th><td>Настоящий Playwright Test на вашем компьютере через локальный runner и учебный магазин с управляемыми дефектами.</td><td>да (локально)</td><td>нет — показывается записанный результат с пометкой</td></tr>
          <tr><th scope="row">Лаборатория локаторов</th><td>Учебная модель: упрощённые роли и доступные имена на фиксированной странице.</td><td>да</td><td>да</td></tr>
        </tbody>
      </table>

      <h2 id="runner">Runner Playwright</h2>
      <p>Статус: <strong>{runner === 'online' ? `подключён${info.playwright ? ` (Playwright ${info.playwright})` : ''}` : runner === 'token' ? 'запущен, нужен токен' : runner === 'checking' ? 'проверка…' : 'не найден'}</strong> <button type="button" className="btn ghost" onClick={() => void runnerStatus()}>Проверить снова</button></p>
      <ol>
        <li>Установите Node.js 20+ и выполните в папке <code>aqa-lab-app</code>: <code>npm ci</code>, затем <code>npx playwright install chromium</code>.</li>
        <li>Запустите <code>npm run runner</code>. Runner слушает только <code>127.0.0.1:7357</code> и печатает одноразовый токен.</li>
        <li>Вставьте токен сюда:
          <form className="token-form" onSubmit={(e) => { e.preventDefault(); setRunnerToken(tok); }}>
            <input value={tok} onChange={(e) => setTok(e.target.value)} aria-label="Токен runner" placeholder="токен из консоли runner" spellCheck={false} />
            <button type="submit" className="btn">Сохранить</button>
          </form>
        </li>
      </ol>
      <div className="block block-warn"><h3 className="block-title">Ограничения runner</h3>
        <ul>
          <li>Runner выполняет ваш код на вашем компьютере с правами вашего пользователя. Это не песочница: запускайте только тот код, который понимаете.</li>
          <li>Защита от чужих сайтов: принимаются запросы только с токеном и только с разрешённых адресов приложения (localhost); runner не слушает внешние сетевые интерфейсы.</li>
          <li>Каждый запуск ограничен по времени (по умолчанию 30 с) и использует отдельную временную папку; одновременно идёт один запуск.</li>
          <li>Тесты обращаются только к учебному магазину, который runner поднимает сам (с данными в памяти). Никаких реальных сервисов и секретов.</li>
        </ul>
      </div>

      <h2 id="isolation">Изоляция кода в браузере</h2>
      <p>Код TypeScript выполняется не в основном окне, а в отдельном Worker без доступа к странице, прогрессу и черновикам; по таймауту Worker уничтожается. Worker — это граница от случайных ошибок (бесконечный цикл, исключение), а не защита от намеренно вредного кода: код в Worker может делать сетевые запросы, как любой скрипт этого сайта.</p>

      <h2 id="settings">Настройки</h2>
      <label className="read-toggle"><input type="checkbox" checked={fs === 'l'} onChange={(e) => store.setSettings({ fontSize: e.target.checked ? 'l' : 'm' })} /> Крупный шрифт</label>
      <p className="muted small">Анимации отключаются автоматически, если в системе включено «уменьшение движения».</p>

      <h2 id="v3">Учебник v3</h2>
      <p>Полный текст предыдущей версии учебника доступен офлайн: <a href="v3/AQA_Lab_v3.html" target="_blank" rel="noopener">AQA_Lab_v3.html</a>. Уроки с меткой «план» ссылаются на соответствующие главы.</p>
    </div>
  );
}
