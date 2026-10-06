import raw from '../content/glossary.json';

export interface Term { en: string; ru: string; def: string; aliases: string; example?: string; lesson: string | null; v3: { ch: string; anchor: string | null } }
export const GLOSSARY = raw as unknown as Record<string, Term>;
export const termIds = Object.keys(GLOSSARY).sort((a, b) => GLOSSARY[a].en.localeCompare(GLOSSARY[b].en, 'en'));
