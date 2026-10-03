// Cenários de falha de conexão e erros da API (Plano de Projeto, seção 13.3)
import { expect, test } from '@playwright/test'
import { createUser } from '../support/api'

const OFFLINE = 'Não foi possível conectar ao servidor. Verifique sua conexão.'

test.describe('Falhas de conexão e erros da API', () => {
  test('mapa sem conexão com a API mostra aviso', async ({ page }) => {
    await page.route('**/api/occurrences*', (route) => route.abort('internetdisconnected'))
    await page.goto('/mapa')

    await expect(page.getByRole('alert')).toHaveText(OFFLINE)
  })

  test('login sem conexão mostra aviso e não sai da tela', async ({ page, request }) => {
    const user = await createUser(request)
    await page.route('**/api/auth/login', (route) => route.abort('internetdisconnected'))

    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha').fill(user.password)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toHaveText(OFFLINE)
    await expect(page).toHaveURL(/\/entrar$/)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  test('erro interno da API é exibido sem quebrar a tela', async ({ page }) => {
    await page.route('**/api/stats', (route) =>
      route.fulfill({ status: 500, json: { message: 'Erro interno do servidor' } }),
    )
    await page.goto('/painel')

    await expect(page.getByRole('alert')).toHaveText('Erro interno do servidor')
    await expect(page.getByRole('heading', { name: 'Painel de impacto' })).toBeVisible()
  })

  test('ocorrência inexistente mostra mensagem', async ({ page }) => {
    await page.goto('/ocorrencias/00000000-0000-4000-8000-000000000000')

    await expect(page.getByRole('alert')).toHaveText('Ocorrência não encontrada')
  })

  test('sessão expirada/inválida volta para o login', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('reciclaplus:token', 'token-invalido'))
    await page.goto('/historico')

    await expect(page).toHaveURL(/\/entrar$/)
    expect(await page.evaluate(() => localStorage.getItem('reciclaplus:token'))).toBeNull()
  })
})
