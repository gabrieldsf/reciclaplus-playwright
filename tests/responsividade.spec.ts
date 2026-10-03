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
    for (const name of ['Mapa', 'Painel', 'Informar', 'Histórico', 'Perfil']) {
      await expect(
        page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name }),
      ).toBeVisible()
    }
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
