import { build } from 'esbuild'

for (const [entry, outfile] of [['index.ts', '../cloudfunctions/riddle-v1/index.cjs'], ['activation.ts', '../cloudfunctions/riddle-v1-activate/index.cjs']]) await build({
  entryPoints: [entry],
  outfile,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  bundle: true,
  external: ['@cloudbase/node-sdk', '@cloudbase/manager-node', 'sharp'],
  sourcemap: false,
  minify: false,
  logLevel: 'info',
})
