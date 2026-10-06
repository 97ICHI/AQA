// Тексты уроков лежат в content/lessons/<id>.md (встраиваются в сборку: нужны и для поиска).
const files = import.meta.glob('../content/lessons/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const byId: Record<string, string> = {};
for (const [p, t] of Object.entries(files)) byId[p.replace(/^.*\/(.+)\.md$/, '$1')] = t;
export const hasLesson = (id: string) => id in byId;
export const loadLesson = (id: string) => Promise.resolve(byId[id] ?? null);
export const lessonSource = (id: string) => byId[id] ?? null;
export const writtenLessonIds = Object.keys(byId);
