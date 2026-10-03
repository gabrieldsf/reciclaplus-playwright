// Acessibilidade básica com axe-core (regras WCAG 2.1 A/AA).
// Falham os problemas de impacto "serious" e "critical".
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction, signIn } from '../support/api'

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Imagens de fundo do mapa (OpenStreetMap) são de terceiros
    .exclude('.leaflet-tile-pane')
    .analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      regra: v.id,
      impacto: v.impact,
      descricao: v.help,
      elementos: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    }))
}

test.describe('Acessibilidade (axe)', () => {
  for (const path of ['/', '/entrar', '/cadastro', '/mapa', '/painel']) {
    test(`página pública ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(await seriousViolations(page)).toEqual([])
    })
  }

  test('páginas autenticadas', async ({ page, request }) => {
    const owner = await createUser(request)
    const collector = await createUser(request)
    const { id } = await createOccurrence(request, owner)
    await occurrenceAction(request, collector, id, 'claim')
    await signIn(page, owner)

    for (const path of ['/informar', '/historico', '/perfil', `/ocorrencias/${id}`]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(await seriousViolations(page), path).toEqual([])
    }
  })

  test('formulário com erros continua acessível', async ({ page }) => {
    await page.goto('/cadastro')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('E-mail inválido')).toBeVisible()

    // Campos inválidos são anunciados e ligados às mensagens de erro
    const email = page.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('E-mail inválido')
    expect(await seriousViolations(page)).toEqual([])
  })
})
