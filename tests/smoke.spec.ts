import { expect, test } from '@playwright/test'

test('a pilha isolada está no ar (front → API → banco)', async ({ page, request }) => {
  const health = await request.get('/api/health')
  expect(await health.json()).toEqual({ status: 'ok', database: 'ok' })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Encontre, compartilhe e recicle/ })).toBeVisible()
})
