import http from 'node:http';
import { randomUUID } from 'node:crypto';

// Учебная система: данные хранятся в памяти, нет базы данных, оплаты и авторизации.
const orders = new Map();
const PRICE = 1000;
const MAX_BODY = 16 * 1024;

const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Учебный магазин</title><style>body{font:18px system-ui;max-width:700px;margin:40px auto;padding:16px;background:#0b1020;color:#e8edf7}button,input{font:inherit;padding:10px;margin:8px 0}button{background:#a78bfa;color:#10162a;border:0;border-radius:8px}label{display:block}</style></head><body><h1>Учебный магазин</h1><p>Один товар: наушники, цена 1000 ₽.</p><form><label for="qty">Количество</label><input id="qty" type="number" min="1" max="10" value="1" required><br><button>Оформить заказ</button></form><p role="status" aria-live="polite"></p><script>const form=document.querySelector('form'),status=document.querySelector('[role="status"]');form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Отправляем…';try{const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:Number(document.querySelector('#qty').value)})});const body=await response.json();if(!response.ok)throw Error(body.error);status.textContent='Заказ создан: '+body.total+' ₽';status.dataset.orderId=body.id;}catch(error){status.textContent='Ошибка: '+error.message;}finally{button.disabled=false;}});</script></body></html>`;

function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/ready') {
      send(res, 200, { ready: true });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      const raw = await readBody(req);
      if (raw === null) {
        send(res, 413, { error: 'body too large' });
        return;
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        send(res, 400, { error: 'invalid JSON' });
        return;
      }
      if (!body || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 10) {
        send(res, 422, { error: 'quantity must be an integer from 1 to 10' });
        return;
      }
      const order = { id: randomUUID(), quantity: body.quantity, total: body.quantity * PRICE, status: 'created' };
      orders.set(order.id, order);
      send(res, 201, order);
      return;
    }
    const match = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (match && req.method === 'GET') {
      const order = orders.get(match[1]);
      send(res, order ? 200 : 404, order || { error: 'not found' });
      return;
    }
    if (match && req.method === 'DELETE') {
      orders.delete(match[1]); // повторное удаление тоже отвечает 204: операция идемпотентна
      res.writeHead(204);
      res.end();
      return;
    }
    send(res, 404, { error: 'not found' });
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const port = Number(process.env.PORT || 3000);
  // По умолчанию слушаем только локальный интерфейс; в контейнере задайте HOST=0.0.0.0.
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => console.log(`Учебный магазин: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
}
