// Regenerate ./package.json: every workspace package reachable from the dsh CLI
// over dependencies, optionalDependencies AND peerDependencies.
//
// Why a separate deploy root: `pnpm deploy` of @deepseek-ai/dsh copies the CLI's
// dependency subgraph only. In-box plugins declare their contracts as workspace
// peers (dsh-tool-fs → dsh-fs, dsh-sandbox, schemastery …), and the workspace
// satisfies those from the root's hoisted node_modules — a deployed tree has no
// such root, so the peers vanish and the first `import` of a plugin fails. This
// manifest names the peer closure explicitly, so
//
//   pnpm --filter @deepseek-ai/dsh-closure deploy --legacy --prod <dir>
//
// yields a tree that boots with plain Node. Same idea as python/sdk-runtime,
// which is the deploy root of the single-exe build; this one closes over the
// full CLI (web app included) for desktop shells.
//
//   node apps/closure/sync.mjs          # rewrite package.json
//   node apps/closure/sync.mjs --check  # exit 1 when package.json is stale
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const workspace = readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
const globs = [...workspace.matchAll(/^\s+-\s+(\S+)\s*$/gm)].map(m => m[1])

const byName = new Map()
for (const pattern of globs) {
  for (const dir of globSync(pattern, { cwd: root })) {
    let manifest
    try {
      manifest = JSON.parse(readFileSync(path.join(root, dir, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    if (typeof manifest.name === 'string') byName.set(manifest.name, { dir, manifest })
  }
}

const seed = '@deepseek-ai/dsh'
if (!byName.has(seed)) throw new Error(`${seed} not found in the workspace`)
const reached = new Set([seed])
const queue = [seed]
while (queue.length > 0) {
  const { manifest } = byName.get(queue.shift())
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (!byName.has(name) || reached.has(name)) continue
      reached.add(name)
      queue.push(name)
    }
  }
}

const closureName = '@deepseek-ai/dsh-closure'
const dependencies = Object.fromEntries([...reached].sort().map(name => [name, 'workspace:^']))
const next = {
  name: closureName,
  private: true,
  version: '0.0.1',
  type: 'module',
  description:
    'Dependency-only deploy root: the dsh CLI plus every workspace package it reaches through dependencies and peer dependencies, so `pnpm deploy` of this package yields a tree that boots with plain Node. Regenerate with `node apps/closure/sync.mjs`. Not a build target.',
  dependencies,
}
const text = `${JSON.stringify(next, null, 2)}\n`
const file = path.join(here, 'package.json')
let current = ''
try {
  current = readFileSync(file, 'utf8')
} catch {}
if (process.argv.includes('--check')) {
  if (current !== text) {
    console.error('apps/closure/package.json is stale; run `node apps/closure/sync.mjs`.')
    process.exit(1)
  }
  console.log(`apps/closure/package.json is current (${reached.size} packages).`)
} else {
  writeFileSync(file, text)
  console.log(`apps/closure/package.json: ${reached.size} packages (${current === text ? 'unchanged' : 'updated'}).`)
}
