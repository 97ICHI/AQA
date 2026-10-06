import type { Exercise } from './types';
const mods = import.meta.glob('./ex-*.ts', { eager: true }) as Record<string, { default: Exercise[] }>;
export const EXERCISES: Exercise[] = Object.values(mods).flatMap((m) => m.default);
export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
export const EXERCISES_BY_LESSON: Record<string, Exercise[]> = {};
for (const e of EXERCISES) (EXERCISES_BY_LESSON[e.lesson] ||= []).push(e);
export type { Exercise };
