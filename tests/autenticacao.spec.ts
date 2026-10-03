import { expect, test } from '@playwright/test'
import { createUser, uniqueId } from '../support/api'
import { navLink } from '../support/ui'

test.describe('Autenticação', () => {
  test('CT01 — cadastro válido cria a conta, entra e permite autenticar de novo', async ({
    page,
  }) => {
    const email = `e2e.${uniqueId()}@teste.com`

    await page.goto('/cadastro')
    await page.getByText('Empresa', { exact: true }).click()
    await page.getByLabel('Nome da empresa').fill('Cooperativa Verde')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel(/Senha/).fill('senha-segura-123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page).toHaveURL(/\/mapa$/)
    await navLink(page, 'Perfil').click()
    await expect(page.getByText('Cooperativa Verde')).toBeVisible()
    await expect(page.getByText('Empresa', { exact: true })).toBeVisible()

    // Sai e entra de novo com a mesma conta
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha').fill('senha-segura-123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/mapa$/)
  })

  test('CT02 — e-mail já cadastrado é recusado', async ({ page, request }) => {
    const existing = await createUser(request)

    await page.goto('/cadastro')
    await page.getByLabel('Nome').fill('Outra Pessoa')
    await page.getByLabel('E-mail').fill(existing.email.toUpperCase())
    await page.getByLabel(/Senha/).fill('senha-segura-123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByRole('alert')).toHaveText('E-mail já cadastrado')
    await expect(page).toHaveURL(/\/cadastro$/)
  })

  test('valida os campos do cadastro', async ({ page }) => {
    await page.goto('/cadastro')
    await page.getByLabel('E-mail').fill('nao-e-email')
    await page.getByLabel(/Senha/).fill('123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByText('Nome deve ter ao menos 2 caracteres')).toBeVisible()
    await expect(page.getByText('E-mail inválido')).toBeVisible()
    await expect(page.getByText('Senha deve ter ao menos 8 caracteres')).toBeVisible()
  })

  test('CT03 — login inválido nega o acesso com mensagem adequada', async ({ page, request }) => {
    const user = await createUser(request)

    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos')
    await expect(page).toHaveURL(/\/entrar$/)
  })

  test('rota protegida leva ao login e volta para onde o usuário queria ir', async ({
    page,
    request,
  }) => {
    const user = await createUser(request)

    await page.goto('/historico')
    await expect(page).toHaveURL(/\/entrar$/)

    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha').fill(user.password)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/historico$/)
    await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible()
  })
})
