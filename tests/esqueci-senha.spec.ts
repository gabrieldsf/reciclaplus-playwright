// Esqueci minha senha: código por e-mail, senha nova e entrada direta no app
import { expect, test } from '@playwright/test'
import { createUser, lastCodeSentTo } from '../support/api'

test('troca a senha com o código recebido e entra no app', async ({ page, request }) => {
  const user = await createUser(request)

  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible()

  await page.getByLabel('E-mail').fill(user.email)
  await page.getByRole('button', { name: 'Enviar código' }).click()

  await expect(page.getByRole('heading', { name: 'Criar nova senha' })).toBeVisible()
  await expect(page.getByText(user.email)).toBeVisible()
  await expect(page.getByRole('button', { name: /Reenviar código em \d+ s/ })).toBeDisabled()

  // Código errado: mensagem com as tentativas restantes
  const code = await lastCodeSentTo(request, user.email)
  await page.getByLabel('Código').fill(code === '000000' ? '111111' : '000000')
  await page.getByLabel('Nova senha').fill('nova-senha-456')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.getByRole('alert')).toHaveText('Código incorreto. Restam 4 tentativas.')

  await page.getByLabel('Código').fill(code)
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page).toHaveURL(/\/mapa$/)

  // A senha nova vale no login; a antiga, não
  const old = await request.post('/api/auth/login', {
    data: { email: user.email, password: user.password },
  })
  expect(old.status()).toBe(401)
  const fresh = await request.post('/api/auth/login', {
    data: { email: user.email, password: 'nova-senha-456' },
  })
  expect(fresh.status()).toBe(200)
})

test('e-mail sem conta: mesma tela, sem revelar que não existe', async ({ page }) => {
  await page.goto('/esqueci-senha')
  await page.getByLabel('E-mail').fill('ninguem.aqui@teste.com')
  await page.getByRole('button', { name: 'Enviar código' }).click()

  await expect(page.getByRole('heading', { name: 'Criar nova senha' })).toBeVisible()
  await page.getByRole('button', { name: 'Usar outro e-mail' }).click()
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible()
})
