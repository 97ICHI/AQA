/* ===== sims/03-shopapi.js ===== */
/* ===== Учебный REST API магазина в памяти (используется API Playground) =====
   Поведение задано явно и детерминированно; внешние зависимости (платёжный шлюз, служба доставки) управляются сценариями. */
(function (root) {
  'use strict';
  const PRODUCTS = [
    { id: 1, title: 'Наушники Pulse', category: 'audio', price: 4990, stock: 12 },
    { id: 2, title: 'Колонка Boom', category: 'audio', price: 7990, stock: 0 },
    { id: 3, title: 'Клавиатура Keys', category: 'computers', price: 3490, stock: 25 },
    { id: 4, title: 'Мышь Click', category: 'computers', price: 1290, stock: 40 },
    { id: 5, title: 'Монитор View 27', category: 'computers', price: 21990, stock: 3 },
    { id: 6, title: 'Чехол Shell', category: 'accessories', price: 590, stock: 100 },
    { id: 7, title: 'Кабель USB-C', category: 'accessories', price: 390, stock: 0 },
    { id: 8, title: 'Смарт-часы Tick', category: 'wearables', price: 12990, stock: 7 },
  ];
  const USERS = [
    { id: 1, email: 'anna@example.com', password: 'Anna2025!', role: 'customer', token: 'anna-token' },
    { id: 2, email: 'boris@example.com', password: 'Boris2025!', role: 'customer', token: 'boris-token' },
    { id: 3, email: 'admin@example.com', password: 'Admin2025!', role: 'admin', token: 'admin-token' },
  ];
  const TRANSITIONS = { created: ['paid', 'cancelled'], paid: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
  const STATUSES = Object.keys(TRANSITIONS);
  const RATE = { limit: 12, windowMs: 10000 };

  function ShopApi() { this.reset(); }
  ShopApi.prototype.reset = function () {
    this.products = PRODUCTS.map((p) => Object.assign({}, p));
    this.orders = [
      { id: 101, customerId: 1, status: 'delivered', items: [{ productId: 1, qty: 1, price: 4990 }], total: 4990, createdAt: '2025-08-01T10:00:00Z' },
      { id: 102, customerId: 1, status: 'paid', items: [{ productId: 5, qty: 1, price: 21990 }], total: 21990, createdAt: '2025-09-12T12:30:00Z' },
      { id: 104, customerId: 2, status: 'shipped', items: [{ productId: 3, qty: 1, price: 3490 }], total: 3490, createdAt: '2025-09-20T09:15:00Z' },
    ];
    this.nextId = 110;
    this.idem = new Map();
    this.hits = new Map();
    this.deps = { gateway: 'approve', delivery: 'ok' };
    this.depLog = [];
    this.tokens = new Map(USERS.map((u) => [u.token, u]));
    this.clock = 0;
  };
  const json = (status, body, headers) => ({ status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, headers || {}), body });
  const error = (status, code, message, extra) => json(status, Object.assign({ code, message }, extra || {}));
  const STATUS_TEXT = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 415: 'Unsupported Media Type', 422: 'Unprocessable Content', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };

  /**
   * req: { method, path, headers: {lowercase: value}, body: string, now?: ms }
   * → { status, statusText, headers, body (object|null), timeMs }
   */
  ShopApi.prototype.handle = function (req) {
    const now = req.now ?? Date.now();
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.path.startsWith('http') ? req.path : 'http://shop.local' + (req.path.startsWith('/') ? '' : '/') + req.path);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const h = req.headers || {};
    this.depLog = [];
    let timeMs = 35 + ((path.length * 7 + method.length * 13) % 30);
    // ограничение частоты: по токену или «IP» анонимного клиента
    const who = (h.authorization || 'anonymous');
    const hits = (this.hits.get(who) || []).filter((t) => now - t < RATE.windowMs);
    if (hits.length >= RATE.limit) {
      const retry = Math.ceil((RATE.windowMs - (now - hits[0])) / 1000);
      const r = error(429, 'RATE_LIMITED', 'Слишком много запросов', { retryAfterSeconds: retry });
      r.headers['retry-after'] = String(retry); r.headers['x-ratelimit-limit'] = String(RATE.limit); r.headers['x-ratelimit-remaining'] = '0';
      return this.finish(r, timeMs);
    }
    hits.push(now); this.hits.set(who, hits);
    const rlHeaders = { 'x-ratelimit-limit': String(RATE.limit), 'x-ratelimit-remaining': String(RATE.limit - hits.length) };
    let res;
    try { res = this.route(method, path, url.searchParams, h, req.body || ''); }
    catch (e) { res = error(500, 'INTERNAL', 'Внутренняя ошибка учебного сервера'); }
    if (res.slowMs) { timeMs += res.slowMs; delete res.slowMs; }
    Object.assign(res.headers, rlHeaders);
    res.headers['x-request-id'] = 'req-' + ((now / 7) % 1e6).toString(36).replace('.', '').slice(0, 8);
    return this.finish(res, timeMs);
  };
  ShopApi.prototype.finish = function (res, timeMs) { res.statusText = STATUS_TEXT[res.status] || ''; res.timeMs = timeMs; res.deps = this.depLog.slice(); return res; };

  ShopApi.prototype.auth = function (h) {
    const a = h.authorization;
    if (!a) return { err: error(401, 'UNAUTHORIZED', 'Нужен заголовок Authorization: Bearer <token>', null) };
    const m = /^Bearer\s+(.+)$/i.exec(a);
    if (!m) return { err: error(401, 'UNAUTHORIZED', 'Ожидается схема Bearer') };
    if (m[1] === 'expired-token') return { err: error(401, 'TOKEN_EXPIRED', 'Срок действия токена истёк') };
    const u = this.tokens.get(m[1]);
    if (!u) return { err: error(401, 'INVALID_TOKEN', 'Токен не распознан') };
    return { user: u };
  };
  ShopApi.prototype.parseBody = function (h, body, required) {
    if (!body.trim()) return required ? { err: error(400, 'EMPTY_BODY', 'Тело запроса обязательно') } : { data: {} };
    const ct = h['content-type'] || '';
    if (!/application\/json/i.test(ct)) return { err: error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Ожидается Content-Type: application/json') };
    try { return { data: JSON.parse(body) }; } catch (e) { return { err: error(400, 'INVALID_JSON', 'Тело не является корректным JSON') }; }
  };
  ShopApi.prototype.orderView = function (o) { return { id: o.id, status: o.status, items: o.items.map((i) => Object.assign({}, i)), total: o.total, createdAt: o.createdAt }; };

  ShopApi.prototype.route = function (method, path, q, h, body) {
    const allow = (methods) => { if (!methods.includes(method)) { const r = error(405, 'METHOD_NOT_ALLOWED', `Метод ${method} не поддерживается для ${path}`); r.headers.allow = methods.join(', '); return r; } return null; };
    let m;
    if (path === '/api/health') return allow(['GET']) || json(200, { status: 'ok', version: '2.4.0' });

    if (path === '/api/products') {
      const na = allow(['GET']); if (na) return na;
      const page = q.has('page') ? Number(q.get('page')) : 1, limit = q.has('limit') ? Number(q.get('limit')) : 10;
      if (!Number.isInteger(page) || page < 1) return error(400, 'VALIDATION_ERROR', 'Параметр page должен быть целым ≥ 1', { details: [{ field: 'page', reason: 'must be an integer >= 1' }] });
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) return error(400, 'VALIDATION_ERROR', 'Параметр limit должен быть целым от 1 до 50', { details: [{ field: 'limit', reason: 'must be an integer in 1..50' }] });
      let list = this.products.slice();
      if (q.get('category')) list = list.filter((p) => p.category === q.get('category'));
      if (q.get('inStock') === 'true') list = list.filter((p) => p.stock > 0);
      const total = list.length, items = list.slice((page - 1) * limit, page * limit);
      return json(200, { items, total, page, limit });
    }
    if ((m = /^\/api\/products\/([^/]+)$/.exec(path))) {
      const na = allow(['GET']); if (na) return na;
      if (!/^\d+$/.test(m[1])) return error(400, 'VALIDATION_ERROR', 'id должен быть числом', { details: [{ field: 'id', reason: 'must be an integer' }] });
      const p = this.products.find((x) => x.id === +m[1]);
      return p ? json(200, p) : error(404, 'NOT_FOUND', `Товар ${m[1]} не найден`);
    }
    if (path === '/api/auth/login') {
      const na = allow(['POST']); if (na) return na;
      const b = this.parseBody(h, body, true); if (b.err) return b.err;
      const { email, password } = b.data || {};
      const details = [];
      if (typeof email !== 'string' || !email) details.push({ field: 'email', reason: 'required' });
      if (typeof password !== 'string' || !password) details.push({ field: 'password', reason: 'required' });
      if (details.length) return error(422, 'VALIDATION_ERROR', 'Некорректные данные входа', { details });
      const u = USERS.find((x) => x.email === email && x.password === password);
      if (!u) return error(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль');
      return json(200, { accessToken: u.token, tokenType: 'Bearer', expiresIn: 3600 });
    }
    if (path === '/api/orders') {
      const na = allow(['GET', 'POST']); if (na) return na;
      const a = this.auth(h); if (a.err) return a.err;
      if (method === 'GET') {
        let list = this.orders.filter((o) => a.user.role === 'admin' || o.customerId === a.user.id);
        if (q.get('status')) list = list.filter((o) => o.status === q.get('status'));
        return json(200, { items: list.map((o) => this.orderView(o)), total: list.length });
      }
      const key = h['idempotency-key'];
      if (key && this.idem.has(a.user.id + ':' + key)) {
        const prev = this.idem.get(a.user.id + ':' + key);
        const r = json(prev.status, prev.body, Object.assign({}, prev.headers)); r.headers['idempotent-replayed'] = 'true'; return r;
      }
      const b = this.parseBody(h, body, true); if (b.err) return b.err;
      const items = b.data && b.data.items;
      const details = [];
      if (!Array.isArray(items) || !items.length) details.push({ field: 'items', reason: 'must be a non-empty array' });
      else items.forEach((it, i) => {
        if (!it || typeof it !== 'object') { details.push({ field: `items[${i}]`, reason: 'must be an object' }); return; }
        if (!Number.isInteger(it.productId)) details.push({ field: `items[${i}].productId`, reason: 'must be an integer' });
        if (!Number.isInteger(it.qty) || it.qty < 1) details.push({ field: `items[${i}].qty`, reason: 'must be an integer >= 1' });
      });
      if (details.length) return error(422, 'VALIDATION_ERROR', 'Некорректные данные заказа', { details });
      for (const it of items) {
        const p = this.products.find((x) => x.id === it.productId);
        if (!p) return error(422, 'VALIDATION_ERROR', 'Некорректные данные заказа', { details: [{ field: 'productId', reason: `product ${it.productId} does not exist` }] });
        if (p.stock < it.qty) return error(409, 'OUT_OF_STOCK', `Недостаточно товара «${p.title}» на складе`, { available: p.stock });
      }
      const order = { id: this.nextId++, customerId: a.user.id, status: 'created', items: items.map((it) => ({ productId: it.productId, qty: it.qty, price: this.products.find((x) => x.id === it.productId).price })), createdAt: '2025-10-05T12:00:00Z' };
      order.total = order.items.reduce((s, i) => s + i.qty * i.price, 0);
      order.items.forEach((i) => { this.products.find((x) => x.id === i.productId).stock -= i.qty; });
      this.orders.push(order);
      const r = json(201, this.orderView(order), { location: `/api/orders/${order.id}` });
      if (key) this.idem.set(a.user.id + ':' + key, { status: r.status, body: r.body, headers: r.headers });
      return r;
    }
    if ((m = /^\/api\/orders\/([^/]+)\/pay$/.exec(path))) {
      const na = allow(['POST']); if (na) return na;
      const a = this.auth(h); if (a.err) return a.err;
      const o = this.orders.find((x) => String(x.id) === m[1] && (a.user.role === 'admin' || x.customerId === a.user.id));
      if (!o) return error(404, 'NOT_FOUND', `Заказ ${m[1]} не найден`);
      if (o.status !== 'created') return error(409, 'ALREADY_PAID', `Заказ в статусе ${o.status}, оплата невозможна`);
      const mode = this.deps.gateway;
      const call = `payment-gateway  POST /charge  {"amount": ${o.total * 100}, "currency": "RUB"}`;
      if (mode === 'approve') { this.depLog.push(call + '  →  200 approved'); o.status = 'paid'; o.paymentId = 'pay_' + o.id; return json(200, { id: o.id, status: 'paid', paymentId: o.paymentId }); }
      if (mode === 'decline') { this.depLog.push(call + '  →  200 declined'); return error(402, 'CARD_DECLINED', 'Платёж отклонён банком', { orderStatus: o.status }); }
      if (mode === 'timeout') { this.depLog.push(call + '  →  нет ответа за 10 с'); const r = error(504, 'PAYMENT_TIMEOUT', 'Платёжный шлюз не ответил вовремя, повторите позже', { orderStatus: o.status }); r.slowMs = 10000; return r; }
      this.depLog.push(call + '  →  500'); return error(502, 'PAYMENT_GATEWAY_ERROR', 'Ошибка платёжного шлюза', { orderStatus: o.status });
    }
    if ((m = /^\/api\/orders\/([^/]+)$/.exec(path))) {
      const na = allow(['GET', 'PATCH', 'DELETE']); if (na) return na;
      const a = this.auth(h); if (a.err) return a.err;
      if (!/^\d+$/.test(m[1])) return error(400, 'VALIDATION_ERROR', 'id должен быть числом');
      const o = this.orders.find((x) => x.id === +m[1]);
      // чужой заказ не раскрываем: 404, как для несуществующего
      if (!o || (a.user.role !== 'admin' && o.customerId !== a.user.id)) return error(404, 'NOT_FOUND', `Заказ ${m[1]} не найден`);
      if (method === 'GET') return json(200, this.orderView(o));
      if (method === 'DELETE') {
        if (!['created', 'cancelled'].includes(o.status)) return error(409, 'INVALID_STATE', 'Удалить можно только созданный или отменённый заказ');
        if (o.status === 'created') o.items.forEach((i) => { this.products.find((x) => x.id === i.productId).stock += i.qty; });
        this.orders = this.orders.filter((x) => x !== o);
        return { status: 204, headers: {}, body: null };
      }
      const b = this.parseBody(h, body, true); if (b.err) return b.err;
      const st = b.data && b.data.status;
      if (!STATUSES.includes(st)) return error(422, 'VALIDATION_ERROR', 'Неизвестный статус', { details: [{ field: 'status', reason: `must be one of ${STATUSES.join(', ')}` }] });
      if (st === o.status) return json(200, this.orderView(o));
      if (!TRANSITIONS[o.status].includes(st)) return error(409, 'INVALID_TRANSITION', `Переход ${o.status} → ${st} недопустим`, { allowed: TRANSITIONS[o.status] });
      if (['shipped', 'delivered'].includes(st) && a.user.role !== 'admin') return error(403, 'FORBIDDEN', 'Менять статус доставки может только администратор');
      if (st === 'cancelled') o.items.forEach((i) => { this.products.find((x) => x.id === i.productId).stock += i.qty; });
      o.status = st;
      return json(200, this.orderView(o));
    }
    if (path === '/api/delivery/quote') {
      const na = allow(['GET']); if (na) return na;
      const city = q.get('city');
      if (!city) return error(400, 'VALIDATION_ERROR', 'Параметр city обязателен', { details: [{ field: 'city', reason: 'required' }] });
      const call = `delivery-service  GET /quote?city=${city}`;
      if (this.deps.delivery === 'down') { this.depLog.push(call + '  →  503'); const r = error(503, 'DELIVERY_UNAVAILABLE', 'Служба доставки временно недоступна'); r.headers['retry-after'] = '30'; return r; }
      const cost = city.toLowerCase() === 'москва' ? 300 : 450;
      if (this.deps.delivery === 'slow') { this.depLog.push(call + '  →  200 (через 3,2 с)'); const r = json(200, { city, cost, days: 3 }); r.slowMs = 3200; return r; }
      this.depLog.push(call + '  →  200');
      return json(200, { city, cost, days: 2 });
    }
    return error(404, 'ROUTE_NOT_FOUND', `Маршрут ${method} ${path} не найден`);
  };
  ShopApi.STATUS_TEXT = STATUS_TEXT;
  ShopApi.USERS = USERS;
  ShopApi.RATE = RATE;
  root.ShopApi = ShopApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = ShopApi;
})(typeof window !== 'undefined' ? window : globalThis);

;
