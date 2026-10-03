import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './stack/config'

// Curitiba: todos os testes "estão" no mesmo lugar, com localização liberada
const geolocation = { latitude: -25.4284, longitude: -49.2733, accuracy: 15 }

export default defineConfig({
  testDir: './tests',
  globalSetup: './stack/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env['CI'] ? 2 : 3,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation,
    permissions: ['geolocation'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
