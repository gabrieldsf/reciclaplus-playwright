// Sobe uma pilha isolada do Recicla+ para os testes E2E:
//   PostgreSQL temporário → migrations + seed → API → front (Vite)
// Nada aqui toca o banco da Neon: DATABASE_URL e DIRECT_URL são sempre locais.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import { API_PORT, APP_DIR, BASE_URL, WEB_PORT } from './config'

const DB_NAME = 'reciclaplus_e2e'

// Ao encerrar a pilha, o kill forçado gera código de saída ≠ 0: não é erro
let stopping = false

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolve(port))
    })
  })
}

// Executa um script de node_modules do app (sem shell, para ter o PID real)
function nodeBin(relativePath: string) {
  return join(APP_DIR, 'node_modules', relativePath)
}

function start(name: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const output: string[] = []
  child.stdout?.on('data', (d) => output.push(String(d)))
  child.stderr?.on('data', (d) => output.push(String(d)))
  child.on('exit', (code) => {
    if (code && code !== 0 && !stopping)
      console.error(`[${name}] saiu com código ${code}\n${output.join('')}`)
  })
  return child
}

function killTree(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null) return
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      // já encerrado
    }
  } else {
    child.kill('SIGTERM')
  }
}

async function waitFor(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Timeout esperando ${url}`)
}

export default async function globalSetup() {
  const databaseDir = mkdtempSync(join(tmpdir(), 'reciclaplus-e2e-pg-'))
  const pgPort = await freePort()
  const pg = new EmbeddedPostgres({
    databaseDir,
    port: pgPort,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => {},
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase(DB_NAME)

  const databaseUrl = `postgresql://postgres:postgres@localhost:${pgPort}/${DB_NAME}`
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Os dois precisam ser definidos: o prisma.config.ts do app carrega o .env da
    // Neon com dotenv, que só não sobrescreve variáveis que já existem
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    JWT_SECRET: 'e2e-secret',
    PORT: String(API_PORT),
    CORS_ORIGIN: BASE_URL,
    API_URL: `http://localhost:${API_PORT}`,
  }
  const apiDir = join(APP_DIR, 'api')
  const webDir = join(APP_DIR, 'web')

  const processes: ChildProcess[] = []
  try {
    const run = (args: string[]) =>
      execFileSync(process.execPath, args, { cwd: apiDir, env, stdio: 'pipe' })
    run([nodeBin('prisma/build/index.js'), 'migrate', 'deploy'])
    // Seed chamado direto pelo tsx do app (o "prisma db seed" depende do PATH do npm)
    run([nodeBin('tsx/dist/cli.mjs'), 'prisma/seed.ts'])

    processes.push(start('api', [nodeBin('tsx/dist/cli.mjs'), 'src/server.ts'], apiDir, env))
    processes.push(
      start(
        'web',
        [nodeBin('vite/bin/vite.js'), '--port', String(WEB_PORT), '--strictPort'],
        webDir,
        env,
      ),
    )

    // Health pelo proxy do Vite: confirma front → API → banco de uma vez
    await waitFor(`${BASE_URL}/api/health`, 60_000)
  } catch (err) {
    stopping = true
    processes.forEach(killTree)
    await pg.stop()
    rmSync(databaseDir, { recursive: true, force: true })
    throw err
  }

  return async () => {
    stopping = true
    processes.forEach(killTree)
    // Derruba conexões abertas para o Postgres não ficar esperando ao desligar
    const client = pg.getPgClient()
    await client.connect()
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid()',
    )
    await client.end()
    await pg.stop()
    rmSync(databaseDir, { recursive: true, force: true })
  }
}
