// Безопасное хранилище: ошибки localStorage (приватный режим, квота, повреждённые данные) не ломают приложение.
const PREFIX = 'aqalab-app:';
export type StorageStatus = 'ok' | 'unavailable' | 'error';
let lastStatus: StorageStatus = 'ok';
export const storageStatus = () => lastStatus;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const v = JSON.parse(raw);
    if (fallback !== null && typeof fallback === 'object' && (typeof v !== 'object' || v === null || Array.isArray(v) !== Array.isArray(fallback))) return fallback;
    return v as T;
  } catch {
    lastStatus = 'unavailable';
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    lastStatus = 'ok';
    return true;
  } catch {
    lastStatus = 'error';
    return false;
  }
}

export interface Progress {
  read: Record<string, number>; // урок → время отметки
  practice: Record<string, number>; // задание → время успешной проверки
}
export const KEYS = { progress: 'progress', drafts: 'drafts', settings: 'settings' } as const;

export function exportAll(): string {
  const data: Record<string, unknown> = { format: 'aqa-lab-app', version: 1, exportedAt: new Date().toISOString() };
  for (const k of Object.values(KEYS)) data[k] = load(k, null);
  return JSON.stringify(data, null, 1);
}

export function importAll(text: string): { ok: boolean; message: string } {
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch { return { ok: false, message: 'Файл не похож на JSON.' }; }
  if (data.format !== 'aqa-lab-app') return { ok: false, message: 'Это не экспорт AQA Lab.' };
  for (const k of Object.values(KEYS)) if (data[k] && typeof data[k] === 'object') if (!save(k, data[k])) return { ok: false, message: 'Хранилище браузера недоступно — импорт не сохранён.' };
  return { ok: true, message: 'Прогресс, черновики и настройки восстановлены.' };
}
