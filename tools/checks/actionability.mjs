// Сверка таблицы actionability в главе «Assertions» с исходниками установленного playwright-core.
// Запускайте при каждом обновлении Playwright: таблица в тексте должна совпадать с поведением библиотеки.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Report, bookText } from '../lib/common.mjs';

const r = new Report('actionability');
const require = createRequire(import.meta.url);
const corePkg = require.resolve('playwright-core/package.json');
const version = JSON.parse(fs.readFileSync(corePkg, 'utf8')).version;
const dom = fs.readFileSync(corePkg.replace('package.json', 'lib/server/dom.js'), 'utf8');
console.log('playwright-core', version);

// ожидаемые наборы из исходников
const pointer = {}; // действие → ждёт ли enabled
for (const m of dom.matchAll(/_retryPointerAction\(progress, "(\w+)", (true|false)/g)) pointer[m[1]] = m[2] === 'true';
const statesIn = (fnName) => {
  const i = dom.indexOf(`async ${fnName}(`); if (i < 0) return null;
  const j = dom.indexOf('\n  async ', i + 10);
  const m = dom.slice(i, j).match(/checkElementStates\(node, (\[[^\]]*\])\)/);
  return m ? JSON.parse(m[1]) : null;
};
const expected = {
  click: new Set(['visible', 'stable', 'receives', ...(pointer.click ? ['enabled'] : [])]),
  hover: new Set(['visible', 'stable', 'receives', ...(pointer.hover ? ['enabled'] : [])]),
  fill: new Set((statesIn('_fill') || []).map((s) => s)),
  selectOption: new Set(statesIn('_selectOption') || []),
};
r.ok('исходники: click ждёт enabled, hover — нет', pointer.click === true && pointer.hover === false, JSON.stringify(pointer));
r.ok('исходники: найдены проверки fill и selectOption', expected.fill.size > 0 && expected.selectOption.size > 0);

// таблица из учебника
const html = bookText();
const art = html.slice(html.indexOf('<article class="chapter" id="/assertions"'), html.indexOf('<article class="chapter" id="/fixtures"'));
const tbl = art.match(/<table>\s*<thead>\s*<tr>\s*<th>Действие<\/th>[\s\S]*?<\/table>/)[0];
const cols = ['visible', 'stable', 'receives', 'enabled', 'editable'];
const rows = {};
for (const tr of tbl.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>([\s\S]*?)<\/tr>/g)) {
  const names = [...tr[1].matchAll(/<code>(\w+)<\/code>/g)].map((m) => m[1]);
  const cells = [...tr[2].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1].trim() === '✓');
  const set = new Set(cols.filter((c, i) => cells[i]));
  names.forEach((n) => { rows[n] = set; });
}
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
for (const [name, exp] of Object.entries(expected)) {
  r.ok(`таблица: строка «${name}» есть`, !!rows[name]);
  if (rows[name]) r.ok(`таблица: «${name}» = ${[...exp].join(', ')} (в тексте: ${[...rows[name]].join(', ')})`, same(rows[name], exp));
}
r.done();
