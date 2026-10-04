// Rota do coletor: bolinhas até o material, avatar do coletor e atalhos para o GPS.
// No E2E não há chave do serviço de rotas, então a trilha é em linha reta (fallback).
import { expect, test } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction, signIn } from '../support/api'

// O aparelho começa em Curitiba (playwright.config.ts); o material fica ~400 m ao norte
const START = { latitude: -25.4284, longitude: -49.2733 }
const MATERIAL = { latitude: -25.4248, longitude: -49.2733 }

test.describe('Caminho até o material', () => {
  test('o coletor vê as bolinhas, o próprio avatar e os atalhos para o GPS', async ({
    page,
    context,
    request,
  }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const { id } = await createOccurrence(request, owner, { location: MATERIAL })
    await occurrenceAction(request, collector, id, 'claim')
    await request.put('/api/me/avatar', {
      headers: { Authorization: `Bearer ${collector.token}` },
      data: { preset: 'garrafa' },
    })
    await context.setGeolocation(START)
    await signIn(page, collector)

    await page.goto(`/ocorrencias/${id}`)
    const route = page.getByRole('region', { name: 'Caminho até o material' })
    await expect(route).toBeVisible()

    // Avatar na posição do coletor e bolinhas pelo caminho (espaçadas conforme o zoom)
    const me = route.getByRole('img', { name: 'Você' })
    await expect(me).toBeVisible()
    await expect(me.locator('img')).toHaveAttribute('src', /\/avatar/)
    const dots = route.locator('path.route-dot')
    await expect.poll(() => dots.count()).toBeGreaterThanOrEqual(5)
    const before = await dots.count()
    await expect(route.getByText(/^Faltam (3\d\d|4\d\d) m$/)).toBeVisible()
    await expect(route.getByText(/Trajeto aproximado em linha reta/)).toBeVisible()

    // Atalhos para o GPS com o destino certo
    await expect(route.getByRole('link', { name: /Google Maps/ })).toHaveAttribute(
      'href',
      `https://www.google.com/maps/dir/?api=1&destination=${MATERIAL.latitude},${MATERIAL.longitude}`,
    )
    await expect(route.getByRole('link', { name: /Waze/ })).toHaveAttribute(
      'href',
      `https://waze.com/ul?ll=${MATERIAL.latitude},${MATERIAL.longitude}&navigate=yes`,
    )

    // Anda até a metade do caminho: as bolinhas de trás são "comidas"
    await context.setGeolocation({ latitude: -25.4266, longitude: -49.2733 })
    await expect.poll(() => dots.count()).toBeLessThan(before)
    await expect(route.getByText(/^Faltam (1\d\d|2\d\d) m$/)).toBeVisible()

    // Chega ao material
    await context.setGeolocation(MATERIAL)
    await expect(route.getByText('Você chegou! 🎉')).toBeVisible()
    await expect.poll(() => dots.count()).toBe(0)
  })

  test('quem não é o coletor não vê a rota', async ({ page, request }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const { id } = await createOccurrence(request, owner, { location: MATERIAL })
    await occurrenceAction(request, collector, id, 'claim')

    await signIn(page, owner)
    await page.goto(`/ocorrencias/${id}`)

    await expect(page.getByRole('region', { name: 'Coleta' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Caminho até o material' })).toHaveCount(0)
  })

  test('depois de finalizar, a rota some', async ({ page, request }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const { id } = await createOccurrence(request, owner, { location: MATERIAL })
    await occurrenceAction(request, collector, id, 'claim')
    await signIn(page, collector)

    await page.goto(`/ocorrencias/${id}`)
    await expect(page.getByRole('region', { name: 'Caminho até o material' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar coleta' }).click()

    await expect(page.getByText('Coletado', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Caminho até o material' })).toHaveCount(0)
  })
})
