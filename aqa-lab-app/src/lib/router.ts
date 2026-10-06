import { useSyncExternalStore } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'lesson'; id: string; anchor?: string }
  | { page: 'glossary'; term?: string }
  | { page: 'progress' }
  | { page: 'about'; anchor?: string }
  | { page: 'notfound'; path: string };

export function parse(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#\/?/, ''));
  const [a, b, c] = h.split('/');
  if (!a) return { page: 'home' };
  if (a === 'l' && b) return { page: 'lesson', id: b, anchor: c };
  if (a === 'glossary') return { page: 'glossary', term: b };
  if (a === 'progress') return { page: 'progress' };
  if (a === 'about') return { page: 'about', anchor: b };
  return { page: 'notfound', path: h };
}
const sub = (f: () => void) => { window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); };
export const useRoute = () => parse(useSyncExternalStore(sub, () => location.hash));
export const href = { lesson: (id: string) => `#/l/${id}`, term: (id: string) => `#/glossary/${id}` };
