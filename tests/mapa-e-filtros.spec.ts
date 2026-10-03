import { expect, test } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction } from '../support/api'
import { marker } from '../support/ui'

test.describe('Mapa', () => {
  test('filtra ocorrências por categoria', async ({ page, request }) => {
    const owner = await createUser(request)
    const metal = await createOccurrence(request, owner, { category: 'Metal' })
    const vidro = await createOccurrence(request, owner, { category: 'Vidro' })
    const metalMarker = marker(page, `Metal · ${metal.quantity}`)
    const vidroMarker = marker(page, `Vidro · ${vidro.quantity}`)

    await page.goto('/mapa')
    await expect(metalMarker).toBeAttached()
    await expect(vidroMarker).toBeAttached()

    // No celular os filtros ficam no botão "Filtrar"; no desktop, na barra lateral
    const openFilters = page.getByRole('button', { name: /^Filtrar/ })
    const isMobile = await openFilters.isVisible()
    if (isMobile) await openFilters.click()

    await page.getByRole('button', { name: 'Desmarcar todas' }).click()
    await page.getByRole('checkbox', { name: 'Metal' }).check()
    if (isMobile) await page.getByRole('button', { name: 'Aplicar' }).click()

    await expect(vidroMarker).toHaveCount(0)
    await expect(metalMarker).toBeAttached()
    if (isMobile) await expect(openFilters).toHaveText(/Filtrar \(1\)/)
  })

  test('mostra apenas ocorrências disponíveis', async ({ page, request }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const available = await createOccurrence(request, owner)
    const claimed = await createOccurrence(request, owner)
    const cancelled = await createOccurrence(request, owner)
    await occurrenceAction(request, collector, claimed.id, 'claim')
    await occurrenceAction(request, owner, cancelled.id, 'cancel')

    await page.goto('/mapa')

    await expect(marker(page, `Plástico · ${available.quantity}`)).toBeAttached()
    await expect(marker(page, `Plástico · ${claimed.quantity}`)).toHaveCount(0)
    await expect(marker(page, `Plástico · ${cancelled.quantity}`)).toHaveCount(0)
  })

  test('a localização do aparelho centraliza o mapa e calcula a distância', async ({
    page,
    request,
  }) => {
    const owner = await createUser(request)
    const occurrence = await createOccurrence(request, owner)

    await page.goto(`/ocorrencias/${occurrence.id}`)

    // Os testes simulam o aparelho em Curitiba, perto das ocorrências criadas
    await expect(page.locator('dd', { hasText: /de você$/ })).toHaveText(
      /^\d+(,\d)? (m|km) de você$/,
    )
  })
})
