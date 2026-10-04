import { expect, test, type Page } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction, signIn, uniqueId } from '../support/api'
import { acceptDialogs, navLink } from '../support/ui'

// O aparelho simulado está em Curitiba (playwright.config.ts)
const HERE = { latitude: -25.4284, longitude: -49.2733 }

const item = (page: Page, quantity: string) =>
  page.getByRole('listitem').filter({ hasText: quantity })

test.describe('Coletar: ocorrências por distância', () => {
  test('ordena da mais próxima para a mais distante, com a distância', async ({
    page,
    request,
  }) => {
    const owner = await createUser(request)
    const tag = uniqueId()
    // Criadas fora de ordem de propósito
    await createOccurrence(request, owner, {
      quantity: `longe ${tag}`,
      location: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo, ~340 km
    })
    await createOccurrence(request, owner, {
      quantity: `perto ${tag}`,
      location: { latitude: HERE.latitude + 0.0005, longitude: HERE.longitude }, // ~55 m
    })
    await createOccurrence(request, owner, {
      quantity: `meio ${tag}`,
      location: { latitude: HERE.latitude + 0.03, longitude: HERE.longitude }, // ~3 km
    })

    await page.goto('/')
    await page.getByRole('link', { name: 'Explorar mapa' }).click()
    await navLink(page, 'Coletar').click()
    await expect(page.getByRole('heading', { name: 'Coletar', exact: true })).toBeVisible()
    await expect(page.getByText('da mais próxima para a mais distante')).toBeVisible()

    // Só as três deste teste, na ordem em que aparecem na tela
    const mine = page.getByRole('listitem').filter({ hasText: tag })
    await expect(mine).toHaveCount(3)
    await expect(mine).toHaveText([/perto/, /meio/, /longe/])
    await expect(item(page, `perto ${tag}`)).toContainText(/\d+ m/)
    await expect(item(page, `meio ${tag}`)).toContainText(/3(,\d)? km/)
    await expect(item(page, `longe ${tag}`)).toContainText(/3\d\d km/)
  })

  test('mostra só as disponíveis', async ({ page, request }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const available = await createOccurrence(request, owner)
    const claimed = await createOccurrence(request, owner)
    const cancelled = await createOccurrence(request, owner)
    await occurrenceAction(request, collector, claimed.id, 'claim')
    await occurrenceAction(request, owner, cancelled.id, 'cancel')

    await page.goto('/coletar')

    await expect(item(page, available.quantity)).toBeVisible()
    await expect(item(page, claimed.quantity)).toHaveCount(0)
    await expect(item(page, cancelled.quantity)).toHaveCount(0)
  })

  test('coletar pela lista assume a coleta e abre os detalhes', async ({ page, request }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const occurrence = await createOccurrence(request, owner, { category: 'Doação' })
    acceptDialogs(page)
    await signIn(page, collector)

    await page.goto('/coletar')
    const card = item(page, occurrence.quantity)
    await expect(card).toContainText('Doação')
    await card.getByRole('button', { name: 'Coletar' }).click()

    await expect(page).toHaveURL(new RegExp(`/ocorrencias/${occurrence.id}$`))
    await expect(page.getByRole('region', { name: 'Coleta' })).toContainText(
      'Coleta assumida por você',
    )

    // Ela sai da lista para todos
    await navLink(page, 'Coletar').click()
    await expect(page.getByRole('heading', { name: 'Coletar', exact: true })).toBeVisible()
    await expect(item(page, occurrence.quantity)).toHaveCount(0)
  })

  test('a própria ocorrência não tem botão de coletar', async ({ page, request }) => {
    const owner = await createUser(request)
    const occurrence = await createOccurrence(request, owner)
    await signIn(page, owner)

    await page.goto('/coletar')
    const card = item(page, occurrence.quantity)

    await expect(card).toContainText('Sua ocorrência')
    await expect(card.getByRole('button', { name: 'Coletar' })).toHaveCount(0)
  })

  test('visitante vê "Entrar para coletar" e volta para a lista após entrar', async ({
    page,
    request,
  }) => {
    const owner = await createUser(request)
    const visitor = await createUser(request)
    const occurrence = await createOccurrence(request, owner)

    await page.goto('/coletar')
    await item(page, occurrence.quantity).getByRole('link', { name: 'Entrar para coletar' }).click()
    await page.getByLabel('E-mail').fill(visitor.email)
    await page.getByLabel('Senha').fill(visitor.password)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/coletar$/)
    await expect(
      item(page, occurrence.quantity).getByRole('button', { name: 'Coletar' }),
    ).toBeVisible()
  })

  test('se outra pessoa assumiu antes, avisa e tira da lista', async ({ page, request }) => {
    const owner = await createUser(request)
    const fast = await createUser(request)
    const slow = await createUser(request)
    const occurrence = await createOccurrence(request, owner)
    acceptDialogs(page)
    await signIn(page, slow)

    await page.goto('/coletar')
    const card = item(page, occurrence.quantity)
    await expect(card).toBeVisible()

    // Enquanto a lista está aberta, outra pessoa assume
    await occurrenceAction(request, fast, occurrence.id, 'claim')
    await card.getByRole('button', { name: 'Coletar' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'Esta ocorrência não está mais disponível para coleta',
    )
    await expect(card).toHaveCount(0)
    await expect(page).toHaveURL(/\/coletar$/)
  })
})

test('o endereço antigo /lista leva para /coletar', async ({ page }) => {
  await page.goto('/lista')

  await expect(page).toHaveURL(/\/coletar$/)
  await expect(page.getByRole('heading', { name: 'Coletar', exact: true })).toBeVisible()
})
