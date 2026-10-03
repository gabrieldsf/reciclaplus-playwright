# Recicla+ — testes E2E (Playwright)

Testes de ponta a ponta do [Recicla+](../reciclaplus), rodando no navegador como um usuário
real, em **desktop** (Desktop Chrome) e **celular** (Pixel 7).

> O Plano de Projeto previa Cypress; optou-se pelo **Playwright** por suportar vários
> navegadores/contextos simultâneos (essencial para testar dois usuários assumindo a mesma
> coleta ao mesmo tempo — CT08), emulação de dispositivos e geolocalização nativas e
> paralelismo sem custo.

## Pilha isolada

Cada execução sobe sozinha um ambiente descartável e o desliga no final
([stack/global-setup.ts](stack/global-setup.ts)):

```
PostgreSQL temporário (embedded-postgres)
  → migrations + seed das categorias
  → API (porta 3399) → front Vite (porta 5199, /api → 3399)
```

Os testes **nunca** usam o banco da Neon nem interferem no `npm run dev` (3333/5173) ou no
`npm run preview` (4173). Os dados de cada teste usam e-mails únicos, então os testes rodam em
paralelo sem interferir uns nos outros.

## Como rodar

Pré-requisito: o app em `../reciclaplus` com `npm install` feito (ou defina `RECICLAPLUS_DIR`).

```bash
npm install
npm run install:browsers   # baixa o Chromium do Playwright (uma vez)

npm test                   # tudo, desktop + celular
npm run test:mobile        # só celular
npm run test:ui            # modo interativo (bom para apresentar)
npm run test:headed        # vendo o navegador
npm run report             # relatório HTML da última execução
```

## O que é testado

| Arquivo                    | Cobre                                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autenticacao.spec.ts`     | CT01 cadastro (pessoa/empresa) e novo login, CT02 e-mail duplicado, CT03 login inválido, validação de campos, rota protegida                                                           |
| `fluxo-principal.spec.ts`  | **Fluxo da seção 13.2** com dois usuários: login → mapa → criar (CT04–CT06) → marcador → outro usuário assume (CT07) → finaliza (CT10) → status Coletado → linha do tempo → históricos |
| `regras-de-coleta.spec.ts` | CT08 dois usuários clicam ao mesmo tempo, CT09 própria ocorrência, CT11 outro usuário não finaliza, CT12 já coletada, cancelamento durante a coleta, visitante → login → volta         |
| `mapa-e-filtros.spec.ts`   | filtro por categoria (barra lateral / botão Filtrar), só disponíveis no mapa, distância pela geolocalização                                                                            |
| `responsividade.spec.ts`   | sem rolagem horizontal em 9 telas, navegação inferior × superior, alvos de toque ≥ 44px                                                                                                |
| `acessibilidade.spec.ts`   | axe-core (WCAG 2.1 A/AA) em todas as telas, inclusive formulário com erros                                                                                                             |
| `painel.spec.ts`           | números da tela = resposta da API, tabela equivalente a cada gráfico, dica via teclado                                                                                                 |
| `falhas.spec.ts`           | API fora do ar (mapa, login), erro 500, ocorrência inexistente, sessão inválida                                                                                                        |

## Problemas encontrados pelos testes

- **"Sair" levava ao login em vez da página inicial**: a proteção de rotas redirecionava antes
  da navegação terminar. Corrigido no app (rota protegida distingue "acabou de sair").
- **Contraste insuficiente** nos itens inativos da barra inferior do celular (axe,
  `color-contrast`). Corrigido; o item ativo também ganhou negrito e faixa, sem depender só de cor.
