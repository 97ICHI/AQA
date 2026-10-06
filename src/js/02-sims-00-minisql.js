/* ===== sims/00-minisql.js ===== */
/* ===== MiniSQL: учебный SQL-движок в памяти для SQL Playground =====
   Подмножество синтаксиса PostgreSQL: SELECT (DISTINCT, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT/OFFSET,
   подзапросы, EXISTS, IN, CTE WITH), INSERT/UPDATE/DELETE с RETURNING, BEGIN/COMMIT/ROLLBACK,
   CREATE TABLE с ограничениями. Семантика NULL — трёхзначная логика. Результаты сверяются с PostgreSQL 16
   тестом tests/check_minisql.mjs. Работает и в браузере, и в Node.js. */
(function (root) {
  'use strict';

  class SqlError extends Error { constructor(msg) { super(msg); this.name = 'SqlError'; } }
  const err = (m) => { throw new SqlError(m); };

  /* ---------- Числа: целые и numeric с масштабом ---------- */
  class Num { constructor(v, scale) { this.v = v; this.scale = scale; } }
  const isNum = (x) => typeof x === 'number' || x instanceof Num;
  const nv = (x) => (x instanceof Num ? x.v : x);
  const scaleOf = (x) => (x instanceof Num ? x.scale : 0);
  const mkNum = (v, scale) => (scale === 0 && Number.isInteger(v) ? v : new Num(v, scale));

  /* ---------- Лексер ---------- */
  const KEYWORDS = new Set(('select from where and or not null is in between like ilike exists as on join inner left right full outer cross ' +
    'group by having order asc desc nulls first last limit offset distinct insert into values update set delete returning begin commit ' +
    'rollback start transaction create table primary key unique references check default true false case when then else end with ' +
    'cast union all').split(' '));
  function lex(sql) {
    const t = [];
    let i = 0;
    while (i < sql.length) {
      const c = sql[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
      if (c === '/' && sql[i + 1] === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? sql.length : e + 2; continue; }
      if (c === "'") {
        let s = '', j = i + 1;
        for (;;) { if (j >= sql.length) err('unterminated quoted string'); if (sql[j] === "'") { if (sql[j + 1] === "'") { s += "'"; j += 2; continue; } break; } s += sql[j++]; }
        t.push({ k: 'str', v: s }); i = j + 1; continue;
      }
      if (c === '"') { const e = sql.indexOf('"', i + 1); if (e < 0) err('unterminated quoted identifier'); t.push({ k: 'id', v: sql.slice(i + 1, e) }); i = e + 1; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1]))) {
        const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?|^[0-9]+\.?/i.exec(sql.slice(i)); const s = m[0];
        t.push({ k: 'num', v: s }); i += s.length; continue;
      }
      if (/[A-Za-z_\u0400-\u04FF]/.test(c)) {
        const m = /^[A-Za-z_\u0400-\u04FF][A-Za-z0-9_$\u0400-\u04FF]*/.exec(sql.slice(i)); const w = m[0], lw = w.toLowerCase();
        t.push(KEYWORDS.has(lw) ? { k: 'kw', v: lw } : { k: 'id', v: lw }); i += w.length; continue;
      }
      const two = sql.slice(i, i + 2);
      if (['<>', '!=', '<=', '>=', '||', '::'].includes(two)) { t.push({ k: 'op', v: two === '!=' ? '<>' : two }); i += 2; continue; }
      if ('=<>+-*/%(),.;'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
      err(`syntax error at or near "${c}"`);
    }
    t.push({ k: 'eof', v: '' });
    return t;
  }

  /* ---------- Парсер ---------- */
  function Parser(tokens) { this.t = tokens; this.i = 0; }
  const P = Parser.prototype;
  P.peek = function (o = 0) { return this.t[this.i + o]; };
  P.next = function () { return this.t[this.i++]; };
  P.isKw = function (v, o = 0) { const x = this.peek(o); return x.k === 'kw' && x.v === v; };
  P.isOp = function (v, o = 0) { const x = this.peek(o); return x.k === 'op' && x.v === v; };
  P.acceptKw = function (v) { if (this.isKw(v)) { this.i++; return true; } return false; };
  P.acceptOp = function (v) { if (this.isOp(v)) { this.i++; return true; } return false; };
  P.near = function () { const x = this.peek(); return x.k === 'eof' ? 'syntax error at end of input' : `syntax error at or near "${x.k === 'str' ? "'" + x.v + "'" : x.v}"`; };
  P.expectKw = function (v) { if (!this.acceptKw(v)) err(this.near()); };
  P.expectOp = function (v) { if (!this.acceptOp(v)) err(this.near()); };
  P.ident = function () { const x = this.peek(); if (x.k === 'id') { this.i++; return x.v; } err(this.near()); };

  P.statements = function () {
    const out = [];
    while (this.peek().k !== 'eof') {
      if (this.acceptOp(';')) continue;
      const start = this.i;
      const st = this.statement();
      st.text = this.t.slice(start, this.i).map((x) => x.v).join(' ');
      out.push(st);
      if (!this.acceptOp(';') && this.peek().k !== 'eof') err(this.near());
    }
    return out;
  };
  P.statement = function () {
    if (this.isKw('select') || this.isKw('with') || this.isOp('(')) return this.selectStmt();
    if (this.acceptKw('insert')) return this.insertStmt();
    if (this.acceptKw('update')) return this.updateStmt();
    if (this.acceptKw('delete')) return this.deleteStmt();
    if (this.acceptKw('begin')) { this.acceptKw('transaction'); return { type: 'begin' }; }
    if (this.acceptKw('start')) { this.expectKw('transaction'); return { type: 'begin' }; }
    if (this.acceptKw('commit')) return { type: 'commit' };
    if (this.acceptKw('rollback')) return { type: 'rollback' };
    if (this.acceptKw('create')) return this.createStmt();
    if (this.peek().k === 'id' && ['drop', 'alter', 'truncate', 'grant', 'explain', 'copy'].includes(this.peek().v)) err(`команда ${this.peek().v.toUpperCase()} не поддерживается учебным движком`);
    err(this.near());
  };
  P.selectStmt = function () {
    let ctes = null;
    if (this.acceptKw('with')) {
      ctes = [];
      do { const name = this.ident(); this.expectKw('as'); this.expectOp('('); const q = this.selectStmt(); this.expectOp(')'); ctes.push({ name, q }); } while (this.acceptOp(','));
    }
    let q;
    if (this.acceptOp('(')) { q = this.selectStmt(); this.expectOp(')'); } else q = this.selectCore();
    while (this.isKw('union')) {
      this.next(); const all = this.acceptKw('all');
      let r, paren = false; if (this.acceptOp('(')) { r = this.selectStmt(); this.expectOp(')'); paren = true; } else r = this.selectCore();
      q = { type: 'union', left: q, right: r, all };
      if (!paren && (r.orderBy || r.limit || r.offset)) { q.orderBy = r.orderBy; q.limit = r.limit; q.offset = r.offset; r.orderBy = r.limit = r.offset = null; }
    }
    if (q.type === 'union' && !q.orderBy && !q.limit) this.orderLimit(q);
    if (ctes) q.ctes = ctes;
    return q;
  };
  P.selectCore = function () {
    this.expectKw('select');
    const q = { type: 'select', distinct: this.acceptKw('distinct'), cols: [], from: null, joins: [], where: null, groupBy: null, having: null, orderBy: null, limit: null, offset: null };
    do {
      if (this.acceptOp('*')) { q.cols.push({ star: true }); continue; }
      if (this.peek().k === 'id' && this.isOp('.', 1) && this.isOp('*', 2)) { const tb = this.next().v; this.next(); this.next(); q.cols.push({ star: true, table: tb }); continue; }
      const e = this.expr();
      let alias = null;
      if (this.acceptKw('as')) alias = this.ident(); else if (this.peek().k === 'id') alias = this.ident();
      q.cols.push({ e, alias });
    } while (this.acceptOp(','));
    if (this.acceptKw('from')) {
      q.from = this.tableRef();
      for (;;) {
        if (this.acceptOp(',')) { q.joins.push({ kind: 'cross', ref: this.tableRef() }); continue; }
        let kind = null;
        if (this.isKw('join') || this.isKw('inner')) { this.acceptKw('inner'); this.expectKw('join'); kind = 'inner'; }
        else if (this.isKw('left')) { this.next(); this.acceptKw('outer'); this.expectKw('join'); kind = 'left'; }
        else if (this.isKw('right')) { this.next(); this.acceptKw('outer'); this.expectKw('join'); kind = 'right'; }
        else if (this.isKw('full')) { this.next(); this.acceptKw('outer'); this.expectKw('join'); kind = 'full'; }
        else if (this.isKw('cross')) { this.next(); this.expectKw('join'); q.joins.push({ kind: 'cross', ref: this.tableRef() }); continue; }
        if (!kind) break;
        const ref = this.tableRef(); this.expectKw('on');
        q.joins.push({ kind, ref, on: this.expr() });
      }
    }
    if (this.acceptKw('where')) q.where = this.expr();
    if (this.acceptKw('group')) { this.expectKw('by'); q.groupBy = []; do q.groupBy.push(this.expr()); while (this.acceptOp(',')); }
    if (this.acceptKw('having')) q.having = this.expr();
    this.orderLimit(q);
    return q;
  };
  P.orderLimit = function (q) {
    if (this.acceptKw('order')) {
      this.expectKw('by'); q.orderBy = [];
      do {
        const e = this.expr(); let desc = false, nulls = null;
        if (this.acceptKw('desc')) desc = true; else this.acceptKw('asc');
        if (this.acceptKw('nulls')) { if (this.acceptKw('first')) nulls = 'first'; else { this.expectKw('last'); nulls = 'last'; } }
        q.orderBy.push({ e, desc, nulls });
      } while (this.acceptOp(','));
    }
    for (;;) {
      if (this.acceptKw('limit')) { q.limit = this.expr(); continue; }
      if (this.acceptKw('offset')) { q.offset = this.expr(); continue; }
      break;
    }
  };
  P.tableRef = function () {
    if (this.acceptOp('(')) { const sub = this.selectStmt(); this.expectOp(')'); this.acceptKw('as'); const alias = this.ident(); return { sub, alias }; }
    const name = this.ident(); let alias = name;
    if (this.acceptKw('as')) alias = this.ident(); else if (this.peek().k === 'id') alias = this.ident();
    return { name, alias };
  };
  P.returning = function () {
    if (!this.acceptKw('returning')) return null;
    const cols = [];
    do { if (this.acceptOp('*')) { cols.push({ star: true }); continue; } const e = this.expr(); let alias = null; if (this.acceptKw('as')) alias = this.ident(); else if (this.peek().k === 'id') alias = this.ident(); cols.push({ e, alias }); } while (this.acceptOp(','));
    return cols;
  };
  P.insertStmt = function () {
    this.expectKw('into'); const table = this.ident(); let cols = null;
    if (this.acceptOp('(')) { cols = []; do cols.push(this.ident()); while (this.acceptOp(',')); this.expectOp(')'); }
    let rows = null, select = null;
    if (this.acceptKw('values')) { rows = []; do { this.expectOp('('); const r = []; do r.push(this.isKw('default') ? (this.next(), { k: 'default' }) : this.expr()); while (this.acceptOp(',')); this.expectOp(')'); rows.push(r); } while (this.acceptOp(',')); }
    else select = this.selectStmt();
    return { type: 'insert', table, cols, rows, select, returning: this.returning() };
  };
  P.updateStmt = function () {
    const table = this.ident(); let alias = table; if (this.peek().k === 'id') alias = this.ident();
    this.expectKw('set'); const sets = [];
    do { const col = this.ident(); this.expectOp('='); sets.push({ col, e: this.expr() }); } while (this.acceptOp(','));
    const where = this.acceptKw('where') ? this.expr() : null;
    return { type: 'update', table, alias, sets, where, returning: this.returning() };
  };
  P.deleteStmt = function () {
    this.expectKw('from'); const table = this.ident(); let alias = table; if (this.peek().k === 'id') alias = this.ident();
    const where = this.acceptKw('where') ? this.expr() : null;
    return { type: 'delete', table, alias, where, returning: this.returning() };
  };
  P.typeName = function () {
    let t = this.ident();
    if (t === 'character' || t === 'double') this.ident();
    if (this.acceptOp('(')) { while (!this.acceptOp(')')) this.next(); }
    return t;
  };
  P.createStmt = function () {
    this.expectKw('table'); const name = this.ident(); this.expectOp('(');
    const cols = [], pk = [], uniques = [], checks = [], fks = [];
    do {
      if (this.acceptKw('primary')) { this.expectKw('key'); this.expectOp('('); do pk.push(this.ident()); while (this.acceptOp(',')); this.expectOp(')'); continue; }
      if (this.acceptKw('unique')) { this.expectOp('('); const u = []; do u.push(this.ident()); while (this.acceptOp(',')); this.expectOp(')'); uniques.push(u); continue; }
      if (this.acceptKw('check')) { this.expectOp('('); checks.push({ e: this.expr(), name: `${name}_check` }); this.expectOp(')'); continue; }
      const col = { name: this.ident(), type: this.typeName(), notNull: false, def: null };
      for (;;) {
        if (this.acceptKw('not')) { this.expectKw('null'); col.notNull = true; continue; }
        if (this.acceptKw('null')) continue;
        if (this.acceptKw('primary')) { this.expectKw('key'); pk.push(col.name); continue; }
        if (this.acceptKw('unique')) { uniques.push([col.name]); continue; }
        if (this.acceptKw('default')) { col.def = this.primary(); continue; }
        if (this.acceptKw('check')) { this.expectOp('('); checks.push({ e: this.expr(), name: `${name}_${col.name}_check` }); this.expectOp(')'); continue; }
        if (this.acceptKw('references')) { const rt = this.ident(); let rc = null; if (this.acceptOp('(')) { rc = this.ident(); this.expectOp(')'); } fks.push({ col: col.name, table: rt, refCol: rc, name: `${name}_${col.name}_fkey` }); continue; }
        break;
      }
      cols.push(col);
    } while (this.acceptOp(','));
    this.expectOp(')');
    return { type: 'create', name, cols, pk, uniques, checks, fks };
  };

  /* выражения: OR → AND → NOT → сравнения → || → + - → * / % → унарный → :: → первичные */
  P.expr = function () { return this.orExpr(); };
  P.orExpr = function () { let l = this.andExpr(); while (this.acceptKw('or')) l = { op: 'or', l, r: this.andExpr() }; return l; };
  P.andExpr = function () { let l = this.notExpr(); while (this.acceptKw('and')) l = { op: 'and', l, r: this.notExpr() }; return l; };
  P.notExpr = function () { if (this.acceptKw('not')) return { op: 'not', e: this.notExpr() }; return this.cmpExpr(); };
  P.cmpExpr = function () {
    let l = this.concatExpr();
    for (;;) {
      const x = this.peek();
      if (x.k === 'op' && ['=', '<>', '<', '<=', '>', '>='].includes(x.v)) { this.next(); l = { op: 'cmp', f: x.v, l, r: this.concatExpr() }; continue; }
      if (this.isKw('is')) {
        this.next(); const neg = this.acceptKw('not');
        if (this.acceptKw('null')) { l = { op: 'isnull', e: l, neg }; continue; }
        if (this.acceptKw('true')) { l = { op: 'istrue', e: l, val: true, neg }; continue; }
        if (this.acceptKw('false')) { l = { op: 'istrue', e: l, val: false, neg }; continue; }
        err(this.near());
      }
      let neg = false;
      if (this.isKw('not') && (this.isKw('in', 1) || this.isKw('between', 1) || this.isKw('like', 1) || this.isKw('ilike', 1))) { this.next(); neg = true; }
      if (this.acceptKw('in')) {
        this.expectOp('(');
        if (this.isKw('select') || this.isKw('with')) { const q = this.selectStmt(); this.expectOp(')'); l = { op: 'insub', e: l, q, neg }; continue; }
        const list = []; do list.push(this.expr()); while (this.acceptOp(',')); this.expectOp(')');
        l = { op: 'inlist', e: l, list, neg }; continue;
      }
      if (this.acceptKw('between')) { const a = this.concatExpr(); this.expectKw('and'); const b = this.concatExpr(); l = { op: 'between', e: l, a, b, neg }; continue; }
      if (this.isKw('like') || this.isKw('ilike')) { const ci = this.next().v === 'ilike'; l = { op: 'like', e: l, p: this.concatExpr(), ci, neg }; continue; }
      if (neg) err(this.near());
      return l;
    }
  };
  P.concatExpr = function () { let l = this.addExpr(); while (this.acceptOp('||')) l = { op: 'concat', l, r: this.addExpr() }; return l; };
  P.addExpr = function () { let l = this.mulExpr(); for (;;) { if (this.acceptOp('+')) l = { op: 'arith', f: '+', l, r: this.mulExpr() }; else if (this.acceptOp('-')) l = { op: 'arith', f: '-', l, r: this.mulExpr() }; else return l; } };
  P.mulExpr = function () { let l = this.unary(); for (;;) { const x = this.peek(); if (x.k === 'op' && ['*', '/', '%'].includes(x.v)) { this.next(); l = { op: 'arith', f: x.v, l, r: this.unary() }; } else return l; } };
  P.unary = function () { if (this.acceptOp('-')) return { op: 'neg', e: this.unary() }; if (this.acceptOp('+')) return this.unary(); return this.castExpr(); };
  P.castExpr = function () { let e = this.primary(); while (this.acceptOp('::')) e = { op: 'cast', e, to: this.typeName() }; return e; };
  P.primary = function () {
    const x = this.peek();
    if (x.k === 'num') { this.next(); if (/[.e]/i.test(x.v)) { const dec = x.v.includes('.') ? x.v.split('.')[1].replace(/e.*/i, '').length : 0; return { op: 'lit', v: new Num(parseFloat(x.v), dec) }; } return { op: 'lit', v: parseInt(x.v, 10) }; }
    if (x.k === 'str') { this.next(); return { op: 'lit', v: x.v }; }
    if (this.acceptKw('null')) return { op: 'lit', v: null };
    if (this.acceptKw('true')) return { op: 'lit', v: true };
    if (this.acceptKw('false')) return { op: 'lit', v: false };
    if (this.acceptKw('exists')) { this.expectOp('('); const q = this.selectStmt(); this.expectOp(')'); return { op: 'exists', q }; }
    if (this.acceptKw('case')) {
      let base = null; if (!this.isKw('when')) base = this.expr();
      const whens = []; while (this.acceptKw('when')) { const w = this.expr(); this.expectKw('then'); whens.push([w, this.expr()]); }
      const els = this.acceptKw('else') ? this.expr() : null; this.expectKw('end');
      return { op: 'case', base, whens, els };
    }
    if (this.acceptKw('cast')) { this.expectOp('('); const e = this.expr(); this.expectKw('as'); const to = this.typeName(); this.expectOp(')'); return { op: 'cast', e, to }; }
    if (this.acceptOp('(')) {
      if (this.isKw('select') || this.isKw('with')) { const q = this.selectStmt(); this.expectOp(')'); return { op: 'subq', q }; }
      const e = this.expr(); this.expectOp(')'); return e;
    }
    if (x.k === 'id') {
      this.next();
      if (x.v === 'current_date' || x.v === 'now' && !this.isOp('(')) return { op: 'fn', name: 'current_date', args: [] };
      if (x.v === 'date' && this.peek().k === 'str') return { op: 'lit', v: this.next().v };
      if (this.acceptOp('(')) {
        const name = x.v, args = []; let distinct = false, star = false;
        if (this.acceptOp('*')) star = true;
        else if (!this.isOp(')')) { distinct = this.acceptKw('distinct'); do args.push(this.expr()); while (this.acceptOp(',')); }
        this.expectOp(')');
        return { op: 'fn', name, args, distinct, star };
      }
      if (this.acceptOp('.')) { const col = this.ident(); return { op: 'col', table: x.v, name: col }; }
      return { op: 'col', table: null, name: x.v };
    }
    err(this.near());
  };

  /* ---------- Вычисление ---------- */
  const AGG = new Set(['count', 'sum', 'avg', 'min', 'max']);
  const hasAgg = (e) => {
    if (!e || typeof e !== 'object') return false;
    if (e.op === 'fn' && AGG.has(e.name)) return true;
    if (e.op === 'subq' || e.op === 'exists' || e.op === 'insub') return e.op === 'insub' ? hasAgg(e.e) : false;
    return Object.values(e).some((v) => (Array.isArray(v) ? v.some((x) => (Array.isArray(x) ? x.some(hasAgg) : hasAgg(x))) : typeof v === 'object' && v && v.op ? hasAgg(v) : false));
  };
  const truth = (v) => (v === null ? null : !!v);
  function cmp(a, b) {
    if (a === null || b === null) return null;
    if (isNum(a) && isNum(b)) return nv(a) < nv(b) ? -1 : nv(a) > nv(b) ? 1 : 0;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
    if (isNum(a) && typeof b === 'string') { const n = Number(b); if (Number.isNaN(n)) err(`invalid input syntax for type integer: "${b}"`); return nv(a) < n ? -1 : nv(a) > n ? 1 : 0; }
    if (typeof a === 'string' && isNum(b)) return -cmp(b, a);
    const sa = String(a), sb = String(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  function arith(f, a, b) {
    if (a === null || b === null) return null;
    if (typeof a === 'string' && /^-?\d+(\.\d+)?$/.test(a)) a = a.includes('.') ? new Num(+a, a.split('.')[1].length) : +a;
    if (typeof b === 'string' && /^-?\d+(\.\d+)?$/.test(b)) b = b.includes('.') ? new Num(+b, b.split('.')[1].length) : +b;
    if (!isNum(a) || !isNum(b)) err(`operator does not exist: ${typeof a === 'string' ? 'text' : typeof a} ${f} ${typeof b === 'string' ? 'text' : typeof b}`);
    const x = nv(a), y = nv(b), sa = scaleOf(a), sb = scaleOf(b), anyNum = a instanceof Num || b instanceof Num;
    if ((f === '/' || f === '%') && y === 0) err('division by zero');
    if (!anyNum) {
      if (f === '+') return x + y; if (f === '-') return x - y; if (f === '*') return x * y;
      if (f === '/') return Math.trunc(x / y); return x % y;
    }
    if (f === '+') return new Num(x + y, Math.max(sa, sb));
    if (f === '-') return new Num(x - y, Math.max(sa, sb));
    if (f === '*') return new Num(x * y, sa + sb);
    if (f === '/') return new Num(x / y, Math.max(16, sa, sb));
    return new Num(x % y, Math.max(sa, sb));
  }
  const likeRe = (p, ci) => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', ci ? 'is' : 's');

  function Engine() { this.tables = {}; this.tx = null; this.aborted = false; this.today = new Date().toISOString().slice(0, 10); }
  const E = Engine.prototype;

  /** Контекст строки: цепочка областей { rows: {alias: rowObj}, tables: {alias: table}, parent } */
  E.lookup = function (ctx, e) {
    for (let c = ctx; c; c = c.parent) {
      if (e.table) {
        if (c.rows && Object.prototype.hasOwnProperty.call(c.rows, e.table)) {
          const r = c.rows[e.table], cols = c.cols[e.table];
          if (!cols.includes(e.name)) err(`column ${e.table}.${e.name} does not exist`);
          return r ? r[e.name] : null;
        }
      } else if (c.rows) {
        const hits = Object.keys(c.rows).filter((a) => c.cols[a].includes(e.name));
        if (hits.length > 1) err(`column reference "${e.name}" is ambiguous`);
        if (hits.length === 1) { const r = c.rows[hits[0]]; return r ? r[e.name] : null; }
        if (c.out && Object.prototype.hasOwnProperty.call(c.out, e.name)) return c.out[e.name];
      }
    }
    if (e.table && !ctxHasAlias(ctx, e.table)) err(`missing FROM-clause entry for table "${e.table}"`);
    err(`column "${e.table ? e.table + '.' : ''}${e.name}" does not exist`);
  };
  function ctxHasAlias(ctx, a) { for (let c = ctx; c; c = c.parent) if (c.rows && Object.prototype.hasOwnProperty.call(c.rows, a)) return true; return false; }

  E.ev = function (e, ctx) {
    switch (e.op) {
      case 'lit': return e.v;
      case 'col': {
        if (ctx && ctx.group && !ctx.inAgg) this.checkGrouped(e, ctx);
        return this.lookup(ctx, e);
      }
      case 'and': { const a = truth(this.ev(e.l, ctx)); if (a === false) return false; const b = truth(this.ev(e.r, ctx)); if (b === false) return false; return a === null || b === null ? null : true; }
      case 'or': { const a = truth(this.ev(e.l, ctx)); if (a === true) return true; const b = truth(this.ev(e.r, ctx)); if (b === true) return true; return a === null || b === null ? null : false; }
      case 'not': { const a = truth(this.ev(e.e, ctx)); return a === null ? null : !a; }
      case 'cmp': {
        const c = cmp(this.ev(e.l, ctx), this.ev(e.r, ctx)); if (c === null) return null;
        return { '=': c === 0, '<>': c !== 0, '<': c < 0, '<=': c <= 0, '>': c > 0, '>=': c >= 0 }[e.f];
      }
      case 'isnull': { const v = this.ev(e.e, ctx); return e.neg ? v !== null : v === null; }
      case 'istrue': { const v = this.ev(e.e, ctx); const r = v === e.val; return e.neg ? !r : r; }
      case 'inlist': case 'insub': {
        const v = this.ev(e.e, ctx);
        const vals = e.op === 'inlist' ? e.list.map((x) => this.ev(x, ctx)) : this.runQuery(e.q, ctx).rows.map((r) => r[0]);
        if (v === null) return vals.length ? null : !!e.neg;
        let sawNull = false;
        for (const x of vals) { const c = cmp(v, x); if (c === 0) return !e.neg; if (c === null) sawNull = true; }
        return sawNull ? null : !!e.neg;
      }
      case 'between': {
        const v = this.ev(e.e, ctx), a = this.ev(e.a, ctx), b = this.ev(e.b, ctx);
        const c1 = cmp(v, a), c2 = cmp(v, b); if (c1 === null || c2 === null) return null;
        const r = c1 >= 0 && c2 <= 0; return e.neg ? !r : r;
      }
      case 'like': { const v = this.ev(e.e, ctx), p = this.ev(e.p, ctx); if (v === null || p === null) return null; const r = likeRe(p, e.ci).test(String(v)); return e.neg ? !r : r; }
      case 'concat': { const a = this.ev(e.l, ctx), b = this.ev(e.r, ctx); return a === null || b === null ? null : fmtVal(a) + fmtVal(b); }
      case 'arith': return arith(e.f, this.ev(e.l, ctx), this.ev(e.r, ctx));
      case 'neg': { const v = this.ev(e.e, ctx); return v === null ? null : v instanceof Num ? new Num(-v.v, v.scale) : -v; }
      case 'cast': return castTo(this.ev(e.e, ctx), e.to);
      case 'case': {
        if (e.base) { const b = this.ev(e.base, ctx); for (const [w, t] of e.whens) if (cmp(b, this.ev(w, ctx)) === 0) return this.ev(t, ctx); }
        else for (const [w, t] of e.whens) if (truth(this.ev(w, ctx)) === true) return this.ev(t, ctx);
        return e.els ? this.ev(e.els, ctx) : null;
      }
      case 'exists': return this.runQuery(e.q, ctx).rows.length > 0;
      case 'subq': { const r = this.runQuery(e.q, ctx); if (r.columns.length !== 1) err('subquery must return only one column'); if (r.rows.length > 1) err('more than one row returned by a subquery used as an expression'); return r.rows.length ? r.rows[0][0] : null; }
      case 'fn': return this.fn(e, ctx);
      default: err('неподдерживаемое выражение');
    }
  };
  E.checkGrouped = function (e, ctx) {
    const g = ctx.group;
    const key = (x) => (x.op === 'col' ? `${x.table || ''}.${x.name}` : null);
    const resolvedTable = (x) => { if (x.table) return x.table; const hits = Object.keys(g.cols).filter((a) => g.cols[a].includes(x.name)); return hits[0]; };
    if (g.exprs.some((ge) => ge.op === 'col' && ge.name === e.name && (resolvedTable(ge) === resolvedTable(e)))) return;
    // функциональная зависимость: сгруппировано по первичному ключу таблицы
    const t = resolvedTable(e);
    if (t && g.pkGrouped.has(t)) return;
    if (!t) return; // столбец внешнего запроса
    err(`column "${t}.${e.name}" must appear in the GROUP BY clause or be used in an aggregate function`);
  };
  E.fn = function (e, ctx) {
    const name = e.name;
    if (AGG.has(name)) {
      if (!ctx || !ctx.groupRows) err(`aggregate functions are not allowed in this context`);
      const rows = ctx.groupRows;
      let vals;
      if (e.star) vals = rows.map(() => 1);
      else vals = rows.map((rc) => this.ev(e.args[0], Object.assign({}, rc, { inAgg: true, group: null }))).filter((v) => v !== null);
      if (e.distinct) { const seen = []; vals = vals.filter((v) => (seen.some((s) => cmp(s, v) === 0) ? false : (seen.push(v), true))); }
      if (name === 'count') return vals.length;
      if (!vals.length) return null;
      if (name === 'sum') { const sc = Math.max(...vals.map(scaleOf)); const s = vals.reduce((a, v) => a + nv(v), 0); return sc ? new Num(s, sc) : s; }
      if (name === 'avg') { const s = vals.reduce((a, v) => a + nv(v), 0) / vals.length; return new Num(s, Math.max(16, ...vals.map(scaleOf))); }
      if (name === 'min') return vals.reduce((a, v) => (cmp(v, a) < 0 ? v : a));
      if (name === 'max') return vals.reduce((a, v) => (cmp(v, a) > 0 ? v : a));
    }
    const a = e.args.map((x) => this.ev(x, ctx));
    switch (name) {
      case 'coalesce': return a.find((v) => v !== null) ?? null;
      case 'nullif': return cmp(a[0], a[1]) === 0 ? null : a[0];
      case 'lower': return a[0] === null ? null : String(a[0]).toLowerCase();
      case 'upper': return a[0] === null ? null : String(a[0]).toUpperCase();
      case 'length': case 'char_length': return a[0] === null ? null : [...String(a[0])].length;
      case 'trim': return a[0] === null ? null : String(a[0]).trim();
      case 'abs': return a[0] === null ? null : a[0] instanceof Num ? new Num(Math.abs(a[0].v), a[0].scale) : Math.abs(a[0]);
      case 'round': {
        if (a[0] === null) return null;
        const d = a.length > 1 ? nv(a[1]) : 0, f = Math.pow(10, d);
        const v = nv(a[0]), r = Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9) / f;
        return a.length > 1 || a[0] instanceof Num ? new Num(r, d) : r;
      }
      case 'concat': return a.map((v) => (v === null ? '' : fmtVal(v))).join('');
      case 'current_date': return this.today;
      case 'greatest': return a.filter((v) => v !== null).reduce((m, v) => (m === null || cmp(v, m) > 0 ? v : m), null);
      case 'least': return a.filter((v) => v !== null).reduce((m, v) => (m === null || cmp(v, m) < 0 ? v : m), null);
      default: err(`function ${name}(${a.map(() => 'unknown').join(', ')}) does not exist`);
    }
  };
  function castTo(v, to) {
    if (v === null) return null;
    if (['int', 'integer', 'int4', 'bigint', 'int8', 'smallint'].includes(to)) {
      if (typeof v === 'string') { if (!/^\s*-?\d+\s*$/.test(v)) err(`invalid input syntax for type integer: "${v}"`); return parseInt(v, 10); }
      if (typeof v === 'boolean') return v ? 1 : 0;
      return Math.round(nv(v));
    }
    if (['numeric', 'decimal'].includes(to)) { const x = typeof v === 'string' ? parseFloat(v) : nv(v); if (Number.isNaN(x)) err(`invalid input syntax for type numeric: "${v}"`); const s = typeof v === 'string' ? ((v.split('.')[1] || '').length) : scaleOf(v); return new Num(x, s); }
    if (['text', 'varchar', 'character'].includes(to)) return fmtVal(v);
    if (to === 'date') { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) err(`invalid input syntax for type date: "${v}"`); return String(v); }
    if (['boolean', 'bool'].includes(to)) { if (typeof v === 'boolean') return v; const s = String(v).toLowerCase(); if (['t', 'true', '1', 'yes', 'on'].includes(s)) return true; if (['f', 'false', '0', 'no', 'off'].includes(s)) return false; err(`invalid input syntax for type boolean: "${v}"`); }
    return v;
  }
  function fmtVal(v) {
    if (v === null) return '';
    if (v instanceof Num) return v.v.toFixed(v.scale);
    if (typeof v === 'boolean') return v ? 't' : 'f';
    return String(v);
  }

  /* ---------- Источники строк ---------- */
  E.table = function (name) { const t = this.tables[name]; if (!t) err(`relation "${name}" does not exist`); return t; };
  E.source = function (ref, ctx, ctes) {
    if (ref.sub) { const r = this.runQuery(ref.sub, ctx, ctes); return { alias: ref.alias, cols: r.columns, rows: r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]]))) }; }
    if (ctes && ctes[ref.name]) { const r = ctes[ref.name]; return { alias: ref.alias, cols: r.columns, rows: r.rows.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]]))) }; }
    const t = this.table(ref.name);
    return { alias: ref.alias, cols: t.cols.map((c) => c.name), rows: t.rows, table: t };
  };

  E.runQuery = function (q, outer, ctesIn) {
    let ctes = ctesIn ? Object.assign({}, ctesIn) : {};
    if (q.ctes) for (const c of q.ctes) ctes[c.name] = this.runQuery(c.q, outer, ctes);
    if (q.type === 'union') {
      const l = this.runQuery(q.left, outer, ctes), r = this.runQuery(q.right, outer, ctes);
      if (l.columns.length !== r.columns.length) err('each UNION query must have the same number of columns');
      let rows = l.rows.concat(r.rows);
      if (!q.all) rows = dedupe(rows);
      return this.orderAndLimit(q, { columns: l.columns, rows }, outer);
    }
    // FROM + JOIN → массив контекстов
    let frames = [{}];
    const colsMap = {};
    if (q.from) {
      const first = this.source(q.from, outer, ctes);
      colsMap[first.alias] = first.cols;
      frames = first.rows.map((r) => ({ [first.alias]: r }));
      for (const j of q.joins) {
        const src = this.source(j.ref, outer, ctes);
        if (colsMap[src.alias]) err(`table name "${src.alias}" specified more than once`);
        colsMap[src.alias] = src.cols;
        const mk = (rows) => ({ rows, cols: colsMap, parent: outer });
        const out = [];
        const matchedRight = new Set();
        for (const f of frames) {
          let any = false;
          src.rows.forEach((r, ri) => {
            const rows = Object.assign({}, f, { [src.alias]: r });
            if (j.kind === 'cross' || truth(this.ev(j.on, mk(rows))) === true) { out.push(rows); any = true; matchedRight.add(ri); }
          });
          if (!any && (j.kind === 'left' || j.kind === 'full')) out.push(Object.assign({}, f, { [src.alias]: null }));
        }
        if (j.kind === 'right' || j.kind === 'full') {
          src.rows.forEach((r, ri) => { if (!matchedRight.has(ri)) { const nul = {}; Object.keys(colsMap).forEach((a) => { nul[a] = null; }); nul[src.alias] = r; out.push(nul); } });
        }
        frames = out;
      }
    }
    const ctxOf = (rows) => ({ rows, cols: colsMap, parent: outer });
    if (q.where) frames = frames.filter((f) => truth(this.ev(q.where, ctxOf(f))) === true);

    // список выходных столбцов
    const outCols = [];
    for (const c of q.cols) {
      if (c.star) {
        const aliases = c.table ? [c.table] : Object.keys(colsMap);
        if (c.table && !colsMap[c.table]) err(`missing FROM-clause entry for table "${c.table}"`);
        if (!q.from) err('SELECT * with no tables specified is not valid');
        aliases.forEach((a) => colsMap[a].forEach((name) => outCols.push({ name, e: { op: 'col', table: a, name } })));
      } else outCols.push({ name: c.alias || autoName(c.e), e: c.e });
    }
    const grouped = !!q.groupBy || q.cols.some((c) => !c.star && hasAgg(c.e)) || (q.having && hasAgg(q.having)) || (q.orderBy && q.orderBy.some((o) => hasAgg(o.e)));
    let resultRows = [], sortCtx = [];
    if (grouped) {
      if (q.cols.some((c) => c.star)) err('column must appear in the GROUP BY clause or be used in an aggregate function');
      const gexprs = (q.groupBy || []).map((ge) => (ge.op === 'lit' && typeof ge.v === 'number' ? outCols[ge.v - 1].e : ge));
      const pkGrouped = new Set();
      for (const [alias] of Object.entries(colsMap)) {
        const ref = [q.from].concat(q.joins.map((j) => j.ref)).find((r) => r && r.alias === alias);
        const t = ref && ref.name && this.tables[ref.name] && !(ctes[ref.name]) ? this.tables[ref.name] : null;
        if (t && t.pk.length && t.pk.every((pkc) => gexprs.some((ge) => ge.op === 'col' && ge.name === pkc && (ge.table === alias || (!ge.table && Object.keys(colsMap).filter((a) => colsMap[a].includes(pkc)).length === 1 && colsMap[alias].includes(pkc)))))) pkGrouped.add(alias);
      }
      const groups = new Map();
      for (const f of frames) {
        const key = JSON.stringify(gexprs.map((ge) => { const v = this.ev(ge, ctxOf(f)); return v instanceof Num ? v.v : v; }));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
      }
      if (!q.groupBy && !groups.size) groups.set('[]', []);
      const groupInfo = { exprs: gexprs, cols: colsMap, pkGrouped };
      for (const [, fs] of groups) {
        const gctx = { rows: fs[0] || nullRows(colsMap), cols: colsMap, parent: outer, group: groupInfo, groupRows: fs.map((f) => ctxOf(f)) };
        if (q.having && truth(this.ev(q.having, gctx)) !== true) continue;
        const row = outCols.map((c) => this.ev(c.e, gctx));
        resultRows.push(row); sortCtx.push(gctx);
      }
    } else {
      for (const f of frames) { const cx = ctxOf(f); resultRows.push(outCols.map((c) => this.ev(c.e, cx))); sortCtx.push(cx); }
    }
    let res = { columns: outCols.map((c) => c.name), rows: resultRows };
    if (q.distinct) { const keep = []; const seen = []; res.rows.forEach((r, i) => { if (!seen.some((s) => rowEq(s, r))) { seen.push(r); keep.push(i); } }); res.rows = keep.map((i) => res.rows[i]); sortCtx = keep.map((i) => sortCtx[i]); }
    return this.orderAndLimit(q, res, outer, sortCtx, outCols);
  };
  E.orderAndLimit = function (q, res, outer, sortCtx, outCols) {
    if (q.orderBy) {
      const keys = res.rows.map((row, i) => q.orderBy.map((o) => {
        if (o.e.op === 'lit' && typeof o.e.v === 'number') { if (o.e.v < 1 || o.e.v > res.columns.length) err(`ORDER BY position ${o.e.v} is not in select list`); return row[o.e.v - 1]; }
        if (o.e.op === 'col' && !o.e.table) { const k = res.columns.indexOf(o.e.name); if (k >= 0 && (!outCols || outCols[k].e.op !== 'col' || outCols[k].name === o.e.name)) return row[k]; }
        if (!sortCtx) err('ORDER BY для UNION поддерживает только номера и имена столбцов');
        const cx = Object.assign({}, sortCtx[i], { out: Object.fromEntries(res.columns.map((c, j) => [c, row[j]])) });
        return this.ev(o.e, cx);
      }));
      const idx = res.rows.map((_, i) => i);
      idx.sort((a, b) => {
        for (let k = 0; k < q.orderBy.length; k++) {
          const o = q.orderBy[k], x = keys[a][k], y = keys[b][k];
          const nullsFirst = o.nulls ? o.nulls === 'first' : o.desc;
          if (x === null && y === null) continue;
          if (x === null) return nullsFirst ? -1 : 1;
          if (y === null) return nullsFirst ? 1 : -1;
          const c = cmp(x, y); if (c) return o.desc ? -c : c;
        }
        return a - b;
      });
      res = { columns: res.columns, rows: idx.map((i) => res.rows[i]) };
    }
    const off = q.offset ? nv(this.ev(q.offset, outer)) : 0;
    const lim = q.limit ? this.ev(q.limit, outer) : null;
    if (off || lim !== null) res = { columns: res.columns, rows: res.rows.slice(off, lim === null ? undefined : off + nv(lim)) };
    return res;
  };
  function nullRows(colsMap) { const r = {}; Object.keys(colsMap).forEach((a) => { r[a] = null; }); return r; }
  function rowEq(a, b) { return a.length === b.length && a.every((v, i) => (v === null && b[i] === null) || (v !== null && b[i] !== null && cmp(v, b[i]) === 0)); }
  function dedupe(rows) { const out = []; rows.forEach((r) => { if (!out.some((s) => rowEq(s, r))) out.push(r); }); return out; }
  function autoName(e) {
    if (e.op === 'col') return e.name;
    if (e.op === 'fn') return e.name;
    if (e.op === 'cast') return e.to === 'int' || e.to === 'integer' ? (e.e.op === 'col' ? e.e.name : e.e.op === 'fn' ? e.e.name : 'int4') : autoName(e.e);
    if (e.op === 'case') return 'case';
    if (e.op === 'exists') return 'exists';
    if (e.op === 'subq') { const c = e.q.cols && e.q.cols[0]; return c && !c.star ? c.alias || autoName(c.e) : '?column?'; }
    return '?column?';
  }

  /* ---------- Изменение данных и ограничения ---------- */
  E.validateRow = function (t, row, oldRow) {
    for (const c of t.cols) if (c.notNull && row[c.name] === null) err(`null value in column "${c.name}" of relation "${t.name}" violates not-null constraint`);
    for (const ch of t.checks) { const v = truth(this.ev(ch.e, { rows: { [t.name]: row }, cols: { [t.name]: t.cols.map((c) => c.name) } })); if (v === false) err(`new row for relation "${t.name}" violates check constraint "${ch.name}"`); }
    const keys = [{ cols: t.pk, name: `${t.name}_pkey` }].concat(t.uniques.map((u) => ({ cols: u, name: `${t.name}_${u.join('_')}_key` })));
    for (const k of keys) {
      if (!k.cols.length) continue;
      if (k.cols.some((c) => row[c] === null)) continue;
      if (t.rows.some((r) => r !== oldRow && k.cols.every((c) => cmp(r[c], row[c]) === 0))) err(`duplicate key value violates unique constraint "${k.name}"`);
    }
    for (const fk of t.fks) {
      const v = row[fk.col]; if (v === null) continue;
      const rt = this.table(fk.table), rc = fk.refCol || rt.pk[0];
      if (!rt.rows.some((r) => cmp(r[rc], v) === 0)) err(`insert or update on table "${t.name}" violates foreign key constraint "${fk.name}"`);
    }
  };
  E.checkReferenced = function (t, row) {
    for (const other of Object.values(this.tables)) for (const fk of other.fks) {
      if (fk.table !== t.name) continue;
      const rc = fk.refCol || t.pk[0];
      if (other.rows.some((r) => r[fk.col] !== null && cmp(r[fk.col], row[rc]) === 0)) err(`update or delete on table "${t.name}" violates foreign key constraint "${fk.name}" on table "${other.name}"`);
    }
  };
  E.coerce = function (t, colName, v) {
    const c = t.cols.find((x) => x.name === colName);
    if (!c) err(`column "${colName}" of relation "${t.name}" does not exist`);
    if (v === null) return null;
    const ty = c.type;
    if (['integer', 'int', 'int4', 'bigint', 'smallint', 'serial'].includes(ty)) { if (typeof v === 'string' && !/^\s*-?\d+\s*$/.test(v)) err(`invalid input syntax for type integer: "${v}"`); if (typeof v === 'boolean') err(`column "${colName}" is of type integer but expression is of type boolean`); const n = typeof v === 'string' ? parseInt(v, 10) : nv(v); return Math.round(n); }
    if (ty === 'boolean' || ty === 'bool') return castTo(v, 'boolean');
    if (ty === 'date') return castTo(v, 'date');
    if (['text', 'varchar', 'character'].includes(ty)) { if (isNum(v) || typeof v === 'boolean') err(`column "${colName}" is of type text but expression is of type ${typeof v === 'boolean' ? 'boolean' : 'integer'}`); return String(v); }
    if (['numeric', 'decimal'].includes(ty)) return castTo(v, 'numeric');
    return v;
  };
  E.returningRows = function (t, alias, list, rows) {
    if (!list) return null;
    const cols = [];
    const colsMap = { [alias]: t.cols.map((c) => c.name) };
    list.forEach((c) => { if (c.star) t.cols.forEach((tc) => cols.push({ name: tc.name, e: { op: 'col', table: alias, name: tc.name } })); else cols.push({ name: c.alias || autoName(c.e), e: c.e }); });
    return { columns: cols.map((c) => c.name), rows: rows.map((r) => cols.map((c) => this.ev(c.e, { rows: { [alias]: r }, cols: colsMap }))) };
  };
  E.exec1 = function (st) {
    if (this.aborted && !['rollback', 'commit'].includes(st.type)) err('current transaction is aborted, commands ignored until end of transaction block');
    switch (st.type) {
      case 'select': case 'union': return Object.assign({ kind: 'rows' }, this.runQuery(st, null));
      case 'begin': if (this.tx) return { kind: 'msg', msg: 'WARNING: there is already a transaction in progress', tag: 'BEGIN' }; this.tx = snapshot(this.tables); return { kind: 'tag', tag: 'BEGIN' };
      case 'commit': if (!this.tx) return { kind: 'msg', msg: 'WARNING: there is no transaction in progress', tag: 'COMMIT' }; if (this.aborted) { this.tables = this.tx; this.tx = null; this.aborted = false; return { kind: 'tag', tag: 'ROLLBACK' }; } this.tx = null; return { kind: 'tag', tag: 'COMMIT' };
      case 'rollback': if (!this.tx) return { kind: 'msg', msg: 'WARNING: there is no transaction in progress', tag: 'ROLLBACK' }; this.tables = this.tx; this.tx = null; this.aborted = false; return { kind: 'tag', tag: 'ROLLBACK' };
      case 'create': {
        if (this.tables[st.name]) err(`relation "${st.name}" already exists`);
        this.tables[st.name] = { name: st.name, cols: st.cols, pk: st.pk, uniques: st.uniques, checks: st.checks, fks: st.fks, rows: [] };
        st.pk.forEach((p) => { const c = st.cols.find((x) => x.name === p); if (c) c.notNull = true; });
        return { kind: 'tag', tag: 'CREATE TABLE' };
      }
      case 'insert': {
        const t = this.table(st.table);
        const cols = st.cols || t.cols.map((c) => c.name);
        let srcRows;
        if (st.rows) srcRows = st.rows.map((r) => { if (r.length !== cols.length) err(r.length > cols.length ? 'INSERT has more expressions than target columns' : 'INSERT has more target columns than expressions'); return r.map((e) => (e.k === 'default' ? { def: true } : this.ev(e, null))); });
        else { const r = this.runQuery(st.select, null); srcRows = r.rows; }
        const inserted = [];
        for (const vals of srcRows) {
          const row = {};
          t.cols.forEach((c) => { row[c.name] = c.def ? this.ev(c.def, null) : null; });
          cols.forEach((cn, i) => { if (!(vals[i] && vals[i].def)) row[cn] = this.coerce(t, cn, vals[i]); });
          this.validateRow(t, row, null);
          t.rows.push(row); inserted.push(row);
        }
        return this.withReturning(t, st.table, st.returning, inserted, `INSERT 0 ${inserted.length}`);
      }
      case 'update': {
        const t = this.table(st.table);
        const colsMap = { [st.alias]: t.cols.map((c) => c.name) };
        const targets = t.rows.filter((r) => !st.where || truth(this.ev(st.where, { rows: { [st.alias]: r }, cols: colsMap })) === true);
        const updated = [];
        for (const r of targets) {
          const nr = Object.assign({}, r);
          st.sets.forEach((s) => { nr[s.col] = this.coerce(t, s.col, this.ev(s.e, { rows: { [st.alias]: r }, cols: colsMap })); });
          this.validateRow(t, nr, r);
          for (const pk of t.pk) if (cmp(nr[pk], r[pk]) !== 0) this.checkReferenced(t, r);
          Object.assign(r, nr); updated.push(r);
        }
        return this.withReturning(t, st.alias, st.returning, updated, `UPDATE ${updated.length}`);
      }
      case 'delete': {
        const t = this.table(st.table);
        const colsMap = { [st.alias]: t.cols.map((c) => c.name) };
        const targets = t.rows.filter((r) => !st.where || truth(this.ev(st.where, { rows: { [st.alias]: r }, cols: colsMap })) === true);
        targets.forEach((r) => this.checkReferenced(t, r));
        const ret = this.returningRows(t, st.alias, st.returning, targets);
        t.rows = t.rows.filter((r) => !targets.includes(r));
        return ret ? Object.assign({ kind: 'rows', tag: `DELETE ${targets.length}` }, ret) : { kind: 'tag', tag: `DELETE ${targets.length}` };
      }
      default: err('неподдерживаемая команда');
    }
  };
  E.withReturning = function (t, alias, list, rows, tag) {
    const ret = this.returningRows(t, alias, list, rows);
    return ret ? Object.assign({ kind: 'rows', tag }, ret) : { kind: 'tag', tag };
  };
  function snapshot(tables) {
    const out = {};
    for (const [k, t] of Object.entries(tables)) out[k] = Object.assign({}, t, { rows: t.rows.map((r) => Object.assign({}, r)) });
    return out;
  }
  /** Выполнить текст из нескольких команд. Возвращает массив результатов; ошибка прерывает выполнение (как psql с ON_ERROR_STOP). */
  E.exec = function (sql) {
    const results = [];
    let stmts;
    try { stmts = new Parser(lex(sql)).statements(); } catch (e) { results.push({ kind: 'error', error: 'ERROR:  ' + e.message }); return results; }
    for (const st of stmts) {
      // атомарность одной команды: при ошибке откатываем её частичные изменения
      const before = snapshot(this.tables);
      try { results.push(Object.assign({ sql: st.text }, this.exec1(st))); }
      catch (e) {
        if (!(e instanceof SqlError)) throw e;
        this.tables = before;
        if (this.tx) this.aborted = true;
        results.push({ kind: 'error', sql: st.text, error: 'ERROR:  ' + e.message });
        break;
      }
    }
    return results;
  };
  E.reset = function (seedSql) { this.tables = {}; this.tx = null; this.aborted = false; if (seedSql) { const r = this.exec(seedSql); const bad = r.find((x) => x.kind === 'error'); if (bad) throw new Error('Ошибка учебной базы: ' + bad.error); } };

  const MiniSQL = { Engine, fmtVal, Num, lex, Parser, SqlError };
  if (typeof module !== 'undefined' && module.exports) module.exports = MiniSQL;
  root.MiniSQL = MiniSQL;
})(typeof window !== 'undefined' ? window : globalThis);

;
