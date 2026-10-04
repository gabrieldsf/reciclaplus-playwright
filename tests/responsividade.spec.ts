import { expect, test } from '@playwright/test'
import { createOccurrence, createUser, signIn } from '../support/api'

test.describe('Responsividade', () => {
  test('nenhuma tela tem rolagem horizontal', async ({ page, request }) => {
    const user = await createUser(request)
    const { id } = await createOccurrence(request, user)
    await signIn(page, user)

    for (const path of [
      '/',
      '/entrar',
      '/cadastro',
      '/mapa',
      '/painel',
      '/coletar',
      '/informar',
      '/historico',
      '/perfil',
      `/ocorrencias/${id}`,
    ]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          main: main.scrollWidth - main.clientWidth,
        }
      })
      expect(overflow, `rolagem horizontal em ${path}`).toEqual({ page: 0, main: 0 })
    }
  })

  test('navegação: barra inferior no celular, menu no topo no desktop', async ({
    page,
    request,
    isMobile,
  }) => {
    const user = await createUser(request)
    await signIn(page, user)
    await page.goto('/mapa')

    const header = page.getByRole('banner').getByRole('navigation')
    const bottomBar = page.locator('body > div nav').last()

    if (isMobile) {
      await expect(header).toBeHidden()
      await expect(bottomBar).toBeVisible()
      const box = await bottomBar.boundingBox()
      const viewport = page.viewportSize()!
      expect(box!.y + box!.height).toBeCloseTo(viewport.height, 0)
    } else {
      await expect(header).toBeVisible()
      await expect(bottomBar).toBeHidden()
    }
    // Ordem: "Coletar" logo ao lado de "Informar"
    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link'),
    ).toHaveText([/Mapa/, /Painel/, /Informar/, /Coletar/, /Histórico/])

    // Perfil fica no canto superior direito, em qualquer tamanho de tela
    const profile = page.getByRole('banner').getByRole('link', { name: 'Perfil' })
    await expect(profile).toBeVisible()
    const box = await profile.boundingBox()
    expect(box!.y).toBeLessThan(80)
    expect(box!.x + box!.width).toBeGreaterThan(page.viewportSize()!.width - 80)
  })

  test('alvos de toque da barra inferior têm ao menos 44px de altura', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'só se aplica ao celular')
    await page.goto('/mapa')

    const links = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link')
    for (const link of await links.all()) {
      const box = await link.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test('o botão ➕ Informar não fica escondido atrás do mapa', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'o botão elevado só existe no celular')
  await page.goto('/mapa')
  await page.locator('.leaflet-container').waitFor()

  const informar = page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Informar' })
  // O círculo "sobe" acima da barra; testa um ponto na parte de cima dele
  const circle = informar.locator('span').first()
  const box = (await circle.boundingBox())!
  const covered = await page.evaluate(
    ({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      return !hit?.closest('a[href="/informar"]')
    },
    { x: box.x + box.width / 2, y: box.y + 6 },
  )

  expect(covered, 'algo está desenhado por cima do botão ➕').toBe(false)
})
