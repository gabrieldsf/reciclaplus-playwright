// Aba Mapa com coletas em andamento: rota com o come-come, troca entre coletas e
// limite de 3 coletas ao mesmo tempo
import { expect, test, type Page } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction, signIn } from '../support/api'
import { acceptDialogs } from '../support/ui'

const START = { latitude: -25.4284, longitude: -49.2733 }
const NORTH = { latitude: -25.4248, longitude: -49.2733 } // ~400 m ao norte
const EAST = { latitude: -25.4284, longitude: -49.2683 } // ~500 m a leste

const chip = (page: Page) => page.getByRole('button', { name: /coletas? em andamento/i })

test.describe('Mapa com coletas em andamento', () => {
  test('sem coleta em andamento, não aparece aviso nem rota', async ({ page, request }) => {
    const user = await createUser(request)
    await signIn(page, user)

    await page.goto('/mapa')
    await expect(page.locator('.leaflet-container')).toBeVisible()

    await expect(chip(page)).toHaveCount(0)
    await expect(page.locator('path.route-dot')).toHaveCount(0)
  })

  test('com uma coleta: aviso, come-come e bolinhas até o material', async ({
    page,
    context,
    request,
  }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const { id } = await createOccurrence(request, owner, { category: 'Metal', location: NORTH })
    await occurrenceAction(request, collector, id, 'claim')
    await context.setGeolocation(START)
    await signIn(page, collector)

    await page.goto('/mapa')

    await expect(chip(page)).toContainText('Coleta em andamento')
    await expect(chip(page)).toContainText(/Rota até 🥫 Metal · (3\d\d|4\d\d) m/)
    await expect(page.getByRole('img', { name: 'Você' })).toBeVisible()
    await expect.poll(() => page.locator('path.route-dot').count()).toBeGreaterThan(0)
  })

  test('com duas coletas: escolher para qual o come-come vai', async ({
    page,
    context,
    request,
  }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const metal = await createOccurrence(request, owner, { category: 'Metal', location: NORTH })
    const vidro = await createOccurrence(request, owner, { category: 'Vidro', location: EAST })
    await occurrenceAction(request, collector, metal.id, 'claim')
    await occurrenceAction(request, collector, vidro.id, 'claim')
    await context.setGeolocation(START)
    await signIn(page, collector)

    await page.goto('/mapa')
    // Começa pela mais próxima (Metal, ~400 m)
    await expect(chip(page)).toContainText('2 coletas em andamento')
    await expect(chip(page)).toContainText('Rota até 🥫 Metal')
    await expect(page.locator('.active-destination')).toHaveCount(2)

    await chip(page).click()
    const sheet = page.getByRole('dialog', { name: /Coletas em andamento \(2\/3\)/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Metal/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await sheet.getByRole('button', { name: /Vidro/ }).click()

    // A rota passa a ir para o vidro, e a escolha é lembrada
    await expect(chip(page)).toContainText('Rota até 🍾 Vidro')
    await chip(page).click()
    await expect(
      page.getByRole('dialog').getByRole('link', { name: /Google Maps/ }),
    ).toHaveAttribute('href', new RegExp(`destination=${EAST.latitude},${EAST.longitude}$`))
    await page.getByRole('button', { name: 'Fechar' }).click()

    await page.reload()
    await expect(chip(page)).toContainText('Rota até 🍾 Vidro')
  })

  test('limite: com 3 coletas em andamento, a 4ª é recusada', async ({ page, request }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const ids: string[] = []
    for (let i = 0; i < 3; i++) ids.push((await createOccurrence(request, owner)).id)
    const fourth = await createOccurrence(request, owner)
    for (const id of ids) await occurrenceAction(request, collector, id, 'claim')
    acceptDialogs(page)
    await signIn(page, collector)

    await page.goto('/coletar')
    const card = page.getByRole('listitem').filter({ hasText: fourth.quantity })
    await card.getByRole('button', { name: 'Coletar' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'Você já tem 3 coletas em andamento. Finalize uma antes de assumir outra.',
    )
    await expect(page).toHaveURL(/\/coletar$/)
  })
})
