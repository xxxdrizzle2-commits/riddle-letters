import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const previewConfigPath = join(root, 'wrangler.v3-preview.jsonc')
const runtimeConfigPath = join(root, 'wrangler.jsonc')
const wranglerPath = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const previewConfig = readFileSync(previewConfigPath, 'utf8')

if (existsSync(runtimeConfigPath)) {
  const currentConfig = readFileSync(runtimeConfigPath, 'utf8')
  if (currentConfig !== previewConfig) {
    throw new Error('检测到已有 wrangler.jsonc，未覆盖它。请先确认该文件用途。')
  }
}

writeFileSync(runtimeConfigPath, previewConfig, 'utf8')

function cleanupRuntimeConfig() {
  if (!existsSync(runtimeConfigPath)) return
  if (readFileSync(runtimeConfigPath, 'utf8') === previewConfig) unlinkSync(runtimeConfigPath)
}

const child = spawn(
  process.execPath,
  [wranglerPath, 'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', '8788'],
  { cwd: root, env: process.env, stdio: 'inherit' },
)

let stopping = false
function stop(signal) {
  if (stopping) return
  stopping = true
  child.kill(signal)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

child.on('error', (error) => {
  cleanupRuntimeConfig()
  throw error
})

child.on('exit', (code, signal) => {
  cleanupRuntimeConfig()
  if (signal) process.kill(process.pid, signal)
  process.exitCode = code ?? 1
})

