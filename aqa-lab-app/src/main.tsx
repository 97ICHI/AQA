import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applySettings } from './lib/store';
import './styles.css';

applySettings();
createRoot(document.getElementById('root')!).render(<App />);

// Самопроверка заданий (используется e2e/exercises.spec.ts): ?selftest открывает доступ к проверке из консоли/теста.
if (new URLSearchParams(location.search).has('selftest')) {
  void Promise.all([import('./exec/check'), import('./content/exercises')]).then(([c, e]) => {
    (window as unknown as Record<string, unknown>).aqaSelftest = { runCheck: c.runCheck, exercises: e.EXERCISES };
  });
}
