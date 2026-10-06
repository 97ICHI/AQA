/// <reference lib="webworker" />
// Python (Pyodide, WASM) в отдельном Worker. pytest и зависимости — из локальных колёс, без сети.
type Req = { id: number; op: 'run'; code: string } | { id: number; op: 'pytest'; files: Record<string, string>; args?: string[] } | { id: number; op: 'init' };
interface Py { runPythonAsync(c: string): Promise<unknown>; setStdout(o: { batched: (s: string) => void }): void; setStderr(o: { batched: (s: string) => void }): void; unpackArchive(b: Uint8Array, fmt: string, o?: { extractDir?: string }): void; FS: { mkdirTree(p: string): void; writeFile(p: string, d: string): void }; globals: { get(n: string): unknown } }
let py: Py | null = null;
let base = '';
let out: string[] = [];

async function init() {
  if (py) return py;
  const mod = await import(/* @vite-ignore */ base + 'pyodide/pyodide.mjs');
  py = (await mod.loadPyodide({ indexURL: base + 'pyodide/' })) as Py;
  py.setStdout({ batched: (s) => out.push(s) });
  py.setStderr({ batched: (s) => out.push(s) });
  const idx = (await (await fetch(base + 'py-wheels/index.json')).json()) as string[];
  for (const whl of idx) {
    const buf = new Uint8Array(await (await fetch(base + 'py-wheels/' + whl)).arrayBuffer());
    py.unpackArchive(buf, 'wheel', { extractDir: '/lib/python3.14/site-packages' });
  }
  await py.runPythonAsync('import sys; sys.dont_write_bytecode = True; import pytest');
  return py;
}
function cleanTrace(msg: string) {
  // оставляем строки, относящиеся к коду ученика, и последнюю строку исключения
  const lines = msg.split('\n');
  const keep: string[] = [];
  let inUser = false;
  for (const l of lines) {
    if (/File "<exec>"|File "\/work\//.test(l)) { inUser = true; keep.push(l.replace('<exec>', 'main.py')); continue; }
    if (/^\s+File "/.test(l)) { inUser = false; continue; }
    if (inUser && /^\s{4}/.test(l)) keep.push(l);
  }
  const last = lines.filter((l) => l.trim()).pop() || msg;
  return (keep.length ? 'Traceback (most recent call last):\n' + keep.join('\n') + '\n' : '') + last;
}

self.onmessage = async (e: MessageEvent<Req & { base?: string }>) => {
  const m = e.data;
  if (e.data.base) base = e.data.base;
  const reply = (b: object) => (self as unknown as Worker).postMessage({ id: m.id, ...b });
  try {
    const p = await init();
    if (m.op === 'init') return reply({ ok: true });
    out = [];
    if (m.op === 'run') {
      const t0 = performance.now();
      try { await p.runPythonAsync(m.code); } catch (err) { return reply({ output: out.join('\n'), error: cleanTrace(String((err as Error).message)), ms: Math.round(performance.now() - t0) }); }
      return reply({ output: out.join('\n'), ms: Math.round(performance.now() - t0) });
    }
    if (m.op === 'pytest') {
      p.FS.mkdirTree('/work');
      await p.runPythonAsync(`
import os, sys, shutil
shutil.rmtree('/work', ignore_errors=True); os.makedirs('/work')
for name in [n for n, mod in list(sys.modules.items()) if getattr(mod, '__file__', None) and str(mod.__file__).startswith('/work')]:
    del sys.modules[name]
`);
      for (const [n, c] of Object.entries(m.files)) p.FS.writeFile('/work/' + n, c);
      const args = JSON.stringify(['-q', '-p', 'no:cacheprovider', '--rootdir=/work', '--color=no', ...(m.args || []), '/work']);
      const code = await p.runPythonAsync(`import pytest, json\nint(pytest.main(json.loads(${JSON.stringify(args)})))`);
      return reply({ output: out.join('\n'), exitCode: Number(code) });
    }
  } catch (err) {
    reply({ error: String((err as Error)?.message || err) });
  }
};
