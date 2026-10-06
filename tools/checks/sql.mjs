// SQL: примеры главы выполняются в PostgreSQL (PGlite); учебный движок MiniSQL сверяется с ним.
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { Report, bookText } from '../lib/common.mjs';

const r = new Report('sql');
const html = bookText();
const js = html.slice(html.indexOf('/* ===== sims/00-minisql.js'), html.indexOf('/* ===== sims/01-basics.js'));
const seed = JSON.parse(html.match(/window\.SHOP_SQL = ("(?:[^"\\]|\\.)*");/)[1]);
const sandbox = { globalThis: {}, window: undefined, module: { exports: {} } }; sandbox.globalThis = sandbox;
vm.runInNewContext(js, sandbox);
const MiniSQL = sandbox.MiniSQL || sandbox.module.exports;

const art = html.slice(html.indexOf('<article class="chapter" id="/sql"'), html.indexOf('<article class="chapter" id="/git-linux"'));
const unesc = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const blocks = [...art.matchAll(/<span class="code-lang">(SQL|PostgreSQL[^<]*)<\/span>[\s\S]*?<pre><code>([\s\S]*?)<\/code><\/pre>/g)].map((m) => unesc(m[2]));
r.ok('найдено не меньше 20 SQL-примеров главы', blocks.length >= 20, String(blocks.length));
const split = (c) => c.split(/;\s*\n|;\s*$/).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));

const expectedErrors = /duplicate key|foreign key/;
const pgRun = async (sql) => { const db = new PGlite(); await db.exec(seed); try { const res = await db.query(sql); return { rows: res.rows.map((o) => Object.values(o)) }; } catch (e) { return { err: e.message }; } finally { await db.close(); } };

for (const code of blocks) {
  if (/information_schema|Предполагается таблица/.test(code)) continue; // схема-метаданные и гипотетическая таблица из примера
  const negative = /Нарушение (UNIQUE|FOREIGN KEY)/.test(code);
  const db = new PGlite(); await db.exec(seed);
  let err = '';
  try {
    if (/BEGIN/i.test(code)) await db.exec(code.replace(/--[^\n]*/g, ''));
    else for (const stmt of split(code)) await db.query(stmt);
  } catch (e) { err = e.message; }
  r.ok('PostgreSQL: ' + code.replace(/\s+/g, ' ').slice(0, 70), negative ? expectedErrors.test(err) : !err, err);
  await db.close();
}
// сверка MiniSQL ↔ PostgreSQL на запросах главы и дополнительных
const extra = ['SELECT 7/2 AS b, 7%3 AS c', 'SELECT name, city FROM customers ORDER BY city NULLS FIRST, name', 'SELECT category, COUNT(*) c FROM products GROUP BY category HAVING COUNT(*)>1 ORDER BY category',
  'SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id=c.id AND o.status=\'paid\' WHERE o.id IS NULL ORDER BY 1', 'SELECT name FROM customers WHERE city NOT IN (\'Москва\') ORDER BY name',
  'SELECT name, COALESCE(city,\'—\') FROM customers ORDER BY id', 'SELECT title FROM products WHERE title ILIKE \'КОЛОНКА%\'', 'SELECT DISTINCT status FROM orders ORDER BY status', 'SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY 2 DESC, 1'];
const norm = (v) => (v === null ? null : typeof v === 'bigint' ? Number(v) : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
const queries = blocks.flatMap((c) => (/BEGIN|information_schema|INSERT|UPDATE|DELETE|OVER/i.test(c) ? [] : split(c))).concat(extra);
let compared = 0;
for (const q of queries) {
  const pg = await pgRun(q); if (pg.err) continue;
  const eng = new MiniSQL.Engine(); eng.reset(seed);
  const res = eng.exec(q); const last = res[res.length - 1];
  const mine = last.kind === 'error' ? null : (last.rows || []).map((row) => row.map((x) => norm(x && x.v !== undefined ? x.v : x)));
  compared++;
  r.ok('MiniSQL = PostgreSQL: ' + q.slice(0, 60).replace(/\n/g, ' '), JSON.stringify(mine) === JSON.stringify(pg.rows.map((row) => row.map(norm))), last.error || '');
}
r.ok('сравнено не меньше 20 запросов', compared >= 20, String(compared));
r.done();
