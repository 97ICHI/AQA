// Учебный магазин для практики Playwright: каталог → поиск → корзина → вход → заказ.
// Данные в памяти (PGlite, та же база, что в SQL-тренажёре). Дефекты включаются списком defects — для проверки, ловит ли их тест.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { SCHEMA, DATASETS } from '../shared/shop-data.mjs';

export const VARIANTS = {
  ok: { label: 'Исправный магазин', defects: [] },
  'cart-not-add': { label: 'Дефект: товар не добавляется в корзину', defects: ['cart-not-add'] },
  'wrong-total': { label: 'Дефект: сумма корзины не учитывает количество', defects: ['wrong-total'] },
  slow: { label: 'Медленный магазин: кнопки активируются с задержкой (не дефект)', defects: ['slow'] },
  'similar-names': { label: 'Новые данные: похожие названия товаров (не дефект)', defects: ['similar-names'] },
  'markup-change': { label: 'Новая вёрстка: другие классы и id, те же роли и тексты (не дефект)', defects: ['markup-change'] },
  'auth-lost': { label: 'Дефект: вход не сохраняется после перехода', defects: ['auth-lost'] },
  'api-status': { label: 'Дефект: API создания заказа отвечает 200 вместо 201', defects: ['api-status'] },
  'api-json': { label: 'Дефект: total в JSON заказа — строка, а не число', defects: ['api-json'] },
  'order-user': { label: 'Дефект: заказ записывается не тому пользователю', defects: ['order-user'] },
  'shared-cart': { label: 'Дефект: одна корзина на всех посетителей', defects: ['shared-cart'] },
};
export const DEMO_PASSWORD = 'learn-123'; // учебный пароль для всех пользователей учебной базы, не секрет

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rub = (n) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace(/ /g, ' ') + ' ₽';

