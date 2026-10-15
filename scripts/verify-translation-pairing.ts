/**
 * Reject Simplified Chinese documentation artifacts. Repository documentation
 * is English only: no `*.zh.md` counterparts and no `*.i18n.yaml` pairing records.
 */

import { globSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const found = ['**/*.zh.md', '**/*.i18n.yaml']
  .flatMap(pattern => globSync(pattern, { cwd: root, exclude: ['**/node_modules/**', '**/vendor/**'] }))
  .sort()

if (found.length > 0) {
  console.error('verify-translation-pairing: documentation is English only; remove:')
  for (const file of found) console.error(`  ${file}`)
  process.exit(1)
}

console.log('verify-translation-pairing: English-only documentation checked.')
