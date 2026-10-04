// Fotos: ao informar o material e ao finalizar a coleta; aparecem em Coletar e no Histórico
import { expect, test } from '@playwright/test'
import { createUser, signIn, uniqueId } from '../support/api'
import { acceptDialogs, navLink } from '../support/ui'

// PNG válido de 1×1 pixel (o navegador decodifica, reduz e reenvia como WebP/JPEG)
const PNG = {
  name: 'foto.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
}
const PHOTO_SRC = /^\/api\/photos\/[0-9a-f-]{36}$/

test('foto ao informar e ao finalizar, visível em Coletar e no Histórico', async ({
  browser,
  request,
}) => {
  const owner = await createUser(request, { name: 'Maria' })
  const collector = await createUser(request, { name: 'João' })
  const quantity = `${uniqueId()} kg`

  const m = await (await browser.newContext()).newPage()
  const j = await (await browser.newContext()).newPage()
  acceptDialogs(j)
  await signIn(m, owner)
  await signIn(j, collector)

  await test.step('Maria informa com foto', async () => {
    await m.goto('/informar')
    await expect(m.getByText(/Precisão da sua localização/)).toBeVisible()
    await m.getByLabel('Categoria *').selectOption({ label: 'Doação' })
    await m.getByLabel('Quantidade estimada').fill(quantity)
    await m.getByLabel(/Foto do material/).setInputFiles(PNG)
    await expect(m.getByAltText('Prévia da foto')).toHaveAttribute('src', PHOTO_SRC)
    await m.getByRole('button', { name: /Publicar ocorrência/i }).click()

    await expect(m.getByText('Ocorrência publicada!', { exact: false })).toBeVisible()
    await expect(m.getByAltText('Foto do material: Doação')).toHaveAttribute('src', PHOTO_SRC)
  })

  await test.step('João vê a foto na tela Coletar e assume', async () => {
    await j.goto('/coletar')
    const card = j.getByRole('listitem').filter({ hasText: quantity })
    await expect(card.getByAltText('Foto do material: Doação')).toHaveAttribute('src', PHOTO_SRC)
    await card.getByRole('button', { name: 'Coletar' }).click()
    await expect(j).toHaveURL(/\/ocorrencias\//)
  })

  await test.step('João finaliza com a foto da coleta', async () => {
    await j.getByLabel(/Foto da coleta/).setInputFiles(PNG)
    await expect(j.getByAltText('Prévia da foto')).toBeVisible()
    await j.getByRole('button', { name: 'Confirmar coleta' }).click()

    const panel = j.getByRole('region', { name: 'Coleta' })
    await expect(panel.getByAltText('Foto do material coletado')).toHaveAttribute('src', PHOTO_SRC)
  })

  await test.step('as fotos aparecem no Histórico dos dois', async () => {
    await navLink(m, 'Histórico').click()
    const mariaCard = m.getByRole('listitem').filter({ hasText: quantity })
    await expect(mariaCard.getByAltText('Foto do material: Doação')).toBeVisible()
    await expect(mariaCard.getByAltText('Foto da coleta')).toBeVisible()

    await navLink(j, 'Histórico').click()
    await j.getByRole('tab', { name: /Minhas coletas/ }).click()
    const joaoCard = j.getByRole('listitem').filter({ hasText: quantity })
    await expect(joaoCard.getByAltText('Foto do material: Doação')).toBeVisible()
    await expect(joaoCard.getByAltText('Foto da coleta')).toBeVisible()
  })
})

test('dá para remover a foto antes de publicar', async ({ page, request }) => {
  const user = await createUser(request)
  await signIn(page, user)
  await page.goto('/informar')

  await page.getByLabel(/Foto do material/).setInputFiles(PNG)
  await expect(page.getByAltText('Prévia da foto')).toBeVisible()
  await page.getByRole('button', { name: 'Remover' }).click()

  await expect(page.getByAltText('Prévia da foto')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Adicionar foto/ })).toBeVisible()
})
