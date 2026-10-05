import { test, expect } from '@playwright/test';

test('UI: сумма заказа соответствует количеству', async ({ page, request }) => {
  let id: string | undefined;
  try {
    await page.goto('/');
    await page.getByLabel('Количество', { exact: true }).fill('2');
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Оформить заказ', exact: true }).click();
    const response = await responsePromise;
    const body = await response.json();
    // Запомнить id до assertions: cleanup нужен и при их падении.
    id = body.id;
    expect(response.status()).toBe(201);
    expect(body.total).toBe(2000);
    await expect(page.getByRole('status')).toHaveText('Заказ создан: 2000 ₽');
    const saved = await request.get('/api/orders/' + id);
    expect(saved.status()).toBe(200);
    expect((await saved.json()).quantity).toBe(2);
  } finally {
    if (id) expect((await request.delete('/api/orders/' + id)).status()).toBe(204);
  }
});

test('API: невалидное количество отклонено', async ({ request }) => {
  const response = await request.post('/api/orders', { data: { quantity: 0 } });
  expect(response.status()).toBe(422);
  expect(await response.json()).toEqual({ error: 'quantity must be an integer from 1 to 10' });
});
