import { expect, test, type Page } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction, signIn } from '../support/api'
import { acceptDialogs } from '../support/ui'

const panel = (page: Page) => page.getByRole('region', { name: 'Coleta' })
const claimButton = (page: Page) => page.getByRole('button', { name: 'Tenho interesse em coletar' })

test.describe('Regras de coleta', () => {
  test('CT09 — quem registrou não pode assumir a própria ocorrência', async ({ page, request }) => {
    const owner = await createUser(request)
    const { id } = await createOccurrence(request, owner)

    await signIn(page, owner)
    await page.goto(`/ocorrencias/${id}`)

    await expect(panel(page)).toContainText('Aguardando alguém assumir a coleta.')
    await expect(claimButton(page)).toHaveCount(0)
    // A regra vale na API mesmo sem a interface (RN10)
    expect((await occurrenceAction(request, owner, id, 'claim')).status()).toBe(403)
  })

  test('visitante sem login vê "Entrar para coletar" e volta à ocorrência após entrar', async ({
    page,
    request,
  }) => {
    const owner = await createUser(request)
    const visitor = await createUser(request)
    const { id } = await createOccurrence(request, owner)

    await page.goto(`/ocorrencias/${id}`)
    await panel(page).getByRole('link', { name: 'Entrar para coletar' }).click()
    await page.getByLabel('E-mail').fill(visitor.email)
    await page.getByLabel('Senha').fill(visitor.password)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(new RegExp(`/ocorrencias/${id}$`))
    await expect(claimButton(page)).toBeVisible()
  })

  test('CT08 — dois usuários assumem ao mesmo tempo: apenas um consegue', async ({
    browser,
    request,
  }) => {
    const owner = await createUser(request)
    const { id } = await createOccurrence(request, owner)
    const [ana, bruno] = await Promise.all([createUser(request), createUser(request)])

    const pages = await Promise.all(
      [ana, bruno].map(async (user) => {
        const page = await (await browser.newContext()).newPage()
        acceptDialogs(page)
        await signIn(page, user)
        await page.goto(`/ocorrencias/${id}`)
        await expect(claimButton(page)).toBeVisible()
        return page
      }),
    )

    // Os dois clicam "juntos"
    await Promise.all(pages.map((page) => claimButton(page).click()))

    const results = await Promise.all(
      pages.map(async (page) => {
        const won = panel(page).getByText(/Coleta assumida por você/)
        const lost = panel(page).getByRole('alert')
        await expect(won.or(lost)).toBeVisible()
        return (await won.count()) > 0 ? 'venceu' : await lost.textContent()
      }),
    )

    expect(results.filter((r) => r === 'venceu')).toHaveLength(1)
    expect(results).toContain('Esta ocorrência não está mais disponível para coleta')
    // Quem perdeu tem a tela atualizada mostrando quem assumiu
    const loser = pages[results.indexOf('venceu') === 0 ? 1 : 0]!
    await expect(panel(loser)).toContainText('Coleta assumida por')
    await expect(claimButton(loser)).toHaveCount(0)
  })

  test('CT11 — outro usuário não vê como finalizar a coleta de alguém', async ({
    page,
    request,
  }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const intruder = await createUser(request)
    const { id } = await createOccurrence(request, owner)
    await occurrenceAction(request, collector, id, 'claim')

    await signIn(page, intruder)
    await page.goto(`/ocorrencias/${id}`)

    await expect(panel(page)).toContainText(`Coleta assumida por ${collector.name}`)
    await expect(page.getByRole('button', { name: 'Confirmar coleta' })).toHaveCount(0)
    expect((await occurrenceAction(request, intruder, id, 'complete')).status()).toBe(403)
    expect((await occurrenceAction(request, owner, id, 'complete')).status()).toBe(403)
  })

  test('CT12 — ocorrência já coletada não pode ser assumida novamente', async ({
    page,
    request,
  }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const late = await createUser(request)
    const { id } = await createOccurrence(request, owner)
    await occurrenceAction(request, collector, id, 'claim')
    await occurrenceAction(request, collector, id, 'complete')

    await signIn(page, late)
    await page.goto(`/ocorrencias/${id}`)

    await expect(page.getByText('Coletado', { exact: true })).toBeVisible()
    await expect(claimButton(page)).toHaveCount(0)
    expect((await occurrenceAction(request, late, id, 'claim')).status()).toBe(409)
  })

  test('dono cancela durante a coleta: o coletor não consegue mais finalizar', async ({
    browser,
    request,
  }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const { id } = await createOccurrence(request, owner)
    await occurrenceAction(request, collector, id, 'claim')

    const collectorPage = await (await browser.newContext()).newPage()
    await signIn(collectorPage, collector)
    await collectorPage.goto(`/ocorrencias/${id}`)
    await expect(collectorPage.getByRole('button', { name: 'Confirmar coleta' })).toBeVisible()

    const ownerPage = await (await browser.newContext()).newPage()
    acceptDialogs(ownerPage)
    await signIn(ownerPage, owner)
    await ownerPage.goto(`/ocorrencias/${id}`)
    await ownerPage.getByRole('button', { name: 'Cancelar ocorrência' }).click()
    await expect(panel(ownerPage)).toContainText('cancelada por quem a registrou')

    // O coletor estava com a página aberta e tenta confirmar
    await collectorPage.getByRole('button', { name: 'Confirmar coleta' }).click()
    await expect(panel(collectorPage).getByRole('alert')).toHaveText(
      'Não há coleta em andamento para esta ocorrência',
    )
    await expect(panel(collectorPage)).toContainText('cancelada por quem a registrou')
  })
})
