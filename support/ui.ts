import { expect, type Page } from '@playwright/test'

// Confirma automaticamente os window.confirm() (assumir coleta, cancelar ocorrência)
export function acceptDialogs(page: Page) {
  page.on('dialog', (dialog) => void dialog.accept())
}

// Marcador do mapa pelo título acessível, ex.: "Plástico · 12 kg"
export function marker(page: Page, title: string) {
  return page.locator(`.leaflet-marker-icon[title="${title}"]`)
}

// Marcadores podem se sobrepor (todos os testes "estão" em Curitiba): o clique é
// disparado direto no elemento, como faria um toque exatamente sobre ele
export async function openMarkerDetails(page: Page, title: string) {
  await marker(page, title).dispatchEvent('click')
  const popup = page.locator('.leaflet-popup')
  await expect(popup).toContainText(title.split(' · ')[0]!)
  await popup.getByRole('link', { name: 'Ver detalhes' }).click()
  await expect(page).toHaveURL(/\/ocorrencias\/[^/]+$/)
}

// Navegação principal: no celular fica na barra inferior; no desktop, no topo.
// O getByRole ignora a versão escondida, então funciona nos dois.
export function navLink(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name })
}
