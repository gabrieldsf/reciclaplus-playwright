// Atalhos pela API para preparar cenários rapidamente (o que está sendo testado
// é sempre feito pela interface; a API só monta o "antes")
import type { APIRequestContext, Page } from '@playwright/test'

export type TestUser = { id: string; name: string; email: string; password: string; token: string }

let counter = 0

// Sufixo único por execução/worker, para os testes não interferirem entre si
export function uniqueId() {
  counter += 1
  return `${Date.now().toString(36)}${process.pid.toString(36)}${counter}`
}

export async function createUser(
  request: APIRequestContext,
  { name = 'Pessoa Teste', userType = 'PERSON' }: { name?: string; userType?: string } = {},
): Promise<TestUser> {
  const id = uniqueId()
  const email = `e2e.${id}@teste.com`
  const password = 'senha-segura-123'
  const res = await request.post('/api/auth/register', {
    data: { name: `${name} ${id}`, email, password, userType },
  })
  if (!res.ok()) throw new Error(`Cadastro falhou: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  return { id: body.user.id, name: body.user.name, email, password, token: body.token }
}

// Entra sem passar pela tela de login (usado quando o login não é o foco do teste)
export async function signIn(page: Page, user: TestUser) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('reciclaplus:token', token)
  }, user.token)
}

const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` })

export async function categoryId(request: APIRequestContext, name: string) {
  const { categories } = await (await request.get('/api/categories')).json()
  const category = categories.find((c: { name: string }) => c.name === name)
  if (!category) throw new Error(`Categoria não encontrada: ${name}`)
  return category.id as number
}

export async function createOccurrence(
  request: APIRequestContext,
  owner: TestUser,
  {
    category = 'Plástico',
    quantity = `${uniqueId()} kg`,
  }: { category?: string; quantity?: string } = {},
) {
  const res = await request.post('/api/occurrences', {
    headers: auth(owner),
    data: {
      categoryId: await categoryId(request, category),
      estimatedQuantity: quantity,
      description: 'Criada pelo teste E2E',
      latitude: -25.4284 + (Math.random() - 0.5) / 100,
      longitude: -49.2733 + (Math.random() - 0.5) / 100,
    },
  })
  if (!res.ok()) throw new Error(`Criar ocorrência falhou: ${res.status()} ${await res.text()}`)
  const { occurrence } = await res.json()
  return { id: occurrence.id as string, quantity, category }
}

export function occurrenceAction(
  request: APIRequestContext,
  user: TestUser,
  id: string,
  action: 'claim' | 'complete' | 'cancel',
) {
  return request.post(`/api/occurrences/${id}/${action}`, { headers: auth(user), data: {} })
}
