import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

test('API: создание, границы, ошибки и независимые заказы', async (t) => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/ready')).status, 200);
  const ids = [];
  for (const quantity of [1, 10]) {
    const r = await fetch(base + '/api/orders', { method: 'POST', body: JSON.stringify({ quantity }) });
    assert.equal(r.status, 201);
    const order = await r.json(); ids.push(order.id);
    assert.equal(order.total, quantity * 1000);
    assert.equal(order.status, 'created');
    assert.deepEqual(await (await fetch(base + '/api/orders/' + order.id)).json(), order);
  }
  assert.notEqual(ids[0], ids[1]);
  for (const quantity of [0, 11, 1.5, '2', null]) {
    assert.equal((await fetch(base + '/api/orders', { method: 'POST', body: JSON.stringify({ quantity }) })).status, 422);
  }
  assert.equal((await fetch(base + '/api/orders', { method: 'POST', body: '{' })).status, 400);
  for (const id of ids) {
    assert.equal((await fetch(base + '/api/orders/' + id, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(base + '/api/orders/' + id, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(base + '/api/orders/' + id)).status, 404);
  }
});
