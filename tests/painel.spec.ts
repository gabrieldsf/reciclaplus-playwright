import { expect, test, type Page } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction } from '../support/api'

// Valor (dd) logo após o rótulo (dt) de cada indicador
function tile(page: Page, label: string) {
  return page
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd[1]')
}

test.describe('Painel de impacto', () => {
  test('mostra os mesmos números que a API devolve', async ({ page, request }) => {
    // Garante ao menos uma ocorrência coletada para os gráficos não ficarem vazios
    const owner = await createUser(request)
    const collector = await createUser(request)
    const { id } = await createOccurrence(request, owner, { category: 'Metal' })
    await occurrenceAction(request, collector, id, 'claim')
    await occurrenceAction(request, collector, id, 'complete')

    // Outros testes rodam em paralelo: compara a tela com a resposta que ela recebeu
    const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/stats'))
    await page.goto('/painel')
    const stats = await (await responsePromise).json()

    await expect(tile(page, 'Ocorrências registradas')).toHaveText(String(stats.occurrences.total))
    await expect(tile(page, 'Coletas concluídas')).toHaveText(String(stats.occurrences.COLLECTED))
    await expect(tile(page, 'Disponíveis agora')).toHaveText(String(stats.occurrences.AVAILABLE))
    expect(stats.occurrences.COLLECTED).toBeGreaterThanOrEqual(1)

    const metal = stats.byCategory.find((c: { name: string }) => c.name === 'Metal')
    await expect(
      page.getByRole('listitem', {
        name: `Metal: ${metal.total} registradas, ${metal.collected} coletadas`,
        exact: true,
      }),
    ).toBeVisible()
  })

  test('cada gráfico tem uma tabela equivalente', async ({ page }) => {
    await page.goto('/painel')

    const weekly = page.getByRole('region', { name: 'Atividade nas últimas 8 semanas' })
    await weekly.getByRole('button', { name: 'Ver tabela' }).click()
    await expect(weekly.getByRole('table')).toBeVisible()
    await expect(weekly.getByRole('row')).toHaveCount(9) // cabeçalho + 8 semanas

    const byCategory = page.getByRole('region', { name: 'Ocorrências por categoria' })
    await byCategory.getByRole('button', { name: 'Ver tabela' }).click()
    await expect(byCategory.getByRole('row')).toHaveCount(8) // cabeçalho + 7 categorias
  })

  test('dica aparece ao focar uma barra pelo teclado', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover/teclado: só no desktop')
    await page.goto('/painel')

    await page.getByRole('listitem', { name: /^Plástico:/ }).focus()
    await expect(page.getByRole('tooltip')).toContainText('Plástico')
  })
})
