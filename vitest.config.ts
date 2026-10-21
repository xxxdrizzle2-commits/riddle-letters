import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'media-worker/**/*.test.ts'], environment: 'node' } })
