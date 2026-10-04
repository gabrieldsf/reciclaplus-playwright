import { expect, test, type Page } from '@playwright/test'
import { createOccurrence, createUser, signIn } from '../support/api'

// PNG válido de 1×1 pixel: o navegador decodifica e redimensiona antes de enviar
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const headerAvatar = (page: Page) =>
  page.getByRole('banner').getByRole('link', { name: 'Perfil' }).locator('img')

test.describe('Foto de perfil', () => {
  test('escolher um avatar de reciclagem atualiza o cabeçalho', async ({ page, request }) => {
    const user = await createUser(request, { name: 'Gabriel' })
    await signIn(page, user)
    await page.goto('/perfil')

    // Sem avatar: inicial do nome
    await expect(headerAvatar(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Avatar Planeta' }).click()

    await expect(page.getByText('Avatar atualizado!')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Avatar Planeta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(headerAvatar(page)).toHaveAttribute('src', '/avatars/planeta.svg')

    // Persiste após recarregar
    await page.reload()
    await expect(headerAvatar(page)).toHaveAttribute('src', '/avatars/planeta.svg')
  })

  test('enviar uma foto do aparelho, que aparece para outras pessoas', async ({
    page,
    browser,
    request,
  }) => {
    const user = await createUser(request)
    await signIn(page, user)
    await page.goto('/perfil')

    await page.getByLabel('Escolher foto do aparelho').setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    })

    await expect(page.getByText('Foto atualizada!')).toBeVisible()
    await expect(headerAvatar(page)).toHaveAttribute('src', /^\/api\/users\/.+\/avatar\?v=\d+$/)
    await expect(page.getByRole('button', { name: 'Trocar foto' })).toBeVisible()

    // A foto foi reduzida no navegador e é servida pela API
    const src = await headerAvatar(page).getAttribute('src')
    const photo = await request.get(src!)
    expect(photo.ok()).toBe(true)
    expect(photo.headers()['content-type']).toMatch(/^image\/(webp|jpeg)$/)

    // Outra pessoa vê a foto ao abrir uma ocorrência dela
    const { id } = await createOccurrence(request, user)
    const visitor = await (await browser.newContext()).newPage()
    await visitor.goto(`/ocorrencias/${id}`)
    await expect(visitor.locator('dd img').first()).toHaveAttribute('src', src!)
  })

  test('remover a foto volta para a inicial do nome', async ({ page, request }) => {
    const user = await createUser(request)
    await signIn(page, user)
    await page.goto('/perfil')
    await page.getByRole('button', { name: 'Avatar Folha' }).click()
    await expect(headerAvatar(page)).toBeVisible()

    await page.getByRole('button', { name: 'Remover' }).click()

    await expect(page.getByText('Foto removida.')).toBeVisible()
    await expect(headerAvatar(page)).toHaveCount(0)
  })

  test('arquivo que não é imagem mostra erro', async ({ page, request }) => {
    const user = await createUser(request)
    await signIn(page, user)
    await page.goto('/perfil')

    await page.getByLabel('Escolher foto do aparelho').setInputFiles({
      name: 'documento.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('não sou uma imagem'),
    })

    await expect(page.getByRole('alert')).toHaveText('Escolha um arquivo de imagem')
  })
})

test('cadastro sugere a correção de e-mail digitado errado', async ({ page }) => {
  await page.goto('/cadastro')
  const email = page.getByLabel('E-mail')

  await email.fill('maria@gmial.com')
  await page.getByLabel(/Senha/).click() // sai do campo

  const suggestion = page.getByRole('button', { name: 'maria@gmail.com' })
  await expect(suggestion).toBeVisible()
  await suggestion.click()

  await expect(email).toHaveValue('maria@gmail.com')
  await expect(suggestion).toHaveCount(0)
})
