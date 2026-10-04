// Sininho de notificações: número de avisos não lidos e lista de atualizações
import { expect, test } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction, signIn } from '../support/api'

test('o dono vê no sininho quando assumem e coletam o material', async ({ page, request }) => {
  const owner = await createUser(request, { name: 'Maria' })
  const collector = await createUser(request, { name: 'João' })
  const { id, quantity } = await createOccurrence(request, owner)

  await signIn(page, owner)
  await page.goto('/mapa')
  const bell = page.getByRole('link', { name: /^Notificações/ })
  await expect(bell).toHaveAccessibleName('Notificações')

  await occurrenceAction(request, collector, id, 'claim')
  await occurrenceAction(request, collector, id, 'complete')

  // O número atualiza ao trocar de tela
  await page.goto('/coletar')
  await expect(bell).toHaveAccessibleName('Notificações (2 não lidas)')
  await expect(bell).toContainText('2')

  await bell.click()
  await expect(page).toHaveURL(/\/notificacoes$/)
  const items = page.getByRole('listitem')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText(`${collector.name} coletou o seu material`)
  await expect(items.nth(0)).toContainText(quantity)
  await expect(items.nth(1)).toContainText(`${collector.name} assumiu a coleta do seu material`)

  // Abrir a lista marca como vistas: o número some
  await expect(bell).toHaveAccessibleName('Notificações')

  // Tocar no aviso abre a ocorrência com o histórico completo
  await items.nth(0).click()
  await expect(page).toHaveURL(new RegExp(`/ocorrencias/${id}$`))
  const history = page.getByRole('region', { name: 'Histórico da ocorrência' })
  await expect(history.getByText(`Coleta assumida por ${collector.name}`)).toBeVisible()
  await expect(history.getByText('Material coletado')).toBeVisible()
})

test('o coletor é avisado quando o dono cancela a ocorrência', async ({ page, request }) => {
  const owner = await createUser(request, { name: 'Maria' })
  const collector = await createUser(request, { name: 'João' })
  const { id } = await createOccurrence(request, owner)
  await occurrenceAction(request, collector, id, 'claim')
  await occurrenceAction(request, owner, id, 'cancel')

  await signIn(page, collector)
  await page.goto('/notificacoes')

  await expect(page.getByRole('listitem').first()).toContainText(
    `${owner.name} cancelou a ocorrência que você ia coletar`,
  )
})

test('sem notificações: mensagem explicando', async ({ page, request }) => {
  await signIn(page, await createUser(request))
  await page.goto('/notificacoes')

  await expect(page.getByText('Nenhuma notificação ainda.', { exact: false })).toBeVisible()
})
