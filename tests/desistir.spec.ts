// Desistir da coleta: a ocorrência volta para o mapa e a desistência fica no histórico
import { expect, test } from '@playwright/test'
import { createOccurrence, createUser, occurrenceAction, signIn } from '../support/api'
import { acceptDialogs, navLink } from '../support/ui'

test('o coletor desiste e a ocorrência volta a ficar disponível', async ({ page, request }) => {
  const owner = await createUser(request, { name: 'Maria' })
  const collector = await createUser(request, { name: 'João' })
  const { id, quantity } = await createOccurrence(request, owner)
  await occurrenceAction(request, collector, id, 'claim')

  acceptDialogs(page)
  await signIn(page, collector)
  await page.goto(`/ocorrencias/${id}`)

  await page.getByRole('button', { name: 'Desistir da coleta' }).click()

  // Volta a ser uma ocorrência disponível, que a própria pessoa poderia assumir de novo
  await expect(page.getByRole('button', { name: 'Tenho interesse em coletar' })).toBeVisible()
  const history = page.getByRole('region', { name: 'Histórico da ocorrência' })
  await expect(history.getByText('Coleta assumida por você')).toBeVisible()
  await expect(history.getByText('Você desistiu da coleta')).toBeVisible()

  // Aparece de novo na tela Coletar e, no histórico, como desistência
  await navLink(page, 'Coletar').click()
  await expect(page.getByRole('listitem').filter({ hasText: quantity })).toBeVisible()
  await navLink(page, 'Histórico').click()
  await page.getByRole('tab', { name: /Minhas coletas/ }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: quantity }).getByText('Você desistiu'),
  ).toBeVisible()
})

test('o dono vê quando poderá liberar uma coleta parada', async ({ page, request }) => {
  const owner = await createUser(request)
  const collector = await createUser(request, { name: 'João' })
  const { id } = await createOccurrence(request, owner)
  await occurrenceAction(request, collector, id, 'claim')

  await signIn(page, owner)
  await page.goto(`/ocorrencias/${id}`)

  // Antes de 24 h, só o aviso (a liberação em si é coberta pelos testes da API)
  await expect(
    page.getByText(/você poderá liberar a coleta para outras pessoas a partir de/),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Liberar para outras pessoas' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Desistir da coleta' })).toHaveCount(0)
})
