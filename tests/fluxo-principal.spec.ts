// Fluxo principal do Plano de Projeto (seção 13.2):
// Login → Abrir mapa → Criar ocorrência → Validar marcador → Segundo usuário acessa →
// Visualiza ocorrência → Assume coleta → Finaliza coleta → Validar status → Validar histórico
import { expect, test } from '@playwright/test'
import { createUser, uniqueId } from '../support/api'
import { acceptDialogs, marker, navLink, openMarkerDetails } from '../support/ui'

// Seção da página de detalhes com a situação e as ações da coleta
const collectionPanel = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Coleta' })

test('fluxo completo: informar, assumir, finalizar e registrar no histórico', async ({
  browser,
  request,
}) => {
  const maria = await createUser(request, { name: 'Maria' })
  const joao = await createUser(request, { name: 'João' })
  const quantity = `${uniqueId()} kg`
  const title = `Papel / Papelão · ${quantity}`

  // Cada pessoa no seu próprio navegador
  const mariaCtx = await browser.newContext()
  const joaoCtx = await browser.newContext()
  const m = await mariaCtx.newPage()
  const j = await joaoCtx.newPage()
  acceptDialogs(m)
  acceptDialogs(j)

  await test.step('Maria faz login', async () => {
    await m.goto('/entrar')
    await m.getByLabel('E-mail').fill(maria.email)
    await m.getByLabel('Senha').fill(maria.password)
    await m.getByRole('button', { name: 'Entrar' }).click()
    await expect(m).toHaveURL(/\/mapa$/)
  })

  await test.step('Maria informa um reciclável (CT05/CT06: obrigatórios validados)', async () => {
    await navLink(m, 'Informar').click()
    await expect(m.getByText(/Precisão da sua localização/)).toBeVisible()

    // Envio sem categoria → bloqueado
    await m.getByRole('button', { name: /Publicar ocorrência/i }).click()
    await expect(m.getByText('Selecione uma categoria')).toBeVisible()

    await m.getByLabel('Categoria *').selectOption({ label: 'Papel / Papelão' })
    await m.getByLabel('Subcategoria').selectOption({ label: 'Papelão' })
    await m.getByLabel('Quantidade estimada').fill(quantity)
    await m.getByLabel('Observações').fill('Caixas desmontadas na portaria')
    await m.getByRole('button', { name: /Publicar ocorrência/i }).click()

    await expect(m.getByText('Ocorrência publicada! Ela já aparece no mapa.')).toBeVisible()
    await expect(m.getByText('Disponível', { exact: true })).toBeVisible() // CT04
  })

  await test.step('o marcador aparece no mapa', async () => {
    await navLink(m, 'Mapa').click()
    await expect(marker(m, title)).toBeAttached()
  })

  await test.step('João entra, vê a ocorrência no mapa e abre os detalhes', async () => {
    await j.goto('/entrar')
    await j.getByLabel('E-mail').fill(joao.email)
    await j.getByLabel('Senha').fill(joao.password)
    await j.getByRole('button', { name: 'Entrar' }).click()
    await expect(j).toHaveURL(/\/mapa$/)

    await expect(marker(j, title)).toBeAttached()
    await openMarkerDetails(j, title)
    await expect(j.getByText('Caixas desmontadas na portaria')).toBeVisible()
    // "Informada por" mostra o nome de quem registrou
    await expect(j.locator('dd', { hasText: maria.name })).toBeVisible()
  })

  await test.step('João assume a coleta (CT07)', async () => {
    await j.getByRole('button', { name: 'Tenho interesse em coletar' }).click()
    await expect(collectionPanel(j)).toContainText('Coleta assumida por você')
    await expect(j.getByText('Em coleta', { exact: true })).toBeVisible()
  })

  await test.step('Maria vê quem assumiu; a ocorrência sai do mapa', async () => {
    await m.reload()
    await expect(marker(m, title)).toHaveCount(0)
    await m.goto(j.url())
    await expect(collectionPanel(m)).toContainText(`Coleta assumida por ${joao.name}`)
  })

  await test.step('João finaliza a coleta (CT10)', async () => {
    await j.getByLabel('Quantidade coletada').fill('18 kg')
    await j.getByLabel('Observação').fill('Retirado sem problemas')
    await j.getByRole('button', { name: 'Confirmar coleta' }).click()
    await expect(j.getByText('Coletado', { exact: true })).toBeVisible()
    await expect(collectionPanel(j)).toContainText('Coletado por você')
  })

  await test.step('status COLETADO e linha do tempo completa', async () => {
    await m.reload()
    await expect(m.getByText('Coletado', { exact: true })).toBeVisible()
    const timeline = m.getByRole('region', { name: 'Histórico da ocorrência' })
    await expect(timeline.getByRole('listitem')).toHaveText([
      /Registrada por você/,
      new RegExp(`Coleta assumida por ${joao.name}`),
      /Material coletado/,
    ])
  })

  await test.step('histórico de Maria e de João registram as ações', async () => {
    await navLink(m, 'Histórico').click()
    const mariaCard = m.getByRole('listitem').filter({ hasText: quantity })
    await expect(mariaCard).toContainText('Coletado')
    await expect(mariaCard).toContainText(`Coletada por ${joao.name}`)

    await navLink(j, 'Histórico').click()
    await j.getByRole('tab', { name: /Minhas coletas/ }).click()
    const joaoCard = j.getByRole('listitem').filter({ hasText: quantity })
    await expect(joaoCard).toContainText('Concluída')
    await expect(joaoCard).toContainText('18 kg')
  })

  await mariaCtx.close()
  await joaoCtx.close()
})
