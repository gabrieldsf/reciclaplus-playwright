import { resolve } from 'node:path'

// Pasta do app (monorepo reciclaplus). Por padrão, a pasta irmã deste projeto.
export const APP_DIR = resolve(
  process.env['RECICLAPLUS_DIR'] ?? resolve(__dirname, '../../reciclaplus'),
)

// Portas próprias, para não colidir com o `npm run dev` (3333/5173) nem o preview (4173)
export const API_PORT = Number(process.env['E2E_API_PORT'] ?? 3399)
export const WEB_PORT = Number(process.env['E2E_WEB_PORT'] ?? 5199)
export const BASE_URL = `http://localhost:${WEB_PORT}`
