import { expect, test } from '@playwright/test'
import { createOccurrence, createUser, lastCodeSentTo, signIn } from '../support/api'

test.describe('Confirmação de e-mail', () => {
  test('sem confirmar: aviso no topo e Informar bloqueado; depois de confirmar, libera', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, { verified: false })
    await signIn(page, user)

    await page.goto('/mapa')
    await expect(page.getByText('Confirme seu e-mail para informar e coletar.')).toBeVisible()

    await page.goto('/informar')
    await expect(page.getByText(/Para informar um reciclável, confirme primeiro/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Publicar ocorrência/i })).toHaveCount(0)

    // Confirma e volta para onde estava
    await page.getByRole('link', { name: 'Confirmar e-mail' }).click()
    await expect(page).toHaveURL(/\/confirmar-email$/)
    await page.getByLabel('Código').fill(await lastCodeSentTo(request, user.email))
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page).toHaveURL(/\/informar$/)
    await expect(page.getByRole('button', { name: /Publicar ocorrência/i })).toBeVisible()
    await expect(page.getByText('Confirme seu e-mail para informar e coletar.')).toHaveCount(0)
  })

  test('sem confirmar não dá para coletar', async ({ page, request }) => {
    const owner = await createUser(request)
    const occurrence = await createOccurrence(request, owner)
    const user = await createUser(request, { verified: false })
    await signIn(page, user)

    await page.goto(`/ocorrencias/${occurrence.id}`)
    await expect(page.getByRole('link', { name: 'Confirme seu e-mail para coletar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tenho interesse em coletar' })).toHaveCount(0)

    await page.goto('/coletar')
    const card = page.getByRole('listitem').filter({ hasText: occurrence.quantity })
    await expect(card.getByRole('link', { name: 'Confirme o e-mail para coletar' })).toBeVisible()
  })

  test('código errado mostra quantas tentativas restam', async ({ page, request }) => {
    const user = await createUser(request, { verified: false })
    await signIn(page, user)
    const right = await lastCodeSentTo(request, user.email)

    await page.goto('/confirmar-email')
    await page.getByLabel('Código').fill(right === '000000' ? '111111' : '000000')
    await page.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByRole('alert')).toHaveText('Código incorreto. Restam 4 tentativas.')
    await expect(page.getByLabel('Código')).toHaveValue('')
  })

  test('o campo aceita só números e no máximo 6', async ({ page, request }) => {
    const user = await createUser(request, { verified: false })
    await signIn(page, user)
    await page.goto('/confirmar-email')

    await page.getByLabel('Código').pressSequentially('12a3-45678')

    await expect(page.getByLabel('Código')).toHaveValue('123456')
  })

  test('reenviar só libera depois da contagem', async ({ page, request }) => {
    const user = await createUser(request, { verified: false })
    await signIn(page, user)
    await page.goto('/confirmar-email')

    await expect(page.getByRole('button', { name: /Reenviar código em \d+ s/ })).toBeDisabled()
  })

  test('"Confirmar depois" deixa usar o app (só leitura)', async ({ page, request }) => {
    const user = await createUser(request, { verified: false })
    await signIn(page, user)
    await page.goto('/confirmar-email')

    await page.getByRole('link', { name: 'Confirmar depois' }).click()

    await expect(page).toHaveURL(/\/mapa$/)
    await expect(page.getByText('Confirme seu e-mail para informar e coletar.')).toBeVisible()
  })
})
