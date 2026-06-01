import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Fixes the broken marker pattern `{M}{/N}` where M = N+1.
 * Converts to the correct sequential form `{/N}{M}`.
 *
 * This is a conversion artifact where the opening of marker M
 * and the closing of marker N got swapped.
 */

const PATTERN = /\{(\d+)\}\{\/(\d+)\}/g

function fixFile(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8')
  let fixed = 0

  const result = content.replace(PATTERN, (match, m: string, n: string) => {
    const mNum = parseInt(m, 10)
    const nNum = parseInt(n, 10)
    if (mNum === nNum + 1) {
      fixed++
      return `{/${n}}{${m}}`
    }
    return match
  })

  if (fixed > 0) {
    writeFileSync(filePath, result, 'utf-8')
  }
  return fixed
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (entry.name.endsWith('.cham.md')) {
      results.push(fullPath)
    }
  }
  return results
}

export function fixSwappedMarkers(contentDir: string): void {
  const files = walkDir(contentDir)
  let totalFixed = 0
  let filesFixed = 0
  for (const f of files) {
    const count = fixFile(f)
    if (count > 0) {
      filesFixed++
      totalFixed += count
      console.log(`  Fixed ${count} patterns: ${f}`)
    }
  }
  console.log(`\nFixed ${totalFixed} swapped markers in ${filesFixed} of ${files.length} files.`)
}

const contentDir = process.argv[2]
if (!contentDir || !existsSync(contentDir)) {
  console.error('Usage: npx tsx src/fix-swapped-markers.ts <content-dir>')
  process.exit(1)
}
fixSwappedMarkers(contentDir)
