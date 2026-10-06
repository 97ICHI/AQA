// Небольшое состояние приложения с подпиской (без сторонних библиотек).
import { useSyncExternalStore } from 'react';
import { load, save, KEYS, type Progress } from './storage';

export interface Settings { theme: 'dark' | 'light'; fontSize: 'm' | 'l'; }
interface State { progress: Progress; drafts: Record<string, string>; settings: Settings; }

let state: State = {
  progress: { read: {}, practice: {}, ...load<Partial<Progress>>(KEYS.progress, {}) },
  drafts: load<Record<string, string>>(KEYS.drafts, {}),
  settings: { theme: 'dark', fontSize: 'm', ...load<Partial<Settings>>(KEYS.settings, {}) },
};
if (typeof state.progress.read !== 'object' || state.progress.read === null) state.progress.read = {};
if (typeof state.progress.practice !== 'object' || state.progress.practice === null) state.progress.practice = {};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const store = {
  get: () => state,
  subscribe: (f: () => void) => { subs.add(f); return () => subs.delete(f); },
  markRead(id: string, on: boolean) {
    const read = { ...state.progress.read };
    if (on) read[id] = Date.now(); else delete read[id];
    state = { ...state, progress: { ...state.progress, read } }; save(KEYS.progress, state.progress); emit();
  },
  markPractice(id: string) {
    if (state.progress.practice[id]) return;
    state = { ...state, progress: { ...state.progress, practice: { ...state.progress.practice, [id]: Date.now() } } }; save(KEYS.progress, state.progress); emit();
  },
  saveDraft(id: string, code: string | null): boolean {
    const drafts = { ...state.drafts };
    if (code === null) delete drafts[id]; else drafts[id] = code;
    state = { ...state, drafts }; const ok = save(KEYS.drafts, drafts); emit(); return ok;
  },
  setSettings(p: Partial<Settings>) {
    state = { ...state, settings: { ...state.settings, ...p } }; save(KEYS.settings, state.settings); emit();
    applySettings();
  },
  reload() {
    state = {
      progress: { read: {}, practice: {}, ...load<Partial<Progress>>(KEYS.progress, {}) },
      drafts: load<Record<string, string>>(KEYS.drafts, {}),
      settings: { theme: 'dark', fontSize: 'm', ...load<Partial<Settings>>(KEYS.settings, {}) },
    };
    applySettings(); emit();
  },
  resetProgress() { state = { ...state, progress: { read: {}, practice: {} } }; save(KEYS.progress, state.progress); emit(); },
};

export function applySettings() {
  const r = document.documentElement;
  r.dataset.theme = state.settings.theme === 'light' ? 'light' : 'dark';
  if (state.settings.fontSize === 'l') r.dataset.fs = 'l'; else delete r.dataset.fs;
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()));
}
