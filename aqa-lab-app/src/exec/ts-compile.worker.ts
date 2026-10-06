/// <reference lib="webworker" />
// Компилятор TypeScript в отдельном Worker: проверка типов (strict) и преобразование в JavaScript.
import ts from 'typescript';
import globalsDts from './ts-globals.d.ts.txt?raw';

const libLoaders = import.meta.glob('/node_modules/typescript/lib/lib.{es,decorators}*.d.ts', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const libs = new Map<string, string>();
async function loadLib(name: string): Promise<void> {
  if (libs.has(name)) return;
  const key = `/node_modules/typescript/lib/${name}`;
  const loader = libLoaders[key];
  if (!loader) return;
  const text = await loader();
  libs.set(name, text);
  for (const m of text.matchAll(/\/\/\/\s*<reference lib="([^"]+)"\s*\/>/g)) await loadLib(`lib.${m[1].toLowerCase()}.d.ts`);
}
const ready = loadLib('lib.es2022.d.ts');

export interface Diag { file: string; line: number; col: number; code: number; message: string }
export interface CompileResult { ok: boolean; diagnostics: Diag[]; js: Record<string, string> }

const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, moduleDetection: ts.ModuleDetectionKind.Force,
  strict: true, noEmitOnError: false, lib: ['lib.es2022.d.ts'], types: [], skipLibCheck: true, noUnusedLocals: false,
  allowImportingTsExtensions: false, moduleResolution: ts.ModuleResolutionKind.Bundler,
};

function compile(files: Record<string, string>): CompileResult {
  const all: Record<string, string> = { '/globals.d.ts': globalsDts, ...files };
  const host: ts.CompilerHost = {
    getSourceFile: (name, lang) => {
      const base = name.split('/').pop()!;
      const text = all[name] ?? (libs.has(base) ? libs.get(base) : undefined);
      return text === undefined ? undefined : ts.createSourceFile(name, text, lang, true);
    },
    getDefaultLibFileName: () => 'lib.es2022.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (f) => f in all || libs.has(f.split('/').pop()!),
    readFile: (f) => all[f] ?? libs.get(f.split('/').pop()!),
    resolveModuleNames: (names, containing) => names.map((n) => {
      const p = n.startsWith('./') ? '/' + n.slice(2).replace(/\.ts$/, '') + '.ts' : null;
      return p && p in all ? { resolvedFileName: p, extension: ts.Extension.Ts } : undefined;
    }),
  };
  const roots = Object.keys(all);
  const program = ts.createProgram(roots, options, host);
  const diags = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()]
    .filter((d) => d.file && d.file.fileName in files)
    .map((d) => {
      const { line, character } = d.file!.getLineAndCharacterOfPosition(d.start ?? 0);
      return { file: d.file!.fileName.slice(1), line: line + 1, col: character + 1, code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') };
    });
  const js: Record<string, string> = {};
  for (const [name, src] of Object.entries(files)) {
    js[name.slice(1).replace(/\.ts$/, '')] = ts.transpileModule(src, { compilerOptions: { ...options, sourceMap: false }, fileName: name }).outputText;
  }
  return { ok: diags.length === 0, diagnostics: diags, js };
}

self.onmessage = async (e: MessageEvent<{ id: number; files: Record<string, string> }>) => {
  try {
    await ready;
    const r = compile(e.data.files);
    (self as unknown as Worker).postMessage({ id: e.data.id, result: r });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: e.data.id, error: String((err as Error)?.stack || err) });
  }
};