export async function createShop({ defects = [] } = {}) {
  const has = (d) => defects.includes(d);
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(DATASETS.base.sql);
  if (has('similar-names')) await db.exec(`INSERT INTO products VALUES (7,'PULSE-03','Наушники Pulse Pro Max','audio',9990.00,4),(8,'PULSE-00','Чехол для наушников Pulse','audio',490.00,30)`);
  const sessions = new Map(); // sid → { userId, cart: Map(productId → qty) }
  const shared = { userId: null, cart: new Map() };
  const C = has('markup-change') ? { card: 'tile', add: 'js-buy', total: 'sum', list: 'grid' } : { card: 'card', add: 'add-to-cart', total: 'total', list: 'products' };

  function session(req, res) {
    const sid = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
    if (sid && sessions.has(sid)) return sessions.get(sid);
    const id = randomBytes(12).toString('hex');
    const s = { userId: null, cart: new Map() };
    sessions.set(id, s);
    res.setHeader('set-cookie', `sid=${id}; Path=/; HttpOnly; SameSite=Lax`);
    return s;
  }
  const cartOf = (s) => (has('shared-cart') ? shared.cart : s.cart);
  async function cartView(s) {
    const items = [];
    for (const [pid, qty] of cartOf(s)) {
      const p = (await db.query('select id, title, price from products where id=$1', [pid])).rows[0];
      if (p) items.push({ productId: p.id, title: p.title, price: Number(p.price), qty });
    }
    const total = items.reduce((t, i) => t + i.price * (has('wrong-total') ? 1 : i.qty), 0);
    return { items, total, count: items.reduce((n, i) => n + i.qty, 0) };
  }
  async function userOf(s) { return s.userId ? (await db.query('select id, name, email from users where id=$1', [s.userId])).rows[0] : null; }

  const layout = (title, body, { user, count }) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Учебный магазин</title>
<style>body{font:16px system-ui;margin:0;background:#f6f7fc;color:#1b1f36}header{display:flex;gap:16px;align-items:center;padding:12px 20px;background:#fff;border-bottom:1px solid #d9dcef}main{max-width:900px;margin:20px auto;padding:0 16px}
.${C.list}{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.${C.card}{background:#fff;border:1px solid #d9dcef;border-radius:10px;padding:12px}
button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #5b47e0;background:#5b47e0;color:#fff;cursor:pointer}button:disabled{opacity:.5}input{font:inherit;padding:6px 8px}table{border-collapse:collapse}td,th{border:1px solid #d9dcef;padding:6px 10px}</style></head>
<body><header><strong>Учебный магазин</strong><nav aria-label="Основная"><a href="/">Каталог</a> · <a href="/cart">Корзина (<span data-testid="cart-count">${count}</span>)</a> · ${user ? `<span data-testid="user-name">${esc(user.name)}</span> <a href="/logout">Выйти</a>` : '<a href="/login">Войти</a>'}</nav></header>
<main>${body}</main>
<script>
const slow=${has('slow') ? 1500 : 0};
document.querySelectorAll('button[data-product]').forEach(b=>{if(slow){b.disabled=true;setTimeout(()=>b.disabled=false,slow);}b.addEventListener('click',async()=>{b.disabled=true;const r=await fetch('/api/cart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:Number(b.dataset.product),qty:1})});const j=await r.json();document.querySelector('[data-testid=cart-count]').textContent=j.count;const st=document.querySelector('#cart-status');st.textContent=r.ok?'Добавлено: '+b.dataset.title:'Ошибка: '+j.error;b.disabled=false;});});
const order=document.querySelector('#place-order');if(order){if(slow){order.disabled=true;setTimeout(()=>order.disabled=false,slow);}order.addEventListener('click',async()=>{order.disabled=true;const r=await fetch('/api/orders',{method:'POST'});const j=await r.json();document.querySelector('#order-status').textContent=r.ok?'Заказ №'+j.id+' оформлен на сумму '+j.totalText:'Ошибка: '+j.error;order.disabled=false;});}
const login=document.querySelector('#login-form');if(login)login.addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:login.email.value,password:login.password.value})});const j=await r.json();if(r.ok)location.href='/';else document.querySelector('#login-status').textContent='Ошибка: '+j.error;});
</script></body></html>`;

  const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
  const html = (res, code, body) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); };
  async function body(req) { let s = ''; for await (const c of req) { s += c; if (s.length > 16384) return null; } try { return s ? JSON.parse(s) : {}; } catch { return undefined; } }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://shop');
      const s = session(req, res);
      if (has('auth-lost') && req.method === 'GET' && !url.pathname.startsWith('/api')) { if (s.loginSeen) s.userId = null; else if (s.userId) s.loginSeen = true; }
      const p = url.pathname;
      if (req.method === 'GET' && p === '/') {
        const q = url.searchParams.get('q') || '';
        const rows = (await db.query(`select id, title, price, stock from products ${q ? 'where title ilike $1' : ''} order by id`, q ? ['%' + q + '%'] : [])).rows;
        const cards = rows.map((r) => `<li class="${C.card}"${has('markup-change') ? '' : ` id="product-${r.id}"`}>${has('markup-change') ? '<div class="inner">' : ''}<h2>${esc(r.title)}</h2><p>${rub(r.price)}</p>${r.stock > 0 ? `<button type="button" class="${C.add}" data-product="${r.id}" data-title="${esc(r.title)}">В корзину</button>` : '<p>Нет в наличии</p>'}${has('markup-change') ? '</div>' : ''}</li>`).join('');
        const v = await cartView(s);
        return html(res, 200, layout('Каталог', `<h1>Каталог</h1><form role="search" action="/"><label for="q">Поиск товара</label> <input id="q" name="q" type="search" value="${esc(q)}"> <button>Найти</button></form>
<p id="cart-status" role="status" aria-live="polite"></p>${rows.length ? `<ul class="${C.list}" aria-label="Товары">${cards}</ul>` : '<p>Ничего не найдено.</p>'}`, { user: await userOf(s), count: v.count }));
      }
      if (req.method === 'GET' && p === '/cart') {
        const v = await cartView(s);
        const rows = v.items.map((i) => `<tr><td>${esc(i.title)}</td><td>${i.qty}</td><td>${rub(i.price)}</td></tr>`).join('');
        return html(res, 200, layout('Корзина', `<h1>Корзина</h1>${v.items.length ? `<table><thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th></tr></thead><tbody>${rows}</tbody></table><p class="${C.total}">Итого: <strong data-testid="cart-total">${rub(v.total)}</strong></p><button type="button" id="place-order">Оформить заказ</button>` : '<p>Корзина пуста.</p>'}<p id="order-status" role="status" aria-live="polite"></p>`, { user: await userOf(s), count: v.count }));
      }
      if (req.method === 'GET' && p === '/login') {
        return html(res, 200, layout('Вход', `<h1>Вход</h1><form id="login-form"><p><label for="email">Email</label><br><input id="email" name="email" type="email" autocomplete="username"></p><p><label for="password">Пароль</label><br><input id="password" name="password" type="password" autocomplete="current-password"></p><button>Войти</button></form><p id="login-status" role="status"></p><p><small>Учебные пользователи: anna@example.test, boris@example.test; пароль ${DEMO_PASSWORD}</small></p>`, { user: await userOf(s), count: (await cartView(s)).count }));
      }
      if (req.method === 'GET' && p === '/logout') { s.userId = null; res.writeHead(302, { location: '/' }); return res.end(); }
      if (req.method === 'GET' && p === '/api/products') {
        const q = url.searchParams.get('q') || '';
        const rows = (await db.query(`select id, sku, title, price::float8 as price, stock from products ${q ? 'where title ilike $1' : ''} order by id`, q ? ['%' + q + '%'] : [])).rows;
        return send(res, 200, rows);
      }
      if (req.method === 'GET' && p === '/api/cart') return send(res, 200, await cartView(s));
      if (req.method === 'POST' && p === '/api/cart') {
        const b = await body(req);
        if (!b || !Number.isInteger(b.productId) || !Number.isInteger(b.qty ?? 1) || (b.qty ?? 1) < 1) return send(res, 400, { error: 'productId и qty должны быть целыми, qty ≥ 1' });
        const prod = (await db.query('select id, stock from products where id=$1', [b.productId])).rows[0];
        if (!prod) return send(res, 404, { error: 'товар не найден' });
        const cart = cartOf(s);
        const next = (cart.get(prod.id) || 0) + (b.qty ?? 1);
        if (next > prod.stock) return send(res, 409, { error: 'недостаточно товара на складе' });
        if (!has('cart-not-add')) cart.set(prod.id, next);
        return send(res, 200, await cartView(s));
      }
      if (req.method === 'POST' && p === '/api/login') {
        const b = await body(req);
        const u = b && (await db.query('select id, name from users where email=$1 and is_active', [String(b.email || '')])).rows[0];
        if (!u || b.password !== DEMO_PASSWORD) return send(res, 401, { error: 'неверный email или пароль' });
        s.userId = u.id; s.loginSeen = false;
        return send(res, 200, { id: u.id, name: u.name });
      }
      if (req.method === 'POST' && p === '/api/orders') {
        if (!s.userId) return send(res, 401, { error: 'нужно войти' });
        const v = await cartView(s);
        if (!v.items.length) return send(res, 422, { error: 'корзина пуста' });
        const id = (await db.query('select coalesce(max(id),100)+1 as id from orders')).rows[0].id;
        await db.transaction(async (tx) => {
          await tx.query(`insert into orders values ($1,$2,'new',NULL,current_date)`, [id, has('order-user') ? 1 : s.userId]);
          for (const i of v.items) await tx.query('insert into order_items values ($1,$2,$3,$4)', [id, i.productId, i.qty, i.price]);
        });
        cartOf(s).clear();
        const out = { id, userId: s.userId, status: 'new', total: has('api-json') ? v.total.toFixed(2) : v.total, totalText: rub(v.total), items: v.items.map((i) => ({ productId: i.productId, qty: i.qty })) };
        return send(res, has('api-status') ? 200 : 201, out);
      }
      const m = p.match(/^\/api\/orders\/(\d+)$/);
      if (req.method === 'GET' && m) {
        const o = (await db.query('select id, user_id, status from orders where id=$1', [Number(m[1])])).rows[0];
        if (!o) return send(res, 404, { error: 'заказ не найден' });
        if (o.user_id !== s.userId) return send(res, s.userId ? 403 : 401, { error: s.userId ? 'это чужой заказ' : 'нужно войти' });
        const items = (await db.query('select product_id as "productId", qty, price::float8 as price from order_items where order_id=$1 order by product_id', [o.id])).rows;
        return send(res, 200, { id: o.id, userId: o.user_id, status: o.status, items, total: items.reduce((t, i) => t + i.price * i.qty, 0) });
      }
      // Только для учебных тестов: чтение базы магазина (SELECT). В настоящих проектах такого маршрута в приложении нет — используют доступ к тестовой БД.
      if (req.method === 'POST' && p === '/__test/sql') {
        const b = await body(req);
        const sql = String(b?.sql || '');
        if (!/^\s*select\b/i.test(sql) || sql.includes(';')) return send(res, 400, { error: 'разрешён один SELECT' });
        const r = await db.query(sql, Array.isArray(b.params) ? b.params : []);
        return send(res, 200, { rows: r.rows });
      }
      if (req.method === 'GET' && p === '/ready') return send(res, 200, { ready: true });
      send(res, 404, { error: 'not found' });
    } catch (err) {
      send(res, 500, { error: String(err?.message || err) });
    }
  });
  return {
    async listen(port = 0) { await new Promise((r) => server.listen(port, '127.0.0.1', r)); return `http://127.0.0.1:${server.address().port}`; },
    async close() { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await db.close(); },
  };
}

// node runner/shop.mjs [вариант] — поднять магазин вручную, чтобы посмотреть его в браузере
if (import.meta.url === `file://${process.argv[1]}`) {
  const v = process.argv[2] || 'ok';
  if (!VARIANTS[v]) { console.error('Неизвестный вариант. Есть: ' + Object.keys(VARIANTS).join(', ')); process.exit(1); }
  const shop = await createShop({ defects: VARIANTS[v].defects });
  console.log(`Учебный магазин (${VARIANTS[v].label}): ${await shop.listen(Number(process.env.PORT) || 3000)}`);
}
